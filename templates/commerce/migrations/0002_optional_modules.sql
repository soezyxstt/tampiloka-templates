-- Additive migration. Existing orders and their immutable totals remain valid.
-- In 0001, orders.shipping_fee is the CHECK-constrained total of all additions.
-- New orders record shipping_base_fee/tax_amount/service_fee individually and
-- save the combined additions in the legacy shipping_fee for CHECK compatibility.
ALTER TABLE sessions ADD COLUMN member_id TEXT;
CREATE TABLE members (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
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

-- Coupons remain atomic and enforce the coupon share of a combined discount.
DROP TRIGGER IF EXISTS reserve_coupon;
CREATE TRIGGER reserve_coupon BEFORE INSERT ON orders WHEN NEW.coupon_code IS NOT NULL BEGIN
  SELECT CASE WHEN COALESCE((SELECT active FROM coupons WHERE scope=NEW.scope AND code=NEW.coupon_code),0) != 1 THEN RAISE(ABORT,'COUPON_UNAVAILABLE') END;
  SELECT CASE WHEN (SELECT expires_at FROM coupons WHERE scope=NEW.scope AND code=NEW.coupon_code) <= NEW.created_at THEN RAISE(ABORT,'COUPON_EXPIRED') END;
  SELECT CASE WHEN NEW.subtotal < (SELECT min_spend FROM coupons WHERE scope=NEW.scope AND code=NEW.coupon_code) THEN RAISE(ABORT,'COUPON_CHANGED') END;
  SELECT CASE WHEN NEW.discount - NEW.points_discount !=
    (SELECT MIN(NEW.subtotal, CASE WHEN max_discount>0 THEN MIN(max_discount,CASE WHEN kind='percentage' THEN CAST(NEW.subtotal*value/100 AS INTEGER) ELSE value END) ELSE CASE WHEN kind='percentage' THEN CAST(NEW.subtotal*value/100 AS INTEGER) ELSE value END END)
     FROM coupons WHERE scope=NEW.scope AND code=NEW.coupon_code) THEN RAISE(ABORT,'COUPON_CHANGED') END;
  UPDATE coupons SET used_count=used_count+1 WHERE scope=NEW.scope AND code=NEW.coupon_code;
END;
CREATE TRIGGER validate_no_coupon BEFORE INSERT ON orders
  WHEN NEW.coupon_code IS NULL AND NEW.discount != NEW.points_discount
  BEGIN SELECT RAISE(ABORT,'INVALID_DISCOUNT'); END;

-- Redeem and restore are in the same D1 batch transaction as the order mutation.
CREATE TRIGGER redeem_member_points AFTER INSERT ON orders WHEN NEW.points_redeemed > 0 BEGIN
  UPDATE members SET points_balance=points_balance-NEW.points_redeemed
    WHERE scope=NEW.scope AND id=NEW.member_id AND points_balance>=NEW.points_redeemed;
  SELECT CASE WHEN changes()!=1 THEN RAISE(ABORT,'POINTS_UNAVAILABLE') END;
  INSERT INTO loyalty_entries(scope,id,member_id,order_id,kind,delta,created_at)
    VALUES(NEW.scope,lower(hex(randomblob(16))),NEW.member_id,NEW.id,'redeem',-NEW.points_redeemed,NEW.created_at);
END;
CREATE TRIGGER earn_member_points AFTER UPDATE OF status ON orders
  WHEN NEW.status='completed' AND OLD.status!='completed' AND NEW.payment_status='paid' AND NEW.member_id IS NOT NULL BEGIN
  UPDATE members SET points_balance=points_balance+NEW.points_earned,
    completed_spend=completed_spend+MAX(0,NEW.subtotal-NEW.discount) WHERE scope=NEW.scope AND id=NEW.member_id;
  INSERT INTO loyalty_entries(scope,id,member_id,order_id,kind,delta,created_at)
    VALUES(NEW.scope,lower(hex(randomblob(16))),NEW.member_id,NEW.id,'earn',NEW.points_earned,NEW.updated_at);
END;
CREATE TRIGGER restore_member_points AFTER UPDATE OF stock_restored ON orders
  WHEN NEW.stock_restored=1 AND OLD.stock_restored=0 AND NEW.member_id IS NOT NULL BEGIN
  UPDATE members SET points_balance=points_balance+NEW.points_redeemed
    WHERE scope=NEW.scope AND id=NEW.member_id AND NEW.points_redeemed>0;
  INSERT INTO loyalty_entries(scope,id,member_id,order_id,kind,delta,created_at)
    SELECT NEW.scope,lower(hex(randomblob(16))),NEW.member_id,NEW.id,'restore',NEW.points_redeemed,NEW.updated_at
    WHERE NEW.points_redeemed>0;
  -- Only claw back points if the order was completed previously.
  UPDATE members SET points_balance=points_balance-NEW.points_earned,
    completed_spend=MAX(0,completed_spend-MAX(0,NEW.subtotal-NEW.discount))
    WHERE scope=NEW.scope AND id=NEW.member_id
      AND EXISTS(SELECT 1 FROM loyalty_entries WHERE scope=NEW.scope AND order_id=NEW.id AND kind='earn');
  INSERT INTO loyalty_entries(scope,id,member_id,order_id,kind,delta,created_at)
    SELECT NEW.scope,lower(hex(randomblob(16))),NEW.member_id,NEW.id,'reverse',-NEW.points_earned,NEW.updated_at
    WHERE EXISTS(SELECT 1 FROM loyalty_entries WHERE scope=NEW.scope AND order_id=NEW.id AND kind='earn');
END;
