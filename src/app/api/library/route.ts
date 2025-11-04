import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

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

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, clerk_id, email")
      .eq("clerk_id", userId)
      .single();

    if (profileError || !profile) {
      console.error("❌ [Library API] Profile error:", profileError);
      return NextResponse.json(
        { error: "Profile not found", details: profileError },
        { status: 404 }
      );
    }

    console.log("✅ [Library API] Found profile:", profile.id);

    // Get issues
    const { data: issues, error: issuesError } = await supabase
      .from("issues")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });

    if (issuesError) {
      console.error("❌ [Library API] Issues error:", issuesError);
      return NextResponse.json(
        { error: "Failed to fetch issues", details: issuesError },
        { status: 500 }
      );
    }

    console.log("✅ [Library API] Found issues:", issues?.length || 0);

    return NextResponse.json({
      profile: {
        id: profile.id,
        email: profile.email,
      },
      issues: issues || [],
    });
  } catch (error) {
    console.error("❌ [Library API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

