import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { createCheckoutSession } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/payments/distributor-checkout
 * Create Stripe Checkout session for distributor order shipping
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

    // Calculate shipping cost
    // TODO: Implement actual shipping calculation based on:
    // - Total quantity of items
    // - Distributor location
    // - Weight/size of zines
    // For now, using a simple flat rate: $5 base + $2 per item
    const baseShipping = 5.0;
    const perItemShipping = 2.0;
    const totalItems = (order.items as Array<{ quantity: number }>).reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    const shippingCost = baseShipping + perItemShipping * totalItems;

    // Create Stripe Checkout session
    const session = await createCheckoutSession(
      shippingCost,
      "usd",
      {
        orderId: order.id,
        distributorId: distributor.id,
        type: "distributor_shipping",
      },
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/distributor?payment=success&orderId=${order.id}`,
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/distributor?payment=cancelled`
    );

    // Update order with checkout session ID and shipping cost
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
    });
  } catch (err) {
    console.error("[DistributorCheckout] Error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

