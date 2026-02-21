import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/distributors/orders
 * Fetch distributor's order history
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get distributor ID
    const { data: distributor } = await supabase
      .from("distributors")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!distributor) {
      return NextResponse.json({ error: "Distributor not found" }, { status: 404 });
    }

    // Fetch orders with items
    const { data: orders, error } = await supabase
      .from("distributor_orders")
      .select(`
        *,
        items:distributor_order_items(
          *,
          issue:issues(*)
        )
      `)
      .eq("distributor_id", distributor.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (err) {
    console.error("Distributor orders GET error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/distributors/orders
 * Place a new distributor order
 * Body: { items: [{ issue_id: string, quantity: number }] }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { items } = body as {
      items: Array<{ issue_id: string; quantity: number }>;
    };

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "Order must contain at least one item" },
        { status: 400 }
      );
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

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("distributor_orders")
      .insert([
        {
          distributor_id: distributor.id,
          status: "pending",
        },
      ])
      .select()
      .single();

    if (orderError || !order) {
      console.error("Error creating order:", orderError);
      const message = orderError?.message || "Failed to create order";
      return NextResponse.json(
        { error: "Failed to create order", details: message },
        { status: 500 }
      );
    }

    // Create order items
    const orderItems = items.map((item) => ({
      order_id: order.id,
      issue_id: item.issue_id,
      quantity: item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("distributor_order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Error creating order items:", itemsError);
      await supabase.from("distributor_orders").delete().eq("id", order.id);
      const message = itemsError?.message || "Failed to create order items";
      return NextResponse.json(
        { error: "Failed to create order items", details: message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: order,
      message: "Order placed successfully",
    });
  } catch (err) {
    console.error("Distributor orders POST error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}



