// Fixed fixture data — must match what the staging seed creates
// (scripts/seed-staging.mjs / the seeded rows in the zineground-staging project).

export const USERS = {
  creator: {
    email: "e2e-creator+clerk_test@zineground.com",
    password: "E2e-zineground-424242!",
    clerkId: "user_3GWFItFnjDeSvKnJGUAZ3CHPmbF",
    profileId: "11111111-1111-4111-8111-111111111111",
  },
  distributor: {
    email: "e2e-distributor+clerk_test@zineground.com",
    password: "E2e-zineground-424242!",
    clerkId: "user_3GWFJ6dsQcxBoPa3LFhAv2Zt5qA",
    profileId: "22222222-2222-4222-8222-222222222222",
  },
  admin: {
    email: "e2e-admin+clerk_test@zineground.com",
    password: "E2e-zineground-424242!",
    clerkId: "user_3GWFJ34J50cB5YhK1KIMUjqQFTH",
    profileId: "33333333-3333-4333-8333-333333333333",
  },
} as const;

export const FIXTURES = {
  issueId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  issueSlug: "e2e-test-zine",
  issueTitle: "E2E Test Zine",
  distributorId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  distributorBusiness: "E2E Test Bookstore",
  productId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  productName: "E2E Test Tote",
} as const;

// Stripe test cards — https://docs.stripe.com/testing
export const CARDS = {
  ok: "4242424242424242",
  declined: "4000000000000002",
  expired: "4000000000000069",
} as const;
