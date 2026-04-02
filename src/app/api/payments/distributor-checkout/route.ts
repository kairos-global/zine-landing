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

    // Distributors only pay shipping (not printing). Flat $10 until we integrate real shipping.
    const SHIPPING_FLAT_CENTS = 1000; // $10.00
    const shippingCost = SHIPPING_FLAT_CENTS / 100;

    // Use origin only so redirect goes to /dashboard/distributor, not /api/.../dashboard/distributor
    const appOrigin =
      typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL
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

