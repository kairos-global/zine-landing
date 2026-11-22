import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { stripe, createSetupCheckoutSession } from "@/lib/stripe";
import { getSiteBaseUrl } from "@/lib/site-url";
import { calculateTotalCharge } from "@/lib/shipping";

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

    const { data: distributor } = await supabase
      .from("distributors")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!distributor) {
      return NextResponse.json({ error: "Distributor not found" }, { status: 404 });
    }

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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/distributors/orders
 * Place a new distributor order.
 *
 * NEW FLOW (v2):
 *   1. Validate cart + creator limits
 *   2. Create order with status 'pending_creator_approval'
 *   3. Create/reuse Stripe Customer for this distributor
 *   4. Create a Stripe Checkout session in "setup" mode (saves card, no charge yet)
 *   5. Return { order, setupCheckoutUrl, estimatedTotal }
 *
 * The distributor is redirected to Stripe to save their card.
 * The actual charge happens automatically in billing.ts once all creators approve + pay.
 *
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

    if (!Array.isArray(items) || !items.length || items.some(item =>
      !item || typeof item.issue_id !== "string" || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 500
    ) || new Set(items.map(item => item.issue_id)).size !== items.length) {
      return NextResponse.json(
        { error: "Order must contain unique zines with quantities from 1 to 500" },
        { status: 400 }
      );
    }

    // Get distributor with all fields needed for Stripe customer creation
    const { data: distributor, error: distError } = await supabase
      .from("distributors")
      .select("id, status, business_address, business_name, contact_email, contact_name, stripe_customer_id")
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

    const shipToAddress = distributor.business_address?.trim() || "";
    if (!shipToAddress) {
      return NextResponse.json(
        { error: "Business address is required for shipping. Please update your distributor profile." },
        { status: 400 }
      );
    }

    // ── Validate quantities BEFORE creating any rows ──────────────────────────
    const issueIds = items.map((i) => i.issue_id);
    const { data: issueSettings, error: issueError } = await supabase
      .from("issues")
      .select("id, pdf_url, print_for_me, self_distribute, max_copies_per_order, auto_approve_quantity")
      .eq("status", "published")
      .in("id", issueIds);

    const issueMap = new Map(
      (issueSettings || []).map((iss) => [iss.id, iss])
    );

    if (issueError) return NextResponse.json({ error: "Could not verify the order items" }, { status: 500 });
    let printQuantity = 0;
    for (const item of items) {
      const issue = issueMap.get(item.issue_id);
      if (!issue || !(issue.self_distribute || issue.print_for_me && issue.pdf_url)) {
        return NextResponse.json({ error: "A zine is no longer available for distribution" }, { status: 422 });
      }
      if (!issue.print_for_me) continue;
      if (item.quantity > (issue.max_copies_per_order ?? 50)) {
        return NextResponse.json({ error: "Order quantity exceeds the creator’s limit" }, { status: 422 });
      }
      printQuantity += item.quantity;
    }

    // ── Create/reuse Stripe Customer for this distributor ─────────────────────
    let stripeCustomerId = distributor.stripe_customer_id as string | null;
    if (printQuantity > 0 && !stripeCustomerId) {
      // Use the logged-in user's actual email (from Clerk), not the business registration email
      const clerkUser = await currentUser();
      const userEmail =
        clerkUser?.primaryEmailAddress?.emailAddress ??
        clerkUser?.emailAddresses?.[0]?.emailAddress;

      const customer = await stripe.customers.create({
        email: userEmail || undefined,
        name: distributor.business_name || distributor.contact_name || undefined,
        metadata: { distributor_id: distributor.id },
      });
      stripeCustomerId = customer.id;
      const { error } = await supabase.from("distributors")
        .update({ stripe_customer_id: stripeCustomerId }).eq("id", distributor.id);
      if (error) throw error;
    }

    // ── Create the order row ──────────────────────────────────────────────────
    // Status 'pending_creator_approval': order is placed, card will be saved,
    // but the distributor is NOT charged yet. Charge happens automatically once
    // all creators approve and pay their print costs.
    const { data: order, error: orderError } = await supabase
      .from("distributor_orders")
      .insert([
        {
          distributor_id: distributor.id,
          status: "pending_creator_approval",
          ship_to_address: shipToAddress,
        },
      ])
      .select()
      .single();

    if (orderError || !order) {
      console.error("Error creating order:", orderError);
      return NextResponse.json(
        { error: "Failed to create order", details: orderError?.message },
        { status: 500 }
      );
    }

    // ── Create order items ────────────────────────────────────────────────────
    const orderItems = items.map((item) => {
      const iss = issueMap.get(item.issue_id);
      let creator_approval_status = "auto_approved";
      if (iss?.print_for_me) {
        const threshold = iss.auto_approve_quantity ?? 20;
        creator_approval_status =
          item.quantity <= threshold ? "auto_approved" : "pending_approval";
      }
      return {
        order_id: order.id,
        issue_id: item.issue_id,
        quantity: item.quantity,
        creator_approval_status,
      };
    });

    const { error: itemsError } = await supabase
      .from("distributor_order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("Error creating order items:", itemsError);
      // Clean up the order row so we don't leave a dangling record
      await supabase.from("distributor_orders").delete().eq("id", order.id);
      return NextResponse.json(
        { error: "Failed to create order items", details: itemsError?.message },
        { status: 500 }
      );
    }

    const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
    if (!printQuantity) {
      const { data: placed, error } = await supabase.from("distributor_orders")
        .update({ status: "placed" }).eq("id", order.id).select().single();
      if (error) {
        await supabase.from("distributor_orders").delete().eq("id", order.id);
        throw error;
      }
      return NextResponse.json({ success: true, order: placed, estimatedTotal: 0, totalQuantity });
    }

    const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || getSiteBaseUrl()).origin;
    try {
      if (!stripeCustomerId) throw new Error("Missing Stripe customer");
      const setupSession = await createSetupCheckoutSession(
        stripeCustomerId,
        `${appOrigin}/dashboard/distributor?setup=success&session_id={CHECKOUT_SESSION_ID}`,
        `${appOrigin}/dashboard/distributor?setup=cancelled`,
        { orderId: order.id, type: "distributor_card_setup" }
      );
      const { error } = await supabase.from("distributor_orders")
        .update({ stripe_setup_session_id: setupSession.id }).eq("id", order.id);
      if (error || !setupSession.url) throw error ?? new Error("Missing Stripe checkout URL");
      return NextResponse.json({
        success: true,
        order,
        setupCheckoutUrl: setupSession.url,
        estimatedTotal: calculateTotalCharge(printQuantity),
        totalQuantity,
      });
    } catch (error) {
      await supabase.from("distributor_orders").delete().eq("id", order.id);
      throw error;
    }
  } catch (err) {
    console.error("Distributor orders POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
