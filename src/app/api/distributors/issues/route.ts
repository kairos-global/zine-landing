import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/distributors/issues
 * Fetch all published issues available for distribution
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is an approved distributor
    const { data: distributor } = await supabase
      .from("distributors")
      .select("status")
      .eq("user_id", userId)
      .single();

    if (!distributor || distributor.status !== "approved") {
      return NextResponse.json(
        { error: "Must be an approved distributor" },
        { status: 403 }
      );
    }

    // Fetch all published issues available for distribution (self_distribute and/or print_for_me)
    const { data: issues, error } = await supabase
      .from("issues")
      .select("*")
      .eq("status", "published")
      .or("self_distribute.eq.true,print_for_me.eq.true")
      .order("published_at", { ascending: false });

    if (error) {
      console.error("Error fetching issues:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ issues: issues || [] });
  } catch (err) {
    console.error("Distributor issues GET error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}


