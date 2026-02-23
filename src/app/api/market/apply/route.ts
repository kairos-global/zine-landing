import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateProfileId } from "@/lib/profile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/market/apply
 * Create or update current user's paid-creator application (pending).
 * Body: { portfolioUrl?: string, bio?: string }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await getOrCreateProfileId(userId);
    const body = await req.json().catch(() => ({}));
    const portfolioUrl =
      typeof body.portfolioUrl === "string" ? body.portfolioUrl.trim() || null : null;
    const bio = typeof body.bio === "string" ? body.bio.trim() || null : null;

    const { data: existing } = await supabase
      .from("market_creators")
      .select("id, status")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (existing?.status === "approved") {
      return NextResponse.json({ success: true, marketCreator: existing });
    }

    const payload = {
      profile_id: profileId,
      status: "pending" as const,
      portfolio_url: portfolioUrl,
      bio,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = existing
      ? await supabase
          .from("market_creators")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single()
      : await supabase
          .from("market_creators")
          .insert(payload)
          .select()
          .single();

    if (error) {
      console.error("[Market apply] Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, marketCreator: data });
  } catch (err) {
    console.error("[Market apply] Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
