import { Frame, Page, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

/**
 * Sign a Clerk test user in through the real /sign-in UI.
 * Handles both password and email-code (424242) first factors —
 * +clerk_test addresses on a development instance always accept 424242.
 */
export async function signIn(page: Page, email: string, password: string) {
  await setupClerkTestingToken({ page });

  // Dev-server compiles can abort the first navigation — retry a couple times.
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
      break;
    } catch (err) {
      if (attempt >= 3) throw err;
      await page.waitForTimeout(2_000);
    }
  }

  const identifier = page.locator('input[name="identifier"]');
  await identifier.waitFor({ state: "visible", timeout: 30_000 });
  await identifier.fill(email);
  await page.getByRole("button", { name: /^continue$/i }).click();

  const passwordInput = page.locator('input[name="password"]');
  const codeInput = page.locator(
    'input[name="code"], input[autocomplete="one-time-code"]'
  );

  await Promise.race([
    passwordInput.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {}),
    codeInput.first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {}),
  ]);

  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(password);
    await page.getByRole("button", { name: /^continue$/i }).click();
  } else if (await codeInput.first().isVisible().catch(() => false)) {
    await codeInput.first().pressSequentially("424242");
  } else {
    throw new Error("Clerk sign-in: neither password nor code input appeared");
  }

  // Clerk redirects away from /sign-in when the session is active.
  await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 30_000 });
}

/**
 * Stripe hosted Checkout renders the card fields either directly on the page
 * or inside nested iframes, behind a payment-method accordion. Find whichever
 * context actually contains the card number input.
 */
async function findCardContext(page: Page, timeoutMs = 45_000): Promise<Page | Frame> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // The accordion may need "Card" selected before fields exist.
    const cardRadio = page.getByRole("radio", { name: /^card$/i });
    if (await cardRadio.count().catch(() => 0)) {
      const checked = await cardRadio.first().isChecked().catch(() => true);
      if (!checked) await cardRadio.first().click({ force: true }).catch(() => {});
    }

    const contexts: (Page | Frame)[] = [page, ...page.frames()];
    for (const ctx of contexts) {
      try {
        if ((await ctx.locator('input[name="cardNumber"]').count()) > 0) {
          const input = ctx.locator('input[name="cardNumber"]').first();
          if (await input.isVisible().catch(() => false)) return ctx;
        }
      } catch {
        /* frame detached mid-scan — keep looking */
      }
    }
    if (Date.now() > deadline) {
      throw new Error("Stripe Checkout: card number input never appeared");
    }
    await page.waitForTimeout(1_000);
  }
}

/** Fill the Stripe hosted Checkout page (payment or setup mode) and submit. */
export async function fillStripeCheckout(
  page: Page,
  opts: { card: string; expectFailure?: boolean } = { card: "4242424242424242" }
) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });

  const email = page.locator('input[name="email"]');
  if (await email.isVisible().catch(() => false)) {
    if ((await email.inputValue().catch(() => "x")) === "") {
      await email.fill("e2e-receipts+clerk_test@zineground.com");
    }
  }

  const card = await findCardContext(page);
  await card.locator('input[name="cardNumber"]').fill(opts.card);
  await card.locator('input[name="cardExpiry"]').fill("12 / 34");
  await card.locator('input[name="cardCvc"]').fill("123");

  for (const ctx of [card, page]) {
    const name = ctx.locator('input[name="billingName"]');
    if (await name.isVisible().catch(() => false)) {
      await name.fill("E2E Test");
      break;
    }
  }
  for (const ctx of [card, page]) {
    const zip = ctx.locator('input[name="billingPostalCode"]');
    if (await zip.isVisible().catch(() => false)) {
      await zip.fill("79901");
      break;
    }
  }

  // The real submit is type="submit" — Stripe's "Pay with card" accordion
  // label is a hidden type="button" that must not be matched.
  const submit = page
    .locator('[data-testid="hosted-payment-submit-button"], button[type="submit"]')
    .first();
  await submit.click();

  // Link (Stripe's wallet) sometimes interjects — decline it if it shows up.
  const noLink = page.getByRole("button", {
    name: /pay without link|continue without link|not now/i,
  });
  await noLink
    .first()
    .click({ timeout: 5_000 })
    .catch(() => {});

  if (opts.expectFailure) {
    // Declined cards keep you on checkout.stripe.com with an inline error.
    const deadline = Date.now() + 30_000;
    for (;;) {
      const contexts: (Page | Frame)[] = [page, ...page.frames()];
      let found = false;
      for (const ctx of contexts) {
        try {
          const text = await ctx
            .locator("body")
            .innerText()
            .catch(() => "");
          if (/declined|unable to process|expired/i.test(text)) {
            found = true;
            break;
          }
        } catch {
          /* frame detached */
        }
      }
      if (found) break;
      if (Date.now() > deadline) {
        throw new Error("Expected a card-declined error on Stripe Checkout");
      }
      await page.waitForTimeout(1_000);
    }
  } else {
    // Redirect back to the app (staging URL or localhost fallback)
    const appHost = new URL(
      process.env.E2E_BASE_URL ?? "http://localhost:3000"
    ).host;
    await page.waitForURL((url) => url.host === appHost, { timeout: 90_000 });
  }
}
