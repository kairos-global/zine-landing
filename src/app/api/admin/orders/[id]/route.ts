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
 * Update order status or fulfill order
 * Body: { status: "pending" | "fulfilled" | "cancelled" }
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
    const { status } = body;

    // Validate status
    if (!status || !["pending", "fulfilled", "cancelled"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: pending, fulfilled, or cancelled" },
        { status: 400 }
      );
    }

    // If fulfilling, update distributor stock
    if (status === "fulfilled") {
      // Get order items
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

      // Update or insert stock for each item
      for (const item of orderItems) {
        // Check if stock exists
        const { data: existingStock } = await supabase
          .from("distributor_stock")
          .select("*")
          .eq("distributor_id", distributorId)
          .eq("issue_id", item.issue_id)
          .single();

        if (existingStock) {
          // Update existing stock
          await supabase
            .from("distributor_stock")
            .update({ quantity: existingStock.quantity + item.quantity })
            .eq("id", existingStock.id);
        } else {
          // Insert new stock
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

    // Update order status
    const { data, error } = await supabase
      .from("distributor_orders")
      .update({ status, updated_at: new Date().toISOString() })
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

