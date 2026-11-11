CREATE TABLE IF NOT EXISTS scopes (id TEXT PRIMARY KEY, demo INTEGER NOT NULL DEFAULT 0, level TEXT NOT NULL, preset TEXT NOT NULL, config_json TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, role TEXT NOT NULL DEFAULT 'customer', created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_scope ON sessions(scope);
CREATE TABLE IF NOT EXISTS products (scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, id TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL CHECK(price >= 0), compare_at_price INTEGER, images_json TEXT NOT NULL, material TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, PRIMARY KEY(scope,id), UNIQUE(scope,slug));
CREATE TABLE IF NOT EXISTS variants (rowid BIGINT GENERATED ALWAYS AS IDENTITY, scope TEXT NOT NULL, id TEXT NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL, sku TEXT NOT NULL, price INTEGER NOT NULL CHECK(price >= 0), stock INTEGER NOT NULL CHECK(stock >= 0), options_json TEXT NOT NULL, PRIMARY KEY(scope,id), FOREIGN KEY(scope,product_id) REFERENCES products(scope,id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS coupons (scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, code TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('percentage','fixed')), value INTEGER NOT NULL CHECK(value >= 0), min_spend INTEGER NOT NULL DEFAULT 0, max_discount INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, use_limit INTEGER NOT NULL DEFAULT 0, used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0 AND (use_limit = 0 OR used_count <= use_limit)), expires_at TEXT, PRIMARY KEY(scope,code));
CREATE TABLE IF NOT EXISTS orders (scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, id TEXT NOT NULL, session_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, number TEXT NOT NULL, tracking_code_hash TEXT NOT NULL, customer_json TEXT NOT NULL, shipping_json TEXT NOT NULL, subtotal INTEGER NOT NULL CHECK(subtotal >= 0), discount INTEGER NOT NULL CHECK(discount >= 0), shipping_fee INTEGER NOT NULL CHECK(shipping_fee >= 0), total INTEGER NOT NULL CHECK(total >= 0 AND total = subtotal - discount + shipping_fee), coupon_code TEXT, payment_method TEXT NOT NULL, status TEXT NOT NULL, payment_status TEXT NOT NULL, return_status TEXT NOT NULL DEFAULT 'none', note TEXT NOT NULL DEFAULT '', payment_reference TEXT NOT NULL DEFAULT '', carrier TEXT NOT NULL DEFAULT '', tracking_number TEXT NOT NULL DEFAULT '', return_reason TEXT NOT NULL DEFAULT '', payment_url TEXT, gateway_order_id TEXT UNIQUE, gateway_refund_requested INTEGER NOT NULL DEFAULT 0, stock_restored INTEGER NOT NULL DEFAULT 0, coupon_released INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, expires_at TEXT, version INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(scope,id), UNIQUE(scope,session_id,idempotency_key), UNIQUE(scope,number));
CREATE INDEX IF NOT EXISTS orders_customer ON orders(scope,session_id,created_at);
CREATE INDEX IF NOT EXISTS orders_scope_status ON orders(scope,status,created_at);
CREATE TABLE IF NOT EXISTS order_items (scope TEXT NOT NULL, order_id TEXT NOT NULL, variant_id TEXT NOT NULL, product_id TEXT NOT NULL, name TEXT NOT NULL, variant_name TEXT NOT NULL, image TEXT NOT NULL, unit_price INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0 AND quantity <= 99), subtotal INTEGER NOT NULL CHECK(subtotal = unit_price * quantity), PRIMARY KEY(scope,order_id,variant_id), FOREIGN KEY(scope,order_id) REFERENCES orders(scope,id) ON DELETE CASCADE, FOREIGN KEY(scope,variant_id) REFERENCES variants(scope,id));
CREATE TABLE IF NOT EXISTS inventory_movements (rowid BIGINT GENERATED ALWAYS AS IDENTITY, scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, id TEXT NOT NULL, variant_id TEXT NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, order_id TEXT, created_at TEXT NOT NULL, PRIMARY KEY(scope,id));
CREATE TABLE IF NOT EXISTS order_events (rowid BIGINT GENERATED ALWAYS AS IDENTITY, scope TEXT NOT NULL, id TEXT NOT NULL, order_id TEXT NOT NULL, action TEXT NOT NULL, label TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(scope,id), FOREIGN KEY(scope,order_id) REFERENCES orders(scope,id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS audit_events (rowid BIGINT GENERATED ALWAYS AS IDENTITY, scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, id TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, detail TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(scope,id));
CREATE TABLE IF NOT EXISTS wishlist (scope TEXT NOT NULL, session_id TEXT NOT NULL, product_id TEXT NOT NULL, PRIMARY KEY(scope,session_id,product_id), FOREIGN KEY(scope,product_id) REFERENCES products(scope,id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS reviews (scope TEXT NOT NULL, id TEXT NOT NULL, session_id TEXT NOT NULL, product_id TEXT NOT NULL, order_id TEXT NOT NULL, author TEXT NOT NULL, rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(scope,id), UNIQUE(scope,session_id,product_id,order_id), FOREIGN KEY(scope,product_id) REFERENCES products(scope,id) ON DELETE CASCADE, FOREIGN KEY(scope,order_id) REFERENCES orders(scope,id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS payment_events (event_key TEXT PRIMARY KEY, order_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mutation_guards (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok = 1));

-- Additive migration. Existing orders and their immutable totals remain valid.
-- In 0001, orders.shipping_fee is the CHECK-constrained total of all additions.
-- New orders record shipping_base_fee/tax_amount/service_fee individually and
-- save the combined additions in the legacy shipping_fee for CHECK compatibility.
ALTER TABLE sessions ADD COLUMN member_id TEXT;
CREATE TABLE members (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  points_balance INTEGER NOT NULL DEFAULT 0,
  completed_spend INTEGER NOT NULL DEFAULT 0 CHECK(completed_spend >= 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY(scope,id),
  UNIQUE(scope,email)
);
CREATE TABLE member_challenges (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(scope,session_id)
);
CREATE TABLE loyalty_entries (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('redeem','restore','earn','reverse')),
  delta INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(scope,id),
  UNIQUE(scope,order_id,kind)
);
ALTER TABLE orders ADD COLUMN member_id TEXT;
ALTER TABLE orders ADD COLUMN points_redeemed INTEGER NOT NULL DEFAULT 0 CHECK(points_redeemed >= 0);
ALTER TABLE orders ADD COLUMN points_discount INTEGER NOT NULL DEFAULT 0 CHECK(points_discount >= 0);
ALTER TABLE orders ADD COLUMN points_earned INTEGER NOT NULL DEFAULT 0 CHECK(points_earned >= 0);
ALTER TABLE orders ADD COLUMN shipping_base_fee INTEGER;
ALTER TABLE orders ADD COLUMN tax_amount INTEGER NOT NULL DEFAULT 0 CHECK(tax_amount >= 0);
ALTER TABLE orders ADD COLUMN tax_included INTEGER NOT NULL DEFAULT 0 CHECK(tax_included IN (0,1));
ALTER TABLE orders ADD COLUMN service_fee INTEGER NOT NULL DEFAULT 0 CHECK(service_fee >= 0);
UPDATE orders SET shipping_base_fee=shipping_fee;


CREATE UNIQUE INDEX members_scope_email_nocase ON members(scope, lower(email));
-- Preserve the legacy behavior for orders created before this migration.
-- New orders snapshot whether loyalty was enabled at checkout.
ALTER TABLE orders ADD COLUMN loyalty_eligible INTEGER NOT NULL DEFAULT 1 CHECK(loyalty_eligible IN (0,1));
CREATE TABLE IF NOT EXISTS uploads (scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, id TEXT NOT NULL, object_key TEXT NOT NULL, content_type TEXT NOT NULL, PRIMARY KEY(scope,id));
