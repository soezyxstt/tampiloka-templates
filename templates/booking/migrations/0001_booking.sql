PRAGMA foreign_keys = ON;
CREATE TABLE scopes (
  id TEXT PRIMARY KEY, demo INTEGER NOT NULL CHECK(demo IN(0,1)), state_json TEXT NOT NULL,
  secret TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, expires_at INTEGER
);
CREATE TABLE settings (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, preset TEXT NOT NULL,
  config_json TEXT NOT NULL CHECK(json_valid(config_json)), PRIMARY KEY(scope,preset)
);
CREATE TABLE sessions (
  hash TEXT PRIMARY KEY, scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
  principal TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN('customer','owner','operations','viewer')),
  expires_at INTEGER NOT NULL
);
CREATE TABLE entities (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, kind TEXT NOT NULL CHECK(kind IN('service','resource','location','category')),
  id TEXT NOT NULL, preset TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)),
  PRIMARY KEY(scope,kind,id)
);
CREATE INDEX entities_preset ON entities(scope,preset,kind);
CREATE TABLE blackouts (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, id TEXT NOT NULL, preset TEXT NOT NULL,
  resource_id TEXT NOT NULL DEFAULT '', location_id TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL CHECK(ends_at>starts_at), reason TEXT NOT NULL,
  PRIMARY KEY(scope,id)
);
CREATE TABLE resource_units (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, resource TEXT NOT NULL,
  unit INTEGER NOT NULL CHECK(unit>=0 AND unit<100), PRIMARY KEY(scope,resource,unit)
);
CREATE TABLE customers (
  scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, id TEXT NOT NULL, principal TEXT NOT NULL,
  data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(scope,id), UNIQUE(scope,principal)
);
CREATE TABLE bookings (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, preset TEXT NOT NULL,
  principal TEXT NOT NULL, customer_id TEXT NOT NULL, customer_json TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, access_hash TEXT NOT NULL,
  service_id TEXT NOT NULL, item_json TEXT NOT NULL, location_id TEXT NOT NULL, location_name TEXT NOT NULL, timezone TEXT NOT NULL,
  practitioner_id TEXT NOT NULL DEFAULT '', practitioner_name TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL CHECK(starts_at%300000=0), ends_at INTEGER NOT NULL CHECK(ends_at>starts_at AND ends_at%300000=0),
  status TEXT NOT NULL CHECK(status IN('requested','pending_confirmation','awaiting_payment','confirmed','checked_in','completed','cancelled','expired','no_show')),
  payment_status TEXT NOT NULL CHECK(payment_status IN('not_required','unpaid','pending','partial','paid','failed','refund_due','refunded')),
  payment_method TEXT NOT NULL CHECK(payment_method IN('location','online')),
  total INTEGER NOT NULL CHECK(total>=0), due_now INTEGER NOT NULL CHECK(due_now>=0 AND due_now<=total),
  paid_amount INTEGER NOT NULL DEFAULT 0 CHECK(paid_amount>=0), refunded_amount INTEGER NOT NULL DEFAULT 0 CHECK(refunded_amount>=0 AND refunded_amount<=paid_amount),
  refund_eligible INTEGER NOT NULL DEFAULT 0 CHECK(refund_eligible>=0),
  policy_json TEXT NOT NULL, options_json TEXT NOT NULL, expires_at INTEGER,
  version INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  FOREIGN KEY(scope,customer_id) REFERENCES customers(scope,id),
  UNIQUE(scope,principal,idempotency_key), UNIQUE(scope,id)
);
CREATE INDEX bookings_calendar ON bookings(scope,preset,starts_at,status);
CREATE INDEX bookings_customer ON bookings(scope,principal,created_at);
CREATE INDEX bookings_expiry ON bookings(expires_at,status);
CREATE TABLE allocations (
  scope TEXT NOT NULL, resource TEXT NOT NULL, unit INTEGER NOT NULL, tick INTEGER NOT NULL, booking_id TEXT NOT NULL,
  PRIMARY KEY(scope,resource,unit,tick),
  FOREIGN KEY(scope,resource,unit) REFERENCES resource_units(scope,resource,unit),
  FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
CREATE INDEX allocations_booking ON allocations(scope,booking_id);
CREATE TABLE booking_events (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, booking_id TEXT NOT NULL, action TEXT NOT NULL, actor TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '', internal INTEGER NOT NULL DEFAULT 0 CHECK(internal IN(0,1)), at INTEGER NOT NULL,
  FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
CREATE INDEX events_booking ON booking_events(scope,booking_id,at);
CREATE TABLE access_grants (
  scope TEXT NOT NULL, principal TEXT NOT NULL, booking_id TEXT NOT NULL,
  PRIMARY KEY(scope,principal,booking_id), FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
CREATE TABLE payments (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, booking_id TEXT NOT NULL, provider TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount>0), status TEXT NOT NULL CHECK(status IN('created','starting','pending','failed','paid','refund_pending','refunded')),
  reference TEXT NOT NULL UNIQUE, checkout_url TEXT, version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX one_active_payment ON payments(booking_id) WHERE status IN('created','starting','pending');
CREATE TABLE payment_events (
  id TEXT PRIMARY KEY, payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE, state TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE TABLE refunds (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0),
  status TEXT NOT NULL CHECK(status IN('requested','pending','confirmed','failed')), reference TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL, FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX one_refund_per_payment ON refunds(payment_id);
CREATE TABLE tickets (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL, booking_id TEXT NOT NULL, used_at INTEGER, revoked INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX active_ticket ON tickets(booking_id) WHERE revoked=0;
CREATE TABLE mutation_guards (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE notification_jobs (
  id TEXT PRIMARY KEY, scope TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE, booking_id TEXT NOT NULL,
  event TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL,
  FOREIGN KEY(scope,booking_id) REFERENCES bookings(scope,id) ON DELETE CASCADE
);
CREATE TRIGGER release_booking_slots AFTER UPDATE OF status ON bookings
WHEN NEW.status IN('cancelled','expired','completed','no_show') AND NEW.status<>OLD.status
BEGIN
  DELETE FROM allocations WHERE scope=NEW.scope AND booking_id=NEW.id;
  UPDATE tickets SET revoked=1 WHERE scope=NEW.scope AND booking_id=NEW.id;
END;
CREATE TRIGGER booking_state_guard BEFORE UPDATE OF status ON bookings
WHEN NEW.status<>OLD.status AND NOT (
  (OLD.status='requested' AND NEW.status IN('pending_confirmation','awaiting_payment','confirmed','cancelled','expired')) OR
  (OLD.status='pending_confirmation' AND NEW.status IN('awaiting_payment','confirmed','cancelled','expired')) OR
  (OLD.status='awaiting_payment' AND NEW.status IN('confirmed','cancelled','expired')) OR
  (OLD.status='confirmed' AND NEW.status IN('checked_in','cancelled','no_show','pending_confirmation')) OR
  (OLD.status='checked_in' AND NEW.status='completed')
)
BEGIN SELECT RAISE(ABORT,'INVALID_TRANSITION'); END;
