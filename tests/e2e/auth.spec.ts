import { test, expect } from "@playwright/test";
import { signIn } from "./helpers/auth";
import { USERS } from "./helpers/fixtures";

test.describe("authentication", () => {
  test("creator can sign in and reach the dashboard", async ({ page }) => {
    await signIn(page, USERS.creator.email, USERS.creator.password);
    await page.goto("/dashboard");
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
    await expect(page.getByText(/make a zine/i).first()).toBeVisible();
  });

  test("dashboard is protected for signed-out visitors", async ({ page }) => {
    await page.goto("/dashboard");
    // Clerk middleware should bounce to sign-in
    await expect(page).toHaveURL(/sign-in/, { timeout: 30_000 });
  });

  test("admin sees the admin portal", async ({ page }) => {
    await signIn(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/dashboard/admin");
    await expect(page.getByText(/quick actions|admin/i).first()).toBeVisible();
  });
});
