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

export async function POST(req: Request) {
  console.log("[StripeWebhook] POST received at", new Date().toISOString());
  try {
    const body = await req.text();
    const signature = (await headers()).get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    let event: Stripe.Event;
    const liveSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    const testSecret = process.env.STRIPE_WEBHOOK_SECRET_TEST ?? null;

    try {
      event = stripe.webhooks.constructEvent(body, signature, liveSecret);
    } catch {
      // Live secret failed — try test/sandbox secret if configured
      if (!testSecret) {
        console.error("[StripeWebhook] Signature verification failed (no test secret configured)");
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
      try {
        event = stripe.webhooks.constructEvent(body, signature, testSecret);
        console.log("[StripeWebhook] Verified with test/sandbox secret");
      } catch (testErr) {
        console.error("[StripeWebhook] Signature verification failed (both secrets tried):", testErr);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    console.log(`[StripeWebhook] Event: ${event.type} id=${event.id}`);

    // Idempotency — Stripe guarantees at-least-once delivery.
    // Insert the event ID; if it already exists we've processed it.
    const { error: idempotencyError } = await supabase
      .from("stripe_events")
      .insert({ id: event.id });

    if (idempotencyError) {
      if (idempotencyError.code === "23505") {
        console.log(`[StripeWebhook] Duplicate event ${event.id} — already processed, skipping`);
        return NextResponse.json({ received: true });
      }
      // Non-fatal: table might not exist yet. Log and fall through to process.
      console.warn("[StripeWebhook] Could not record event id (idempotency check skipped):", idempotencyError.message);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "setup") {
          await handleSetupCompleted(session);
        } else if (session.mode === "payment") {
          const type = session.metadata?.type;
          console.log(`[StripeWebhook] checkout.session.completed payment: type=${type} sessionId=${session.id}`);
          if (type === "creator_print_for_me") {
            await handleCreatorPayment(session);
          } else if (type === "distributor_shipping") {
            await handleDistributorShippingPayment(session);
          } else if (type === "store_order") {
            await handleStoreOrderPayment(session);
          } else {
            console.error(`[StripeWebhook] Unrecognized payment type "${type}" for session ${session.id} — doing nothing`);
          }
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
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// ─── Setup session completed (distributor saves card) ─────────────────────────

async function handleSetupCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  if (!metadata || metadata.type !== "distributor_card_setup") return;

  const orderId = metadata.orderId;
  if (!orderId) return;

  if (!session.setup_intent) {
    console.error("[StripeWebhook] Setup session has no setup_intent:", session.id);
    return;
  }

  const setupIntent = await stripe.setupIntents.retrieve(session.setup_intent as string);
  const paymentMethodId = setupIntent.payment_method as string;

  if (!paymentMethodId) {
    console.error("[StripeWebhook] No payment method on setup intent:", session.setup_intent);
    return;
  }

  const { error: orderErr } = await supabase
    .from("distributor_orders")
    .update({ stripe_payment_method_id: paymentMethodId })
    .eq("id", orderId);

  if (orderErr) {
    console.error("[StripeWebhook] Failed to save payment method to order:", orderErr);
    throw orderErr;
  }

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

// ─── Creator pays print fee ───────────────────────────────────────────────────

async function handleCreatorPayment(session: Stripe.Checkout.Session) {
  const { data: row, error: findErr } = await supabase
    .from("creator_print_payments")
    .select("id, payment_status, distributor_order_item_id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (findErr) {
    console.error(
      `[StripeWebhook] DB error looking up creator_print_payments. sessionId=${session.id}`,
      findErr
    );
    throw findErr;
  }

  if (!row) {
    console.error(
      `[StripeWebhook] CRITICAL — no payment row found. sessionId=${session.id}`
    );
    return;
  }

  if (row.payment_status === "paid") {
    console.log(
      `[StripeWebhook] Creator payment already marked paid. rowId=${row.id} sessionId=${session.id}`
    );
    return;
  }

  const { error: updateErr } = await supabase
    .from("creator_print_payments")
    .update({
      payment_status: "paid",
      stripe_payment_intent_id: session.payment_intent as string,
    })
    .eq("id", row.id);

  if (updateErr) {
    console.error("[StripeWebhook] creator_print_payments update failed:", updateErr);
    throw updateErr;
  }

  console.log(
    `[StripeWebhook] Creator payment marked paid. rowId=${row.id} sessionId=${session.id}`
  );

  await checkAndFinalizeOrder(String(row.distributor_order_item_id), supabase);
}

// ─── Distributor shipping checkout (legacy direct-pay path) ───────────────────

async function handleDistributorShippingPayment(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;

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

// ─── Store order checkout ─────────────────────────────────────────────────────

async function handleStoreOrderPayment(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId) return;

  type SessionExt = typeof session & {
    shipping_details?: { name?: string; address?: Record<string, string> | null } | null;
  };
  const sess = session as SessionExt;

  const { error } = await supabase
    .from("store_orders")
    .update({
      status: "paid",
      stripe_payment_intent_id: session.payment_intent as string,
      total_cents: session.amount_total,
      shipping_name: sess.shipping_details?.name ?? session.customer_details?.name ?? null,
      shipping_address: sess.shipping_details?.address ?? null,
    })
    .eq("id", orderId);

  if (error) {
    console.error("[StripeWebhook] store_orders update failed:", error);
    throw error;
  }

  console.log(`[StripeWebhook] Store order ${orderId} marked paid.`);
}

// ─── PaymentIntent succeeded (backup / auto-billing PI events) ────────────────

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;
  if (!metadata) return;

  const type = metadata.type;

  if (type === "distributor_shipping") {
    const orderId = metadata.orderId;
    if (!orderId) return;
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
  } else if (type === "creator_print_for_me") {
    // Backup path: fires after checkout.session.completed for the same payment.
    // If the checkout handler already marked the row paid, this is a no-op.
    const orderItemId = metadata.orderItemId;
    if (!orderItemId) return;

    const { data: row } = await supabase
      .from("creator_print_payments")
      .select("id, payment_status")
      .eq("distributor_order_item_id", orderItemId)
      .neq("payment_status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return;

    const { error } = await supabase
      .from("creator_print_payments")
      .update({
        payment_status: "paid",
        stripe_payment_intent_id: paymentIntent.id,
      })
      .eq("id", row.id);

    if (error) {
      console.error("[StripeWebhook] creator_print_payments update (PI) failed:", error);
      throw error;
    }

    await checkAndFinalizeOrder(orderItemId, supabase).catch((err) => {
      console.error("[StripeWebhook] checkAndFinalizeOrder (PI path) error:", err);
    });
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
        .eq("distributor_order_item_id", orderItemId)
        .neq("payment_status", "paid");
    }
  }
}
