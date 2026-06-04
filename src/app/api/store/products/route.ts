import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";
import { stripe } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — public: list all products (admin sees all; store shows in_stock only via filter)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const onlyInStock = searchParams.get("in_stock") === "true";

  let query = supabase
    .from("store_products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (onlyInStock) query = query.eq("in_stock", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

// POST — admin: create product in DB + Stripe
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userIsAdmin = await isAdmin(userId);
  if (!userIsAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, description, price_cents, category, image_url } = body;

  if (!name || !price_cents || typeof price_cents !== "number") {
    return NextResponse.json({ error: "name and price_cents required" }, { status: 400 });
  }

  // Create Stripe Product + Price so it appears in Stripe dashboard
  const stripeProduct = await stripe.products.create({
    name,
    description: description ?? undefined,
    images: image_url ? [image_url] : undefined,
    metadata: { source: "zineground_store" },
  });

  const stripePrice = await stripe.prices.create({
    product: stripeProduct.id,
    unit_amount: price_cents,
    currency: "usd",
  });

  const { data, error } = await supabase
    .from("store_products")
    .insert({
      name,
      description: description ?? null,
      price_cents,
      category: category ?? null,
      image_url: image_url ?? null,
      in_stock: true,
      stripe_product_id: stripeProduct.id,
      stripe_price_id: stripePrice.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data }, { status: 201 });
}
