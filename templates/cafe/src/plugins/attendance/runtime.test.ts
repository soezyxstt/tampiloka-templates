import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import sharp from 'sharp';
import * as schema from './schema.ts';
import { createAttendanceRuntime } from './runtime.ts';
import { createLocalEvidenceStore } from './storage/index.mjs';

test('private attendance lifecycle and security', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'attendance-')); const client = new PGlite();
 try {
  const database = drizzle(client, { schema }); await (await pushSchema(schema, drizzle(client))).apply();
  const runtime = createAttendanceRuntime({ database: database as never, databaseKind: 'pglite', store: createLocalEvidenceStore({ directory: dir, retentionSeconds: 3600 }), allowedOrigins: ['https://cafe.test'], member: async (_tenant, _outlet, staff) => staff === 'staff', principal: { authenticate: async r => r.headers.get('authorization') === 'staff' ? { tenantId: 'tenant', staffId: 'staff', outletIds: ['outlet'], supervisorOutletIds: [] } : r.headers.get('authorization') === 'supervisor' ? { tenantId: 'tenant', staffId: 'boss', outletIds: [], supervisorOutletIds: ['outlet'] } : null }, policy: async (tenantId, outletId) => ({ tenantId, outletId, latitude: -6, longitude: 107, radiusMeters: 100, maxAccuracyMeters: 30, maxLocationAgeMs: 60000, timezone: 'Asia/Jakarta', businessCutoff: '04:00', requireFace: false, requireLiveness: false }) });
  const call = (query: string, method: string, body?: BodyInit, auth = 'staff', origin = 'https://cafe.test') => runtime.handle(new Request(`https://cafe.test/api/attendance${query}`, { method, headers: { authorization: auth, origin }, body }));
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
  assert.equal((await call('?resource=evidence&outletId=outlet', 'POST', image, 'staff', 'https://evil.test')).status, 403);
  assert.equal((await call('?resource=evidence&outletId=outlet', 'POST', image, '')).status, 401);
  const upload = async () => { const r = await call('?resource=evidence&outletId=outlet', 'POST', image); assert.equal(r.status, 201); return (await r.json()).evidenceKey as string; };
  const first = await upload();
  const record = (key: string, kind: string, idem: string) => call('', 'POST', JSON.stringify({ action: 'record', outletId: 'outlet', kind, evidenceKey: key, idempotencyKey: idem, location: { latitude: -6, longitude: 107, accuracyMeters: 5, capturedAt: new Date().toISOString() } }));
  const inResponse = await record(first, 'IN', 'abcdefghijklmnop'); assert.equal(inResponse.status, 200); const event = await inResponse.json();
  assert.equal((await record(first, 'OUT', 'qrstuvwxyzabcdef')).status, 422);
  const second = await upload(); assert.equal((await record(second, 'OUT', 'qrstuvwxyzabcdef')).status, 200);
  const correction = await call('', 'POST', JSON.stringify({ action: 'correct', outletId: 'outlet', eventId: event.id, correctedAt: new Date().toISOString(), reason: 'adjust time' }), 'supervisor'); assert.equal(correction.status, 200);
  const statusResponse = await call('?resource=status&outletId=outlet&idempotencyKey=abcdefghijklmnop', 'GET');
  assert.equal(statusResponse.headers.get('cache-control'), 'no-store');
  const status = await statusResponse.json(); assert.equal(status.current.kind, 'OUT'); assert.equal(status.operation.id, event.id); assert.equal(status.operation.corrections.length, 1); assert.ok(status.operation.evidence.readUrl);
  const firstPage = await (await call('?resource=history&outletId=outlet&limit=1', 'GET')).json(); assert.equal(firstPage.events.length, 1); assert.ok(firstPage.nextCursor);
  const nextPage = await (await call(`?resource=history&outletId=outlet&limit=1&cursor=${firstPage.nextCursor}`, 'GET')).json(); assert.equal(nextPage.events[0].id, event.id); assert.equal(nextPage.nextCursor, null);
  assert.equal((await call('?resource=review&outletId=outlet', 'GET')).status, 403);
  assert.equal((await call('?resource=review&outletId=outlet&staffId=staff', 'GET', undefined, 'supervisor')).status, 200);
  assert.equal((await call('?resource=review&outletId=outlet&staffId=forged', 'GET', undefined, 'supervisor')).status, 403);
  assert.equal((await call('?resource=review&outletId=other', 'GET', undefined, 'supervisor')).status, 403);
  assert.equal((await call('?resource=history&outletId=outlet&limit=51', 'GET')).status, 400);
  assert.equal((await call('?resource=history&outletId=outlet&cursor=bad', 'GET')).status, 400);
  const review = await (await call('?resource=review&outletId=outlet', 'GET', undefined, 'supervisor')).json(); assert.equal(review.events.length, 2);
  assert.equal((await call('', 'POST', JSON.stringify({ action: 'correct', outletId: 'other', eventId: event.id, correctedAt: new Date().toISOString(), reason: 'adjust time' }), 'supervisor')).status, 403);
  const read = await call(`?resource=evidence&outletId=outlet&id=${first}`, 'GET'); assert.equal(read.status, 200); assert.equal(read.headers.get('cache-control'), 'no-store');
  assert.equal((await runtime.retain(new Date(Date.now() + 7200000))).deleted, 2);
  assert.equal((await call(`?resource=evidence&outletId=outlet&id=${first}`, 'GET')).status, 404);
 } finally { await client.close(); await rm(dir, { recursive: true, force: true }); }
});

