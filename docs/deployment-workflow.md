# Deployment and branch workflow

Use one permanent pre-production branch: **`staging`**. Do not maintain both
`staging` and `testing`; two branches serving the same purpose make it unclear
which version was approved. Before deleting either existing branch, check the
Vercel project's **Settings → Git → Production Branch** and its branch-domain
configuration. Keep whichever branch is already connected to the staging
domain, rename it to `staging` if necessary, and only then delete the duplicate.

## Recommended environments

| Git ref | Vercel environment | Purpose |
| --- | --- | --- |
| `main` | Production | Public Zineground site |
| `staging` | Preview with a stable branch domain | Final authenticated testing |
| Feature branches / pull requests | Ephemeral preview | Review one change in isolation |

Use separate Clerk and Supabase projects (or, at minimum, separate Supabase
schemas and Clerk instances) for Preview and Production. Configure these in
Vercel's environment-variable scopes. Never copy production service-role keys
into repository files or GitHub Actions.

## Shipping a feature

1. Create a feature branch from the latest `main`.
2. Open a pull request and wait for `npm run check` to pass.
3. Visit the Vercel preview URL and test sign-in, backend writes, and the feature.
4. Merge the feature into `staging` and test the stable staging URL.
5. Promote the exact tested commit by merging `staging` into `main`.
6. Confirm the Vercel production deployment, then run a short production smoke
   test. Do not develop directly on `main`, even when production is currently
   the only environment that has working authentication.

## Canvas release smoke test

- In ZineMat, click **New Canvas** and confirm the URL contains the new issue ID.
- Refresh immediately and confirm the untitled draft still opens.
- Select eight images, arrange them, and choose a frame for every page.
- Set the global background and verify it appears in both editor views.
- Add and reposition text in Top view, then refresh and confirm it persists.
- Complete the checklist, name the zine, and confirm its library record updates.
- Confirm another signed-in account cannot load or save the canvas ID.

The GitHub Actions workflow deliberately runs deterministic code checks only.
Authenticated browser tests should be added later using dedicated staging Clerk
test users and Supabase test data; they should never target the production data
store.

## Public map, store, and contact

The map reads approved distributors with verified addresses and lists published issues with positive stock. The store uses its existing catalog and order tables. Keep **Mini Zine Display** out of stock until inventory is ready. The product preview uses rendered views of `3dmodels/finished/zine-holders/zine-holder-v3-mini.stl`. The Featured Zine Pack uses cover art supplied by shdwmtn and salamanderprint.

### Contact intake and Google Workspace

Apply `supabase/migrations/20261121165326_contact_requests.sql` in each environment that serves the new contact form. The inbox is at `/dashboard/admin/contact` and requires a Clerk user with the Zineground admin role. A request remains available there even when its email notification fails.

Enable the Gmail API in a Google Cloud project owned by your Workspace organization. Authorize an internal OAuth client as the mailbox owner with offline access and only the `https://www.googleapis.com/auth/gmail.send` scope. Set `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` in the Vercel environment that sends notifications. Set `GMAIL_SENDER` to the authorized mailbox if it differs from `hello@zineground.com`. The notification goes to `hello@zineground.com`, with the visitor’s email in Reply-To. [Google OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server) · [Gmail API sending](https://developers.google.com/workspace/gmail/api/guides/sending)

Confirm that Gmail is active and `hello@zineground.com` is a mailbox or alias in Google Admin. Generate and activate DKIM for the domain in Google Admin, then test inbound mail, outbound replies, and a form submission that changes to **Sent** in the admin inbox. [Google DKIM setup](https://knowledge.workspace.google.com/admin/security/set-up-dkim)

### Stripe fulfillment

Point Stripe at the canonical HTTPS URL for `/api/webhooks/stripe`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired` alongside the existing payment intent events. Use a sandbox catalog and signing secret to test the full return and fulfillment path before enabling the first sellable product.
