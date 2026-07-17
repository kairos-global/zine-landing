import { test, expect } from "@playwright/test";
import { signIn, fillStripeCheckout } from "./helpers/auth";
import { stagingDb, waitFor } from "./helpers/db";
import { USERS, FIXTURES, CARDS } from "./helpers/fixtures";

/**
 * The core Zineground revenue flow, end to end, in Stripe test mode:
 *
 *  1. Distributor orders copies of a print-for-me zine → saves a card
 *     (Stripe Checkout in setup mode, no charge).
 *  2. Order item auto-approves (qty below the creator's threshold).
 *  3. Creator pays the print fee (10¢/copy, $0.50 Stripe minimum)
 *     — declined card is tried first to cover the failure path.
 *  4. checkAndFinalizeOrder charges the distributor's saved card
 *     off-session and the order lands as placed/paid.
 */
test.describe.serial("distributor print-for-me flow", () => {
  test("distributor places order and saves card", async ({ page }) => {
    test.slow();
    await signIn(page, USERS.distributor.email, USERS.distributor.password);
    await page.goto("/dashboard/distributor");

    // Browse Zines tab → add the only zine to the cart
    await page.getByRole("button", { name: /browse zines/i }).first().click();
    await expect(page.getByText(FIXTURES.issueTitle).first()).toBeVisible();
    await page.getByRole("button", { name: /add to cart/i }).first().click();

    // Place order → Stripe setup checkout (save card, no charge)
    await page.getByRole("button", { name: /place order & save card/i }).click();
    await fillStripeCheckout(page, { card: CARDS.ok });

    // Back in the portal with ?setup=success — verify-on-return runs
    await expect(page).toHaveURL(/setup=success/);

    // DB: order exists with a saved payment method
    const db = stagingDb();
    const order = await waitFor(
      async () => {
        const { data } = await db
          .from("distributor_orders")
          .select("id, status, stripe_payment_method_id")
          .eq("distributor_id", FIXTURES.distributorId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.stripe_payment_method_id ? data : null;
      },
      { label: "saved payment method on order" }
    );
    expect(order.status).toBe("pending_creator_approval");

    // Portal shows the order awaiting creator payment (item auto-approved)
    await page.goto("/dashboard/distributor");
    await page.getByRole("button", { name: /orders/i }).first().click();
    await expect(page.getByText(/awaiting creator payment/i).first()).toBeVisible();
  });

  test("creator pays print fee (declined first), order finalizes", async ({ page }) => {
    test.slow();
    await signIn(page, USERS.creator.email, USERS.creator.password);
    await page.goto("/dashboard/creator?tab=zine-orders");

    // Auto-approved item is awaiting payment
    const payButton = page.getByRole("button", { name: /pay \$\d/i }).first();
    await expect(payButton).toBeVisible({ timeout: 30_000 });
    await payButton.click();

    // Failure path: declined card keeps us on Stripe with an error
    await fillStripeCheckout(page, { card: CARDS.declined, expectFailure: true });

    // Retry on the same Checkout session with a good card
    await fillStripeCheckout(page, { card: CARDS.ok });
    await expect(page).toHaveURL(/payment=success/);

    // DB: print payment paid, order finalized, distributor charged off-session
    const db = stagingDb();
    const order = await waitFor(
      async () => {
        const { data } = await db
          .from("distributor_orders")
          .select("id, status, payment_status, stripe_payment_intent_id")
          .eq("distributor_id", FIXTURES.distributorId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.status === "placed" && data?.payment_status === "paid"
          ? data
          : null;
      },
      { label: "order placed + paid after finalization", timeoutMs: 90_000 }
    );
    expect(order.stripe_payment_intent_id).toBeTruthy();

    // Stock trigger: distributor now has copies in stock
    const { data: stock } = await db
      .from("distributor_stock")
      .select("quantity")
      .eq("distributor_id", FIXTURES.distributorId)
      .eq("issue_id", FIXTURES.issueId)
      .maybeSingle();
    expect(stock?.quantity ?? 0).toBeGreaterThan(0);
  });
});