test('retention reconciles a late upload and retries tombstones after interrupted completion', async () => {
 const client = new PGlite();
 try {
  const database = drizzle(client, { schema }); await (await pushSchema(schema, drizzle(client))).apply();
  let release!: () => void, started!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  const objects = new Set<string>(); let failDelete = false;
  const store = {
   async put(_scope: unknown, _bytes: unknown, id: string) { started(); await waiting; objects.add(id); return { id, contentType: 'image/png' as const, size: 1, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() }; },
   async delete(_scope: unknown, ref: { id: string }) { if (failDelete) throw Error('offline'); objects.delete(ref.id); },
   async read() { throw Error('unused'); },
  };
  const runtime = createAttendanceRuntime({ database: database as never, databaseKind: 'pglite', store, allowedOrigins: ['https://cafe.test'], principal: { authenticate: async () => ({ tenantId: 'tenant', staffId: 'staff', outletIds: ['outlet'], supervisorOutletIds: [] }) }, policy: async (tenantId, outletId) => ({ tenantId, outletId, latitude: 0, longitude: 0, radiusMeters: 100, maxAccuracyMeters: 30, maxLocationAgeMs: 60000, timezone: 'UTC', businessCutoff: '04:00', requireFace: false, requireLiveness: false }) });
  const upload = runtime.handle(new Request('https://cafe.test/api/attendance?resource=evidence&outletId=outlet', { method: 'POST', headers: { origin: 'https://cafe.test' }, body: 'image' }));
  await entered;
  const [pending] = await database.select().from(schema.attendanceEvidence);
  assert.equal((await runtime.retain(new Date(Date.now() + 120000))).deleted, 1);
  // Model a process dying immediately after a late provider write, before SQL completion.
  objects.add(pending.id); failDelete = true;
  assert.equal((await runtime.retain(new Date(Date.now() + 180000))).failed, 1);
  failDelete = false;
  assert.equal((await runtime.retain(new Date(Date.now() + 180000))).deleted, 1);
  assert.equal(objects.has(pending.id), false);
  release();
  assert.equal((await upload).status, 422);
  assert.equal((await database.select().from(schema.attendanceEvidence))[0].state, 'deleted');
  assert.equal(objects.has(pending.id), false);
  // A write arriving after even the last successful deletion is removed on the next run.
  objects.add(pending.id); await runtime.retain(new Date(Date.now() + 180000)); assert.equal(objects.has(pending.id), false);
  // A failed SQL completion and failed compensation leave the reservation retryable.
  let failUpdate = false;
  const flakyDatabase = new Proxy(database, { get(target, prop, receiver) {
   if (prop === 'update' && failUpdate) return () => { throw Error('database unavailable'); };
   return Reflect.get(target, prop, receiver);
  } });
  const failingRuntime = createAttendanceRuntime({ database: flakyDatabase as never, databaseKind: 'pglite', store: { ...store, async put(_scope, _bytes, id) { objects.add(id!); failUpdate = true; return { id: id!, contentType: 'image/png', size: 1, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() }; } }, allowedOrigins: ['https://cafe.test'], principal: { authenticate: async () => ({ tenantId: 'tenant', staffId: 'staff', outletIds: ['outlet'], supervisorOutletIds: [] }) }, policy: async (tenantId, outletId) => ({ tenantId, outletId, latitude: 0, longitude: 0, radiusMeters: 100, maxAccuracyMeters: 30, maxLocationAgeMs: 60000, timezone: 'UTC', businessCutoff: '04:00', requireFace: false, requireLiveness: false }) });
  failDelete = true;
  const failed = await failingRuntime.handle(new Request('https://cafe.test/api/attendance?resource=evidence&outletId=outlet', { method: 'POST', headers: { origin: 'https://cafe.test' }, body: 'image' }));
  assert.equal(failed.status, 422); assert.equal(objects.size, 1);
  failUpdate = false; failDelete = false;
  await runtime.retain(new Date(Date.now() + 120000)); assert.equal(objects.size, 0);

 } finally { await client.close(); }
});

