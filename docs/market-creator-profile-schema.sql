-- =============================================================================
-- Paid Creator Profile: display name, profile picture, portfolio images
-- Run after market-schema.sql. Adds columns to market_creators.
-- =============================================================================

ALTER TABLE market_creators
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS profile_image_url text,
  ADD COLUMN IF NOT EXISTS portfolio_image_urls jsonb DEFAULT '[]';

-- portfolio_image_urls: array of URLs (e.g. ["https://...", "https://..."])
-- Up to 5 images. Enforce in app or add CHECK (jsonb_array_length(portfolio_image_urls) <= 5) if desired.
