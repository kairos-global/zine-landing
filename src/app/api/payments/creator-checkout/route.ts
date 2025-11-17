import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { createCheckoutSession } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/payments/creator-checkout
 * Create Stripe Checkout session for creator print_for_me payment
 * Body: { issueId: string }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { issueId } = body as { issueId: string };

    if (!issueId) {
      return NextResponse.json(
        { error: "Issue ID is required" },
        { status: 400 }
      );
    }

    // Get profile ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Verify issue exists and belongs to user
    const { data: issue, error: issueError } = await supabase
      .from("issues")
      .select("id, title, profile_id, print_for_me")
      .eq("id", issueId)
      .eq("profile_id", profile.id)
      .single();

    if (issueError || !issue) {
      return NextResponse.json(
        { error: "Issue not found or access denied" },
        { status: 404 }
      );
    }

    // Check if already paid
    const { data: existingPayment } = await supabase
      .from("creator_print_payments")
      .select("*")
      .eq("issue_id", issueId)
      .eq("payment_status", "paid")
      .maybeSingle();

    if (existingPayment) {
      return NextResponse.json(
        { error: "Payment already completed for this issue" },
        { status: 400 }
      );
    }

    // Calculate print_for_me cost
    // TODO: Implement actual pricing logic
    // For now: $25 upfront fee to enable print_for_me
    const printForMeCost = 25.0;

    // Create Stripe Checkout session
    const session = await createCheckoutSession(
      printForMeCost,
      "usd",
      {
        issueId: issue.id,
        profileId: profile.id,
        type: "creator_print_for_me",
      },
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/library?payment=success&issueId=${issue.id}`,
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/zinemat?issueId=${issue.id}&payment=cancelled`
    );

    // Create payment record
    await supabase.from("creator_print_payments").insert({
      issue_id: issueId,
      profile_id: profile.id,
      amount: printForMeCost,
      currency: "usd",
      stripe_checkout_session_id: session.id,
      payment_status: "pending",
      payment_type: "upfront",
    });

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      amount: printForMeCost,
    });
  } catch (err) {
    console.error("[CreatorCheckout] Error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

