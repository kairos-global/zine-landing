# Distributor payments (Stripe)

Distributors only pay **shipping** ($10 flat for now). Printing/distribution cost is not charged to them.

## Env vars (your side)

In `.env.local` (or Vercel env):

- **`STRIPE_SECRET_KEY`** – Stripe secret key (Dashboard → Developers → API keys). Required for creating Checkout sessions.
- **`STRIPE_WEBHOOK_SECRET`** – Signing secret for the webhook (see below). Required so we can mark orders as paid.
- **`NEXT_PUBLIC_APP_URL`** – App **origin only**, no path (e.g. `https://www.zineground.com`). Used for Stripe success/cancel redirects. Do not include `/api/webhooks/stripe` or any path.

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

## Troubleshooting (100% error rate)

1. **URL must match your app exactly**
   - If your site is **https://www.zineground.com**, the webhook URL must be **https://www.zineground.com/api/webhooks/stripe** (with `www`).
   - If you used **https://zineground.com** (no www), Stripe may be hitting a different host or a redirect that breaks the POST. **Edit** the webhook in Stripe: click it → "Update details" → set URL to **https://www.zineground.com/api/webhooks/stripe** (or your real app URL) → Save. You don’t need to create a new endpoint unless you want to keep both.

2. **Use the correct signing secret**
   - In Stripe: Developers → Webhooks → click your endpoint → "Signing secret" → "Reveal".
   - Copy that value (starts with `whsec_`) and set **STRIPE_WEBHOOK_SECRET** in Vercel (or your host) to exactly that. If the secret is wrong, every request returns 400 and the error rate will be 100%.

3. **See why each request failed**
   - In Stripe: Developers → Webhooks → click the endpoint → "Recent deliveries". Open a failed request to see the HTTP status (400 = bad signature, 404 = wrong URL, 500 = our code or DB error) and the response body. Check your host’s logs (e.g. Vercel) for `[StripeWebhook]` messages.

4. **DB columns**
   - Ensure `distributor_orders` has `payment_status` and `stripe_payment_intent_id` (or the names your app uses). Missing columns cause 500s after signature verification.
