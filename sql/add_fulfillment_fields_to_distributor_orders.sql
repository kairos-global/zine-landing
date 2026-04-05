-- Migration: Add fulfillment fields to distributor_orders
-- Run this in the Zineground Supabase SQL editor.

ALTER TABLE distributor_orders
  ADD COLUMN IF NOT EXISTS tracking_number    text,
  ADD COLUMN IF NOT EXISTS shipped_at         timestamptz,
  ADD COLUMN IF NOT EXISTS fulfillment_notes  text;

-- Optional: index on tracking_number for quick lookups
CREATE INDEX IF NOT EXISTS distributor_orders_tracking_number_idx
  ON distributor_orders (tracking_number)
  WHERE tracking_number IS NOT NULL;
