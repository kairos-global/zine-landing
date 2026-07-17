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
import { getRates, pickRate, buyLabel, type ShippoAddress, type ShippoRate } from "./shippo";

/** Distributor row fields needed to build a Shippo destination address. */
type DistributorShipFields = {
  business_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  ship_street1?: string | null;
  ship_street2?: string | null;
  ship_city?: string | null;
  ship_state?: string | null;
  ship_zip?: string | null;
  ship_country?: string | null;
};

/** Build a Shippo destination address from a distributor, or null if not verified. */
function buildToAddress(d: DistributorShipFields): ShippoAddress | null {
  if (!d.ship_street1 || !d.ship_city || !d.ship_country) return null;
  return {
    name: d.business_name || undefined,
    street1: d.ship_street1,
    street2: d.ship_street2 || undefined,
    city: d.ship_city,
    state: d.ship_state || "",
    zip: d.ship_zip || "",
    country: d.ship_country,
    email: d.contact_email || undefined,
    phone: d.contact_phone || undefined,
  };
}

/**
 * processCreatorPayment
 *
 * Called when a creator returns from Stripe Checkout (success URL) or when
 * the admin force-finalizes. Retrieves the session from Stripe directly —
 * no webhook required. Marks the payment row paid and triggers billing.
 */
export async function processCreatorPayment(
  sessionId: string,
  supabase: SupabaseClient
): Promise<void> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    console.log(`[processCreatorPayment] Session ${sessionId} not yet paid (status: ${session.payment_status})`);
    return;
  }

  const { data: row } = await supabase
    .from("creator_print_payments")
    .select("id, payment_status, distributor_order_item_id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (!row) {
    console.error(`[processCreatorPayment] No payment row found for session ${sessionId}`);
    return;
  }

  if (row.payment_status !== "paid") {
    const { error } = await supabase
      .from("creator_print_payments")
      .update({
        payment_status: "paid",
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq("id", row.id);

    if (error) {
      console.error("[processCreatorPayment] Failed to mark payment paid:", error);
      throw error;
    }

    console.log(`[processCreatorPayment] Marked paid. rowId=${row.id} sessionId=${sessionId}`);
  }

  await checkAndFinalizeOrder(String(row.distributor_order_item_id), supabase);
}

/**
 * processDistributorSetup
 *
 * Called when the distributor returns from Stripe Setup Checkout (success URL).
 * Retrieves the setup session directly from Stripe, saves the payment method to
 * the order, then attempts to finalize the order synchronously.
 */
export async function processDistributorSetup(
  sessionId: string,
  supabase: SupabaseClient
): Promise<void> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.status !== "complete") {
    console.log(`[processDistributorSetup] Session ${sessionId} not complete (status: ${session.status})`);
    return;
  }

  if (!session.setup_intent) {
    console.error(`[processDistributorSetup] Session ${sessionId} has no setup_intent`);
    return;
  }

  const setupIntent = await stripe.setupIntents.retrieve(session.setup_intent as string);
  const paymentMethodId = setupIntent.payment_method as string;

  if (!paymentMethodId) {
    console.error(`[processDistributorSetup] No payment method on setup intent ${session.setup_intent}`);
    return;
  }

  const { data: order } = await supabase
    .from("distributor_orders")
    .select("id, distributor_order_items(id)")
    .eq("stripe_setup_session_id", sessionId)
    .maybeSingle();

  if (!order) {
    console.error(`[processDistributorSetup] No order found for session ${sessionId}`);
    return;
  }

  const { error } = await supabase
    .from("distributor_orders")
    .update({ stripe_payment_method_id: paymentMethodId })
    .eq("id", order.id);

  if (error) {
    console.error("[processDistributorSetup] Failed to save payment method:", error);
    throw error;
  }

  console.log(`[processDistributorSetup] Payment method saved. orderId=${order.id} method=${paymentMethodId}`);

  const items = order.distributor_order_items as Array<{ id: string }> | null;
  if (items && items.length > 0) {
    await checkAndFinalizeOrder(String(items[0].id), supabase);
  }
}

/**
 * processStoreOrder
 *
 * Called on store checkout return (verify-on-return) and as a webhook backup.
 * Marks the store order paid (idempotent) and buys the shipping label for the
 * rate the customer already paid for. Buying the label is also idempotent —
 * it's skipped if a transaction already exists.
 */
