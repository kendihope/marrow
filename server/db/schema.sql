CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  author TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  category TEXT NOT NULL CHECK (category IN ('fiction', 'nonfiction', 'staff')),
  image_url TEXT,
  image_alt TEXT,
  cover_style TEXT,
  staff_note TEXT,
  staff_by TEXT,
  is_new_arrival BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  category_order SMALLINT NOT NULL DEFAULT 0,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  time_label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  customer_name VARCHAR(100) NOT NULL,
  customer_email VARCHAR(254) NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  intasend_api_ref TEXT,
  intasend_invoice_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe, repeatable migration for databases created before hosted checkout.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS intasend_api_ref TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS intasend_invoice_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
UPDATE orders SET status = 'pending' WHERE status = 'requested';
UPDATE orders SET status = 'paid' WHERE status = 'confirmed';
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'payment_failed', 'cancelled'));
CREATE UNIQUE INDEX IF NOT EXISTS orders_intasend_api_ref_idx
  ON orders(intasend_api_ref) WHERE intasend_api_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_intasend_invoice_id_idx
  ON orders(intasend_invoice_id) WHERE intasend_invoice_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity SMALLINT NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0)
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
