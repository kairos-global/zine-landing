# Zineground: product scope and next steps

Code inventory reviewed October 8, 2026. “Implemented” below means a page and supporting code exist; it does not mean every production payment, permission, or fulfillment path was exercised during this scanner release.

Zineground connects **making**, **discovering**, **collecting**, and **physically distributing** independent zines. QR codes are the bridge from a printed object to a creator’s digital destination. The repository contains a Next.js web app, not a separate iOS or Android app.

## Pages and journeys

| Page | Route | Current scope |
| --- | --- | --- |
| Landing | `/` | Existing visual landing experience and navigation. Unchanged by this release. |
| About | `/about` | Reader, creator, and distributor explanations; pricing copy and FAQ. Includes an offline-zines proposal, which is informational rather than an implemented workflow. |
| Contact | `/contact` | Email contact link. |
| Browse zines | `/browse-zines` | Published issue covers, issue pages, PDF download/print actions, make-a-zine entry. |
| Issue | `/issues/[slug]` | Cover and creator, digital PDF, interactive links and QR codes, map links, flip-reader entry. |
| Flip reader | `/issues/[slug]/flip` | Digital page-flipping viewer. |
| Creator profile | `/u/[handle]` | Public creator identity and published work. |
| Map | `/map` | Distributor locations and issue-stock filtering; issue pages can link to a filtered map. |
| Store | `/store` | Product browsing, detail modal, cart, Stripe checkout, purchase confirmation. Empty stock currently produces a “Coming soon” state. |
| Sign in / sign up | `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]` | Clerk account flows. |
| Dashboard | `/dashboard` | Entrypoint to reader, creator, distributor, profile, analytics, and eligible admin tools; pending approval badge. Now includes a prominent scanner shortcut. |
| **QR scanner — new** | `/dashboard/scan` | Full-screen live camera, automatic QR detection, photo import, camera switching, supported-device flashlight, native redirect, external result card, copy and scan-again actions. |
| **Mobile concept — new** | `/dashboard/mobile-preview` | Isolated interactive navigation concept: Home, Discover, Scan, Library, You. Links open existing pages. No replacement of the landing page or global navigation. |
| Library | `/dashboard/library` | Drafts, published issues, generated QR codes, and collected zines. |
| Analytics | `/dashboard/analytics` | Creator-owned issue and individual-link scan counts, charts, and time-based reporting. |
| Profile | `/dashboard/profile` | Edit public identity, profile image/handle, account statuses, published work. |
| ZineMat | `/zinemat` | Start an eight-page canvas or upload a zine; metadata, file settings, interactive links, QR generation, distribution settings, save/publish checklist. |
| Canvas | `/canvas?id=…` | Dedicated visual eight-page editor with page assets, positioning, backgrounds, text, saving, and print-sheet imposition. API operations check ownership. |
| Creator portal | `/dashboard/creator` | Zine-order approvals, payment steps, print/fulfillment information, paid-creator profile, market orders and store order history. |
| Distributor portal | `/dashboard/distributor` | Application/approval states, setup-payment flow, available issues, order cart, stock, order history, and location details. |
| Market | `/dashboard/market` | **Placeholder UI.** Services-market APIs and parts of creator management exist, but the customer-facing page says “Coming soon.” |
| Admin overview | `/dashboard/admin` | Platform totals and access to operational management. User management, content moderation, and deeper platform analytics are placeholders. |
| Distributor administration | `/dashboard/admin/distributors` | Review applications, approve/reject, manage business and verified map-location details. |
| Paid creator administration | `/dashboard/admin/paid-creators` | Review and manage paid-creator applications and statuses. |
| Distributor order administration | `/dashboard/admin/orders` | Review order/payment state and finalize fulfillment. |
| Store administration | `/dashboard/admin/store` | Product management and store-order fulfillment. |

## Supporting services

| Area | Existing routes / integration |
| --- | --- |
| Authentication and identity | Clerk provider, sign-in/up pages, protected-route middleware, `/api/clerk-webhook`, profile APIs. |
| Content and uploads | `/api/zinemat/{save,load,publish,deletelink,upload-url}`, `/api/canvas`, `/api/canvas/[id]`, `/api/canvas/save`, `/api/library`. Supabase stores content and files. |
| QR and collections | `/qr/[issueId]/[linkId]` resolves `issue_links`, records `qr_scans`, optionally emits a PostHog event, then redirects. `/collect/[issueId]` adds the issue to the signed-in reader’s collection. |
| Analytics | `/api/analytics` and `/api/admin/stats`. |
| Discovery | Supabase-backed public issue/profile/map pages, `/api/geocode` and `/api/geocode/suggest`. |
| Distribution | `/api/distributors/{me,register,issues,stock,orders}` and admin distributor/order APIs. |
| Creator operations | `/api/creator/{orders,order-approvals,market-orders}` and per-item market-order updates. |
| Store | Product, order, and my-orders APIs under `/api/store`. |
| Services market | `/api/market/{categories,services,upload,creator-profile,apply,me,orders}`, category creator listings, creator stats. Backend footprint is broader than the visible Market UI. |
| Payments | Stripe store, creator, distributor, and setup checkout/verification routes; payment checks and `/api/webhooks/stripe`. |
| Operations | Admin authorization helpers, GitHub checks, Vercel Git deployments. |

