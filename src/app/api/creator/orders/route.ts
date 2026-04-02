import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getOrCreateProfileId } from "@/lib/profile";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/creator/orders
 * Returns distributor orders that contain at least one item for the current
 * user's zines (issues where profile_id = current user). Used by Creator Portal
 * so creators can view and fulfill orders for their print-for-me zines.
 */
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = await getOrCreateProfileId(userId);

    // My issue IDs (zines I created)
    const { data: myIssues, error: issuesError } = await supabase
      .from("issues")
      .select("id")
      .eq("profile_id", profileId);

    if (issuesError) {
      console.error("[Creator orders] Issues fetch error:", issuesError);
      return NextResponse.json({ error: issuesError.message }, { status: 500 });
    }

    const myIssueIds = (myIssues || []).map((i) => i.id);
    if (myIssueIds.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    // Order items that are for my issues, with order + distributor + issue
    const { data: items, error: itemsError } = await supabase
      .from("distributor_order_items")
      .select(
        `
        id,
        order_id,
        issue_id,
        quantity,
        order:distributor_orders(
          id,
          status,
          ship_to_address,
          created_at,
          updated_at,
          shipping_cost,
          payment_status,
          distributor:distributors(
            id,
            business_name,
            business_address,
            contact_name,
            contact_email
          )
        ),
        issue:issues(id, title, slug)
      `
      )
      .in("issue_id", myIssueIds);

    if (itemsError) {
      console.error("[Creator orders] Order items fetch error:", itemsError);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // Group by order (one order can have multiple line items from my zines)
    const byOrder = new Map<
      string,
      {
        order: {
          id: string;
          status: string;
          ship_to_address: string | null;
          created_at: string;
          updated_at?: string;
          shipping_cost?: number;
          payment_status?: string;
          distributor: {
            id: string;
            business_name: string;
            business_address: string;
            contact_name: string;
            contact_email: string;
          } | null;
        };
        myItems: Array<{
          id: string;
          issue_id: string;
          quantity: number;
          issue: { id: string; title: string | null; slug: string | null };
        }>;
      }
    >();

    for (const row of items || []) {
      const rawOrder = row.order;
      const order = (Array.isArray(rawOrder) ? rawOrder[0] : rawOrder) as unknown as {
        id: string;
        status: string;
        ship_to_address: string | null;
        created_at: string;
        updated_at?: string;
        shipping_cost?: number;
        payment_status?: string;
        distributor: {
          id: string;
          business_name: string;
          business_address: string;
          contact_name: string;
          contact_email: string;
        } | null;
      };
      if (!order?.id) continue;

      if (!byOrder.has(order.id)) {
        byOrder.set(order.id, { order, myItems: [] });
      }
      const entry = byOrder.get(order.id)!;
      const rawIssue = row.issue;
      const issueRow = Array.isArray(rawIssue) ? rawIssue[0] : rawIssue;
      const issue =
        issueRow != null
          ? { id: issueRow.id, title: issueRow.title ?? null, slug: issueRow.slug ?? null }
          : { id: "", title: null, slug: null };
      entry.myItems.push({
        id: row.id,
        issue_id: row.issue_id,
        quantity: row.quantity,
        issue,
      });
    }

    const orders = Array.from(byOrder.values())
      .map(({ order, myItems }) => ({ ...order, myItems }))
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

    return NextResponse.json({ orders });
  } catch (err) {
    console.error("[Creator orders] Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