export async function processStoreOrder(
  sessionId: string,
  supabase: SupabaseClient
): Promise<void> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    console.log(`[processStoreOrder] Session ${sessionId} not paid (${session.payment_status})`);
    return;
  }

  const { data: order } = await supabase
    .from("store_orders")
    .select("id, status, shippo_rate_id, shippo_transaction_id")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (!order) {
    console.error(`[processStoreOrder] No store order for session ${sessionId}`);
    return;
  }

  if (order.status !== "paid" && order.status !== "fulfilled") {
    const { error } = await supabase
      .from("store_orders")
      .update({
        status: "paid",
        stripe_payment_intent_id: session.payment_intent as string,
        total_cents: session.amount_total ?? undefined,
      })
      .eq("id", order.id);
    if (error) {
      console.error("[processStoreOrder] Failed to mark paid:", error);
      throw error;
    }
    console.log(`[processStoreOrder] Order ${order.id} marked paid.`);
  }

  // Buy the label once. Non-fatal on failure — the order is paid; admin can
  // buy a label manually from the Shippo dashboard or re-trigger.
  if (order.shippo_rate_id && !order.shippo_transaction_id) {
    try {
      const label = await buyLabel(order.shippo_rate_id);
      await supabase
        .from("store_orders")
        .update({
          shippo_transaction_id: label.transactionId,
          shippo_label_url: label.labelUrl,
          tracking_number: label.trackingNumber || null,
        })
        .eq("id", order.id);
      console.log(`[processStoreOrder] Order ${order.id}: label purchased, tracking ${label.trackingNumber}`);
    } catch (labelErr) {
      console.error(`[processStoreOrder] Order ${order.id}: label purchase failed:`, labelErr);
    }
  }
}

type IssueRef = { print_for_me: boolean } | null;
type OrderItemRow = {
  id: string;
  quantity: number;
  creator_approval_status: string;
  issue: IssueRef;
};

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
    .select("id, status, stripe_payment_method_id, distributor_id, shipping_carrier, shipping_service, delivery_method")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== "pending_creator_approval") return;

  // Get all items in this order with their issue's print_for_me flag
  const { data: allItems } = await supabase
    .from("distributor_order_items")
    .select("id, quantity, creator_approval_status, issue:issues(print_for_me)")
    .eq("order_id", orderId);

  if (!allItems || allItems.length === 0) return;

  // Cast through unknown: Supabase infers the joined field as an array type
  // without schema types, but at runtime it's always a single object or null.
  const items = allItems as unknown as OrderItemRow[];

  // Check if every item is resolved
  for (const item of items) {
    const status = item.creator_approval_status;

    if (status === "rejected") continue; // resolved — creator said no

    if (status === "pending_approval") return; // still waiting

    // approved or auto_approved
    const isPrintForMe = item.issue?.print_for_me === true;

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
  const approvedPrintItems = items.filter(
    (i) =>
      i.creator_approval_status !== "rejected" &&
      i.issue?.print_for_me === true
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

  // Local delivery: free. No card, no charge, no label — just confirm the order.
  if (order.delivery_method === "local") {
    console.log(`[AutoBill] Order ${orderId}: local delivery, confirming free.`);
    await supabase
      .from("distributor_orders")
      .update({ status: "placed", payment_status: "paid", shipping_cost: 0 })
      .eq("id", orderId);
    return;
  }

  // Get the distributor's Stripe customer ID + structured shipping address
  const { data: distributor } = await supabase
    .from("distributors")
    .select(
      "stripe_customer_id, business_name, contact_email, contact_phone, ship_street1, ship_street2, ship_city, ship_state, ship_zip, ship_country"
    )
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

  // Determine shipping cost. Prefer a live Shippo re-quote for the actually-
  // approved copies (rate timing = re-fetch at finalize); fall back to the
  // tiered estimate if the distributor has no verified address or Shippo errors.
  let shippingCost = calculateShippingCost(totalQty);
  let chosenRate: ShippoRate | null = null;
  const toAddress = buildToAddress(distributor);
  if (toAddress) {
    try {
      const { rates } = await getRates(toAddress, totalQty);
      const rate = pickRate(rates, order.shipping_carrier, order.shipping_service);
      if (rate) {
        shippingCost = parseFloat(rate.amount);
        chosenRate = rate;
      }
    } catch (rateErr) {
      console.error(
        `[AutoBill] Order ${orderId}: Shippo re-quote failed, using tier fallback:`,
        rateErr
      );
    }
  }

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

      // Buy the actual shipping label now that payment succeeded. The label/
      // tracking auto-populate the order (tracking_number stays an admin
      // override). A label failure is non-fatal — the charge already went
      // through, so we log it and leave the label for manual admin purchase.
      if (chosenRate) {
        try {
          const label = await buyLabel(chosenRate.object_id);
          await supabase
            .from("distributor_orders")
            .update({
              shippo_transaction_id: label.transactionId,
              shippo_label_url: label.labelUrl,
              tracking_number: label.trackingNumber || null,
              shipping_carrier: chosenRate.provider,
              shipping_service: chosenRate.servicelevel.token,
            })
            .eq("id", orderId);
          console.log(
            `[AutoBill] Order ${orderId}: label purchased, tracking ${label.trackingNumber}`
          );
        } catch (labelErr) {
          console.error(
            `[AutoBill] Order ${orderId}: label purchase failed (charge succeeded). Admin can buy manually:`,
            labelErr
          );
        }
      }
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
