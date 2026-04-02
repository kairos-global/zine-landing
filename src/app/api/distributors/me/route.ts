import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/distributors/me
 * Get the current user's distributor profile
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("distributors")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      // If no distributor found, return null (user hasn't registered yet)
      if (error.code === "PGRST116") {
        return NextResponse.json({ distributor: null });
      }
      console.error("Error fetching distributor:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ distributor: data });
  } catch (err) {
    console.error("Distributor me route error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}


