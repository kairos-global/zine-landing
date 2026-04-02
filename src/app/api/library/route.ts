import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateProfileId } from "@/lib/profile";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("📚 [Library API] Fetching for user:", userId);

    const profileId = await getOrCreateProfileId(userId);

    // Get issues
    const { data: issues, error: issuesError } = await supabase
      .from("issues")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (issuesError) {
      console.error("❌ [Library API] Issues error:", issuesError);
      return NextResponse.json(
        { error: "Failed to fetch issues", details: issuesError },
        { status: 500 }
      );
    }

    console.log("✅ [Library API] Found issues:", issues?.length || 0);

    // Fetch the auto-generated Issue QR link for each issue
    let issueQrLinks: { id: string; issue_id: string; qr_path: string | null; redirect_path: string | null }[] = [];
    if (issues && issues.length > 0) {
      const issueIds = issues.map((i: { id: string }) => i.id);
      const { data: qrData } = await supabase
        .from("issue_links")
        .select("id, issue_id, qr_path, redirect_path")
        .in("issue_id", issueIds)
        .eq("label", "__issue_qr__");
      issueQrLinks = qrData || [];
    }

    return NextResponse.json({
      profile: {
        id: profileId,
        email: null,
      },
      issues: issues || [],
      issueQrLinks,
    });
  } catch (error) {
    console.error("❌ [Library API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

