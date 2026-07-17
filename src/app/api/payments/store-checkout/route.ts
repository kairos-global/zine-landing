import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type CartItem = { productId: string; quantity: number };
type ShipAddress = {
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};
type SelectedRate = {
  rateId: string;
  amount: string;
  provider: string;
  service: string;
  serviceToken: string;
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    const body = await req.json();
    const items: CartItem[] = body.items;
    const address: ShipAddress = body.address ?? {};
    const selectedRate: SelectedRate | null = body.selectedRate ?? null;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    if (!address.street1 || !address.city || !address.zip || !address.country) {
      return NextResponse.json({ error: "Shipping address is incomplete" }, { status: 400 });
    }

    if (!selectedRate) {
      return NextResponse.json({ error: "A shipping option is required" }, { status: 400 });
    }

    // Validate quantities
    for (const item of items) {
      if (!item.productId || item.quantity < 1) {
        return NextResponse.json({ error: "Invalid cart item" }, { status: 400 });
      }
    }

    // Fetch all products from DB
    const { data: products, error: productError } = await supabase
      .from("store_products")
      .select("id, name, price_cents, stripe_price_id, in_stock")
      .in("id", items.map((i) => i.productId));

    if (productError || !products) {
      return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
    }

    // Validate stock
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return NextResponse.json({ error: `Product not found` }, { status: 400 });
      }
      if (!product.in_stock) {
        return NextResponse.json({ error: `${product.name} is out of stock` }, { status: 400 });
      }
    }

    // Build Stripe line items — prefer saved stripe_price_id, fall back to price_data
    const lineItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      if (product.stripe_price_id) {
        return { price: product.stripe_price_id, quantity: item.quantity };
      }
      return {
        price_data: {
          currency: "usd",
          unit_amount: product.price_cents,
          product_data: { name: product.name },
        },
        quantity: item.quantity,
      };
    });

    const productCents = items.reduce((sum, item) => {
      const p = products.find((p) => p.id === item.productId)!;
      return sum + p.price_cents * item.quantity;
    }, 0);
    const shippingCents = Math.round(Number(selectedRate.amount) * 100);
    const totalCents = productCents + shippingCents;

    // Store the address in the shape the admin orders page already renders.
    const shippingAddress = {
      line1: address.street1,
      line2: address.street2 || null,
      city: address.city,
      state: address.state || null,
      postal_code: address.zip,
      country: address.country,
    };

    // Create pending order record
    const { data: order, error: orderError } = await supabase
      .from("store_orders")
      .insert({
        clerk_user_id: userId ?? null,
        status: "pending",
        total_cents: totalCents,
        shipping_name: address.name || null,
        shipping_address: shippingAddress,
        shippo_rate_id: selectedRate.rateId,
        shipping_carrier: selectedRate.provider,
        shipping_service: selectedRate.serviceToken,
        shipping_cost_cents: shippingCents,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    // Create order items
    await supabase.from("store_order_items").insert(
      items.map((item) => {
        const p = products.find((p) => p.id === item.productId)!;
        return {
          order_id: order.id,
          product_id: item.productId,
          product_name: p.name,
          price_cents: p.price_cents,
          quantity: item.quantity,
        };
      })
    );

    // Add the live shipping rate the customer picked as its own line item, so
    // the amount charged matches the real carrier rate.
    lineItems.push({
      price_data: {
        currency: "usd",
        unit_amount: shippingCents,
        product_data: { name: `Shipping — ${selectedRate.provider} ${selectedRate.service}` },
      },
      quantity: 1,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://zineground.com";

    // We already collected + quoted the shipping address ourselves, so we don't
    // let Stripe re-collect it (that would let the destination drift from the
    // address we rated). success_url carries the session id for verify-on-return.
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${baseUrl}/store?order=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/store?order=cancelled`,
      metadata: { orderId: order.id, type: "store_order" },
    });

    // Save session ID to order
    await supabase
      .from("store_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[StoreCheckout]", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
