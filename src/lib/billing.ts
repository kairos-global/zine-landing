/**
 * checkAndFinalizeOrder
 *
 * Called every time a creator approves, rejects, or pays for their items.
 * Checks whether all items in the parent distributor order are "resolved", and if so,
 * auto-bills the distributor's saved card for the confirmed print_for_me copies.
 *
 * An item is "resolved" when:
 *   - creator_approval_status === 'rejected'  (creator said no)
 *   - creator_approval_status === 'approved' or 'auto_approved'  AND
 *       - the issue is print_for_me → a paid creator_print_payments row exists
 *       - the issue is self_distribute → no payment needed, just the decision
 *
 * Once all items are resolved:
 *   - If 0 approved print_for_me copies → cancel the order
 *   - Otherwise → charge the distributor's saved Stripe card
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "./stripe";
import { calculateShippingCost, DISTRIBUTOR_SERVICE_FEE } from "./shipping";

export async function checkAndFinalizeOrder(
  orderItemId: string,
  supabase: SupabaseClient
): Promise<void> {
  // Get the order this item belongs to
  const { data: triggerItem } = await supabase
    .from("distributor_order_items")
    .select("order_id")
    .eq("id", orderItemId)
    .single();

  if (!triggerItem?.order_id) return;
  const orderId = triggerItem.order_id;

  // Get the order — only act on orders waiting for creator approvals
  const { data: order } = await supabase
    .from("distributor_orders")
    .select("id, status, stripe_payment_method_id, distributor_id")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== "pending_creator_approval") return;

  // Get all items in this order with their issue's print_for_me flag
  const { data: allItems } = await supabase
    .from("distributor_order_items")
    .select("id, quantity, creator_approval_status, issue:issues(print_for_me)")
    .eq("order_id", orderId);

  if (!allItems || allItems.length === 0) return;

  // Check if every item is resolved
  for (const item of allItems) {
    const status = item.creator_approval_status;

    if (status === "rejected") continue; // resolved — creator said no

    if (status === "pending_approval") return; // still waiting

    // approved or auto_approved
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isPrintForMe = (item.issue as any)?.print_for_me === true;

    if (isPrintForMe) {
      // Need creator to have paid before we bill the distributor
      const { data: payment } = await supabase
        .from("creator_print_payments")
        .select("payment_status")
        .eq("distributor_order_item_id", item.id)
        .eq("payment_status", "paid")
        .maybeSingle();

      if (!payment) return; // creator hasn't paid for this item yet
    }
    // self_distribute approved items need no payment → resolved
  }

  // All items are resolved. Calculate final approved print_for_me quantity.
  const approvedPrintItems = allItems.filter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i) =>
      i.creator_approval_status !== "rejected" &&
      (i.issue as any)?.print_for_me === true
  );
  const totalQty = approvedPrintItems.reduce(
    (s: number, i: { quantity: number }) => s + i.quantity,
    0
  );

  if (totalQty === 0) {
    // All print_for_me items were rejected (or none existed) — cancel, no charge
    console.log(`[AutoBill] Order ${orderId}: all rejected, cancelling.`);
    await supabase
      .from("distributor_orders")
      .update({ status: "cancelled" })
      .eq("id", orderId);
    return;
  }

  // Get the distributor's Stripe customer ID
  const { data: distributor } = await supabase
    .from("distributors")
    .select("stripe_customer_id")
    .eq("id", order.distributor_id)
    .single();

  if (!distributor?.stripe_customer_id || !order.stripe_payment_method_id) {
    console.error(
      `[AutoBill] Order ${orderId}: missing Stripe payment info. customer=${distributor?.stripe_customer_id}, method=${order.stripe_payment_method_id}`
    );
    // Can't charge — mark so admin can intervene
    await supabase
      .from("distributor_orders")
      .update({ payment_status: "failed" })
      .eq("id", orderId);
    return;
  }

  const shippingCost = calculateShippingCost(totalQty);
  const totalCharge = shippingCost + DISTRIBUTOR_SERVICE_FEE;

  console.log(
    `[AutoBill] Order ${orderId}: ${totalQty} copies → charging $${totalCharge}`
  );

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalCharge * 100),
      currency: "usd",
      customer: distributor.stripe_customer_id,
      payment_method: order.stripe_payment_method_id,
      confirm: true,
      off_session: true,
      metadata: {
        orderId: order.id,
        type: "distributor_shipping",
      },
    });

    if (
      paymentIntent.status === "succeeded" ||
      paymentIntent.status === "processing"
    ) {
      await supabase
        .from("distributor_orders")
        .update({
          status: "placed",
          payment_status: "paid",
          shipping_cost: totalCharge,
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("id", orderId);
      console.log(`[AutoBill] Order ${orderId}: charged successfully.`);
    } else {
      await supabase
        .from("distributor_orders")
        .update({
          payment_status: "failed",
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("id", orderId);
      console.error(
        `[AutoBill] Order ${orderId}: unexpected PaymentIntent status: ${paymentIntent.status}`
      );
    }
  } catch (stripeErr: unknown) {
    // Card declined, 3DS required, etc.
    console.error(`[AutoBill] Order ${orderId}: Stripe charge failed:`, stripeErr);
    await supabase
      .from("distributor_orders")
      .update({ payment_status: "failed" })
      .eq("id", orderId);
    // Don't re-throw — the webhook should still return 200 so Stripe doesn't retry
    // creator payment events. The billing failure is logged for admin to handle.
  }
}
