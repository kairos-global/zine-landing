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
