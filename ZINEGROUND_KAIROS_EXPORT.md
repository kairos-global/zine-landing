# ZINEGROUND — Kairos Export
Generated: 2026-05-24
Surveyed by: Claude Code agent

---

## Dev Features List

| Feature Name | Status | Notes |
|---|---|---|
| ZineMat canvas editor | shipped | Core zine creation tool at `/zinemat` |
| Mini Zine format | shipped | 8-panel fold layout |
| Half Letter Zine format | shipped | Standard 8.5×5.5 format; canvas editor is placeholder |
| Canvas template system (mini zine) | in-progress | Templates changing soon per founder decision |
| ZineMat — Basics section | shipped | Title + format picker |
| ZineMat — Uploads section | shipped | PDF upload + cover image upload with styled preview cards |
| ZineMat — Interactivity section | shipped | Issue QR block, Collection QR block, add-link form, per-link QR toggles |
| ZineMat — Distribution section | shipped | Print-for-me toggle, max copies/order + auto-approve threshold controls |
| ZineMat — Publish checklist | shipped | Progress bar, required/optional step cards, readiness banner |
| Auto Issue QR generation (on every save) | shipped | `__issue_qr__` link, stable linkId across saves, stored in Supabase Storage |
| Auto Collection QR generation (on every save) | shipped | `__collection_qr__` link, encodes `/collect/[issueId]` |
| Flip viewer | shipped | Apple Books-style slide reveal at `/issues/[slug]/flip`; Mini + Half Letter modes |
| Browse Zines page | shipped | Grid of all published issues with cover images |
| My Library — Drafts + Published | shipped | Split grid of saved drafts and published issues |
| My Library — Zine QR Codes section | shipped | Per-issue QR download cards |
| My Library — Collected section | shipped | Purple-accented cards for physically collected zines |
| Zine Collection flow | shipped | `/collect/[issueId]` route: auth check → upsert collections row → redirect |
| QR tracking redirect | shipped | `/qr/[issueId]/[linkId]` logs scan to `qr_scans` table, then redirects |
| Analytics dashboard | shipped | QR scan chart at `/dashboard/analytics` using PostHog + Supabase |
| Distributor application form | shipped | Multi-field form: business name, address, phone, email, contact info |
| Distributor portal | shipped | Tabs: Browse Issues, Cart, My Orders; cart persists in localStorage |
| Distributor shopping cart | shipped | localStorage key `zineground_distributor_cart`; shows live shipping estimate |
| Distributor tiered shipping pricing | shipped | 1–10=$5 / 11–25=$8 / 26–50=$12 / 51–100=$18 / 101–200=$25 / 201–500=$40 / 500+=$60 |
| Stripe — distributor checkout | shipped | Checkout session via `/api/payments/distributor-checkout`; live mode confirmed |
| Stripe — creator print-for-me checkout | shipped | 10¢/copy, min $0.50; per order item; `/api/payments/creator-checkout` |
| Stripe webhook handler | shipped | `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed` |
| Creator order approvals | shipped | Creators approve/reject large distributor orders; auto-approve threshold |
| Creator print-for-me limits | shipped | `max_copies_per_order` + `auto_approve_quantity` set per zine in Distribution section |
| Admin portal | shipped | `/dashboard/admin` — stats, quick actions, pending counts |
| Admin — distributor management | shipped | Approve/reject distributors; verify+map address; "Verify & Map" modal |
| Admin — geocoding (Nominatim) | shipped | Address search via OpenStreetMap, no API key; User-Agent: `Zineground/1.0` |
| Admin — order fulfillment | shipped | Tracking number + shipment date + notes; fulfillment info visible to distributor |
| Admin — paid creator management | shipped | Approve/reject market creator applications |
| Admin — stats | shipped | Total Users, Published Issues, QR Code Scans |
| Map (Leaflet) | shipped | Default center El Paso TX; only verified+approved distributors shown as purple pins |
| Map — issue filter | shipped | Filter pins by which issue a distributor stocks (via `distributor_stock` table) |
| Map — distributor detail on click | shipped | Shows business name, verified address, contact info |
| Public profiles | shipped | `/u/[handle]` — username or UUID fallback; name, avatar, joined, badges, published zines |
| Profile edit page | shipped | `/dashboard/profile` — avatar upload, display name, username, status badges, "View public profile" link |
| Avatar upload | shipped | Uploads to `zineground` Supabase bucket under `avatars/` folder |
| Creator byline on issue pages | shipped | Avatar + "By [name]" linking to `/u/[handle]` in issue sidebar |
| The Market — buyer browse | shipped | Browse approved paid creators by category |
| The Market — paid creator profile | shipped | Display name, portfolio URL, portfolio images |
| The Market — service listing | shipped | Creators list services by category with prices |
| The Market — buyer checkout | shipped | Cart → order creation → payment |
| The Market — creator order management | shipped | Accept/decline orders; deliverable upload (UI stub shows "coming soon") |
| Dashboard pending approval badge | shipped | Red pill badge on Creator Portal card when `pending_approval` items > 0 |
| Clerk auth | shipped | Sign in / Sign up via Clerk; webhook syncs users to Supabase `profiles` |
| Navbar | shipped | About, Map, Products, Contact, Browse Zines |
| About page | shipped | Staggered feature rectangles using ZineMat color system |
| Contact page | shipped | `hello@zineground.com` mailto link |
| Products / Pricing page | in-progress | Currently shows "printing…" placeholder — no real content yet |
| Half Letter canvas editor | planned | `FullZineEditor.tsx` is a placeholder stub |
| Creator email notifications | planned | Email when large order hits `pending_approval`; no service wired yet |
| Distributor stock management UI | planned | `distributor_stock` table exists; no distributor-facing UI to update it |
| Market — deliverable upload | planned | "Coming soon" stub in accepted order cards |
| Zine category browsing | planned | `ZINE_CATEGORIES` enum defined (comic, art, photography, music, product catalog, menu, event calendar); no browse-by-category UI yet |

