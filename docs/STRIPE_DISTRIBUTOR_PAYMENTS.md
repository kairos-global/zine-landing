# Distributor payments (Stripe)

Distributors only pay **shipping** ($10 flat for now). Printing/distribution cost is not charged to them.

## Env vars (your side)

In `.env.local` (or Vercel env):

- **`STRIPE_SECRET_KEY`** – Stripe secret key (Dashboard → Developers → API keys). Required for creating Checkout sessions.
- **`STRIPE_WEBHOOK_SECRET`** – Signing secret for the webhook (see below). Required so we can mark orders as paid.
- **`NEXT_PUBLIC_APP_URL`** – Full app URL (e.g. `https://www.zineground.com`). Used for Stripe success/cancel redirects.

## Webhook (Stripe Dashboard)

1. Developers → Webhooks → Add endpoint.
2. URL: `https://www.zineground.com/api/webhooks/stripe` (or your production URL).
3. Events to send:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy the **Signing secret** (starts with `whsec_`) into `STRIPE_WEBHOOK_SECRET`.

For local testing, use Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and put the printed secret in `.env.local`.

## Flow

1. Distributor clicks “Proceed to Payment” → we create a row in `distributor_orders` and rows in `distributor_order_items`.
2. We create a Stripe Checkout session for **$10** (shipping only), then redirect to Stripe.
3. After payment, Stripe sends `checkout.session.completed`; we set `payment_status: "paid"` on the order.
4. User is redirected to `/dashboard/distributor?payment=success&orderId=...`.

## DB

Tables used: `distributor_orders` (with `shipping_cost`, `stripe_checkout_session_id`, `payment_status`, `stripe_payment_intent_id`), `distributor_order_items` (order_id, issue_id, quantity). No schema change was made for the $10 flat shipping.
