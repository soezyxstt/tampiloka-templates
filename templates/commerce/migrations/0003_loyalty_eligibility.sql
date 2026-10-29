-- Preserve the legacy behavior for orders created before this migration.
-- New orders snapshot whether loyalty was enabled at checkout.
ALTER TABLE orders ADD COLUMN loyalty_eligible INTEGER NOT NULL DEFAULT 1 CHECK(loyalty_eligible IN (0,1));
DROP TRIGGER IF EXISTS earn_member_points;
CREATE TRIGGER earn_member_points AFTER UPDATE OF status ON orders
  WHEN NEW.status='completed' AND OLD.status!='completed' AND NEW.payment_status='paid' AND NEW.member_id IS NOT NULL AND NEW.loyalty_eligible=1 BEGIN
  UPDATE members SET points_balance=points_balance+NEW.points_earned,
    completed_spend=completed_spend+MAX(0,NEW.subtotal-NEW.discount) WHERE scope=NEW.scope AND id=NEW.member_id;
  INSERT INTO loyalty_entries(scope,id,member_id,order_id,kind,delta,created_at)
    VALUES(NEW.scope,lower(hex(randomblob(16))),NEW.member_id,NEW.id,'earn',NEW.points_earned,NEW.updated_at);
END;
