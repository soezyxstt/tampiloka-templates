import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from './schema.ts';
import { createAttendanceRepository } from './repository.ts';
import { businessDate, validateLocation, createAttendanceService } from './service.ts';
import { createAttendanceHandler } from './api.ts';
import type { AttendanceCommand, OutletPolicy } from './contracts.ts';

test('attendance serializes transitions, scopes identity, and appends corrections in PGlite', async () => {
  const client = new PGlite();
  try {
    const db = drizzle(client, { schema });
    await (await pushSchema(schema, drizzle(client))).apply();
    const repo = createAttendanceRepository(db as never);
    let now = new Date('2026-11-10T17:00:00Z');
    const service = createAttendanceService({ repository: repo, evidence: { verify: async ({ key }) => key === 'private-key' }, clock: () => now });
    const principal = { tenantId: 'tenant', staffId: 'staff', outletIds: ['outlet'], supervisorOutletIds: [] as string[] };
    const policy: OutletPolicy = { tenantId: 'tenant', outletId: 'outlet', latitude: -6, longitude: 107, radiusMeters: 100, maxAccuracyMeters: 30, maxLocationAgeMs: 60000, timezone: 'Asia/Jakarta', businessCutoff: '04:00', requireFace: false, requireLiveness: false };
    const command: AttendanceCommand = { outletId: 'outlet', kind: 'IN', idempotencyKey: '0123456789abcdef', evidenceKey: 'private-key', location: { latitude: -6, longitude: 107, accuracyMeters: 5, capturedAt: now.toISOString() } };
    const first = await service.record(principal, policy, command);
    assert.equal(first.businessDate, '2026-11-10');
    assert.equal((await service.record(principal, policy, command)).id, first.id);
    await assert.rejects(service.record(principal, policy, { ...command, location: { ...command.location, accuracyMeters: 6 } }), /IDEMPOTENCY_CONFLICT/);
    await assert.rejects(service.record(principal, policy, { ...command, location: { ...command.location, capturedAt: '2020-01-01T00:00:00Z' } }), /STALE_LOCATION/);
    await assert.rejects(service.record(principal, policy, { ...command, evidenceKey: 'other' }), /INVALID_EVIDENCE/);
    await assert.rejects(service.record({ ...principal, tenantId: 'other' }, policy, command), /FORBIDDEN/);
    await assert.rejects(service.record(principal, { ...policy, requireFace: true }, command), /BIOMETRIC_UNAVAILABLE/);
    await assert.rejects(service.record(principal, policy, { ...command, location: { ...command.location, accuracyMeters: 101 } }), /LOW_ACCURACY/);
    await assert.rejects(service.record(principal, policy, { ...command, location: { ...command.location, latitude: -7 } }), /OUTSIDE_GEOFENCE/);
    now = new Date('2026-11-11T03:00:00Z');
    const out = await service.record(principal, policy, { ...command, kind: 'OUT', idempotencyKey: 'fedcba9876543210', location: { ...command.location, capturedAt: now.toISOString() } });
    assert.equal(out.shiftId, first.shiftId); assert.equal(out.businessDate, first.businessDate);
    await assert.rejects(service.correct(principal, { tenantId: 'tenant', outletId: 'outlet', eventId: first.id, correctedAt: now.toISOString(), reason: 'missed time' }), /FORBIDDEN/);
    const supervisor = { ...principal, staffId: 'supervisor', supervisorOutletIds: ['outlet'] };
    const correction = await service.correct(supervisor, { tenantId: 'tenant', outletId: 'outlet', eventId: first.id, correctedAt: now.toISOString(), reason: 'missed time' });
    assert.equal(correction.sequence, 1);
    assert.equal((await db.select().from(schema.attendanceEvents)).length, 2);
    assert.equal((await db.select().from(schema.attendanceCorrections)).length, 1);
    const handler = createAttendanceHandler({ principal: { authenticate: async () => null }, policy: async () => policy, service });
    assert.equal((await handler(new Request('http://localhost', { method: 'POST', body: '{}' }))).status, 401);
    assert.equal(businessDate(new Date('2026-11-10T17:00:00Z'), 'Asia/Jakarta', '04:00'), '2026-11-10');
  } finally { await client.close(); }
});

