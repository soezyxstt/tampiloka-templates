CREATE TABLE IF NOT EXISTS attendance_canceled (
 tenant_id text NOT NULL, outlet_id text NOT NULL, staff_id text NOT NULL,
 idempotency_key text NOT NULL, request_hash text NOT NULL,
 UNIQUE (tenant_id, outlet_id, staff_id, idempotency_key)
);
