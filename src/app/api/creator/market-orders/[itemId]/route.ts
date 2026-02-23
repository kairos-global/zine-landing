import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateProfileId } from "@/lib/profile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * PATCH /api/creator/market-orders/[itemId]
 * Accept or decline a market order item. Body: { status: "accepted" | "declined" }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const profileId = await getOrCreateProfileId(userId);
    const { itemId } = await params;

    const { data: creator } = await supabase
      .from("market_creators")
      .select("id")
      .eq("profile_id", profileId)
      .eq("status", "approved")
      .maybeSingle();

    if (!creator) {
      return NextResponse.json({ error: "Not an approved market creator" }, { status: 403 });
    }

    const body = await req.json();
    const status = body.status as string;
    if (status !== "accepted" && status !== "declined") {
      return NextResponse.json({ error: "status must be accepted or declined" }, { status: 400 });
    }

    const { data: item, error: fetchErr } = await supabase
      .from("market_order_items")
      .select("id, market_creator_id, status")
      .eq("id", itemId)
      .single();

    if (fetchErr || !item || item.market_creator_id !== creator.id) {
      return NextResponse.json({ error: "Order item not found" }, { status: 404 });
    }
    if (item.status !== "pending") {
      return NextResponse.json({ error: "Item already responded to" }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from("market_order_items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", itemId);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json({ success: true, status });
  } catch (err) {
    console.error("[Creator market-orders] PATCH error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
