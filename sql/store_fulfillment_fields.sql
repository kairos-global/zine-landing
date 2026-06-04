-- Add fulfillment tracking fields to store_orders
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS tracking_number    text,
  ADD COLUMN IF NOT EXISTS shipped_at         timestamptz,
  ADD COLUMN IF NOT EXISTS fulfillment_notes  text;

-- Allow public read of in-stock products (API uses service role key, but this covers direct access)
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON TABLE store_products TO anon, authenticated;
DROP POLICY IF EXISTS "Public can read store products" ON store_products;
CREATE POLICY "Public can read store products"
  ON store_products FOR SELECT TO anon, authenticated
  USING (true);

-- Allow service role full access (already implicit, but explicit for clarity)
GRANT ALL ON TABLE store_products TO service_role;
GRANT ALL ON TABLE store_orders TO service_role;
GRANT ALL ON TABLE store_order_items TO service_role;
