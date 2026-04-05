import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PATCH /api/admin/orders/[id]
 * Update order status, and optionally save fulfillment details.
 * Body: {
 *   status: "pending" | "fulfilled" | "cancelled",
 *   tracking_number?: string,   // required when fulfilling
 *   shipped_at?: string,        // ISO date string "YYYY-MM-DD"
 *   fulfillment_notes?: string,
 * }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userIsAdmin = await isAdmin(userId);
    if (!userIsAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, tracking_number, shipped_at, fulfillment_notes } = body;

    // Validate status
    if (!status || !["pending", "fulfilled", "cancelled"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: pending, fulfilled, or cancelled" },
        { status: 400 }
      );
    }
    const statusForDb = status === "pending" ? "placed" : status;

    // If fulfilling, update distributor stock
    if (status === "fulfilled") {
      const { data: orderItems, error: itemsError } = await supabase
        .from("distributor_order_items")
        .select("*, order:distributor_orders(distributor_id)")
        .eq("order_id", id);

      if (itemsError || !orderItems || orderItems.length === 0) {
        return NextResponse.json(
          { error: "Order items not found" },
          { status: 404 }
        );
      }

      const distributorId = orderItems[0].order.distributor_id;

      for (const item of orderItems) {
        const { data: existingStock } = await supabase
          .from("distributor_stock")
          .select("*")
          .eq("distributor_id", distributorId)
          .eq("issue_id", item.issue_id)
          .single();

        if (existingStock) {
          await supabase
            .from("distributor_stock")
            .update({ quantity: existingStock.quantity + item.quantity })
            .eq("id", existingStock.id);
        } else {
          await supabase
            .from("distributor_stock")
            .insert([
              {
                distributor_id: distributorId,
                issue_id: item.issue_id,
                quantity: item.quantity,
              },
            ]);
        }
      }
    }

    // Build the update payload
    const updatePayload: Record<string, unknown> = {
      status: statusForDb,
      updated_at: new Date().toISOString(),
    };

    if (status === "fulfilled") {
      if (tracking_number) updatePayload.tracking_number = tracking_number;
      if (shipped_at) updatePayload.shipped_at = shipped_at;
      if (fulfillment_notes !== undefined) updatePayload.fulfillment_notes = fulfillment_notes;
    }

    const { data, error } = await supabase
      .from("distributor_orders")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating order:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: data,
      message: `Order ${status}`,
    });
  } catch (err) {
    console.error("Admin order PATCH error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