---

## Dev Pages List

| Page Name | Route / Path | Status | Description |
|---|---|---|---|
| Landing / Home | `/` | live | Bubble grid nav + rolling quotes + collage graphic |
| About | `/about` | live | Staggered feature rectangles — one per Zineground section |
| Browse Zines | `/browse-zines` | live | Grid of all published issues |
| Contact | `/contact` | live | `hello@zineground.com` mailto |
| Products / Pricing | `/products` | wip | Placeholder ("printing…") — real pricing page not yet built |
| Map | `/map` | live | Leaflet map of verified distributor locations (El Paso default) |
| ZineMat editor | `/zinemat` | live | Full zine creation toolkit |
| Issue detail | `/issues/[slug]` | live | Issue page: cover, flip view button, QR, creator byline |
| Flip viewer | `/issues/[slug]/flip` | live | Page-flip viewer for mini + half-letter zines |
| Sign in | `/sign-in/[[...sign-in]]` | live | Clerk sign-in |
| Sign up | `/sign-up/[[...sign-up]]` | live | Clerk sign-up |
| Public profile | `/u/[handle]` | live | Creator's public page; handle = username or profile UUID |
| Collection redirect | `/collect/[issueId]` | live | Route handler: auth → upsert collection → redirect to issue |
| QR scan redirect | `/qr/[issueId]/[linkId]` | live | Route handler: log scan → redirect to link URL |
| Dashboard | `/dashboard` | live | Card grid: Make Zine, Library, Analytics, Creator Portal, Market, Distributor Portal, Profile, Admin |
| My Library | `/dashboard/library` | live | Saved/published zines, QR codes, collected zines |
| Analytics | `/dashboard/analytics` | live | QR scan bar chart and engagement data |
| Creator Portal | `/dashboard/creator` | live | Zine orders tab (approvals + order history) + Market orders tab |
| Market | `/dashboard/market` | live | Browse/purchase design services; sell panel for paid creators |
| Distributor Portal | `/dashboard/distributor` | live | Browse issues, cart, order history, fulfillment tracking |
| Profile Edit | `/dashboard/profile` | live | Edit avatar, display name, username; view status badges |
| Admin Dashboard | `/dashboard/admin` | live | Stats tiles + quick action cards (admin only) |
| Admin — Distributors | `/dashboard/admin/distributors` | live | Approve/reject/map distributor applications |
| Admin — Orders | `/dashboard/admin/orders` | live | Fulfill distributor orders with tracking |
| Admin — Paid Creators | `/dashboard/admin/paid-creators` | live | Approve/reject market creator applications |
| API — Analytics | `/api/analytics` | live | QR scan data |
| API — Clerk webhook | `/api/clerk-webhook` | live | Syncs Clerk users to Supabase profiles |
| API — Creator market orders | `/api/creator/market-orders` | live | GET list; PATCH accept/decline per item |
| API — Creator order approvals | `/api/creator/order-approvals` | live | GET pending/approved items; PATCH approve/reject |
| API — Creator orders | `/api/creator/orders` | live | GET zine order history for creator |
| API — Distributor issues | `/api/distributors/issues` | live | Issues available for distributors to order |
| API — Distributor me | `/api/distributors/me` | live | Current distributor's profile |
| API — Distributor orders | `/api/distributors/orders` | live | GET order history; POST place order (with limit validation) |
| API — Distributor register | `/api/distributors/register` | live | POST application submission |
| API — Distributor stock | `/api/distributors/stock` | live | Stock data |
| API — Geocode | `/api/geocode` | live | Geocoding endpoint |
| API — Geocode suggest | `/api/geocode/suggest` | live | Nominatim autocomplete for admin address verification |
| API — Library | `/api/library` | live | Issues + issueQrLinks + collectedIssues for current user |
| API — Market apply | `/api/market/apply` | live | Paid creator application |
| API — Market categories | `/api/market/categories` | live | Category list |
| API — Market category creators | `/api/market/categories/[categoryKey]/creators` | live | Approved creators for a category |
| API — Market creator profile | `/api/market/creator-profile` | live | GET/PATCH paid creator profile |
| API — Market me | `/api/market/me` | live | Current user's market status + services |
| API — Market me stats | `/api/market/me/stats` | live | Market stats for creator |
| API — Market orders | `/api/market/orders` | live | Market order history |
| API — Market services | `/api/market/services` | live | Creator's listed services |
| API — Market upload | `/api/market/upload` | live | Portfolio image upload (references non-existent bucket — needs fix) |
| API — Payments check | `/api/payments/check` | live | Payment status check |
| API — Creator checkout | `/api/payments/creator-checkout` | live | Stripe session for creator print-for-me (10¢/copy) |
| API — Distributor checkout | `/api/payments/distributor-checkout` | live | Stripe session for distributor shipping (tiered) |
| API — Profile | `/api/profile` | live | GET profile + status; PATCH display_name, username, avatar_url |
| API — Profile upload | `/api/profile/upload` | live | Avatar image upload to `zineground` bucket |
| API — Stripe webhook | `/api/webhooks/stripe` | live | Handles checkout.session.completed, payment_intent.succeeded/failed |
| API — ZineMat delete link | `/api/zinemat/deletelink` | live | Delete an interactive link |
| API — ZineMat load | `/api/zinemat/load` | live | Load zine draft data |
| API — ZineMat publish | `/api/zinemat/publish` | live | Publish zine (sets status=published) |
| API — ZineMat save | `/api/zinemat/save` | live | Save draft; auto-generates Issue QR + Collection QR |
| API — ZineMat upload URL | `/api/zinemat/upload-url` | live | Pre-signed upload URL for zine assets |
| API — Admin check | `/api/admin/check` | live | Verify admin status |
| API — Admin distributors | `/api/admin/distributors` | live | List all distributors |
| API — Admin distributor by ID | `/api/admin/distributors/[id]` | live | PATCH status or address verification |
| API — Admin orders | `/api/admin/orders` | live | List all distributor orders |
| API — Admin order by ID | `/api/admin/orders/[id]` | live | PATCH fulfill with tracking |
| API — Admin paid creators | `/api/admin/paid-creators` | live | List all market creator applications |
| API — Admin paid creator by ID | `/api/admin/paid-creators/[id]` | live | PATCH approve/reject |
| API — Admin stats | `/api/admin/stats` | live | Platform-wide stats |

