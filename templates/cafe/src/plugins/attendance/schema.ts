import { pgTable, text, timestamp, doublePrecision, integer, uniqueIndex, index } from 'drizzle-orm/pg-core';

// Evidence keys are private storage references, never public URLs.
export const attendanceEvents = pgTable('attendance_events', {
  id: text('id').primaryKey(), tenantId: text('tenant_id').notNull(), outletId: text('outlet_id').notNull(),
  staffId: text('staff_id').notNull(), kind: text('kind').notNull(), occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  sequence: integer('sequence').notNull(), businessDate: text('business_date').notNull(), shiftId: text('shift_id').notNull(),
  latitude: doublePrecision('latitude').notNull(), longitude: doublePrecision('longitude').notNull(),
  accuracyMeters: doublePrecision('accuracy_meters').notNull(), evidenceKey: text('evidence_key').notNull(),
  idempotencyKey: text('idempotency_key').notNull(), requestHash: text('request_hash').notNull(),
}, t => [uniqueIndex('attendance_event_replay').on(t.tenantId, t.outletId, t.staffId, t.idempotencyKey), uniqueIndex('attendance_event_sequence').on(t.tenantId, t.outletId, t.staffId, t.sequence), uniqueIndex('attendance_shift_kind').on(t.tenantId, t.outletId, t.shiftId, t.kind), index('attendance_staff_lookup').on(t.tenantId, t.outletId, t.staffId, t.occurredAt)]);

export const attendanceCorrections = pgTable('attendance_corrections', {
  id: text('id').primaryKey(), tenantId: text('tenant_id').notNull(), outletId: text('outlet_id').notNull(),
  eventId: text('event_id').notNull(), supervisorId: text('supervisor_id').notNull(), reason: text('reason').notNull(),
  correctedAt: timestamp('corrected_at', { withTimezone: true }).notNull(), recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  sequence: integer('sequence').notNull(),
}, t => [uniqueIndex('attendance_correction_sequence').on(t.tenantId, t.outletId, t.eventId, t.sequence)]);

// A stable row to serialize transitions, including the first check-in.
export const attendanceLocks = pgTable('attendance_locks', {
  tenantId: text('tenant_id').notNull(), outletId: text('outlet_id').notNull(), staffId: text('staff_id').notNull(),
}, t => [uniqueIndex('attendance_lock_scope').on(t.tenantId, t.outletId, t.staffId)]);

export const attendanceEvidence = pgTable('attendance_evidence', {
  id: text('id').primaryKey(), tenantId: text('tenant_id').notNull(), outletId: text('outlet_id').notNull(), staffId: text('staff_id').notNull(),
  contentType: text('content_type'), size: integer('size'), createdAt: timestamp('created_at', { withTimezone: true }).notNull(), expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  state: text('state').notNull(), nextCheckAt: timestamp('next_check_at', { withTimezone: true }).notNull().defaultNow(), claimedEventId: text('claimed_event_id'), attempts: integer('attempts').notNull().default(0), lastErrorAt: timestamp('last_error_at', { withTimezone: true }), deletedAt: timestamp('deleted_at', { withTimezone: true }), deletedBy: text('deleted_by'),
}, t => [index('attendance_evidence_retention').on(t.state, t.expiresAt), index('attendance_evidence_reconciliation').on(t.state, t.nextCheckAt, t.id)]);

// Permanent terminal receipts; never removed while record requests can be replayed.
export const attendanceCanceled = pgTable('attendance_canceled', {
  tenantId: text('tenant_id').notNull(), outletId: text('outlet_id').notNull(), staffId: text('staff_id').notNull(),
  idempotencyKey: text('idempotency_key').notNull(), requestHash: text('request_hash').notNull(),
}, t => [uniqueIndex('attendance_canceled_scope').on(t.tenantId, t.outletId, t.staffId, t.idempotencyKey)]);
