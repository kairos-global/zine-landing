import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/creator/order-approvals
 * Returns all order items that need this creator's attention:
 *   - pending_approval: need to approve or reject
 *   - auto_approved or approved: need payment (no paid record yet)
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Find all order items for this creator's print_for_me issues
    const { data: items, error } = await supabase
      .from("distributor_order_items")
      .select(`
        id,
        quantity,
        creator_approval_status,
        creator_reviewed_at,
        order:distributor_orders(
          id,
          status,
          created_at,
          distributor:distributors(business_name, contact_name, contact_email)
        ),
        issue:issues(id, title, profile_id)
      `)
      .in("creator_approval_status", [
        "pending_approval",
        "auto_approved",
        "approved",
      ])
      .order("id", { ascending: false });

    if (error) {
      console.error("[OrderApprovals] Fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter to only items for this creator's issues
    const myItems = (items || []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item: any) => item.issue?.profile_id === profile.id
    );

    // For approved/auto-approved items, check if already paid
    const approvedItemIds = myItems
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) =>
        ["auto_approved", "approved"].includes(item.creator_approval_status)
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.id);

    let paidItemIds = new Set<string>();
    if (approvedItemIds.length > 0) {
      const { data: paidPayments } = await supabase
        .from("creator_print_payments")
        .select("distributor_order_item_id")
        .in("distributor_order_item_id", approvedItemIds)
        .eq("payment_status", "paid");

      paidItemIds = new Set(
        (paidPayments || []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => p.distributor_order_item_id as string
        )
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = myItems.map((item: any) => ({
      id: item.id,
      quantity: item.quantity,
      creator_approval_status: item.creator_approval_status,
      creator_reviewed_at: item.creator_reviewed_at,
      cost_dollars: (item.quantity * 10) / 100, // $0.10 per copy
      is_paid: paidItemIds.has(item.id),
      order: item.order,
      issue: item.issue,
    }));

    return NextResponse.json({ items: result });
  } catch (err) {
    console.error("[OrderApprovals] Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/creator/order-approvals
 * Approve or reject a pending order item.
 * Body: { orderItemId: string, action: "approve" | "reject" }
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const { orderItemId, action } = body as {
      orderItemId: string;
      action: "approve" | "reject";
    };

    if (!orderItemId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "orderItemId and action (approve|reject) are required" },
        { status: 400 }
      );
    }

    // Verify this item belongs to this creator's issue
    const { data: item, error: fetchError } = await supabase
      .from("distributor_order_items")
      .select("id, creator_approval_status, issue:issues(profile_id)")
      .eq("id", orderItemId)
      .single();

    if (fetchError || !item) {
      return NextResponse.json(
        { error: "Order item not found" },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((item.issue as any)?.profile_id !== profile.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (item.creator_approval_status !== "pending_approval") {
      return NextResponse.json(
        { error: "Only pending items can be approved or rejected" },
        { status: 400 }
      );
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    const { error: updateError } = await supabase
      .from("distributor_order_items")
      .update({
        creator_approval_status: newStatus,
        creator_reviewed_at: new Date().toISOString(),
      })
      .eq("id", orderItemId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, newStatus });
  } catch (err) {
    console.error("[OrderApprovals PATCH] Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
