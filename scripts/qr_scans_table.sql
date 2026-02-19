-- qr_scans: one row per scan (each hit to /qr/issueId/linkId).
-- Run in Supabase: SQL Editor, New query.

CREATE TABLE IF NOT EXISTS qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES issue_links(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  ip_address text,
  referer text
);

-- 2) Ensure every new row gets a timestamp (safe if column already exists)
ALTER TABLE qr_scans
  ALTER COLUMN scanned_at SET DEFAULT now();

-- If you get "column scanned_at does not exist", run this first then re-run the rest:
-- ALTER TABLE qr_scans ADD COLUMN scanned_at timestamptz NOT NULL DEFAULT now();

-- 3) Indexes for analytics (dashboard: by issue, by link, recent by time)
CREATE INDEX IF NOT EXISTS idx_qr_scans_issue_id ON qr_scans(issue_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_link_id ON qr_scans(link_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON qr_scans(scanned_at DESC);

-- 4) Optional: comment for clarity
COMMENT ON TABLE qr_scans IS 'One row per QR scan. Each scan is tied to an issue and a link (QR). scanned_at = when the scan happened.';
