import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Service-role client for the STAGING project — used for assertions + cleanup. */
export function stagingDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.startsWith("REPLACE_WITH")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY for the staging project is not set in .env.local"
    );
  }
  if (!url.includes("oitszqwzqfxoibgkfyer")) {
    throw new Error(
      `Refusing to run E2E tests against non-staging Supabase project: ${url}`
    );
  }
  return createClient(url, key);
}

/** Poll until `fn` returns a truthy value or the timeout elapses. */
export async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  { timeoutMs = 60_000, intervalMs = 2_000, label = "condition" } = {}
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await fn();
    if (result) return result as T;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