---

## Dev Products List

| Product Name | Type | Status | Price | Notes |
|---|---|---|---|---|
| ZineMat (zine creation tool) | digital / free tool | shipped | Free | Core product; every signed-in user can access |
| Distributor Shipping — Tier 1 | shipping service | shipped | $5.00 | 1–10 copies per order |
| Distributor Shipping — Tier 2 | shipping service | shipped | $8.00 | 11–25 copies per order |
| Distributor Shipping — Tier 3 | shipping service | shipped | $12.00 | 26–50 copies per order |
| Distributor Shipping — Tier 4 | shipping service | shipped | $18.00 | 51–100 copies per order |
| Distributor Shipping — Tier 5 | shipping service | shipped | $25.00 | 101–200 copies per order |
| Distributor Shipping — Tier 6 | shipping service | shipped | $40.00 | 201–500 copies per order |
| Distributor Shipping — Tier 7 | shipping service | shipped | $60.00 | 501+ copies per order |
| Creator Print-for-Me | per-copy print fee | shipped | $0.10/copy (min $0.50) | Charged to creator on approved distributor order item |
| Market Design Services | service marketplace | shipped | Creator-set | Flyer design, zine design, logo design, carousel post, graphic illustration |
| Products / Pricing Page | informational | in-progress | — | Currently placeholder; needs real pricing explainer |

