import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateProfileId } from "@/lib/profile";
import { MARKET_CATEGORIES } from "@/lib/market-categories";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const defaultServices = () =>
  MARKET_CATEGORIES.map((c) => ({
    categoryKey: c.key,
    label: c.label,
    enabled: false,
    priceCents: null as number | null,
  }));

/**
 * GET /api/market/me
 * Current user's market creator status and their enabled services + prices.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await getOrCreateProfileId(userId);

    const { data: creator, error } = await supabase
      .from("market_creators")
      .select("id, status, display_name, profile_image_url, portfolio_url, portfolio_image_urls")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ approved: false, status: "none", profile: null, services: defaultServices() });
    }
    if (!creator) {
      return NextResponse.json({ approved: false, status: "none", profile: null, services: defaultServices() });
    }

    const profile = {
      displayName: creator.display_name ?? null,
      profileImageUrl: creator.profile_image_url ?? null,
      portfolioUrl: creator.portfolio_url ?? null,
      portfolioImageUrls: Array.isArray(creator.portfolio_image_urls)
        ? creator.portfolio_image_urls
        : (creator.portfolio_image_urls as string[] | null) ?? [],
    };

    if (creator.status !== "approved") {
      return NextResponse.json({
        approved: false,
        status: creator.status as "pending" | "rejected",
        marketCreatorId: creator.id,
        profile,
        services: defaultServices(),
      });
    }

    const { data: rows } = await supabase
      .from("market_creator_services")
      .select("category_key, enabled, price_cents")
      .eq("market_creator_id", creator.id);

    const byCategory = new Map(
      (rows || []).map((r) => [r.category_key, { enabled: !!r.enabled, priceCents: r.price_cents }])
    );

    const services = MARKET_CATEGORIES.map((c) => {
      const row = byCategory.get(c.key);
      return {
        categoryKey: c.key,
        label: c.label,
        enabled: row?.enabled ?? false,
        priceCents: row?.priceCents ?? null,
      };
    });

    return NextResponse.json({
      approved: true,
      status: "approved",
      marketCreatorId: creator.id,
      profile,
      services,
    });
  } catch {
    return NextResponse.json({ approved: false, status: "none", profile: null, services: defaultServices() });
  }
}
