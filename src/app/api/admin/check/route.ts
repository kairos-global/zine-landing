import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";

/**
 * API endpoint to check if current user is an admin
 * GET /api/admin/check
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      console.log("[Admin Check] No userId found");
      return NextResponse.json({ isAdmin: false });
    }

    console.log("[Admin Check] Checking admin status for userId:", userId);
    const userIsAdmin = await isAdmin(userId);
    console.log("[Admin Check] Result:", userIsAdmin);

    return NextResponse.json({ isAdmin: userIsAdmin });
  } catch (err) {
    console.error("[Admin Check] Error:", err);
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}

