import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateProfileId } from "@/lib/profile";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const issueId = searchParams.get("id");

    if (!issueId) {
      return NextResponse.json({ error: "Missing issue ID" }, { status: 400 });
    }

    console.log("📖 [Load Issue] Loading issue:", issueId, "for user:", userId);

    const profileId = await getOrCreateProfileId(userId);

    // Get the issue and verify ownership
    const { data: issue, error: issueError } = await supabase
      .from("issues")
      .select("*")
      .eq("id", issueId)
      .eq("profile_id", profileId)
      .single();

    if (issueError || !issue) {
      console.error("❌ [Load Issue] Issue not found or unauthorized:", issueError);
      return NextResponse.json(
        { error: "Issue not found or you don't have permission to edit it" },
        { status: 404 }
      );
    }

    console.log("✅ [Load Issue] Found issue:", issue.title);

    // Get links
    const { data: links, error: linksError } = await supabase
      .from("issue_links")
      .select("*")
      .eq("issue_id", issueId);

    if (linksError) {
      console.error("❌ [Load Issue] Error loading links:", linksError);
    }

    console.log("✅ [Load Issue] Found links:", links?.length || 0);

    return NextResponse.json({
      issue: {
        id: issue.id,
        title: issue.title,
        slug: issue.slug,
        status: issue.status,
        cover_img_url: issue.cover_img_url,
        self_distribute: issue.self_distribute ?? false,
        print_for_me: issue.print_for_me ?? false,
        pdf_url: issue.pdf_url,
        published_at: issue.published_at,
        created_at: issue.created_at,
      },
      links: links || [],
    });
  } catch (error) {
    console.error("❌ [Load Issue] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

