import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";
import { stripe } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userIsAdmin = await isAdmin(userId);
  if (!userIsAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, description, price_cents, category, image_url, in_stock, sort_order } = body;

  const { data: existing } = await supabase
    .from("store_products")
    .select("stripe_product_id, stripe_price_id")
    .eq("id", id)
    .single();

  // Sync name/description/image to Stripe Product
  if (
    existing?.stripe_product_id &&
    (name !== undefined || description !== undefined || image_url !== undefined)
  ) {
    await stripe.products
      .update(existing.stripe_product_id, {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description ?? "" }),
        ...(image_url !== undefined && { images: image_url ? [image_url] : [] }),
      })
      .catch(() => {});
  }

  // If price changed, create a new Stripe Price and archive the old one
  let newStripepriceId = existing?.stripe_price_id;
  if (price_cents !== undefined && existing?.stripe_product_id) {
    const newPrice = await stripe.prices.create({
      product: existing.stripe_product_id,
      unit_amount: price_cents,
      currency: "usd",
    });
    if (existing.stripe_price_id) {
      await stripe.prices
        .update(existing.stripe_price_id, { active: false })
        .catch(() => {});
    }
    newStripepriceId = newPrice.id;
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (price_cents !== undefined) {
    updateData.price_cents = price_cents;
    updateData.stripe_price_id = newStripepriceId;
  }
  if (category !== undefined) updateData.category = category;
  if (image_url !== undefined) updateData.image_url = image_url;
  if (in_stock !== undefined) updateData.in_stock = in_stock;
  if (sort_order !== undefined) updateData.sort_order = sort_order;

  const { data, error } = await supabase
    .from("store_products")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userIsAdmin = await isAdmin(userId);
  if (!userIsAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const { data: existing } = await supabase
    .from("store_products")
    .select("stripe_product_id, stripe_price_id")
    .eq("id", id)
    .single();

  // Archive in Stripe (can't delete products that have had orders)
  if (existing?.stripe_price_id) {
    await stripe.prices.update(existing.stripe_price_id, { active: false }).catch(() => {});
  }
  if (existing?.stripe_product_id) {
    await stripe.products.update(existing.stripe_product_id, { active: false }).catch(() => {});
  }

  const { error } = await supabase.from("store_products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
