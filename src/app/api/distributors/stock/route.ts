import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/distributors/stock
 * Fetch distributor's current stock
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get distributor ID
    const { data: distributor, error: distError } = await supabase
      .from("distributors")
      .select("id, status")
      .eq("user_id", userId)
      .single();

    if (distError || !distributor) {
      return NextResponse.json({ error: "Distributor not found" }, { status: 404 });
    }

    if (distributor.status !== "approved") {
      return NextResponse.json(
        { error: "Must be an approved distributor" },
        { status: 403 }
      );
    }

    // Fetch stock with issue details
    const { data: stock, error } = await supabase
      .from("distributor_stock")
      .select(`
        *,
        issue:issues(*)
      `)
      .eq("distributor_id", distributor.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching stock:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stock: stock || [] });
  } catch (err) {
    console.error("Distributor stock GET error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

