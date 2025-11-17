import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set");
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("[StripeWebhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      default:
        console.log(`[StripeWebhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[StripeWebhook] Error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  if (!metadata) return;

  const type = metadata.type;

  if (type === "distributor_shipping") {
    const orderId = metadata.orderId;
    if (orderId) {
      await supabase
        .from("distributor_orders")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: session.payment_intent as string,
        })
        .eq("id", orderId);
    }
  } else if (type === "creator_print_for_me") {
    const issueId = metadata.issueId;
    if (issueId) {
      await supabase
        .from("creator_print_payments")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: session.payment_intent as string,
        })
        .eq("stripe_checkout_session_id", session.id);
    }
  }
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
) {
  const metadata = paymentIntent.metadata;
  if (!metadata) return;

  const type = metadata.type;

  if (type === "distributor_shipping") {
    const orderId = metadata.orderId;
    if (orderId) {
      await supabase
        .from("distributor_orders")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("id", orderId);
    }
  } else if (type === "creator_print_for_me") {
    const issueId = metadata.issueId;
    if (issueId) {
      await supabase
        .from("creator_print_payments")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("issue_id", issueId);
    }
  }
}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
) {
  const metadata = paymentIntent.metadata;
  if (!metadata) return;

  const type = metadata.type;

  if (type === "distributor_shipping") {
    const orderId = metadata.orderId;
    if (orderId) {
      await supabase
        .from("distributor_orders")
        .update({
          payment_status: "failed",
        })
        .eq("id", orderId);
    }
  } else if (type === "creator_print_for_me") {
    const issueId = metadata.issueId;
    if (issueId) {
      await supabase
        .from("creator_print_payments")
        .update({
          payment_status: "failed",
        })
        .eq("issue_id", issueId);
    }
  }
}

