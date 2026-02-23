import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/paid-creators
 * List market creators with optional status filter.
 * Query params: ?status=pending|approved|rejected
 * Returns each with profile email for display.
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

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    let query = supabase
      .from("market_creators")
      .select("*, profiles(email)")
      .order("created_at", { ascending: false });

    if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching paid creators:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Normalize: Supabase may return profiles as object or array
    const paidCreators = (data || []).map((row: Record<string, unknown>) => {
      const profile = row.profiles as { email?: string } | { email?: string }[] | null;
      const email = Array.isArray(profile) ? profile[0]?.email : profile?.email;
      const { profiles: _, ...rest } = row;
      return { ...rest, email: email ?? null };
    });

    return NextResponse.json({ paidCreators });
  } catch (err) {
    console.error("Admin paid-creators GET error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
