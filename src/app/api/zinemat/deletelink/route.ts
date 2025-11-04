import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get("linkId");
    const issueId = searchParams.get("issueId");

    if (!linkId || !issueId) {
      return NextResponse.json(
        { error: "Missing linkId or issueId" },
        { status: 400 }
      );
    }

    console.log("🗑️ [Delete Link] Deleting link:", linkId, "from issue:", issueId);

    // Get the user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (profileError || !profile) {
      console.error("❌ [Delete Link] Profile not found:", profileError);
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Verify the issue belongs to the user
    const { data: issue, error: issueError } = await supabase
      .from("issues")
      .select("id")
      .eq("id", issueId)
      .eq("profile_id", profile.id)
      .single();

    if (issueError || !issue) {
      console.error("❌ [Delete Link] Issue not found or unauthorized:", issueError);
      return NextResponse.json(
        { error: "Issue not found or you don't have permission" },
        { status: 404 }
      );
    }

    // Delete the link
    const { error: deleteError } = await supabase
      .from("issue_links")
      .delete()
      .eq("id", linkId)
      .eq("issue_id", issueId);

    if (deleteError) {
      console.error("❌ [Delete Link] Error deleting link:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete link" },
        { status: 500 }
      );
    }

    console.log("✅ [Delete Link] Successfully deleted link:", linkId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ [Delete Link] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

