CREATE FUNCTION commerce_reserve_stock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE((SELECT active FROM products WHERE scope=NEW.scope AND id=NEW.product_id),0) <> 1 THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'; END IF;
  UPDATE variants SET stock=stock-NEW.quantity WHERE scope=NEW.scope AND id=NEW.variant_id AND product_id=NEW.product_id AND price=NEW.unit_price AND stock>=NEW.quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRICE_CHANGED_OR_STOCK_UNAVAILABLE'; END IF;
  INSERT INTO inventory_movements(scope,id,variant_id,delta,reason,order_id,created_at) VALUES(NEW.scope,md5(random()::text || clock_timestamp()::text),NEW.variant_id,-NEW.quantity,'Pesanan masuk',NEW.order_id,to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  RETURN NEW;
END $$;
CREATE TRIGGER reserve_order_stock BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION commerce_reserve_stock();
CREATE FUNCTION commerce_reserve_coupon() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c coupons%ROWTYPE; expected integer;
BEGIN
 IF NEW.coupon_code IS NULL THEN
   IF NEW.discount <> NEW.points_discount THEN RAISE EXCEPTION 'INVALID_DISCOUNT'; END IF;
   RETURN NEW;
 END IF;
 SELECT * INTO c FROM coupons WHERE scope=NEW.scope AND code=NEW.coupon_code FOR UPDATE;
 IF NOT FOUND OR c.active <> 1 THEN RAISE EXCEPTION 'COUPON_UNAVAILABLE'; END IF;
 IF c.expires_at IS NOT NULL AND c.expires_at <= NEW.created_at THEN RAISE EXCEPTION 'COUPON_EXPIRED'; END IF;
 expected := CASE WHEN c.kind='percentage' THEN (NEW.subtotal::bigint*c.value/100)::integer ELSE c.value END;
 IF c.max_discount>0 THEN expected := LEAST(expected,c.max_discount); END IF;
 expected := LEAST(expected,NEW.subtotal);
 IF NEW.subtotal<c.min_spend OR NEW.discount-NEW.points_discount<>expected THEN RAISE EXCEPTION 'COUPON_CHANGED'; END IF;
 UPDATE coupons SET used_count=used_count+1 WHERE scope=NEW.scope AND code=NEW.coupon_code;
 RETURN NEW;
END $$;
CREATE TRIGGER reserve_coupon BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION commerce_reserve_coupon();
CREATE FUNCTION commerce_redeem_points() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.points_redeemed>0 THEN
  UPDATE members SET points_balance=points_balance-NEW.points_redeemed WHERE scope=NEW.scope AND id=NEW.member_id AND points_balance>=NEW.points_redeemed;
  IF NOT FOUND THEN RAISE EXCEPTION 'POINTS_UNAVAILABLE'; END IF;
  INSERT INTO loyalty_entries(scope,id,member_id,order_id,kind,delta,created_at) VALUES(NEW.scope,md5(random()::text || clock_timestamp()::text),NEW.member_id,NEW.id,'redeem',-NEW.points_redeemed,NEW.created_at);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER redeem_member_points AFTER INSERT ON orders FOR EACH ROW EXECUTE FUNCTION commerce_redeem_points();
CREATE FUNCTION commerce_order_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='completed' AND OLD.status<>'completed' AND NEW.payment_status='paid' AND NEW.member_id IS NOT NULL AND NEW.loyalty_eligible=1 THEN
  UPDATE members SET points_balance=points_balance+NEW.points_earned, completed_spend=completed_spend+GREATEST(0,NEW.subtotal-NEW.discount) WHERE scope=NEW.scope AND id=NEW.member_id;
  INSERT INTO loyalty_entries(scope,id,member_id,order_id,kind,delta,created_at) VALUES(NEW.scope,md5(random()::text || clock_timestamp()::text),NEW.member_id,NEW.id,'earn',NEW.points_earned,NEW.updated_at);
 END IF;
 IF NEW.stock_restored=1 AND OLD.stock_restored=0 THEN
  UPDATE variants v SET stock=v.stock+i.quantity FROM order_items i WHERE i.scope=NEW.scope AND i.order_id=NEW.id AND v.scope=i.scope AND v.id=i.variant_id;
  INSERT INTO inventory_movements(scope,id,variant_id,delta,reason,order_id,created_at) SELECT scope,md5(random()::text || clock_timestamp()::text),variant_id,quantity,'Stok kembali',order_id,NEW.updated_at FROM order_items WHERE scope=NEW.scope AND order_id=NEW.id;
  IF NEW.member_id IS NOT NULL THEN
   IF NEW.points_redeemed>0 THEN
    UPDATE members SET points_balance=points_balance+NEW.points_redeemed WHERE scope=NEW.scope AND id=NEW.member_id;
    INSERT INTO loyalty_entries(scope,id,member_id,order_id,kind,delta,created_at) VALUES(NEW.scope,md5(random()::text || clock_timestamp()::text),NEW.member_id,NEW.id,'restore',NEW.points_redeemed,NEW.updated_at);
   END IF;
   IF EXISTS(SELECT 1 FROM loyalty_entries WHERE scope=NEW.scope AND order_id=NEW.id AND kind='earn') THEN
    UPDATE members SET points_balance=points_balance-NEW.points_earned,completed_spend=GREATEST(0,completed_spend-GREATEST(0,NEW.subtotal-NEW.discount)) WHERE scope=NEW.scope AND id=NEW.member_id;
    INSERT INTO loyalty_entries(scope,id,member_id,order_id,kind,delta,created_at) VALUES(NEW.scope,md5(random()::text || clock_timestamp()::text),NEW.member_id,NEW.id,'reverse',-NEW.points_earned,NEW.updated_at);
   END IF;
  END IF;
 END IF;
 IF NEW.coupon_released=1 AND OLD.coupon_released=0 AND NEW.coupon_code IS NOT NULL THEN
  UPDATE coupons SET used_count=GREATEST(0,used_count-1) WHERE scope=NEW.scope AND code=NEW.coupon_code;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER order_update AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION commerce_order_update();
