import { test, expect } from "@playwright/test";
import { FIXTURES } from "./helpers/fixtures";

test.describe("public pages", () => {
  test("homepage renders with nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /browse zines/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /about/i }).first()).toBeVisible();
  });

  test("browse zines lists the published test zine", async ({ page }) => {
    await page.goto("/browse-zines");
    await expect(page.getByText(FIXTURES.issueTitle).first()).toBeVisible();
  });

  test("issue detail page renders", async ({ page }) => {
    await page.goto(`/issues/${FIXTURES.issueSlug}`);
    await expect(page.getByText(FIXTURES.issueTitle).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /flip view/i })).toBeVisible();
  });

  test("about page renders the frozen hero", async ({ page }) => {
    await page.goto("/about");
    await expect(
      page.getByText(/zineground is a platform for distribution/i)
    ).toBeVisible();
  });

  test("store lists the test product", async ({ page }) => {
    await page.goto("/store");
    await expect(page.getByText(FIXTURES.productName).first()).toBeVisible();
  });

  test("map shows verified distributor count", async ({ page }) => {
    await page.goto("/map");
    // Control bar: "Distributors" label + black pill with the pin count
    await expect(page.getByText("Distributors", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("span.bg-black.text-white").first()).toHaveText(
      /^\d+$/,
      { timeout: 30_000 }
    );
  });
});
