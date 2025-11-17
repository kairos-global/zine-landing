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
  type: "distributor_shipping" | "creator_print_for_me";
};

export async function createCheckoutSession(
  amount: number,
  currency: string,
  metadata: PaymentMetadata,
  successUrl: string,
  cancelUrl: string
) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency,
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
        amount: Math.round(amount * 100), // Convert to cents
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      orderId: metadata.orderId || "",
      issueId: metadata.issueId || "",
      profileId: metadata.profileId || "",
      distributorId: metadata.distributorId || "",
      type: metadata.type,
    },
  });

  return session;
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
      type: metadata.type,
    },
  });
}