---

## Goods List

| Item Name | Category | SKU / ID | Price | Status |
|---|---|---|---|---|
| Physical zines (creator-produced) | zine | set by creator/issue | creator-set | available — produced by creators, distributed via network |
| TBD — platform merchandise | merchandise | TBD | TBD | planned |

---

## Print Runs List

| Run Name | Item | Quantity | Date / Quarter | Status | Notes |
|---|---|---|---|---|---|
| Kinleys Coffee House test order | first live zine order | 5 copies | Q2 2026 | completed | First real Stripe transaction; $5 shipping; fulfilled with tracking |
| TBD | TBD | TBD | TBD | planned | No formal print run tracking in codebase; managed via distributor orders |

---

## Inventory List

| Item | Quantity On Hand | Location | Last Updated | Notes |
|---|---|---|---|---|
| Platform zine stock | tracked per distributor | `distributor_stock` table in Supabase | dynamic | No UI for distributors to update stock yet — admin-managed only |
| Physical inventory (platform-side) | N/A | N/A | N/A | Zineground does not hold physical inventory; creators produce and ship direct |
| TBD — merchandise | TBD | TBD | TBD | TBD |

---

## Mockups List

| Mockup Name | Type | File Path / URL | Status | Notes |
|---|---|---|---|---|
| ZG Collage | product / landing | `/public/images/ZG_Collage.png` | approved | Used as fixed landing page graphic (desktop only) |
| ZG Collage (JPEG) | product / landing | `/public/images/ZG_Collage.jpeg` | approved | JPEG version of same collage |
| Landing Page Graphic | UI / landing | `/public/images/landing-page-graphic.JPG` | archived | Not currently used in active landing page |
| ZG Landing | UI | `/public/images/zglanding.JPG` | unknown | Present in `/public/images/` — status unclear |
| Kairos BP | business plan / deck | `/public/images/kairos-bp.jpg` | unknown | Present in repo — status/usage unclear |

---

## Socials Content List

| Content Title | Platform | Format | Status | Date | Notes |
|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | No social media content plans found in codebase or docs |

---

## Zines List

| Zine Title | Issue # | Status | Print Run | Date | Notes |
|---|---|---|---|---|---|
| TBD (live data in Supabase) | TBD | TBD | TBD | TBD | All zine data is dynamic — query `issues` table in Supabase for live list |
| Kinleys Coffee House test zine | 1 | published (implied) | 5 copies | Q2 2026 | Implied by first live distributor order; actual title in Supabase |

---

## Business Plan

### Overview

**Zineground** is a zine publishing and physical distribution platform. It solves two connected problems: (1) independent zine creators have no dedicated digital home that takes their format seriously, and (2) getting physical zines into the hands of local readers requires navigating fragmented, informal distribution networks with no tooling. Zineground brings both sides together — a browser-based creation tool (ZineMat), a digital distribution network of verified local venues, and a discovery layer for readers.

