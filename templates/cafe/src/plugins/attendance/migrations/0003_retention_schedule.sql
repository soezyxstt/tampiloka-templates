ALTER TABLE attendance_evidence ADD COLUMN IF NOT EXISTS next_check_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS attendance_evidence_reconciliation ON attendance_evidence (state, next_check_at, id);
