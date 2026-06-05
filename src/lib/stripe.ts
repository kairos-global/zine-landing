import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

export type PaymentMetadata = {
  orderId?: string;
  issueId?: string;
  profileId?: string;
  distributorId?: string;
  orderItemId?: string;  // per-order-item creator print payment (new model)
  quantity?: number;     // copies ordered in that item
  type: "distributor_shipping" | "creator_print_for_me" | "store_order";
};

export async function createCheckoutSession(
  amount: number,
  currency: string,
  metadata: PaymentMetadata,
  successUrl: string,
  cancelUrl: string
) {
  const stripeMetadata = {
    orderId: metadata.orderId || "",
    issueId: metadata.issueId || "",
    profileId: metadata.profileId || "",
    distributorId: metadata.distributorId || "",
    orderItemId: String(metadata.orderItemId ?? ""),
    quantity: String(metadata.quantity ?? ""),
    type: metadata.type,
  };

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: Math.round(amount * 100), // Convert to cents
          product_data: {
            name:
              metadata.type === "distributor_shipping"
                ? "Zine Shipping & Handling"
                : "Print-for-Me Distribution Service",
            description:
              metadata.type === "distributor_shipping"
                ? "Shipping and handling for your zine order"
                : "Zineground will print and distribute your zine to distributors worldwide",
          },
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: stripeMetadata,
    // Mirror metadata onto the PaymentIntent so payment_intent.succeeded
    // events carry the same fields and can act as a backup handler.
    payment_intent_data: { metadata: stripeMetadata },
  });

  return session;
}

/**
 * Create a Stripe Checkout session in "setup" mode.
 * This saves the customer's card without charging them.
 * The card is later charged automatically via a PaymentIntent (off-session).
 */
export async function createSetupCheckoutSession(
  stripeCustomerId: string,
  successUrl: string,
  cancelUrl: string,
  metadata: Record<string, string>
) {
  return await stripe.checkout.sessions.create({
    mode: "setup",
    customer: stripeCustomerId,
    currency: "usd",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    custom_text: {
      submit: {
        message:
          "Your card is saved now. You will only be charged once creators approve their copies — the exact amount depends on which items are approved.",
      },
    },
  });
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  return await stripe.paymentIntents.retrieve(paymentIntentId);
}

export async function createPaymentIntent(
  amount: number,
  currency: string,
  metadata: PaymentMetadata
) {
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency,
    metadata: {
      orderId: metadata.orderId || "",
      issueId: metadata.issueId || "",
      profileId: metadata.profileId || "",
      distributorId: metadata.distributorId || "",
      orderItemId: metadata.orderItemId || "",
      quantity: String(metadata.quantity ?? ""),
      type: metadata.type,
    },
  });
}