## What a native QR code means

A QR pattern has no built-in creator identity. The encoded payload is what matters. Zineground currently generates HTTPS links containing a Zineground origin plus `/qr/{issue UUID}/{link UUID}`. The redirect endpoint associates that pair with the saved destination and creator analytics.

The scanner automatically opens only that route format or the existing `/collect/{issue UUID}` format on the exact canonical Zineground origins (or an explicitly configured HTTPS site origin). It does not trust arbitrary subdomains, lookalike domains, embedded usernames/passwords, unknown paths, or URLs with query/hash additions for automatic navigation. The server still validates that a link exists; recognizing a native route is not a cryptographic authenticity guarantee.

Native link scans pass through the existing endpoint instead of opening the final URL directly, preserving its scan logging. Collection codes keep the existing collection behavior and sign-in requirements. A creator’s QR that contains a direct external URL cannot be identified as Zineground-generated; it gets the external preview card.

External web URLs remain visible in the camera view until the reader chooses **Open link**. Email, phone, Wi-Fi, contact, and plain-text QR payloads show their content for copying; they do not automatically launch other apps. The preview does not fetch arbitrary destination pages or claim a site is trustworthy. Camera frames and uploaded photos are processed locally using jsQR, not sent to a server. Following a native code still invokes the existing server-side scan analytics.

## Recommended product direction

1. **Keep the landing page as the public front door.** Introduce a separate app shell for repeat visitors. The prototype uses Home / Discover / Scan / Library / You, with Scan in the center. Creator/distributor/admin tools belong under You or a workspace switcher rather than competing for primary navigation space.
2. **Make discovery and scanning usable before sign-in.** Browse, map, public profiles, issue reading, and QR redirects already have public routes. The new scanner intentionally inherits Dashboard protection for this release. Next, expose a public `/scan` and request sign-in only when saving to a library, making a zine, ordering, or managing a workspace. Audit actual redirects before removing broad auth rules.
3. **Tighten collection behavior before expanding it.** The existing collection handler selects publication status but does not check it before collecting, and its missing-issue fallback points to `/browse` although the existing browse page is `/browse-zines`. Its success redirect also carries a `collected` flag that the issue page does not currently turn into a visible confirmation. Fix these together with a clear “Added to your library” experience.
4. **Establish a stable QR contract.** Keep printed links permanent; let creators update destinations without reprinting. Add a branded unavailable-code page, destination validation, and a documented native-domain policy. Future custom-domain or signed-code support should be explicit rather than trusting any URL that resembles Zineground.
5. **Make the library reader-friendly.** Separate Collected / Made by you, keep drafts easy to resume, and add search once library size warrants it. Consider opt-in recent scans; avoid retaining sensitive Wi-Fi/contact QR content by default.
6. **Finish one commerce journey at a time.** Validate distributor application → approval → payment → stock/order → fulfillment first. Then decide whether the services market is a launch priority; its placeholder page and substantial API surface currently imply different levels of readiness.
7. **Add repeatable authenticated staging tests.** Cover Clerk return URLs, ownership, publication visibility, collection idempotency, creator approval, checkout webhooks, and order fulfillment with dedicated test data. Preview and production auth/database/payment settings should be separate.
8. **Consider installability after the scanner is tested on phones.** An installable web app could make the scanner one tap away without a separate native app. Validate iOS Safari/Android Chrome permissions, camera switching, orientation, resume behavior, and flashlight support before committing to that direction.

## Release verification and phone checks

Automated QR tests: `npm run test:scanner`. They cover native/collection URLs, external previews, unsafe schemes, lookalike domains, configured origins, payload types, and actual generated normal/inverted QR images. The decoder is loaded only by the scanner route.

On a signed-in phone at the production HTTPS site:

- Dashboard → Scan a QR code → allow camera; scan a native link and confirm its configured destination and creator scan count.
- Scan an external URL; confirm the preview remains above the live camera until Open link.
- Scan another code, dismiss/re-scan, upload a QR photo, and try an image without a code.
- Deny camera permission and confirm the photo path and retry instructions remain usable.
- Try front/back camera, supported-device flashlight, app background/resume, browser Back, and closing the scanner. Camera access should end when leaving/backgrounding.
- Open the mobile prototype and try all four tabs plus the center Scan action. Visit `/` to confirm the original landing page.

A browser test harness can exercise the new components with generated codes and simulated camera input. This does not substitute for actual iPhone/Android hardware or prove production Clerk, database writes, and analytics delivery end to end.

Release-specific browser checks passed in an isolated harness mounting the actual scanner/prototype components: photo decoding, native navigation, external-link confirmation, unsafe text, Wi-Fi payloads, corrupt-image recovery, prototype tab interactions, live QR detection under React StrictMode, camera-switch cleanup, background/foreground stop-and-resume, page-exit cleanup, and narrow-screen overflow. Generated QR images and canvas video streams were used; no physical camera or production account was involved.
