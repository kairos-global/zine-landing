import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { checkAndFinalizeOrder } from "@/lib/billing";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!webhookSecret) {
  throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set");
}

const webhookSecretString: string = webhookSecret;

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
      event = stripe.webhooks.constructEvent(body, signature, webhookSecretString);
    } catch (err) {
      console.error("[StripeWebhook] Signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "setup") {
          // Distributor saved their card for a pending order
          await handleSetupCompleted(session);
        } else {
          // Payment checkout (distributor shipping auto-bill or creator print fee)
          await handleCheckoutCompleted(session);
        }
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

// ─── Setup session completed (distributor saves card) ─────────────────────────

async function handleSetupCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  if (!metadata || metadata.type !== "distributor_card_setup") return;

  const orderId = metadata.orderId;
  if (!orderId) return;

  // Retrieve the setup intent to get the saved payment method ID
  if (!session.setup_intent) {
    console.error("[StripeWebhook] Setup session has no setup_intent:", session.id);
    return;
  }
  const setupIntent = await stripe.setupIntents.retrieve(
    session.setup_intent as string
  );
  const paymentMethodId = setupIntent.payment_method as string;

  if (!paymentMethodId) {
    console.error("[StripeWebhook] No payment method on setup intent:", session.setup_intent);
    return;
  }

  // Save the payment method to the order
  const { error: orderErr } = await supabase
    .from("distributor_orders")
    .update({ stripe_payment_method_id: paymentMethodId })
    .eq("id", orderId);

  if (orderErr) {
    console.error("[StripeWebhook] Failed to save payment method to order:", orderErr);
    throw orderErr; // Stripe retries
  }

  // Also save the Stripe customer ID on the distributor row (may already be there)
  if (session.customer) {
    const { data: order } = await supabase
      .from("distributor_orders")
      .select("distributor_id")
      .eq("id", orderId)
      .single();

    if (order?.distributor_id) {
      await supabase
        .from("distributors")
        .update({ stripe_customer_id: session.customer as string })
        .eq("id", order.distributor_id);
    }
  }

  console.log(`[StripeWebhook] Card saved for order ${orderId}, method ${paymentMethodId}`);
}

// ─── Checkout session completed (creator pays print fee) ──────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  if (!metadata) return;

  const type = metadata.type;

  if (type === "distributor_shipping") {
    // Legacy path: distributor paid directly (old flow, kept for safety)
    const orderId = metadata.orderId;
    if (orderId) {
      const { error } = await supabase
        .from("distributor_orders")
        .update({
          status: "placed",
          payment_status: "paid",
          stripe_payment_intent_id: session.payment_intent as string,
        })
        .eq("id", orderId);
      if (error) {
        console.error("[StripeWebhook] distributor_orders update failed:", error);
        throw error;
      }
    }
  } else if (type === "creator_print_for_me") {
    // Mark creator's payment as paid
    const { error: creatorError } = await supabase
      .from("creator_print_payments")
      .update({
        payment_status: "paid",
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq("stripe_checkout_session_id", session.id);

    if (creatorError) {
      console.error("[StripeWebhook] creator_print_payments update failed:", creatorError);
      throw creatorError; // Stripe retries
    }

    // Check if all items in this order are now resolved → auto-bill distributor
    const orderItemId = metadata.orderItemId;
    if (orderItemId) {
      await checkAndFinalizeOrder(orderItemId, supabase);
    }
  }
}

// ─── PaymentIntent succeeded (safety net for auto-billing PI events) ──────────

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;
  if (!metadata) return;

  const type = metadata.type;

  if (type === "distributor_shipping") {
    // Covers both legacy direct payments and new auto-billing path
    const orderId = metadata.orderId;
    if (orderId) {
      const { error } = await supabase
        .from("distributor_orders")
        .update({
          status: "placed",
          payment_status: "paid",
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("id", orderId);
      if (error) {
        console.error("[StripeWebhook] distributor_orders update (PI succeeded):", error);
        throw error;
      }
    }
  } else if (type === "creator_print_for_me") {
    const orderItemId = metadata.orderItemId;
    if (orderItemId) {
      const { error: piCreatorError } = await supabase
        .from("creator_print_payments")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("distributor_order_item_id", orderItemId);
      if (piCreatorError) {
        console.error("[StripeWebhook] creator_print_payments update (PI) failed:", piCreatorError);
        throw piCreatorError;
      }
    } else {
      // Legacy fallback: match by issue_id
      const issueId = metadata.issueId;
      if (issueId) {
        const { error: piLegacyError } = await supabase
          .from("creator_print_payments")
          .update({
            payment_status: "paid",
            stripe_payment_intent_id: paymentIntent.id,
          })
          .eq("issue_id", issueId);
        if (piLegacyError) {
          console.error("[StripeWebhook] creator_print_payments legacy update failed:", piLegacyError);
          throw piLegacyError;
        }
      }
    }
  }
}

// ─── PaymentIntent failed ─────────────────────────────────────────────────────

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;
  if (!metadata) return;

  const type = metadata.type;

  if (type === "distributor_shipping") {
    const orderId = metadata.orderId;
    if (orderId) {
      await supabase
        .from("distributor_orders")
        .update({ payment_status: "failed" })
        .eq("id", orderId);
    }
  } else if (type === "creator_print_for_me") {
    const orderItemId = metadata.orderItemId;
    if (orderItemId) {
      await supabase
        .from("creator_print_payments")
        .update({ payment_status: "failed" })
        .eq("distributor_order_item_id", orderItemId);
    } else {
      const issueId = metadata.issueId;
      if (issueId) {
        await supabase
          .from("creator_print_payments")
          .update({ payment_status: "failed" })
          .eq("issue_id", issueId);
      }
    }
  }
}
