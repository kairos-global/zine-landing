import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateProfileId } from "@/lib/profile";
import { MARKET_CATEGORIES } from "@/lib/market-categories";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/market/me/stats
 * Per-category order stats for the current creator (total, accepted, declined, completed).
 * Used in Sell section "History" column. Returns 0s if market_order_items doesn't exist yet.
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
      .maybeSingle();

    const byCategory: Record<
      string,
      { total: number; accepted: number; declined: number; completed: number }
    > = {};
    for (const c of MARKET_CATEGORIES) {
      byCategory[c.key] = { total: 0, accepted: 0, declined: 0, completed: 0 };
    }

    if (!creator) {
      return NextResponse.json({ byCategory });
    }

    const { data: items, error } = await supabase
      .from("market_order_items")
      .select("category_key, status")
      .eq("market_creator_id", creator.id);

    if (error) {
      return NextResponse.json({ byCategory });
    }

    for (const row of items || []) {
      const key = row.category_key;
      if (!byCategory[key]) byCategory[key] = { total: 0, accepted: 0, declined: 0, completed: 0 };
      byCategory[key].total += 1;
      if (row.status === "accepted") byCategory[key].accepted += 1;
      else if (row.status === "declined") byCategory[key].declined += 1;
      else if (row.status === "completed") byCategory[key].completed += 1;
    }

    return NextResponse.json({ byCategory });
  } catch {
    const empty: Record<string, { total: number; accepted: number; declined: number; completed: number }> = {};
    for (const c of MARKET_CATEGORIES) {
      empty[c.key] = { total: 0, accepted: 0, declined: 0, completed: 0 };
    }
    return NextResponse.json({ byCategory: empty });
  }
}
