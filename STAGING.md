# Zineground environments

One repo (`zine-landing`), two deployments. **All testing happens on the
hosted staging deployment — never locally.**

| | Production (LIVE) | Hosted staging (TESTING) |
|---|---|---|
| URL | zineground.com | `zine-landing-git-staging-*.vercel.app` |
| Branch | `main` | `staging` |
| Supabase | zineground-live (`hzqjzqzmudetapqwubxf`) | zineground-staging (`oitszqwzqfxoibgkfyer`) |
| Clerk | production instance (pk_live/sk_live) | development instance (pk_test/sk_test) |
| Stripe | LIVE (sk_live) | sandbox (sk_test) |
| Shippo | live token | test token |
| Money | REAL | fake |

The Playwright suite targets the staging URL:
`E2E_BASE_URL=https://<staging-url> npm run test:e2e`

## One-time hosted-staging setup (Vercel dashboard)

1. Create the branch (after committing current work):
   `git checkout -b staging && git push origin staging` then `git checkout main`
2. Vercel → zine-landing project → **Settings → Environment Variables**.
   For each variable below, add a value scoped to **Preview** only
   (Production values already exist — do not touch them):
   - `NEXT_PUBLIC_SUPABASE_URL` → `https://oitszqwzqfxoibgkfyer.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → staging anon key (in local `.env.local`)
   - `SUPABASE_SERVICE_ROLE_KEY` → staging service role key (in local `.env.local`)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → the pk_test key (in local `.env.local`)
   - `CLERK_SECRET_KEY` → the sk_test key (in local `.env.local`)
   - `STRIPE_SECRET_KEY` → sk_test sandbox key (in local `.env.local`)
   - `STRIPE_WEBHOOK_SECRET` → sandbox webhook secret (in local `.env.local`)
   - `SHIPPO_API_KEY` → shippo_test token (in local `.env.local`)
   - `NEXT_PUBLIC_APP_URL` → the stable staging URL once known
3. Vercel builds every push to `staging` automatically. The staging URL is
   permanent; optionally point `staging.zineground.com` at it under
   Settings → Domains (assign to the `staging` branch).

## Day-to-day

- Feature work: branch off `main`, open a PR → GitHub Actions runs the
  Playwright suite (`.github/workflows/e2e.yml`) against a CI-built app +
  staging Supabase.
- Manual testing with fake money: push to `staging`, click around the
  staging URL.
- `main` merge → auto-deploys to zineground.com.

## Test commands (run from the repo folder, target = staging URL)

- `E2E_BASE_URL=https://<staging-url> npm run test:e2e` — whole suite headless
- `E2E_BASE_URL=https://<staging-url> npm run test:e2e:ui` — watch tests drive a real browser
- `npx playwright show-report` — HTML report of the last run
- `npm run seed:staging` — (re)create fixture data in staging Supabase

## GitHub Actions secrets required (Settings → Secrets → Actions)

`STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`,
`STAGING_SUPABASE_SERVICE_ROLE_KEY`, `TEST_CLERK_PUBLISHABLE_KEY`,
`TEST_CLERK_SECRET_KEY`, `TEST_STRIPE_SECRET_KEY`,
`TEST_STRIPE_WEBHOOK_SECRET`, `TEST_SHIPPO_API_KEY`,
`NEXT_PUBLIC_MAPBOX_TOKEN` — same values as the Preview env vars above.
