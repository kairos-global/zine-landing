// Seed the STAGING Supabase project with the fixture data the E2E suite expects.
// Idempotent — safe to run repeatedly. Never run against production.
//
//   node scripts/seed-staging.mjs
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (staging) in env
// or .env.local.

import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* CI provides env directly */
}

const STAGING_REF = "oitszqwzqfxoibgkfyer";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url.includes(STAGING_REF)) {
  console.error(`Refusing to seed non-staging project: ${url}`);
  process.exit(1);
}
if (!key || key.startsWith("REPLACE_WITH")) {
  console.error("SUPABASE_SERVICE_ROLE_KEY (staging) is not set.");
  process.exit(1);
}

const db = createClient(url, key);

const PROFILES = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    clerk_id: "user_3GWFItFnjDeSvKnJGUAZ3CHPmbF",
    email: "e2e-creator+clerk_test@zineground.com",
    role: "creator",
    display_name: "E2E Creator",
    username: "e2ecreator",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    clerk_id: "user_3GWFJ6dsQcxBoPa3LFhAv2Zt5qA",
    email: "e2e-distributor+clerk_test@zineground.com",
    role: "creator",
    display_name: "E2E Distributor",
    username: "e2edistributor",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    clerk_id: "user_3GWFJ34J50cB5YhK1KIMUjqQFTH",
    email: "e2e-admin+clerk_test@zineground.com",
    role: "admin",
    display_name: "E2E Admin",
    username: "e2eadmin",
  },
];

const ISSUE = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "E2E Test Zine",
  slug: "e2e-test-zine",
  status: "published",
  published_at: new Date().toISOString().slice(0, 10),
  cover_img_url:
    "https://hzqjzqzmudetapqwubxf.supabase.co/storage/v1/object/public/zineground/covers/1f56fe80-13cd-4d28-ab10-26435cc13d58.png",
  pdf_url:
    "https://hzqjzqzmudetapqwubxf.supabase.co/storage/v1/object/public/zineground/issues/1f56fe80-13cd-4d28-ab10-26435cc13d58.pdf",
  profile_id: "11111111-1111-4111-8111-111111111111",
  self_distribute: false,
  print_for_me: true,
  zine_format: "mini",
  max_copies_per_order: 50,
  auto_approve_quantity: 20,
};

const DISTRIBUTOR = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  user_id: "user_3GWFJ6dsQcxBoPa3LFhAv2Zt5qA",
  status: "approved",
  business_name: "E2E Test Bookstore",
  business_address: "600 Congress Ave, Austin, TX 78701",
  business_phone: "512-555-0100",
  business_email: "e2e-distributor+clerk_test@zineground.com",
  contact_name: "E2E Distributor",
  contact_title: "Owner",
  contact_email: "e2e-distributor+clerk_test@zineground.com",
  lat: 30.2672,
  lng: -97.7431,
  verified_address: "600 Congress Ave, Austin, TX 78701",
  address_verified_at: new Date().toISOString(),
  ship_street1: "600 Congress Ave",
  ship_city: "Austin",
  ship_state: "TX",
  ship_zip: "78701",
  ship_country: "US",
};

const PRODUCT = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  name: "E2E Test Tote",
  description: "Test product for automated checkout tests",
  price_cents: 500,
  category: "merch",
  in_stock: true,
  sort_order: 999,
  weight_oz: 4,
  length_in: 10,
  width_in: 8,
  height_in: 1,
};

async function upsert(table, rows, onConflict) {
  const { error } = await db.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`✓ ${table} (${Array.isArray(rows) ? rows.length : 1})`);
}

await upsert("profiles", PROFILES, "clerk_id");
await upsert("issues", ISSUE, "id");
await upsert("distributors", DISTRIBUTOR, "user_id");
await upsert("store_products", PRODUCT, "id");
console.log("Staging seed complete.");