**Who it's for:**
- **Creators** — independent zine makers who want to design, publish digitally, and get physical copies into local venues without managing logistics themselves
- **Distributors** — shops, cafés, galleries, and venues that carry zines and want a structured way to order, track, and stock them
- **Readers** — people who want to discover local/independent print culture and know where to find it

**Initial market:** El Paso, TX. Expansion into other Texas cities and regional indie publishing scenes planned.

---

### Revenue Model

Zineground has two active revenue streams, both live and tested:

1. **Distributor shipping fees** (tiered by order size)
   — Distributors pay for shipping when they place an order for physical copies. Tiered from $5 (1–10 copies) to $60 (500+ copies). Charged via Stripe Checkout at time of order.

2. **Creator print-for-me fee** (10¢ per copy, min $0.50)
   — When a creator enables "print-for-me" on a zine and a distributor orders copies, the creator pays a per-copy production fee. This is charged after the creator approves the order (or after auto-approval). Charged via Stripe Checkout per order item.

**Marketplace (The Market)** — design services marketplace within the platform (flyer design, zine design, logo design, carousel posts, graphic illustration). Creators set their own prices. Platform fee/cut structure not yet explicitly defined in codebase — currently unclear if Zineground takes a percentage.

**Not yet monetized:**
- ZineMat itself (currently free)
- Browse Zines / reading (free)
- Subscriptions or premium tiers (not built)

---

### Current Status (as of 2026-05-24)

**Live and fully functional:**
- zineground.com deployed on Vercel, auto-deployed from `main`
- Stripe live mode active; first real transaction confirmed (Kinleys Coffee House, 5 copies, $5)
- ZineMat — full zine creation with two formats, interactivity, distribution controls
- Distribution flow end-to-end: apply → approve → verify → order → pay → fulfill → track
- The Market — design services marketplace with paid creator vetting
- Public profiles, zine collection (QR scan → collect), analytics
- Admin portal for platform operations

**In progress:**
- Products/pricing page (placeholder)
- Canvas template redesign (founder decision pending)

**Planned / not built:**
- Creator email notifications (pending approval alerts)
- Distributor stock management UI
- Half Letter canvas editor
- Market deliverable upload flow
- Zine category browsing UI
- Marketing, social content, email campaigns

---

### Goals

**3-Month (by ~August 2026)**
- Launch Products/pricing page — clear explanation of both revenue models
- Onboard 5–10 verified distributors in El Paso area
- Implement creator email notifications for pending approvals
- Build distributor stock management UI
- First wave of Market paid creator approvals
- Get 10+ zines published on platform

**6-Month (by ~November 2026)**
- Expand distribution network to second Texas city (likely San Antonio or Austin)
- Zine category browse UI live
- 50+ published zines
- Revenue > $0 recurring (not just one-off test)
- Half Letter canvas editor launched

**1-Year (by ~May 2027)**
- 3+ cities in active distribution network
- 100+ creators publishing on platform
- 20+ approved distributors
- Market generating meaningful transaction volume
- Consider premium creator tier or subscription model

---

### Key Risks / Blockers

| Risk | Severity | Notes |
|---|---|---|
| No creator awareness / discovery | High | No marketing presence, no social content, no SEO strategy visible in codebase |
| Solo founder execution bottleneck | High | All dev, ops, and business decisions on one person |
| Distributor cold-start | Medium | Map is empty until distributors apply and get verified; chicken-and-egg with creators |
| Creator email notifications absent | Medium | Creators can miss pending approval orders, blocking the print-for-me revenue flow |
| Market portfolio upload broken | Medium | `/api/market/upload` references a non-existent `creator-profile` Supabase bucket |
| No platform fee defined on Market | Medium | Market transactions don't clearly charge Zineground a cut — revenue leakage |
| Products page absent | Low-Medium | Visitors/distributors can't understand pricing before hitting checkout |
| No subscription / recurring revenue | Medium | Current model is transactional; vulnerable to low order volume |

---

### Competitive Landscape

