import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateProfileId } from "@/lib/profile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PATCH /api/market/creator-profile
 * Update current user's paid creator profile (display name, profile image, portfolio, portfolio images).
 * Body: { displayName?, profileImageUrl?, portfolioUrl?, portfolioImageUrls? }
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
      .maybeSingle();

    if (!creator) {
      return NextResponse.json({ error: "No market creator record" }, { status: 403 });
    }

    const body = await req.json();
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() || null : undefined;
    const profileImageUrl = typeof body.profileImageUrl === "string" ? body.profileImageUrl.trim() || null : undefined;
    const portfolioUrl = typeof body.portfolioUrl === "string" ? body.portfolioUrl.trim() || null : undefined;
    let portfolioImageUrls: string[] | undefined;
    if (Array.isArray(body.portfolioImageUrls)) {
      portfolioImageUrls = body.portfolioImageUrls
        .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        .slice(0, 5);
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (displayName !== undefined) updates.display_name = displayName;
    if (profileImageUrl !== undefined) updates.profile_image_url = profileImageUrl;
    if (portfolioUrl !== undefined) updates.portfolio_url = portfolioUrl;
    if (portfolioImageUrls !== undefined) updates.portfolio_image_urls = portfolioImageUrls;

    const { error } = await supabase
      .from("market_creators")
      .update(updates)
      .eq("id", creator.id);

    if (error) {
      console.error("[Creator profile] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Creator profile] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
