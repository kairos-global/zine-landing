import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { createCheckoutSession } from "@/lib/stripe";
import { calculateShippingCost, DISTRIBUTOR_SERVICE_FEE } from "@/lib/shipping";

/**
 * NOTE: This route is no longer used in the primary order flow (v2).
 * Orders now collect the card via a Setup Checkout (distributors/orders POST)
 * and charge automatically via billing.ts once creators approve.
 *
 * This route is kept as a manual fallback for admin use or legacy orders.
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/payments/distributor-checkout
 * Create Stripe Checkout session for distributor order shipping.
 * Shipping cost is quantity-based (tiered), not a flat fee.
 * Body: { orderId: string }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { orderId } = body as { orderId: string };

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    // Verify order exists and belongs to distributor
    const { data: distributor } = await supabase
      .from("distributors")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!distributor) {
      return NextResponse.json(
        { error: "Distributor not found" },
        { status: 404 }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("distributor_orders")
      .select(`
        *,
        items:distributor_order_items(
          quantity,
          issue:issues(id, title)
        )
      `)
      .eq("id", orderId)
      .eq("distributor_id", distributor.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Prevent double-payment: reject if already paid or already placed
    if (order.payment_status === "paid" || order.status === "placed") {
      return NextResponse.json(
        { error: "This order has already been paid." },
        { status: 400 }
      );
    }

    if (order.status === "cancelled" || order.status === "fulfilled") {
      return NextResponse.json(
        { error: "This order cannot be paid — it is " + order.status + "." },
        { status: 400 }
      );
    }

    // Calculate total quantity across all items
    const totalQuantity: number = (order.items ?? []).reduce(
      (sum: number, item: { quantity: number }) => sum + item.quantity,
      0
    );

    const shippingCost = calculateShippingCost(totalQuantity);
    // Total charge = tiered shipping + flat $0.50 service fee
    const totalCharge = shippingCost + DISTRIBUTOR_SERVICE_FEE;

    const appOrigin =
      typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
      process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
        : "http://localhost:3000";

    const session = await createCheckoutSession(
      totalCharge,
      "usd",
      {
        orderId: order.id,
        distributorId: distributor.id,
        type: "distributor_shipping",
      },
      `${appOrigin}/dashboard/distributor?payment=success&orderId=${order.id}`,
      `${appOrigin}/dashboard/distributor?payment=cancelled`
    );

    // Save total charge (shipping + service fee) as shipping_cost on the order
    await supabase
      .from("distributor_orders")
      .update({
        stripe_checkout_session_id: session.id,
        shipping_cost: totalCharge,
      })
      .eq("id", orderId);

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      shippingCost: totalCharge,
      totalQuantity,
    });
  } catch (err) {
    console.error("[DistributorCheckout] Error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
