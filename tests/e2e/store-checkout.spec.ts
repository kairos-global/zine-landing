import { test, expect } from "@playwright/test";
import { fillStripeCheckout } from "./helpers/auth";
import { stagingDb, waitFor } from "./helpers/db";
import { FIXTURES, CARDS } from "./helpers/fixtures";

/**
 * Public store checkout: cart → address → live Shippo rate → Stripe payment
 * → verify-on-return marks the order paid (+ buys the label).
 *
 * Requires SHIPPO_API_KEY (test token) — the store blocks checkout without a
 * selectable shipping rate, so this suite skips until the key is configured.
 */
test.describe("store checkout", () => {
  test.skip(
    !process.env.SHIPPO_API_KEY,
    "SHIPPO_API_KEY not set — store checkout requires live rates"
  );

  test("guest buys a product with a test card", async ({ page }) => {
    test.slow();
    await page.goto("/store");

    // Open the product modal (image button is labeled "View <name>") and add to cart
    await page
      .getByRole("button", { name: `View ${FIXTURES.productName}` })
      .click();
    await page.getByRole("button", { name: /add to cart/i }).click();

    // Shipping address (El Paso, matches the return address region)
    await page.getByPlaceholder(/name/i).first().fill("E2E Buyer");
    await page.getByPlaceholder(/street|address/i).first().fill("125 W Mills Ave");
    await page.getByPlaceholder(/city/i).fill("El Paso");
    await page.getByPlaceholder(/state/i).fill("TX");
    await page.getByPlaceholder(/zip/i).fill("79901");

    // Wait for live rates, keep the default (cheapest) selection
    await expect(page.locator('input[type="radio"]').first()).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("button", { name: /checkout/i }).click();
    await fillStripeCheckout(page, { card: CARDS.ok });
    await expect(page).toHaveURL(/order=success/);
    await expect(page.getByText(/order placed/i)).toBeVisible();

    // DB: order paid with shipping recorded
    const db = stagingDb();
    const order = await waitFor(
      async () => {
        const { data } = await db
          .from("store_orders")
          .select("id, status, shipping_cost_cents, shippo_label_url")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return data?.status === "paid" ? data : null;
      },
      { label: "store order paid" }
    );
    expect(order.shipping_cost_cents ?? 0).toBeGreaterThan(0);
  });
});
