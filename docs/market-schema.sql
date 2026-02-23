-- =============================================================================
-- Market: paid creators and their services
-- Run this in Supabase SQL Editor to create tables and RLS.
-- =============================================================================

-- 1) Enum for market creator application status
CREATE TYPE market_creator_status AS ENUM ('pending', 'approved', 'rejected');

-- 2) market_creators: one row per creator who applied to sell on the market
CREATE TABLE market_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status market_creator_status NOT NULL DEFAULT 'pending',
  portfolio_url text,
  bio text,
  stripe_account_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

CREATE INDEX idx_market_creators_profile_id ON market_creators(profile_id);
CREATE INDEX idx_market_creators_status ON market_creators(status);

-- 3) market_creator_services: which categories they sell and at what price
CREATE TABLE market_creator_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_creator_id uuid NOT NULL REFERENCES market_creators(id) ON DELETE CASCADE,
  category_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  price_cents integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(market_creator_id, category_key)
);

CREATE INDEX idx_market_creator_services_creator ON market_creator_services(market_creator_id);
CREATE INDEX idx_market_creator_services_category ON market_creator_services(category_key);
CREATE INDEX idx_market_creator_services_list ON market_creator_services(category_key, enabled) WHERE enabled = true AND price_cents IS NOT NULL;

-- 4) Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER market_creators_updated_at
  BEFORE UPDATE ON market_creators
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER market_creator_services_updated_at
  BEFORE UPDATE ON market_creator_services
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- 5) RLS: only backend (service_role) should access these tables
--    Authenticated/anon have no direct access; all access goes through your API.
ALTER TABLE market_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_creator_services ENABLE ROW LEVEL SECURITY;

-- No permissive policies: anon/authenticated get no access. Your API uses
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS in Supabase.