import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateProfileId } from "@/lib/profile";
import { MARKET_CATEGORIES } from "../categories/route";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const validKeys = new Set(MARKET_CATEGORIES.map((c) => c.key));

/**
 * PATCH /api/market/services
 * Update current user's market services (enabled + price per category).
 * Body: { services: Array<{ categoryKey: string, enabled: boolean, priceCents: number | null }> }
 */
export async function PATCH(req: Request) {
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
      return NextResponse.json({ error: "Not an approved market creator" }, { status: 403 });
    }

    const body = await req.json();
    const { services } = body as {
      services: Array<{ categoryKey: string; enabled: boolean; priceCents: number | null }>;
    };

    if (!Array.isArray(services)) {
      return NextResponse.json({ error: "services array required" }, { status: 400 });
    }

    for (const s of services) {
      if (!validKeys.has(s.categoryKey)) continue;
      const priceCents = s.enabled && s.priceCents != null ? Math.round(Number(s.priceCents)) : null;
      await supabase
        .from("market_creator_services")
        .upsert(
          {
            market_creator_id: creator.id,
            category_key: s.categoryKey,
            enabled: !!s.enabled,
            price_cents: priceCents,
          },
          { onConflict: "market_creator_id,category_key" }
        );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Market services] Error:", err);
    return NextResponse.json({ error: "Failed to update services" }, { status: 500 });
  }
}
