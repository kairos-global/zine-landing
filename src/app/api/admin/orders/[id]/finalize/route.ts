import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";
import { checkAndFinalizeOrder } from "@/lib/billing";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/orders/[id]/finalize
 * Admin safety valve: manually kick checkAndFinalizeOrder for a stuck order.
 * Safe to call at any time — billing only fires when all items are resolved.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userIsAdmin = await isAdmin(userId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: orderId } = await params;

    const { data: order } = await supabase
      .from("distributor_orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "pending_creator_approval") {
      return NextResponse.json(
        { error: `Order is not pending_creator_approval (current: ${order.status})` },
        { status: 400 }
      );
    }

    // Grab first approved/auto_approved item to pass to checkAndFinalizeOrder
    const { data: items } = await supabase
      .from("distributor_order_items")
      .select("id, creator_approval_status")
      .eq("order_id", orderId)
      .in("creator_approval_status", ["approved", "auto_approved"])
      .limit(1);

    const firstItem = items?.[0];
    if (!firstItem) {
      return NextResponse.json(
        { error: "No approved items found — nothing to finalize yet" },
        { status: 400 }
      );
    }

    await checkAndFinalizeOrder(String(firstItem.id), supabase);

    // Return the updated order status so the UI can refresh
    const { data: updated } = await supabase
      .from("distributor_orders")
      .select("id, status, payment_status")
      .eq("id", orderId)
      .single();

    return NextResponse.json({ success: true, order: updated });
  } catch (err) {
    console.error("[AdminFinalize] Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
