import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getSiteBaseUrl } from "@/lib/site-url";
import { stripe } from "@/lib/stripe";
import { MAX_CART_LINES, MAX_LINE_QUANTITY, type StoreCartEntry } from "@/lib/store";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("session_id") ?? "";
  const response = (body: object, status = 200) => NextResponse.json(body, {
    status, headers: { "Cache-Control": "private, no-store" },
  });
  if (!/^cs_(?:live|test)_[a-zA-Z0-9]{12,120}$/.test(id)) return response({ error: "Invalid checkout reference." }, 400);

  try {
    const session = await stripe.checkout.sessions.retrieve(id);
    const orderId = session.metadata?.orderId;
    if (!orderId || session.metadata?.type !== "store_order") return response({ error: "Order not found." }, 404);
    const { data, error } = await supabase.from("store_orders").select("status").eq("id", orderId).eq("stripe_session_id", id).maybeSingle();
    if (error) throw error;
    if (!data) return response({ error: "Order not found." }, 404);
    const status = session.payment_status === "paid" ? "paid"
      : session.status === "complete" && data.status === "pending" ? "processing" : "incomplete";
    return response({ status, orderId });
  } catch {
    return response({ error: "Couldn’t verify this checkout." }, 503);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input: unknown = body?.items;
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_CART_LINES) {
    return NextResponse.json({ error: "Add products to your cart before checking out." }, { status: 400 });
  }

  const quantities = new Map<string, number>();
  for (const item of input) {
    if (typeof item?.productId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(item.productId)
      || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_LINE_QUANTITY) {
      return NextResponse.json({ error: "Your cart contains an invalid item." }, { status: 400 });
    }
    const id = item.productId.toLowerCase();
    const quantity = (quantities.get(id) ?? 0) + item.quantity;
    if (quantity > MAX_LINE_QUANTITY) return NextResponse.json({ error: `Each item has a limit of ${MAX_LINE_QUANTITY}.` }, { status: 400 });
    quantities.set(id, quantity);
  }

  let orderId: string | undefined;
  let sessionId: string | undefined;
  try {
    const { userId } = await auth();
    const { data, error } = await supabase.from("store_products")
      .select("id,name,price_cents,stripe_price_id,in_stock").in("id", [...quantities.keys()]);
    if (error) throw error;

    const products = new Map(data.map((product) => [product.id, product]));
    const items: StoreCartEntry[] = [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
    const unavailable = items.find(({ productId }) => {
      const product = products.get(productId);
      return !product?.in_stock || !Number.isSafeInteger(product.price_cents) || product.price_cents <= 0;
    });
    if (unavailable) {
      const name = products.get(unavailable.productId)?.name;
      return NextResponse.json({ error: name ? `${name} is unavailable.` : "A product in your cart is unavailable." }, { status: 409 });
    }

    const orderItems = items.map(({ productId, quantity }) => {
      const product = products.get(productId)!;
      return { product_id: productId, product_name: product.name, price_cents: product.price_cents, quantity };
    });
    const totalCents = orderItems.reduce((total, item) => total + item.price_cents * item.quantity, 0);

    const { data: order, error: orderError } = await supabase.from("store_orders")
      .insert({ clerk_user_id: userId ?? null, status: "pending", total_cents: totalCents })
      .select("id").single();
    if (orderError) throw orderError;
    orderId = order.id as string;

    const { error: itemError } = await supabase.from("store_order_items").insert(orderItems.map((item) => ({ ...item, order_id: orderId })));
    if (itemError) throw itemError;

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || getSiteBaseUrl()).replace(/\/+$/, "");
    const session = await stripe.checkout.sessions.create({
      line_items: orderItems.map((item) => {
        const product = products.get(item.product_id)!;
        return product.stripe_price_id ? { price: product.stripe_price_id, quantity: item.quantity } : {
          price_data: { currency: "usd", unit_amount: item.price_cents, product_data: { name: item.product_name } },
          quantity: item.quantity,
        };
      }),
      mode: "payment",
      shipping_address_collection: { allowed_countries: ["US"] },
      success_url: `${baseUrl}/store?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/store?order=cancelled`,
      client_reference_id: orderId,
      metadata: { orderId, type: "store_order" },
    });
    sessionId = session.id;
    if (!session.url || session.amount_subtotal !== totalCents || session.currency !== "usd") throw new Error("Stripe session did not match the order");

    const { error: sessionError } = await supabase.from("store_orders").update({ stripe_session_id: session.id }).eq("id", orderId);
    if (sessionError) throw sessionError;
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (sessionId) await stripe.checkout.sessions.expire(sessionId).catch(() => {
      console.error("[StoreCheckout] Could not expire unreturned session", sessionId);
    });
    if (orderId) {
      const { error } = await supabase.from("store_orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending");
      if (error) console.error("[StoreCheckout] Could not cancel incomplete order", orderId, error.code);
    }
    console.error("[StoreCheckout]", error instanceof Error ? error.message : "Order persistence failed");
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Try again." }, { status: 503 });
  }
}
