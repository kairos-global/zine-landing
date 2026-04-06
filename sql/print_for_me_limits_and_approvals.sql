-- ============================================================
-- Print-for-Me: Full migration — safe to run fresh or re-run
-- ============================================================

-- 1. Add creator-controlled limits to issues
ALTER TABLE issues
  ADD COLUMN IF NOT EXISTS max_copies_per_order int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS auto_approve_quantity int NOT NULL DEFAULT 20;

-- 2. Add approval tracking to distributor_order_items
ALTER TABLE distributor_order_items
  ADD COLUMN IF NOT EXISTS creator_approval_status text
    NOT NULL DEFAULT 'auto_approved'
    CHECK (creator_approval_status IN ('auto_approved', 'pending_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS creator_reviewed_at timestamptz;

-- 3. Create creator_print_payments (distributor_order_items.id is bigint, not uuid)
CREATE TABLE IF NOT EXISTS creator_print_payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id                    uuid REFERENCES issues(id) ON DELETE SET NULL,
  profile_id                  text NOT NULL,
  distributor_order_item_id   bigint REFERENCES distributor_order_items(id) ON DELETE SET NULL,
  quantity                    int,
  amount                      numeric(10,2) NOT NULL,
  currency                    text NOT NULL DEFAULT 'usd',
  stripe_checkout_session_id  text,
  stripe_payment_intent_id    text,
  payment_status              text NOT NULL DEFAULT 'pending'
                                CHECK (payment_status IN ('pending', 'paid', 'failed')),
  payment_type                text NOT NULL DEFAULT 'per_copy',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- If table already existed without these columns, add them
ALTER TABLE creator_print_payments
  ADD COLUMN IF NOT EXISTS distributor_order_item_id bigint
    REFERENCES distributor_order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity int;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_print_payments_order_item
  ON creator_print_payments (distributor_order_item_id);

CREATE INDEX IF NOT EXISTS idx_order_items_approval_status
  ON distributor_order_items (creator_approval_status);