| Competitor | Overlap | Differentiation |
|---|---|---|
| Gumroad | Digital zine sales | Zineground focuses on physical distribution + community, not just digital downloads |
| Etsy | Physical zine marketplace | Zineground is creator-tool-first; ZineMat is built-in; physical distribution is structured |
| Issuu | Digital publishing | No physical distribution; no creation tool; no local/community angle |
| Comichaus / Shortbox | Comics/zine subscriptions | Subscription box model, curated; Zineground is open platform |
| Distro networks (informal) | Physical distribution | Excel spreadsheets and DMs vs. Zineground's structured portal + map |
| Adobe Express / Canva | Design tools | General-purpose; Zineground is zine-specific with publishing + distribution built in |

**Zineground's unique position:** The only platform that combines browser-based zine creation, a verified physical distribution network, QR-powered digital interactivity, and a creator services marketplace — all in one product.

---

## Timelines

### A. Development Roadmap Timeline

```
01. Project setup (Next.js 15, Clerk, Supabase, Tailwind v4, Vercel) — done
02. Landing page + bubble grid navigation — done
03. ZineMat basic editor (PDF upload, cover image, save/publish) — done
04. Browse Zines page — done
05. Issue detail page — done
06. My Library (drafts + published grid) — done
07. QR tracking (issue links + /qr/ redirect + scan logging) — done
08. Flip viewer (Mini + Half Letter modes, Apple Books animation) — done
09. Format selector in ZineMat (mini / half-letter) — done
10. Canvas template system (mini zine templates) — done (redesign in-progress)
11. Auto Issue QR on every save — done
12. Auto Collection QR on every save — done
13. Zine Collection flow (/collect/[issueId]) — done
14. Collected zines section in My Library — done
15. Interactivity section redesign (inline QR per link, Issue QR block) — done
16. Distribution section (print-for-me settings, limit controls) — done
17. Publish checklist redesign (progress bar, required/optional cards) — done
18. Distributor application + portal (cart, orders, fulfillment tracking) — done
19. Admin portal (distributors, orders, paid creators, stats) — done
20. Nominatim geocoding + map pin verification modal — done
21. Map page (Leaflet, El Paso default, issue filter) — done
22. Stripe distributor checkout (tiered shipping) — done
23. Stripe creator print-for-me checkout (10¢/copy, per order item) — done
24. Creator order approvals UI (approve/reject/pay) — done
25. Admin order fulfillment (tracking number + date + notes) — done
26. Public profiles (/u/[handle], profile edit, avatar upload) — done
27. Creator byline on issue pages — done
28. The Market (buyer browse, paid creator profile, service listing, orders) — done
29. Dashboard pending approval badge — done
30. Stripe bug fixes (double-payment guard, webhook error propagation, $0.50 minimum) — done
31. Canvas template redesign — in-progress
32. Products / pricing page (real content) — in-progress
33. Creator email notifications (pending approval alerts) — upcoming
34. Distributor stock management UI — upcoming
35. Half Letter canvas editor (FullZineEditor) — upcoming
36. Market deliverable upload flow — upcoming
37. Zine category browsing UI — upcoming
38. Fix market upload bucket reference (creator-profile → zineground/market/) — upcoming
```

### B. Business / Launch Timeline

```
01. Concept and initial design — done
02. MVP development (ZineMat, library, basic pub flow) — done
03. Distribution system built (apply, approve, order, pay, fulfill) — done
04. Stripe live mode activated — done
05. First distributor onboarded — done
06. First real Stripe transaction processed (Kinleys Coffee House) — done
07. Platform live at zineground.com — done
08. El Paso distribution network: 2–5 active distributors — in-progress
09. Products / pricing page launch — planned (Q2–Q3 2026)
10. Creator onboarding push — planned (Q3 2026)
11. Market paid creator recruitment — planned (Q3 2026)
12. Creator email notifications live — planned (Q3 2026)
13. 10+ zines published on platform — planned (Q3 2026)
14. Distributor stock management UI — planned (Q3 2026)
15. Expand to second Texas city — planned (Q4 2026)
16. 50+ creators / 20+ distributors milestone — planned (Q4 2026)
17. Half Letter canvas editor launch — planned (Q4 2026)
18. Revenue > $0 recurring — planned (Q4 2026)
19. 100+ creators / 3+ cities — planned (Q2 2027)
20. Consider premium tier or subscription model — planned (2027)
```

