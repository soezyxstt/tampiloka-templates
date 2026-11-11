import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import sharp from 'sharp';
import * as schema from './schema.ts';
import { createAttendanceRuntime } from './runtime.ts';
import { createAttendanceRoute } from './route-handler.ts';
import { createS3EvidenceStore } from './storage/index.mjs';

// Only point this at a disposable local database. Each run owns and drops a unique schema.
test('local PostgreSQL migrations, mounted route and concurrent attendance', { skip: !process.env.ATTENDANCE_TEST_DATABASE_URL && 'set ATTENDANCE_TEST_DATABASE_URL for local PostgreSQL' }, async t => {
 const admin = new Pool({ connectionString: process.env.ATTENDANCE_TEST_DATABASE_URL, max: 1 });
 const name = `attendance_test_${randomUUID().replaceAll('-', '')}`;
 await admin.query(`CREATE SCHEMA ${name}`);
 const pool = new Pool({ connectionString: process.env.ATTENDANCE_TEST_DATABASE_URL, max: 5, options: `-c search_path=${name}` });
 try {
  const migrate = async () => {
   const c = await pool.connect();
   try {
    await c.query('BEGIN');
    await c.query('CREATE TABLE IF NOT EXISTS attendance_migrations (version text PRIMARY KEY)');
    for (const file of ['0001_attendance.sql', '0002_evidence.sql', '0003_retention_schedule.sql', '0004_canceled.sql']) {
     if (!(await c.query('SELECT 1 FROM attendance_migrations WHERE version=$1', [file])).rowCount) {
      await c.query(await readFile(new URL(`./migrations/${file}`, import.meta.url), 'utf8'));
      await c.query('INSERT INTO attendance_migrations VALUES ($1)', [file]);
     }
    }
    await c.query('COMMIT');
   } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  };
  await migrate();
  await pool.query("INSERT INTO attendance_locks VALUES ('preserved','o','s')");
  await migrate();
  assert.equal((await pool.query('SELECT * FROM attendance_migrations')).rowCount, 4);
  assert.equal((await pool.query("SELECT * FROM attendance_locks WHERE tenant_id='preserved'")).rowCount, 1);
  const db = drizzle(pool, { schema });
  const objects = new Map<string, Buffer>();
  const store = { async put(_s: unknown, bytes: Uint8Array, id: string) { objects.set(id, Buffer.from(bytes)); return { id, contentType: 'image/png' as const, size: bytes.length, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() }; }, async read(_s: unknown, ref: { id: string }) { return { bytes: objects.get(ref.id)!, contentType: 'image/png' as const }; }, async delete(_s: unknown, ref: { id: string }) { objects.delete(ref.id); } };
  const runtime = createAttendanceRuntime({ database: db as never, databaseKind: 'postgresql', store, allowedOrigins: ['https://cafe.test'], principal: { authenticate: async r => r.headers.get('cookie') === 'session=fixture' ? { tenantId: 'tenant', staffId: 'staff', outletIds: ['outlet'], supervisorOutletIds: [] } : null }, policy: async (tenantId, outletId) => ({ tenantId, outletId, latitude: -6, longitude: 107, radiusMeters: 100, maxAccuracyMeters: 30, maxLocationAgeMs: 60000, timezone: 'Asia/Jakarta', businessCutoff: '04:00', requireFace: false, requireLiveness: false }) });
  const route = createAttendanceRoute(async () => runtime);
  const call = (query: string, body: BodyInit, origin = 'https://cafe.test', cookie = 'session=fixture') => route(new Request(`https://cafe.test/api/attendance${query}`, { method: 'POST', headers: { origin, cookie }, body }));
  assert.equal((await createAttendanceRoute(async () => null)(new Request('https://cafe.test'))).status, 503);
  assert.equal((await call('?resource=evidence&outletId=outlet', 'x', 'https://evil.test')).status, 403);
  assert.equal((await call('?resource=evidence&outletId=outlet', 'x', 'https://cafe.test', '')).status, 401);
  assert.equal((await call('?resource=evidence&outletId=other', 'x')).status, 403);
  const upload = async () => { const response = await call('?resource=evidence&outletId=outlet', 'image'); assert.equal(response.status, 201); return (await response.json()).evidenceKey; };
  const first = await upload();
  const payload = (key: string, kind: string, idem: string) => JSON.stringify({ action: 'record', outletId: 'outlet', kind, evidenceKey: key, idempotencyKey: idem, location: { latitude: -6, longitude: 107, accuracyMeters: 5.25, capturedAt: new Date().toISOString() } });
  const same = payload(first, 'IN', 'abcdefghijklmnop');
  const [a, b] = await Promise.all([call('', same), call('', same)]);
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal((await a.json()).id, (await b.json()).id);
  // Both orders run through the mounted route while an independent transaction holds the same employee lock.
  const race = async (recordFirst: boolean, key: string) => {
   const evidenceKey = await upload();
   const recordBody = payload(evidenceKey, 'OUT', key);
   const finalizeBody = JSON.stringify({ ...JSON.parse(recordBody), action: 'finalize' });
   const locker = await pool.connect();
   try {
    await locker.query('BEGIN');
    await locker.query("SELECT * FROM attendance_locks WHERE tenant_id='tenant' AND outlet_id='outlet' AND staff_id='staff' FOR UPDATE");
    const firstCall = call('', recordFirst ? recordBody : finalizeBody);
    const waitForBlocked = async (count: number) => {
     for (let i = 0; i < 200; i++) {
      const result = await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%attendance_locks%' AND pid <> pg_backend_pid()");
      if (result.rows[0].n >= count) return;
      await new Promise(resolve => setTimeout(resolve, 10));
     }
     throw Error('request did not wait on attendance lock');
    };
    await waitForBlocked(1);
    const secondCall = call('', recordFirst ? finalizeBody : recordBody);
    await waitForBlocked(2);
    await locker.query('COMMIT');
    const firstResult = await firstCall, secondResult = await secondCall;
    if (recordFirst) { assert.equal(firstResult.status, 200); assert.equal((await secondResult.json()).outcome, 'committed'); }
    else { assert.equal((await firstResult.json()).outcome, 'canceled'); assert.equal(secondResult.status, 409); assert.equal((await secondResult.json()).error, 'OPERATION_CANCELED'); }
   } finally { await locker.query('ROLLBACK'); locker.release(); }
  };
  const rollbackEvidence = await upload();
  const rollbackBody = JSON.parse(payload(rollbackEvidence, 'OUT', 'rollbackfinal001'));
  await pool.query("ALTER TABLE attendance_canceled ADD CONSTRAINT reject_finalization CHECK (idempotency_key <> 'rollbackfinal001')");
  assert.equal((await call('', JSON.stringify({ ...rollbackBody, action: 'finalize' }))).status, 503);
  assert.equal((await pool.query('SELECT claimed_event_id FROM attendance_evidence WHERE id=$1', [rollbackEvidence])).rows[0].claimed_event_id, null);
  await pool.query('ALTER TABLE attendance_canceled DROP CONSTRAINT reject_finalization');
  assert.equal((await (await call('', JSON.stringify({ ...rollbackBody, action: 'finalize' }))).json()).outcome, 'canceled');
  assert.equal((await call('', JSON.stringify({ ...rollbackBody, action: 'finalize' }), 'https://evil.test')).status, 403);
  assert.equal((await call('', JSON.stringify({ ...rollbackBody, action: 'finalize' }), 'https://cafe.test', '')).status, 401);
  assert.equal((await call('', JSON.stringify({ ...rollbackBody, action: 'finalize', outletId: 'other' }))).status, 403);
  await race(false, 'canceledrace0001');
  await race(true, 'committedrace001');
  // Restore an open shift for the existing transition checks below.
  const restore = await upload(); assert.equal((await call('', payload(restore, 'IN', 'restore000000001'))).status, 200);
  const second = await upload(); const third = await upload();
  const outs = await Promise.all([call('', payload(second, 'OUT', 'qrstuvwxyzabcdef')), call('', payload(third, 'OUT', '0123456789abcdef'))]);
  assert.deepEqual(outs.map(x => x.status).sort(), [200, 409]);
  const reused = await call('', payload(first, 'IN', '0000000000000000')); assert.equal(reused.status, 422);
  const rows = await pool.query('SELECT kind, occurred_at, accuracy_meters, business_date FROM attendance_events ORDER BY sequence');
  assert.deepEqual(rows.rows.map(x => x.kind), ['IN', 'OUT', 'IN', 'OUT']); assert.equal(rows.rows[0].accuracy_meters, 5.25); assert.ok(rows.rows[0].occurred_at instanceof Date); assert.match(rows.rows[0].business_date, /^\d{4}-\d{2}-\d{2}$/);
  // A database failure on event insertion must also roll back the evidence claim.
  const fourth = await upload();
  await pool.query("ALTER TABLE attendance_events ADD CONSTRAINT test_failure CHECK (kind <> 'IN') NOT VALID");
  assert.notEqual((await call('', payload(fourth, 'IN', '1111111111111111'))).status, 200);
  assert.equal((await pool.query('SELECT claimed_event_id FROM attendance_evidence WHERE id=$1', [fourth])).rows[0].claimed_event_id, null);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM attendance_events')).rows[0].n, 4);
  await pool.query('ALTER TABLE attendance_events DROP CONSTRAINT test_failure');
  const claims = await Promise.all([call('', payload(fourth, 'IN', '2222222222222222')), call('', payload(fourth, 'IN', '3333333333333333'))]);
  assert.deepEqual(claims.map(x => x.status).sort(), [200, 422]);
  const audit = await pool.query('SELECT sequence, claimed_event_id FROM attendance_events JOIN attendance_evidence ON evidence_key = attendance_evidence.id ORDER BY sequence');
  assert.equal(audit.rowCount, 5); assert.deepEqual(audit.rows.map(x => x.sequence), [1, 2, 3, 4, 5]); assert.ok(audit.rows.every(x => x.claimed_event_id));
  await t.test('PostgreSQL retention over local S3 transport', { skip: !process.env.ATTENDANCE_TEST_S3_ENDPOINT && 'set ATTENDANCE_TEST_S3_ENDPOINT and credentials for combined transport' }, async () => {
   const network = s3Store();
   const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
   let release!: () => void, started!: () => void;
   const gate = new Promise<void>(resolve => { release = resolve; });
   const entered = new Promise<void>(resolve => { started = resolve; });
   let failDelete = false;
   const transport = { ...network, async put(scope: Parameters<typeof network.put>[0], bytes: Uint8Array, id?: string) { started(); await gate; return network.put(scope, bytes, id); }, async delete(scope: Parameters<typeof network.delete>[0], ref: Parameters<typeof network.delete>[1]) { if (failDelete) return s3Store('bad-secret').delete(scope, ref); return network.delete(scope, ref); } };
   const retention = createAttendanceRuntime({ database: db as never, databaseKind: 'postgresql', store: transport, allowedOrigins: ['https://cafe.test'], principal: { authenticate: async () => ({ tenantId: 'transport', staffId: 'staff', outletIds: ['outlet'], supervisorOutletIds: [] }) }, policy: async (tenantId, outletId) => ({ tenantId, outletId, latitude: 0, longitude: 0, radiusMeters: 100, maxAccuracyMeters: 30, maxLocationAgeMs: 60000, timezone: 'UTC', businessCutoff: '04:00', requireFace: false, requireLiveness: false }) });
   const upload = retention.handle(new Request('https://cafe.test/api/attendance?resource=evidence&outletId=outlet', { method: 'POST', headers: { origin: 'https://cafe.test' }, body: image }));
   await entered;
   const pending = (await pool.query("SELECT id FROM attendance_evidence WHERE tenant_id='transport'")).rows[0];
   try {
    assert.equal((await retention.retain(new Date(Date.now() + 120000))).deleted >= 1, true);
    // The delayed PUT reaches the daemon after the reservation was deleted; compensation removes it.
    release(); assert.equal((await upload).status, 422);
    const scope = { tenantId: 'transport', outletId: 'outlet', employeeId: 'staff' };
    const late = await network.put(scope, image, pending.id);
    failDelete = true;
    assert.equal((await retention.retain(new Date(Date.now() + 180000))).failed >= 1, true);
    assert.equal((await network.read(scope, late)).bytes.length, late.size);
    failDelete = false;
    // More than a retry batch of older tombstones must not starve a fresh expiry.
    for (let i = 0; i < 30; i++) await pool.query("INSERT INTO attendance_evidence (id, tenant_id, outlet_id, staff_id, created_at, expires_at, state, next_check_at) VALUES ($1,'transport','outlet','staff',now()-interval '2 hours',now()-interval '1 hour','deleted',now()-interval '1 hour')", [randomUUID()]);
    const fresh = await network.put(scope, image);
    await pool.query("INSERT INTO attendance_evidence (id, tenant_id, outlet_id, staff_id, created_at, expires_at, state, content_type, size) VALUES ($1,'transport','outlet','staff',now()-interval '2 hours',now()-interval '1 hour','ready',$2,$3)", [fresh.id, fresh.contentType, fresh.size]);
    assert.equal((await retention.retain(new Date(Date.now() + 180000))).deleted >= 1, true);
    await assert.rejects(network.read(scope, fresh));
    for (let i = 0; i < 4; i++) await retention.retain(new Date(Date.now() + 240000 + i * 61000));
    await assert.rejects(network.read(scope, late));
   } finally { release(); await network.delete({ tenantId: 'transport', outletId: 'outlet', employeeId: 'staff' }, { id: pending.id, contentType: 'image/png', size: 1, createdAt: new Date(Date.now()-1000).toISOString(), expiresAt: new Date(Date.now()+60000).toISOString() }); }
  });
 } finally { await pool.end(); await admin.query(`DROP SCHEMA ${name} CASCADE`); await admin.end(); }
});

