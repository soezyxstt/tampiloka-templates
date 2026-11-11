CREATE TABLE attendance_locks (tenant_id text NOT NULL, outlet_id text NOT NULL, staff_id text NOT NULL, UNIQUE (tenant_id, outlet_id, staff_id));
CREATE TABLE attendance_events (
 id text PRIMARY KEY, tenant_id text NOT NULL, outlet_id text NOT NULL, staff_id text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('IN','OUT')), occurred_at timestamptz NOT NULL, sequence integer NOT NULL,
 business_date text NOT NULL, shift_id text NOT NULL, latitude double precision NOT NULL, longitude double precision NOT NULL,
 accuracy_meters double precision NOT NULL, evidence_key text NOT NULL, idempotency_key text NOT NULL, request_hash text NOT NULL,
 UNIQUE (tenant_id, outlet_id, staff_id, idempotency_key), UNIQUE (tenant_id, outlet_id, staff_id, sequence), UNIQUE (tenant_id, outlet_id, shift_id, kind)
);
CREATE INDEX attendance_staff_lookup ON attendance_events (tenant_id, outlet_id, staff_id, occurred_at);
CREATE TABLE attendance_corrections (
 id text PRIMARY KEY, tenant_id text NOT NULL, outlet_id text NOT NULL, event_id text NOT NULL,
 supervisor_id text NOT NULL, reason text NOT NULL, corrected_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL,
 sequence integer NOT NULL, UNIQUE (tenant_id, outlet_id, event_id, sequence)
);
