-- =============================================================================
-- Market: orders and order items (buyer places order; creator accepts/declines;
-- creator uploads deliverable; buyer sees in History).
-- Run after market-schema.sql. RLS: same pattern (no policies, service_role only).
-- =============================================================================

-- Order status: placed → paid (after checkout) → items move to accepted/declined/completed
CREATE TYPE market_order_status AS ENUM ('placed', 'paid', 'cancelled');
CREATE TYPE market_order_item_status AS ENUM ('pending', 'accepted', 'declined', 'completed');

-- Buyer's order (one per purchase)
CREATE TABLE market_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status market_order_status NOT NULL DEFAULT 'placed',
  total_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_orders_buyer ON market_orders(buyer_profile_id);
CREATE INDEX idx_market_orders_created ON market_orders(created_at DESC);

-- Line items: each is one service from one creator (creator can accept/decline, then upload)
CREATE TABLE market_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_order_id uuid NOT NULL REFERENCES market_orders(id) ON DELETE CASCADE,
  market_creator_id uuid NOT NULL REFERENCES market_creators(id) ON DELETE CASCADE,
  category_key text NOT NULL,
  price_cents integer NOT NULL,
  status market_order_item_status NOT NULL DEFAULT 'pending',
  deliverable_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_market_order_items_order ON market_order_items(market_order_id);
CREATE INDEX idx_market_order_items_creator ON market_order_items(market_creator_id);
CREATE INDEX idx_market_order_items_status ON market_order_items(status);

CREATE TRIGGER market_orders_updated_at
  BEFORE UPDATE ON market_orders
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER market_order_items_updated_at
  BEFORE UPDATE ON market_order_items
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

ALTER TABLE market_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_order_items ENABLE ROW LEVEL SECURITY;
