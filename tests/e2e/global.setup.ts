import { clerkSetup } from "@clerk/testing/playwright";
import { stagingDb } from "./helpers/db";
import { FIXTURES } from "./helpers/fixtures";

/**
 * Runs once before the suite:
 *  1. Obtains a Clerk testing token (bypasses bot detection on the dev instance).
 *  2. Sanity-checks we are pointed at the STAGING Supabase project.
 *  3. Clears order/payment rows from previous runs so flows start clean.
 */
export default async function globalSetup() {
  await clerkSetup({
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  });

  const db = stagingDb(); // throws if not staging / key missing

  // Wipe transactional data from previous runs (fixture rows stay).
  const orders = await db
    .from("distributor_orders")
    .select("id")
    .eq("distributor_id", FIXTURES.distributorId);
  const orderIds = (orders.data ?? []).map((o) => o.id);
  if (orderIds.length) {
    const items = await db
      .from("distributor_order_items")
      .select("id")
      .in("order_id", orderIds);
    const itemIds = (items.data ?? []).map((i) => i.id);
    if (itemIds.length) {
      await db
        .from("creator_print_payments")
        .delete()
        .in("distributor_order_item_id", itemIds);
    }
    await db.from("distributor_order_items").delete().in("order_id", orderIds);
    await db.from("distributor_orders").delete().in("id", orderIds);
  }
  await db.from("creator_print_payments").delete().eq("issue_id", FIXTURES.issueId);
  await db.from("distributor_stock").delete().eq("distributor_id", FIXTURES.distributorId);
  await db.from("store_orders").delete().not("id", "is", null);
  // Saved test cards from previous runs are fine to keep on the distributor row.

  console.log(
    `[e2e setup] staging clean — removed ${orderIds.length} old distributor order(s)`
  );
}
