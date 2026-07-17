import { test, expect } from "@playwright/test";

/** The webhook must reject anything that isn't signed by Stripe. */
test.describe("stripe webhook hardening", () => {
  test("rejects requests with no signature", async ({ request }) => {
    const res = await request.post("/api/webhooks/stripe", {
      data: { type: "checkout.session.completed", fake: true },
    });
    expect(res.status()).toBe(400);
  });

  test("rejects requests with a forged signature", async ({ request }) => {
    const res = await request.post("/api/webhooks/stripe", {
      headers: {
        "stripe-signature":
          "t=1700000000,v1=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      },
      data: JSON.stringify({ type: "checkout.session.completed" }),
    });
    expect(res.status()).toBe(400);
  });
});
