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
  console.log("[StripeWebhook] POST received at", new Date().toISOString());
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
  } else if (type === "store_order") {
    const orderId = metadata.orderId;
    if (!orderId) return;

    // shipping_details exists at runtime but isn't typed in this SDK version
    type SessionExt = typeof session & {
      shipping_details?: { name?: string; address?: Record<string, string> | null } | null;
    };
    const sess = session as SessionExt;
    const shippingDetails = sess.shipping_details;
    const customerDetails = session.customer_details;

    const { error: storeErr } = await supabase
      .from("store_orders")
      .update({
        status: "paid",
        stripe_payment_intent_id: session.payment_intent as string,
        total_cents: session.amount_total,
        shipping_name: shippingDetails?.name ?? customerDetails?.name ?? null,
        shipping_address: shippingDetails?.address ?? null,
      })
      .eq("id", orderId);

    if (storeErr) {
      console.error("[StripeWebhook] store_orders update failed:", storeErr);
      throw storeErr;
    }
    console.log(`[StripeWebhook] Store order ${orderId} marked paid.`);
  } else if (type === "creator_print_for_me") {
    const orderItemId = metadata.orderItemId;
    console.log(`[StripeWebhook] creator_print_for_me: sessionId=${session.id} orderItemId=${orderItemId}`);

    // ── Step 1: Find the row to update ────────────────────────────────────────
    // Fetch ALL rows for this order item (avoids maybeSingle() erroring on
    // multiple rows from prior stuck attempts). Prefer the row whose session ID
    // matches exactly; fall back to the most-recent unpaid row for the item.
    // If nothing matches by item ID, fall back to a session-ID lookup.
    let paymentRowId: string | null = null;

    // Primary lookup: by stripe_checkout_session_id — unambiguous, exact match.
    const { data: bySession, error: findErr1 } = await supabase
      .from("creator_print_payments")
      .select("id, payment_status, distributor_order_item_id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();

    console.log(`[StripeWebhook] Primary lookup by sessionId=${session.id}: row=${JSON.stringify(bySession)} err=${JSON.stringify(findErr1)}`);

    if (bySession && bySession.payment_status !== "paid") {
      paymentRowId = bySession.id;
    }

    // Fallback: by distributor_order_item_id (handles rows without a stored session ID).
    if (!paymentRowId && orderItemId) {
      const { data: candidateRows, error: findErr2 } = await supabase
        .from("creator_print_payments")
        .select("id, payment_status, stripe_checkout_session_id")
        .eq("distributor_order_item_id", orderItemId)
        .order("created_at", { ascending: false });

      console.log(`[StripeWebhook] Fallback lookup by orderItemId=${orderItemId}: rows=${JSON.stringify(candidateRows)} err=${JSON.stringify(findErr2)}`);

      const exactMatch = (candidateRows || []).find(
        (r) => r.stripe_checkout_session_id === session.id && r.payment_status !== "paid"
      );
      const fallbackMatch = (candidateRows || []).find((r) => r.payment_status !== "paid");
      const match = exactMatch ?? fallbackMatch;
      if (match) paymentRowId = match.id;
    }

    if (!paymentRowId) {
      const { data: allRows } = await supabase
        .from("creator_print_payments")
        .select("id, distributor_order_item_id, stripe_checkout_session_id, payment_status");
      console.error(
        `[StripeWebhook] CRITICAL — no payment row found. sessionId=${session.id} orderItemId=${orderItemId} allRows=${JSON.stringify(allRows)}`
      );
      // Do NOT throw — Stripe would retry endlessly without ever matching.
      return;
    }

    // ── Step 2: Update by primary key ─────────────────────────────────────────
    const { error: updateError } = await supabase
      .from("creator_print_payments")
      .update({
        payment_status: "paid",
        stripe_payment_intent_id: session.payment_intent as string,
        stripe_checkout_session_id: session.id,
      })
      .eq("id", paymentRowId);

    if (updateError) {
      console.error("[StripeWebhook] creator_print_payments update failed:", updateError);
      throw updateError; // Stripe retries
    }

    console.log(`[StripeWebhook] Marked payment row ${paymentRowId} as paid. orderItemId=${orderItemId}`);

    // ── Step 3: Check if all items resolved → auto-bill distributor ────────────
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
    // This fires after checkout.session.completed for the same payment.
    // It acts as a backup: if the checkout handler already marked the row paid,
    // these updates are no-ops. If it failed, this catches the gap.
    const orderItemId = metadata.orderItemId;
    if (orderItemId) {
      // Use find-then-update so we don't blindly update all rows for the item.
      const { data: candidateRows } = await supabase
        .from("creator_print_payments")
        .select("id, payment_status")
        .eq("distributor_order_item_id", orderItemId)
        .order("created_at", { ascending: false });

      const targetRow = (candidateRows || []).find((r) => r.payment_status !== "paid");
      if (targetRow) {
        const { error: piCreatorError } = await supabase
          .from("creator_print_payments")
          .update({
            payment_status: "paid",
            stripe_payment_intent_id: paymentIntent.id,
          })
          .eq("id", targetRow.id);
        if (piCreatorError) {
          console.error("[StripeWebhook] creator_print_payments update (PI) failed:", piCreatorError);
          throw piCreatorError;
        }
        // Trigger auto-billing in case the checkout handler didn't get to it.
        await checkAndFinalizeOrder(orderItemId, supabase).catch((err) => {
          console.error("[StripeWebhook] checkAndFinalizeOrder (PI path) error:", err);
        });
      }
    } else {
      // Legacy fallback: match by issue_id (pre-per-item model)
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