---

## Calendar Events

| Event | Date | Category | Notes |
|---|---|---|---|
| First live Stripe transaction (Kinleys Coffee House) | 2026-Q2 | milestone | 5 copies, $5 shipping, fulfilled with tracking — confirmed working |
| Products / pricing page launch | TBD — Q2–Q3 2026 | launch | Currently placeholder; needs real pricing content |
| Canvas template redesign | TBD — Q2 2026 | launch | Founder decision pending; in active development |
| Creator email notifications | TBD — Q3 2026 | deadline | Blocking full print-for-me revenue loop |
| Distributor stock management UI | TBD — Q3 2026 | deadline | `distributor_stock` table ready; UI not built |
| El Paso distribution network buildout | Q3 2026 | recurring | Ongoing outreach to local venues |
| Half Letter canvas editor | TBD — Q4 2026 | launch | `FullZineEditor.tsx` is stub |
| Market deliverable upload | TBD — Q4 2026 | launch | "Coming soon" stub in accepted order cards |
| Expansion to second Texas city | TBD — Q4 2026 | launch | Planned after El Paso network is stable |

---

## Additional Notes

### Tech Stack Summary
- **Framework:** Next.js 15 App Router, React 19, TypeScript
- **Styling:** Tailwind CSS v4
- **Auth:** Clerk (`@clerk/nextjs` v6)
- **Database + Storage:** Supabase (Postgres + Supabase Storage)
- **Payments:** Stripe (live mode, `stripe` v19, API version `2025-10-29.clover`)
- **Analytics:** PostHog (`posthog-js` + `posthog-node`)
- **Map:** Leaflet + react-leaflet
- **Canvas tooling:** `react-rnd`, `html-to-image`, `html2canvas`, `pdf-lib`
- **QR codes:** `qrcode`, `qrcode-generator`
- **Geocoding:** Nominatim (OpenStreetMap) — no API key required
- **Deployment:** Vercel, auto-deploy from `main` branch of `github.com/kairos-global/zine-landing`

### Supabase Storage Buckets
- `zineground` (main bucket) — subfolders: `covers/`, `issues/`, `qr-codes/`, `avatars/`
- `creator-profile` — referenced in `/api/market/upload` but does **not exist** yet; needs creating or route needs updating to use `zineground/market/`

### Supabase Tables (confirmed in schema)
`profiles`, `issues`, `issue_links`, `distributor_orders`, `distributor_order_items`, `distributor_stock`, `distributors`, `creator_print_payments`, `map_features`, `market_creators`, `market_creator_services`, `collections`, `qr_scans`

### Admin Access
Determined by `NEXT_PUBLIC_ADMIN_USER_IDS` environment variable (comma-separated Clerk user IDs). Admin portal is only rendered/accessible when this check passes.

### Contact
Platform contact: `hello@zineground.com`

### ZineMat Color System (used across platform UI)
- A) Basics → `#65CBF1` (sky blue)
- B) Uploads → `#F2DC6F` (yellow)
- C) Interactivity → `#82E385` (green)
- D) Distribution → `#D16FF2` (purple)
- Map / The Map feature → `#F26565` (red)
- Browse Zines → `#A4A4A4` (gray)
- Market → `#82E385` (green, shared with Interactivity)

### Zine Category Enum (defined, not yet browsable by UI)
`comic`, `art`, `photography`, `music`, `product_catalog`, `menu`, `event_calendar`

### Market Service Categories
`flyer_design`, `zine_design`, `logo_design`, `carousel_post`, `graphic_illustration`

### Known Issues / Tech Debt
- `api/market/upload` references non-existent `creator-profile` Supabase bucket — will 500 when paid creators try to upload portfolio images
- `FullZineEditor.tsx` is a stub — half-letter canvas editing not functional yet
- `distributor_stock` table has no distributor-facing UI for updates
- No platform fee explicitly charged on Market transactions — revenue model gap
- No email notification system integrated (no SendGrid, Resend, Mailgun, or similar in `package.json`)
