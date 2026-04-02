import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/stats
 * Get platform-wide statistics for admin dashboard
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(userId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
    }

    // Fetch various stats in parallel
    const [
      { count: totalUsers },
      { count: totalIssues },
      { count: totalDistributors },
      { count: pendingDistributors },
      { count: approvedDistributors },
      { count: totalQRScans },
      { count: totalPaidCreators },
      { count: pendingPaidCreators },
      { count: approvedPaidCreators },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("issues").select("*", { count: "exact", head: true }),
      supabase.from("distributors").select("*", { count: "exact", head: true }),
      supabase.from("distributors").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("distributors").select("*", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("qr_scans").select("*", { count: "exact", head: true }),
      supabase.from("market_creators").select("*", { count: "exact", head: true }),
      supabase.from("market_creators").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("market_creators").select("*", { count: "exact", head: true }).eq("status", "approved"),
    ]);

    return NextResponse.json({
      stats: {
        totalUsers: totalUsers || 0,
        totalIssues: totalIssues || 0,
        totalDistributors: totalDistributors || 0,
        pendingDistributors: pendingDistributors || 0,
        approvedDistributors: approvedDistributors || 0,
        totalQRScans: totalQRScans || 0,
        totalPaidCreators: totalPaidCreators || 0,
        pendingPaidCreators: pendingPaidCreators || 0,
        approvedPaidCreators: approvedPaidCreators || 0,
      },
    });
  } catch (err) {
    console.error("Admin stats GET error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}


