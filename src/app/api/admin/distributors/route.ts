import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/distributors
 * Fetch all distributors with optional status filter
 * Query params: ?status=pending|approved|rejected
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(userId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    let query = supabase
      .from("distributors")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply status filter if provided
    if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching distributors:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ distributors: data });
  } catch (err) {
    console.error("Admin distributors GET error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