test('bounded retention makes progress across backlog, retries failures, and revisits late writes', async () => {
 const client = new PGlite();
 try {
  const database = drizzle(client, { schema }); await (await pushSchema(schema, drizzle(client))).apply();
  const now = Date.now(); const objects = new Set<string>(); let operations = 0; let fail = true;
  const rows = Array.from({ length: 70 }, (_, i) => ({ id: `old-${String(i).padStart(3, '0')}`, tenantId: 't', outletId: 'o', staffId: 's', createdAt: new Date(now - 100000), expiresAt: new Date(now - 1000), state: 'deleted', nextCheckAt: new Date(now - 1000) }));
  await database.insert(schema.attendanceEvidence).values([...rows, { ...rows[0], id: 'new', state: 'ready' }]); objects.add('new'); objects.add('old-000');
  const runtime = createAttendanceRuntime({ database: database as never, databaseKind: 'pglite', store: { async put() { throw Error('unused'); }, async read() { throw Error('unused'); }, async delete(_scope, ref) { operations++; if (ref.id === 'old-000' && fail) throw Error('offline'); objects.delete(ref.id); } }, allowedOrigins: ['https://cafe.test'], principal: { authenticate: async () => null }, policy: async () => null });
  const result = await runtime.retain(new Date(now)); assert.equal(result.deleted, 1); assert.equal(result.failed, 1); assert.equal(operations, 26); assert.equal(objects.has('new'), false);
  fail = false;
  // All old rows get a turn before the rescheduled failure, despite a backlog larger than the batch.
  await runtime.retain(new Date(now + 61000)); await runtime.retain(new Date(now + 61000)); await runtime.retain(new Date(now + 61000));
  assert.equal(objects.has('old-000'), false);
  objects.add('old-000');
  for (let i = 1; i <= 5; i++) await runtime.retain(new Date(now + 120000 + i * 61000));
  assert.equal(objects.has('old-000'), false);
 } finally { await client.close(); }
});

test('retention migration can be applied repeatedly', async () => {
 const { readFile } = await import('node:fs/promises'); const client = new PGlite();
 try {
  await client.exec(await readFile(new URL('./migrations/0002_evidence.sql', import.meta.url), 'utf8'));
  const migration = await readFile(new URL('./migrations/0003_retention_schedule.sql', import.meta.url), 'utf8');
  await client.exec(migration); await client.exec(migration);
 } finally { await client.close(); }
});

test('actual shared database selection is validated independently of caller claims', async () => {
 const { spawnSync } = await import('node:child_process');
 const script = `import {db} from './src/db/index.ts'; import {createAttendanceRuntime} from './src/plugins/attendance/runtime.ts'; try { createAttendanceRuntime({database:db,databaseKind:'postgresql',store:{},principal:{},policy:()=>{},allowedOrigins:['https://example.com']}); process.exit(0); } catch(e) { if (!String(e).includes('Attendance requires')) throw e; process.exit(7); }`;
 for (const [provider, demo, expected] of [['postgresql', '0', 0], ['turso', '0', 7], ['d1', '0', 7], ['d1', '1', 0]] as const) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { cwd: process.cwd(), env: { ...process.env, DATABASE_PROVIDER: provider, CAFE_DEMO_DB: demo }, encoding: 'utf8' });
  assert.equal(result.status, expected, result.stderr);
 }
});

