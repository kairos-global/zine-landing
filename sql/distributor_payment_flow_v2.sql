-- ============================================================
-- Distributor Payment Flow v2
-- Run this in the Supabase SQL editor before deploying.
-- ============================================================

-- 1. Stripe Customer ID on the distributors table
--    Used to charge the saved card automatically once creators approve.
ALTER TABLE distributors
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- 2. Card capture columns on distributor_orders
--    stripe_payment_method_id: saved when distributor completes Stripe Setup Checkout
--    stripe_setup_session_id:  the Stripe Checkout session used to save the card
ALTER TABLE distributor_orders
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS stripe_setup_session_id  text;

-- 3. Allow the new 'pending_creator_approval' status value
--    Drop and recreate the CHECK constraint to add the new value.
ALTER TABLE distributor_orders
  DROP CONSTRAINT IF EXISTS distributor_orders_status_check;

ALTER TABLE distributor_orders
  ADD CONSTRAINT distributor_orders_status_check
  CHECK (status IN (
    'draft',                    -- legacy, no longer created
    'pending_creator_approval', -- card saved, waiting on creators
    'placed',                   -- auto-billed, in production
    'fulfilled',                -- shipped
    'cancelled'                 -- all rejected or charge failed
  ));
