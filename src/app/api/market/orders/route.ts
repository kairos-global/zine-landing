import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateProfileId } from "@/lib/profile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/market/orders
 * List current user's market orders (as buyer).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profileId = await getOrCreateProfileId(userId);

    const { data: orders, error } = await supabase
      .from("market_orders")
      .select("id, status, total_cents, created_at")
      .eq("buyer_profile_id", profileId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ orders: [] });
    }

    const ordersWithItems = await Promise.all(
      (orders || []).map(async (order) => {
        const { data: items } = await supabase
          .from("market_order_items")
          .select("id, category_key, price_cents, status, deliverable_url")
          .eq("market_order_id", order.id);
        return {
          id: order.id,
          status: order.status,
          totalCents: order.total_cents,
          createdAt: order.created_at,
          items: items || [],
        };
      })
    );

    return NextResponse.json({ orders: ordersWithItems });
  } catch {
    return NextResponse.json({ orders: [] });
  }
}

/**
 * POST /api/market/orders
 * Create a market order from cart. Body: { items: Array<{ marketCreatorId, categoryKey, priceCents }> }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profileId = await getOrCreateProfileId(userId);

    const body = await req.json();
    const items = body.items as Array<{ marketCreatorId: string; categoryKey: string; priceCents: number }>;
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array required" }, { status: 400 });
    }

    const totalCents = items.reduce((s, i) => s + (i.priceCents || 0), 0);

    const { data: order, error: orderError } = await supabase
      .from("market_orders")
      .insert({
        buyer_profile_id: profileId,
        status: "placed",
        total_cents: totalCents,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("[Market orders] Create error:", orderError);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    const rows = items.map((i) => ({
      market_order_id: order.id,
      market_creator_id: i.marketCreatorId,
      category_key: i.categoryKey,
      price_cents: i.priceCents,
      status: "pending",
    }));

    const { error: itemsError } = await supabase.from("market_order_items").insert(rows);
    if (itemsError) {
      console.error("[Market orders] Items insert error:", itemsError);
      await supabase.from("market_orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Failed to create order items" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: { id: order.id, status: order.status, totalCents: order.total_cents, createdAt: order.created_at },
    });
  } catch (err) {
    console.error("[Market orders] POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
