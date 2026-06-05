import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { createCheckoutSession } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PRINT_FOR_ME_CENTS_PER_COPY = 10; // $0.10 per copy
const CREATOR_FLAT_FEE_CENTS = 30;      // $0.30 added to every creator payment (covers Stripe processing)
const MIN_CHARGE_CENTS = 50;            // Stripe's own minimum charge

/**
 * POST /api/payments/creator-checkout
 * Create Stripe Checkout for a creator to pay their print-for-me fee.
 *
 * New model: $0.10 per copy, charged per distributor order item.
 * Body: { orderItemId: string }
 *
 * The creator pays when a distributor orders copies of their print-for-me zine —
 * either immediately for auto-approved items, or after they manually approve.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { orderItemId } = body as { orderItemId: string };

    if (!orderItemId) {
      return NextResponse.json(
        { error: "orderItemId is required" },
        { status: 400 }
      );
    }

    // Resolve creator profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Fetch the order item + parent issue (to verify ownership)
    const { data: item, error: itemError } = await supabase
      .from("distributor_order_items")
      .select(`
        id,
        quantity,
        creator_approval_status,
        issue:issues(id, title, profile_id, print_for_me)
      `)
      .eq("id", orderItemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Order item not found" },
        { status: 404 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issue = item.issue as any;

    // Verify the issue belongs to this creator
    if (issue.profile_id !== profile.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!issue.print_for_me) {
      return NextResponse.json(
        { error: "This zine does not have print-for-me enabled" },
        { status: 400 }
      );
    }

    // Only allow payment for approved or auto-approved items
    if (
      item.creator_approval_status !== "auto_approved" &&
      item.creator_approval_status !== "approved"
    ) {
      return NextResponse.json(
        {
          error:
            "This order item is not yet approved. Approve it first before paying.",
        },
        { status: 400 }
      );
    }

    // Block if already paid or a checkout session is already in flight
    const { data: existingPayment } = await supabase
      .from("creator_print_payments")
      .select("id, payment_status")
      .eq("distributor_order_item_id", orderItemId)
      .in("payment_status", ["paid", "pending"])
      .maybeSingle();

    if (existingPayment?.payment_status === "paid") {
      return NextResponse.json(
        { error: "Payment already completed for this order item" },
        { status: 400 }
      );
    }
    if (existingPayment?.payment_status === "pending") {
      return NextResponse.json(
        { error: "A checkout session is already open for this order item. Complete or cancel it first." },
        { status: 400 }
      );
    }

    // Calculate cost: $0.10 per copy + $0.30 flat fee, minimum $0.50 for Stripe
    // Example: 10 copies = $1.00 + $0.30 = $1.30
    const costCents = Math.max(
      item.quantity * PRINT_FOR_ME_CENTS_PER_COPY + CREATOR_FLAT_FEE_CENTS,
      MIN_CHARGE_CENTS
    );
    const costDollars = costCents / 100;

    const appOrigin =
      typeof process.env.NEXT_PUBLIC_APP_URL === "string" &&
      process.env.NEXT_PUBLIC_APP_URL
        ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin
        : "http://localhost:3000";

    const session = await createCheckoutSession(
      costDollars,
      "usd",
      {
        issueId: issue.id,
        profileId: profile.id,
        orderItemId: item.id,
        quantity: item.quantity,
        type: "creator_print_for_me",
      },
      `${appOrigin}/dashboard/creator?tab=zine-orders&payment=success`,
      `${appOrigin}/dashboard/creator?tab=zine-orders&payment=cancelled`
    );

    // Create pending payment record linked to the order item
    const { error: insertError } = await supabase
      .from("creator_print_payments")
      .insert({
        issue_id: issue.id,
        profile_id: profile.id,
        distributor_order_item_id: item.id,
        quantity: item.quantity,
        amount: costDollars,
        currency: "usd",
        stripe_checkout_session_id: session.id,
        payment_status: "pending",
        payment_type: "per_copy",
      });

    if (insertError) {
      console.error("[CreatorCheckout] Failed to insert creator_print_payments:", insertError);
      return NextResponse.json(
        { error: "Failed to record payment details. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      amount: costDollars,
      quantity: item.quantity,
    });
  } catch (err) {
    console.error("[CreatorCheckout] Error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
