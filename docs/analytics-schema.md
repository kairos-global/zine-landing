# Analytics & QR scan schema

The dashboard analytics page and QR redirect depend on these Supabase objects.

## Expected tables

### `qr_scans`
Used to record each scan when someone hits `/qr/[issueId]/[linkId]`.

**Columns (aligned with your Supabase schema):**

| Column       | Type   | Notes |
|-------------|--------|--------|
| `id`        | uuid   | Primary key (e.g. default `gen_random_uuid()`) |
| `issue_id`  | uuid   | FK to `issues.id` |
| `link_id`   | uuid   | FK to `issue_links.id` |
| `scanned_at`| timestamptz | When the scan occurred (set by redirect route) |
| `user_agent`| text   | Device/browser string |
| `ip_address`| text   | Client IP |
| `referer`   | text   | Referring URL if any |

Analytics API selects `id, issue_id, link_id, scanned_at` and orders by `scanned_at`. The redirect route inserts all of the above (with `scanned_at` set to now).

### `issues`
Must have: `id`, `title`, `slug`, `profile_id` (for scoping analytics to the owner).

### `issue_links`
Must have: `id`, `issue_id`, `label`, `url` (and optionally `qr_path`, `redirect_path`).

---

If your column names differ (e.g. `issue_id` → `issueId`), share your actual schema and we can align the API select/insert.