test('location uncertainty and business cutoff boundaries', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  const policy: OutletPolicy = { tenantId: 't', outletId: 'o', latitude: 0, longitude: 0, radiusMeters: 100, maxAccuracyMeters: 100, maxLocationAgeMs: 60000, timezone: 'Asia/Jakarta', businessCutoff: '04:00', requireFace: false, requireLiveness: false };
  const location = { latitude: 0, longitude: 0, accuracyMeters: 100, capturedAt: now.toISOString() };
  validateLocation(location, policy, now);
  validateLocation({ ...location, accuracyMeters: 99.999 }, policy, now);
  assert.throws(() => validateLocation({ ...location, longitude: 0.000001 }, policy, now), /OUTSIDE_GEOFENCE/);
  validateLocation({ ...location, capturedAt: new Date(now.getTime() - 60000).toISOString() }, policy, now);
  assert.throws(() => validateLocation({ ...location, capturedAt: new Date(now.getTime() - 60001).toISOString() }, policy, now), /STALE_LOCATION/);
  assert.throws(() => validateLocation({ ...location, capturedAt: new Date(now.getTime() + 1).toISOString() }, policy, now), /STALE_LOCATION/);
  assert.equal(businessDate(new Date('2025-12-31T20:59:59Z'), 'Asia/Jakarta', '04:00'), '2025-12-31');
  assert.equal(businessDate(new Date('2025-12-31T21:00:00Z'), 'Asia/Jakarta', '04:00'), '2026-01-01');
});

test('finalization serializes with recording and keeps terminal receipts', async () => {
 const client = new PGlite();
 try {
  const db = drizzle(client, { schema }); await (await pushSchema(schema, drizzle(client))).apply();
  const repo = createAttendanceRepository(db as never, { claimEvidence: true });
  const now = new Date();
  const principal = { tenantId: 't', staffId: 's', outletIds: ['o'], supervisorOutletIds: [] as string[] };
  const policy: OutletPolicy = { tenantId: 't', outletId: 'o', latitude: 0, longitude: 0, radiusMeters: 100, maxAccuracyMeters: 30, maxLocationAgeMs: 60000, timezone: 'UTC', businessCutoff: '04:00', requireFace: false, requireLiveness: false };
  const command: AttendanceCommand = { outletId: 'o', kind: 'IN', idempotencyKey: 'abcdefghijklmnop', evidenceKey: 'ev', location: { latitude: 0, longitude: 0, accuracyMeters: 5, capturedAt: now.toISOString() } };
  await db.insert(schema.attendanceEvidence).values({ id: 'ev', tenantId: 't', outletId: 'o', staffId: 's', createdAt: now, expiresAt: new Date(now.getTime() + 60000), state: 'ready' });
  const service = createAttendanceService({ repository: repo, evidence: { verify: async () => true }, clock: () => now });
  assert.deepEqual(await service.finalize(principal, policy, command), { outcome: 'canceled' });
  assert.deepEqual(await service.finalize(principal, policy, command), { outcome: 'canceled' });
  await assert.rejects(service.finalize(principal, policy, { ...command, kind: 'OUT' }), /IDEMPOTENCY_CONFLICT/);
  await assert.rejects(service.record(principal, policy, command), /OPERATION_CANCELED/);
  await assert.rejects(service.record(principal, policy, { ...command, idempotencyKey: 'newkey0123456789' }), /INVALID_EVIDENCE/);
  await assert.rejects(service.finalize({ ...principal, outletIds: [] }, policy, command), /FORBIDDEN/);
  assert.deepEqual(await service.finalize({ ...principal, staffId: 'other' }, policy, command), { outcome: 'canceled' });
  assert.equal((await db.select().from(schema.attendanceCanceled)).length, 2); // independent identities cannot finalize each other's receipt
  await assert.rejects(service.finalize(principal, { ...policy, outletId: 'other' }, command), /FORBIDDEN/);
  await db.insert(schema.attendanceEvidence).values({ id: 'ev2', tenantId: 't', outletId: 'o', staffId: 's', createdAt: now, expiresAt: new Date(now.getTime() + 60000), state: 'ready' });
  const next = { ...command, idempotencyKey: 'nextkey012345678', evidenceKey: 'ev2' };
  const event = await service.record(principal, policy, next);
  const expiredService = createAttendanceService({ repository: repo, evidence: { verify: async () => false }, clock: () => new Date(now.getTime() + 86400000) });
  assert.deepEqual(await expiredService.finalize(principal, policy, { ...command, evidenceKey: 'expired', idempotencyKey: 'expiredkey000001' }), { outcome: 'canceled' });
  const final = await expiredService.finalize(principal, policy, next);
  assert.equal(final.outcome, 'committed'); if (final.outcome === 'committed') assert.equal(final.event.id, event.id);
 } finally { await client.close(); }
});
