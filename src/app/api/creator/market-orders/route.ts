import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateProfileId } from "@/lib/profile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/creator/market-orders
 * List market order items for the current user (as creator/seller).
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profileId = await getOrCreateProfileId(userId);

    const { data: creator } = await supabase
      .from("market_creators")
      .select("id")
      .eq("profile_id", profileId)
      .eq("status", "approved")
      .maybeSingle();

    if (!creator) {
      return NextResponse.json({ items: [] });
    }

    const { data: items, error } = await supabase
      .from("market_order_items")
      .select("id, market_order_id, category_key, price_cents, status, deliverable_url, created_at")
      .eq("market_creator_id", creator.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ items: [] });
    }

    const orderIds = [...new Set((items || []).map((i) => i.market_order_id))];
    const ordersLookup: Record<string, { createdAt: string; buyerProfileId: string }> = {};
    const buyerProfileIds: string[] = [];
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from("market_orders")
        .select("id, buyer_profile_id, created_at")
        .in("id", orderIds);
      for (const o of orders || []) {
        ordersLookup[o.id] = { createdAt: o.created_at, buyerProfileId: o.buyer_profile_id };
        buyerProfileIds.push(o.buyer_profile_id);
      }
    }

    const profileIdToEmail: Record<string, string | null> = {};
    if (buyerProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", [...new Set(buyerProfileIds)]);
      for (const p of profiles || []) {
        profileIdToEmail[p.id] = p.email ?? null;
      }
    }

    const result = (items || []).map((i) => {
      const ord = ordersLookup[i.market_order_id];
      return {
        id: i.market_order_id,
        itemId: i.id,
        categoryKey: i.category_key,
        priceCents: i.price_cents,
        status: i.status,
        deliverableUrl: i.deliverable_url,
        orderCreatedAt: ord?.createdAt ?? i.created_at,
        buyerEmail: ord ? profileIdToEmail[ord.buyerProfileId] ?? null : null,
      };
    });

    return NextResponse.json({ items: result });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
