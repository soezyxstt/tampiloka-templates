CREATE OR REPLACE FUNCTION booking_json_valid(value TEXT) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  PERFORM value::jsonb;
  RETURN TRUE;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN FALSE;
END;
$$;
-- @statement
CREATE TABLE scopes (
  id TEXT PRIMARY KEY, demo BIGINT NOT NULL CHECK(demo IN(0,1)), state_json TEXT NOT NULL,
  secret TEXT NOT NULL, revision BIGINT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, expires_at BIGINT
);
-- @statement
CREATE TABLE settings (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, preset TEXT NOT NULL,
  config_json TEXT NOT NULL CHECK (booking_json_valid(config_json)), PRIMARY KEY(scope,preset)
);
-- @statement
CREATE TABLE sessions (
  hash TEXT PRIMARY KEY, scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  principal TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN('customer','owner','operations','viewer')),
  expires_at BIGINT NOT NULL
);
-- @statement
CREATE TABLE entities (
  rowid BIGSERIAL UNIQUE,
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN('service','resource','location','category')),
  id TEXT NOT NULL, preset TEXT NOT NULL, data TEXT NOT NULL CHECK (booking_json_valid(data)),
  PRIMARY KEY(scope,kind,id)
);
-- @statement
CREATE INDEX entities_preset ON entities(scope,preset,kind);
-- @statement
CREATE TABLE blackouts (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, id TEXT NOT NULL, preset TEXT NOT NULL,
  resource_id TEXT NOT NULL DEFAULT '', location_id TEXT NOT NULL DEFAULT '',
  starts_at BIGINT NOT NULL, ends_at BIGINT NOT NULL CHECK(ends_at>starts_at), reason TEXT NOT NULL,
  PRIMARY KEY(scope,id)
);
-- @statement
CREATE TABLE resource_units (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, resource TEXT NOT NULL,
  unit BIGINT NOT NULL CHECK(unit>=0 AND unit<100), PRIMARY KEY(scope,resource,unit)
);
-- @statement
CREATE TABLE customers (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, id TEXT NOT NULL, principal TEXT NOT NULL,
  data TEXT NOT NULL CHECK (booking_json_valid(data)), PRIMARY KEY(scope,id), UNIQUE(scope,principal)
);
-- @statement
CREATE TABLE bookings (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, preset TEXT NOT NULL,
  principal TEXT NOT NULL, customer_id TEXT NOT NULL, customer_json TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, access_hash TEXT NOT NULL,
  service_id TEXT NOT NULL, item_json TEXT NOT NULL, location_id TEXT NOT NULL, location_name TEXT NOT NULL, timezone TEXT NOT NULL,
  practitioner_id TEXT NOT NULL DEFAULT '', practitioner_name TEXT NOT NULL DEFAULT '',
  starts_at BIGINT NOT NULL CHECK(starts_at%300000=0), ends_at BIGINT NOT NULL CHECK(ends_at>starts_at AND ends_at%300000=0),
  status TEXT NOT NULL CHECK(status IN('requested','pending_confirmation','awaiting_payment','confirmed','checked_in','completed','cancelled','expired','no_show')),
  payment_status TEXT NOT NULL CHECK(payment_status IN('not_required','unpaid','pending','partial','paid','failed','refund_due','refunded')),
  payment_method TEXT NOT NULL CHECK(payment_method IN('location','online')),
  total BIGINT NOT NULL CHECK(total>=0), due_now BIGINT NOT NULL CHECK(due_now>=0 AND due_now<=total),
  paid_amount BIGINT NOT NULL DEFAULT 0 CHECK(paid_amount>=0), refunded_amount BIGINT NOT NULL DEFAULT 0 CHECK(refunded_amount>=0 AND refunded_amount<=paid_amount),
  refund_eligible BIGINT NOT NULL DEFAULT 0 CHECK(refund_eligible>=0),
  policy_json TEXT NOT NULL, options_json TEXT NOT NULL, expires_at BIGINT,
  version BIGINT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
  FOREIGN KEY(scope,customer_id) REFERENCES customers(scope,id),
  UNIQUE(scope,principal,idempotency_key), UNIQUE(scope,id)
);
-- @statement
CREATE INDEX bookings_calendar ON bookings(scope,preset,starts_at,status);
-- @statement
CREATE INDEX bookings_customer ON bookings(scope,principal,created_at);
-- @statement
CREATE INDEX bookings_expiry ON bookings(expires_at,status);
-- @statement
CREATE TABLE allocations (
  scope TEXT NOT NULL, resource TEXT NOT NULL, unit BIGINT NOT NULL, tick BIGINT NOT NULL, booking_id TEXT NOT NULL,
  PRIMARY KEY(scope,resource,unit,tick),
  FOREIGN KEY(scope,resource,unit) REFERENCES resource_units(scope,resource,unit),
  FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
-- @statement
CREATE INDEX allocations_booking ON allocations(scope,booking_id);
-- @statement
CREATE TABLE booking_events (
  rowid BIGSERIAL UNIQUE,
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, booking_id TEXT NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '', internal BIGINT NOT NULL DEFAULT 0 CHECK(internal IN(0,1)), at BIGINT NOT NULL,
  FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
-- @statement
CREATE INDEX events_booking ON booking_events(scope,booking_id,at);
-- @statement
CREATE TABLE access_grants (
  scope TEXT NOT NULL, principal TEXT NOT NULL, booking_id TEXT NOT NULL,
  PRIMARY KEY(scope,principal,booking_id), FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
-- @statement
CREATE TABLE payments (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, booking_id TEXT NOT NULL, provider TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK(amount>0), status TEXT NOT NULL CHECK(status IN('created','starting','pending','failed','paid','refund_pending','refunded')),
  reference TEXT NOT NULL UNIQUE, checkout_url TEXT, version BIGINT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL,
  FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
-- @statement
CREATE UNIQUE INDEX one_active_payment ON payments(booking_id) WHERE status IN('created','starting','pending');
-- @statement
CREATE TABLE payment_events (
  id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE, state TEXT NOT NULL, at BIGINT NOT NULL
);
-- @statement
CREATE TABLE refunds (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL, amount BIGINT NOT NULL CHECK(amount>0),
  status TEXT NOT NULL CHECK(status IN('requested','pending','confirmed','failed')), reference TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL, FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
-- @statement
CREATE UNIQUE INDEX one_refund_per_payment ON refunds(payment_id);
-- @statement
CREATE TABLE tickets (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, booking_id TEXT NOT NULL, used_at BIGINT, revoked BIGINT NOT NULL DEFAULT 0,
  FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
-- @statement
CREATE UNIQUE INDEX active_ticket ON tickets(booking_id) WHERE revoked=0;
-- @statement
CREATE TABLE mutation_guards (id TEXT PRIMARY KEY, ok BIGINT NOT NULL CHECK(ok=1));
-- @statement
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count BIGINT NOT NULL, expires_at BIGINT NOT NULL);
-- @statement
CREATE TABLE notification_jobs (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, booking_id TEXT NOT NULL,
  event TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempts BIGINT NOT NULL DEFAULT 0, next_at BIGINT NOT NULL,
  FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
-- @statement
CREATE FUNCTION booking_release_slots() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('cancelled','expired','completed','no_show') AND NEW.status <> OLD.status THEN
    DELETE FROM allocations WHERE scope=NEW.scope AND booking_id=NEW.id;
    UPDATE tickets SET revoked=1 WHERE scope=NEW.scope AND booking_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
-- @statement
CREATE TRIGGER release_booking_slots AFTER UPDATE OF status ON bookings FOR EACH ROW EXECUTE FUNCTION booking_release_slots();
-- @statement
CREATE FUNCTION booking_guard_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> OLD.status AND NOT (
    (OLD.status='requested' AND NEW.status IN ('pending_confirmation','awaiting_payment','confirmed','cancelled','expired')) OR
    (OLD.status='pending_confirmation' AND NEW.status IN ('awaiting_payment','confirmed','cancelled','expired')) OR
    (OLD.status='awaiting_payment' AND NEW.status IN ('confirmed','cancelled','expired')) OR
    (OLD.status='confirmed' AND NEW.status IN ('checked_in','cancelled','no_show','pending_confirmation')) OR
    (OLD.status='checked_in' AND NEW.status='completed')
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION';
  END IF;
  RETURN NEW;
END;
$$;
-- @statement
CREATE TRIGGER booking_state_guard BEFORE UPDATE OF status ON bookings FOR EACH ROW EXECUTE FUNCTION booking_guard_state();
