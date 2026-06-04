import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// PATCH — admin: update order status / fulfillment info
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userIsAdmin = await isAdmin(userId);
  if (!userIsAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { status, tracking_number, shipped_at, fulfillment_notes } = body;

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) updateData.status = status;
  if (tracking_number !== undefined) updateData.tracking_number = tracking_number;
  if (shipped_at !== undefined) updateData.shipped_at = shipped_at;
  if (fulfillment_notes !== undefined) updateData.fulfillment_notes = fulfillment_notes;

  const { data, error } = await supabase
    .from("store_orders")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
