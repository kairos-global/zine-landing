import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MARKET_CATEGORIES } from "@/lib/market-categories";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const validKeys = new Set<string>(MARKET_CATEGORIES.map((c) => c.key));

/**
 * GET /api/market/categories/[categoryKey]/creators
 * List creators who sell this service (enabled + price between $10–$200).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ categoryKey: string }> }
) {
  const { categoryKey } = await params;
  if (!validKeys.has(categoryKey)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const { data: rows, error } = await supabase
    .from("market_creator_services")
    .select("market_creator_id, price_cents, market_creators!inner(profile_id, profiles(email))")
    .eq("category_key", categoryKey)
    .eq("enabled", true)
    .not("price_cents", "is", null)
    .gte("price_cents", 1000)
    .lte("price_cents", 20000);

  if (error) {
    console.error("[Market creators] Error:", error);
    return NextResponse.json({ creators: [] });
  }

  const creators = (rows || []).map((r: Record<string, unknown>) => {
    const mc = r.market_creators as { profiles?: { email?: string } | { email?: string }[] } | null;
    const prof = mc?.profiles;
    const email = Array.isArray(prof) ? prof[0]?.email : (prof as { email?: string })?.email;
    return {
      marketCreatorId: r.market_creator_id,
      email: email ?? null,
      priceCents: r.price_cents,
    };
  });

  return NextResponse.json({ creators });
}
