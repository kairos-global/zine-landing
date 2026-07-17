import { defineConfig, devices } from "@playwright/test";

// Load local env (Next.js loads .env.local itself for the dev server; the test
// process needs the same values for Clerk setup and DB assertions).
// In CI the env vars are provided directly, so a missing file is fine.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local (CI) — env comes from the runner */
}

// The suite targets the HOSTED STAGING deployment (staging branch on Vercel).
// Set E2E_BASE_URL to the staging URL — that is the normal way to run it.
// Without E2E_BASE_URL (e.g. in GitHub Actions) it boots the app itself.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global.setup.ts",
  // Payment flows are stateful (orders in the staging DB) — keep them serial.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Only boot a server when no staging URL was given (CI fallback).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
