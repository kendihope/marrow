-- Apply this migration once in the Supabase SQL Editor before testing IntaSend checkout.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS intasend_api_ref TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS intasend_invoice_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
UPDATE orders SET status = 'legacy' WHERE status IN ('requested', 'confirmed');
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'payment_failed', 'cancelled', 'legacy'));
CREATE UNIQUE INDEX IF NOT EXISTS orders_intasend_api_ref_idx
  ON orders(intasend_api_ref) WHERE intasend_api_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_intasend_invoice_id_idx
  ON orders(intasend_invoice_id) WHERE intasend_invoice_id IS NOT NULL;