test('route capabilities resolve trusted unique mappings and enforce outlet membership', async () => {
 const basePolicy = (tenantId: string, outletId: string) => ({ tenantId, outletId, latitude: 0, longitude: 0, radiusMeters: 100, maxAccuracyMeters: 30, maxLocationAgeMs: 60000, timezone: 'UTC', businessCutoff: '04:00', requireFace: false, requireLiveness: false });
 const principals = {
  staff: { tenantId: 'tenant', staffId: 's', outletIds: ['one'], supervisorOutletIds: [] },
  supervisor: { tenantId: 'tenant', staffId: 'b', outletIds: [], supervisorOutletIds: ['one'] },
  mixed: { tenantId: 'tenant', staffId: 'm', outletIds: ['one'], supervisorOutletIds: ['two'] },
 };
 const options = { database: {} as never, databaseKind: 'pglite' as const, store: {} as never, allowedOrigins: ['https://cafe.test'], principal: { authenticate: async (r: Request) => principals[r.headers.get('authorization') as keyof typeof principals] || null }, policy: async (tenant: string, outlet: string) => basePolicy(tenant, outlet), resolveOutlet: async (_tenant: string, slug: string) => slug === 'unknown' ? [] : slug === 'duplicate' ? [{ tenantId: 'tenant', outletId: 'one' }, { tenantId: 'tenant', outletId: 'two' }] : [{ tenantId: slug === 'foreign' ? 'other' : 'tenant', outletId: slug }] };
 const runtime = createAttendanceRuntime(options);
 const call = (query: string, auth = 'staff', method = 'GET', body?: string) => runtime.handle(new Request(`https://cafe.test/api/attendance${query}`, { method, headers: { authorization: auth, origin: 'https://cafe.test' }, body }));
 const cap = (slug: string, auth = 'staff') => call(`?resource=capabilities&tenantSlug=demo&outletSlug=${slug}`, auth);
 const staff = await (await cap('one')).json(); assert.equal(staff.outletId, 'one'); assert.deepEqual(staff.capabilities, { capture: true, review: false }); assert.equal(staff.employee, true); assert.equal(staff.supervisor, false); assert.equal(staff.policy.latitude, undefined);
 const supervisorResponse = await cap('one', 'supervisor'); assert.equal(supervisorResponse.headers.get('cache-control'), 'no-store'); const supervisor = await supervisorResponse.json(); assert.deepEqual(supervisor.capabilities, { capture: false, review: true }); assert.equal(supervisor.employee, false);
 assert.equal((await call('?resource=status&outletId=one', 'supervisor')).status, 403);
 assert.equal((await call('?resource=evidence&outletId=one', 'supervisor', 'POST', 'x')).status, 403);
 assert.equal((await call('', 'supervisor', 'POST', JSON.stringify({ action: 'record', outletId: 'one' }))).status, 403);
 assert.deepEqual((await (await cap('one', 'mixed')).json()).capabilities, { capture: true, review: false });
 assert.deepEqual((await (await cap('two', 'mixed')).json()).capabilities, { capture: false, review: true });
 for (const slug of ['unknown', 'foreign', 'two']) { const response = await cap(slug); assert.equal(response.status, 403); assert.deepEqual(await response.json(), { error: 'FORBIDDEN' }); }
 assert.equal((await cap('duplicate')).status, 503);
 assert.equal((await cap('one', '')).status, 401);
 assert.equal((await call('?resource=capabilities&tenantSlug=demo&tenantSlug=other&outletSlug=one')).status, 400);
 const missing = createAttendanceRuntime({ ...options, resolveOutlet: undefined });
 assert.deepEqual(await (await missing.handle(new Request('https://cafe.test/api/attendance?resource=capabilities&tenantSlug=demo&outletSlug=one', { headers: { authorization: 'staff' } }))).json(), { error: 'OUTLET_RESOLVER_NOT_CONFIGURED' });
 const mismatch = createAttendanceRuntime({ ...options, policy: async () => basePolicy('tenant', 'different') });
 assert.equal((await mismatch.handle(new Request('https://cafe.test/api/attendance?resource=capabilities&tenantSlug=demo&outletSlug=one', { headers: { authorization: 'staff' } }))).status, 403);
 const biometric = createAttendanceRuntime({ ...options, policy: async (tenant, outlet) => ({ ...basePolicy(tenant, outlet), requireFace: true }) });
 assert.equal((await (await biometric.handle(new Request('https://cafe.test/api/attendance?resource=capabilities&tenantSlug=demo&outletSlug=one', { headers: { authorization: 'staff' } }))).json()).capabilities.capture, false);
});
