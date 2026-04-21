-- Profile section — display_name, username, avatar_url
-- Run this in Supabase SQL editor.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS username     text,
  ADD COLUMN IF NOT EXISTS avatar_url   text;

-- Case-insensitive unique index on username (nulls allowed)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON profiles (lower(username))
  WHERE username IS NOT NULL;

-- Make sure the bucket we use for avatars exists.
-- (Storage buckets are not DDL-created by migrations; create "profile-avatars"
--  in Supabase Storage UI with "public" read enabled, OR reuse the existing
--  "creator-profile" bucket.)

-- Public SELECT policy so the anon role can render /u/[handle] pages.
-- Only expose the public-facing columns via this policy; sensitive fields
-- (email, clerk_id) are still readable only via the service role.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read public profile fields" ON profiles;
CREATE POLICY "Public can read public profile fields"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE profiles TO anon;