function s3Store(secret = process.env.ATTENDANCE_TEST_S3_SECRET_KEY!) {
 return createS3EvidenceStore({ endpoint: process.env.ATTENDANCE_TEST_S3_ENDPOINT!, bucket: process.env.ATTENDANCE_TEST_S3_BUCKET!, region: process.env.ATTENDANCE_TEST_S3_REGION || 'us-east-1', accessKeyId: process.env.ATTENDANCE_TEST_S3_ACCESS_KEY!, secretAccessKey: secret, retentionSeconds: 3600 });
}

test('local S3 network transport and private access', { skip: !process.env.ATTENDANCE_TEST_S3_ENDPOINT && 'set ATTENDANCE_TEST_S3_ENDPOINT and credentials for local transport' }, async () => {
 const endpoint = process.env.ATTENDANCE_TEST_S3_ENDPOINT!;
 const bucket = process.env.ATTENDANCE_TEST_S3_BUCKET!;
 const store = s3Store();
 const scope = { tenantId: 'test', outletId: 'test', employeeId: 'test' };
 const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().withMetadata().toBuffer();
 await assert.rejects(store.put(scope, Buffer.alloc(5 * 1024 * 1024 + 1)), /size/);
 await assert.rejects(store.put(scope, Buffer.from('invalid')), /image/);
 const ref = await store.put(scope, bytes);
 try {
  assert.equal(ref.contentType, 'image/png'); assert.equal(Date.parse(ref.expiresAt) - Date.parse(ref.createdAt), 3600000);
  const result = await store.read(scope, ref); assert.equal(result.bytes.length, ref.size);
  assert.equal((await sharp(result.bytes).metadata()).exif, undefined);
  await assert.rejects(store.read({ ...scope, tenantId: 'other' }, ref));
  await assert.rejects(s3Store('incorrect-secret').read(scope, ref));
  const anonymous = await fetch(`${endpoint.replace(/\/$/, '')}/${bucket}/attendance/test/test/test/${ref.id}`);
  assert.ok(anonymous.status === 403 || anonymous.status === 404);
 } finally { await store.delete(scope, ref); }
 await assert.rejects(store.read(scope, ref));
});
