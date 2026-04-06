import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { createCheckoutSession } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Tiered shipping rates based on total copies ordered.
 * Covers standard USPS/carrier costs for zine shipments.
 */
export function calculateShippingCost(totalQuantity: number): number {
  if (totalQuantity <= 10) return 5.0;
  if (totalQuantity <= 25) return 8.0;
  if (totalQuantity <= 50) return 12.0;
  if (totalQuantity <= 100) return 18.0;
  if (totalQuantity <= 200) return 25.0;
  if (totalQuantity <= 500) return 40.0;
  return 60.0;
}

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

    // Calculate total quantity across all items
    const totalQuantity: number = (order.items ?? []).reduce(
      (sum: number, item: { quantity: number }) => sum + item.quantity,
      0
    );

    const shippingCost = calculateShippingCost(totalQuantity);

    const appOrigin =
      typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
      process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
        : "http://localhost:3000";

    const session = await createCheckoutSession(
      shippingCost,
      "usd",
      {
        orderId: order.id,
        distributorId: distributor.id,
        type: "distributor_shipping",
      },
      `${appOrigin}/dashboard/distributor?payment=success&orderId=${order.id}`,
      `${appOrigin}/dashboard/distributor?payment=cancelled`
    );

    // Update order with checkout session ID and computed shipping cost
    await supabase
      .from("distributor_orders")
      .update({
        stripe_checkout_session_id: session.id,
        shipping_cost: shippingCost,
      })
      .eq("id", orderId);

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      shippingCost,
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
