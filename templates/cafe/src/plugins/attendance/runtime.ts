import { randomUUID } from 'node:crypto';
import { and, eq, lte, inArray, sql } from 'drizzle-orm';
import { db, selectedDatabaseProvider } from '../../db/index.ts';
import type { AttendanceOutletResolver, BiometricProvider, OutletPolicy, PrincipalAdapter } from './contracts.ts';
import type { EvidenceReference, EvidenceStore } from './storage/index.mjs';
import { attendanceEvidence } from './schema.ts';
import { createAttendanceRepository } from './repository.ts';
import { createAttendanceService } from './service.ts';
import { createAttendanceHandler } from './api.ts';
import { readAttendance } from './read.ts';

type Database = typeof db;
const MAX_IMAGE = 5 * 1024 * 1024;
const json = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function bounded(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new Error('TOO_LARGE');
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > limit) { await reader.cancel(); throw new Error('TOO_LARGE'); } chunks.push(value); } } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, total);
}
/** Explicit server-only composition. The host owns authentication, trusted policy and origin configuration. */
export function createAttendanceRuntime(options: { database: Database; store: EvidenceStore; principal: PrincipalAdapter<Request>; policy: (tenant: string, outlet: string) => Promise<OutletPolicy | null>; allowedOrigins: readonly string[]; biometric?: BiometricProvider; uploadMaxAgeMs?: number; member?: (tenant: string, outlet: string, staff: string) => Promise<boolean>; databaseKind?: 'pglite' | 'postgresql'; resolveOutlet?: AttendanceOutletResolver }) {
  const provider = options.database === db ? selectedDatabaseProvider : options.databaseKind;
  if (provider !== 'postgresql' && provider !== 'pglite') throw new Error('Attendance requires PostgreSQL or PGlite');
  if (!options.principal || !options.policy || !options.allowedOrigins.length || options.allowedOrigins.some(origin => { try { return new URL(origin).origin !== origin; } catch { return true; } })) throw new Error('Invalid attendance host configuration');
  const { database, store } = options;
  const ref = (row: typeof attendanceEvidence.$inferSelect): EvidenceReference => ({ id: row.id, contentType: (row.contentType || 'image/jpeg') as EvidenceReference['contentType'], size: row.size || 1, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString() });
  const scope = (row: typeof attendanceEvidence.$inferSelect) => ({ tenantId: row.tenantId, outletId: row.outletId, employeeId: row.staffId });
  const repository = createAttendanceRepository(database, { claimEvidence: true, uploadMaxAgeMs: options.uploadMaxAgeMs });
  const service = createAttendanceService({ repository, biometric: options.biometric, evidence: { verify: async ({ key, principal, outletId }) => {
    const [row] = await database.select().from(attendanceEvidence).where(and(eq(attendanceEvidence.id, key), eq(attendanceEvidence.tenantId, principal.tenantId), eq(attendanceEvidence.outletId, outletId), eq(attendanceEvidence.staffId, principal.staffId)));
    return !!row && row.state === 'ready' && row.expiresAt > new Date() && (row.claimedEventId !== null || Date.now() - row.createdAt.getTime() <= (options.uploadMaxAgeMs ?? 10 * 60_000));
  } } });
  async function remove(row: typeof attendanceEvidence.$inferSelect, actor: string) {
    try { await store.delete(scope(row), ref(row)); await database.update(attendanceEvidence).set({ state: 'deleted', nextCheckAt: new Date(Date.now() + 60_000), deletedAt: sql`coalesce(${attendanceEvidence.deletedAt}, ${new Date()})`, deletedBy: sql`coalesce(${attendanceEvidence.deletedBy}, ${actor})` }).where(eq(attendanceEvidence.id, row.id)); }
    catch { await database.update(attendanceEvidence).set({ state: 'deleting', nextCheckAt: new Date(Date.now() + 60_000), attempts: sql`${attendanceEvidence.attempts} + 1`, lastErrorAt: new Date() }).where(eq(attendanceEvidence.id, row.id)); throw new Error('STORAGE_UNAVAILABLE'); }
  }
  return {
    async handle(request: Request): Promise<Response> {
      try {
        const url = new URL(request.url);
        if (request.method !== 'GET' && (!options.allowedOrigins.includes(request.headers.get('origin') || '') || request.headers.get('sec-fetch-site') === 'cross-site')) return json({ error: 'INVALID_ORIGIN' }, 403);
        const principal = await options.principal.authenticate(request);
        if (!principal) return json({ error: 'UNAUTHENTICATED' }, 401);
        if (request.method === 'GET' && url.searchParams.get('resource') === 'capabilities') {
          const tenants = url.searchParams.getAll('tenantSlug'), outlets = url.searchParams.getAll('outletSlug');
          if (tenants.length !== 1 || outlets.length !== 1 || !tenants[0].trim() || !outlets[0].trim() || tenants[0].length > 200 || outlets[0].length > 200) return json({ error: 'INVALID_REQUEST' }, 400);
          if (!options.resolveOutlet) return json({ error: 'OUTLET_RESOLVER_NOT_CONFIGURED' }, 503);
          const mappings = await options.resolveOutlet(tenants[0], outlets[0]);
          if (!Array.isArray(mappings) || mappings.length > 1 || mappings.some(item => !item || typeof item.tenantId !== 'string' || !item.tenantId || typeof item.outletId !== 'string' || !item.outletId)) return json({ error: 'OUTLET_MAPPING_INVALID' }, 503);
          const mapping = mappings[0];
          if (!mapping || mapping.tenantId !== principal.tenantId) return json({ error: 'FORBIDDEN' }, 403);
          const employee = principal.outletIds.includes(mapping.outletId), supervisor = principal.supervisorOutletIds.includes(mapping.outletId);
          if (!employee && !supervisor) return json({ error: 'FORBIDDEN' }, 403);
          const policy = await options.policy(mapping.tenantId, mapping.outletId);
          if (!policy || policy.tenantId !== mapping.tenantId || policy.outletId !== mapping.outletId) return json({ error: 'FORBIDDEN' }, 403);
          return json({ tenantId: mapping.tenantId, outletId: mapping.outletId, employee, supervisor, capabilities: { capture: employee && (!(policy.requireFace || policy.requireLiveness) || !!options.biometric), review: supervisor }, policy: { timezone: policy.timezone, businessCutoff: policy.businessCutoff, maxAccuracyMeters: policy.maxAccuracyMeters, maxLocationAgeMs: policy.maxLocationAgeMs, requireFace: policy.requireFace, requireLiveness: policy.requireLiveness } });
        }
        const outlet = url.searchParams.get('outletId') || '';
        if (url.searchParams.get('resource') === 'evidence') {
          if (!principal.outletIds.includes(outlet) && !principal.supervisorOutletIds.includes(outlet)) return json({ error: 'FORBIDDEN' }, 403);
          const policy = await options.policy(principal.tenantId, outlet);
          if (!policy || policy.tenantId !== principal.tenantId || policy.outletId !== outlet) return json({ error: 'FORBIDDEN' }, 403);
          if (request.method === 'POST') {
            if (!principal.outletIds.includes(outlet)) return json({ error: 'FORBIDDEN' }, 403);
            const bytes = await bounded(request, MAX_IMAGE); const id = randomUUID(); const now = new Date();
            await database.insert(attendanceEvidence).values({ id, tenantId: principal.tenantId, outletId: outlet, staffId: principal.staffId, createdAt: now, expiresAt: new Date(now.getTime() + 60_000), state: 'pending' });
            try { const uploaded = await store.put({ tenantId: principal.tenantId, outletId: outlet, employeeId: principal.staffId }, bytes, id); const [completed] = await database.update(attendanceEvidence).set({ state: 'ready', contentType: uploaded.contentType, size: uploaded.size, createdAt: new Date(uploaded.createdAt), expiresAt: new Date(uploaded.expiresAt) }).where(and(eq(attendanceEvidence.id, id), eq(attendanceEvidence.state, 'pending'))).returning(); if (!completed) throw new Error('RESERVATION_CANCELLED'); return json({ evidenceKey: id }, 201); }
            catch { const [row] = await database.select().from(attendanceEvidence).where(eq(attendanceEvidence.id, id)); if (row) { try { await remove(row, principal.staffId); } catch {} } return json({ error: 'UPLOAD_FAILED' }, 422); }
          }
          const id = url.searchParams.get('id') || '';
          const [row] = await database.select().from(attendanceEvidence).where(and(eq(attendanceEvidence.id, id), eq(attendanceEvidence.tenantId, principal.tenantId), eq(attendanceEvidence.outletId, outlet)));
          if (!row || (row.staffId !== principal.staffId && !principal.supervisorOutletIds.includes(outlet))) return json({ error: 'NOT_FOUND' }, 404);
          if (request.method === 'GET') { if (row.state !== 'ready' || row.expiresAt <= new Date()) return json({ error: 'NOT_FOUND' }, 404); const image = await store.read(scope(row), ref(row)); return new Response(new Uint8Array(image.bytes), { headers: { 'Content-Type': image.contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } }); }
          if (request.method === 'DELETE') { const [locked] = await database.transaction(async tx => { const [current] = await tx.select().from(attendanceEvidence).where(eq(attendanceEvidence.id, id)).for('update'); if (!current || current.state !== 'ready') return []; return tx.update(attendanceEvidence).set({ state: 'deleting' }).where(eq(attendanceEvidence.id, id)).returning(); }); if (!locked) return json({ error: 'NOT_FOUND' }, 404); await remove(locked, principal.staffId); return json({ deleted: true }); }
          return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
        }
        if (request.method === 'GET') {
          const policy = await options.policy(principal.tenantId, outlet);
          if (!policy) return json({ error: 'FORBIDDEN' }, 403);
          return await readAttendance(request, { database, principal, policy, biometricAvailable: !!options.biometric, member: options.member });
        }
        if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
        const body = await bounded(request, 16384);
        const handler = createAttendanceHandler({ principal: { authenticate: async () => principal }, policy: options.policy, service });
        const response = await handler(new Request(request.url, { method: 'POST', headers: request.headers, body: new Uint8Array(body) }));
        response.headers.set('Cache-Control', 'no-store'); return response;
      } catch (error) { return json({ error: error instanceof Error && error.message === 'TOO_LARGE' ? 'TOO_LARGE' : 'ATTENDANCE_UNAVAILABLE' }, error instanceof Error && error.message === 'TOO_LARGE' ? 413 : 503); }
    },
    /** Invoke only from a trusted server job; deletion failures remain persisted for retry. */
    async retain(now = new Date()) {
      // Independent quotas prevent either historical tombstones or failures from starving new expiry.
      const fresh = await database.select().from(attendanceEvidence).where(and(inArray(attendanceEvidence.state, ['pending', 'ready']), lte(attendanceEvidence.expiresAt, now))).orderBy(attendanceEvidence.expiresAt, attendanceEvidence.id).limit(25);
      const retry = await database.select().from(attendanceEvidence).where(and(inArray(attendanceEvidence.state, ['deleted', 'deleting']), lte(attendanceEvidence.nextCheckAt, now))).orderBy(attendanceEvidence.nextCheckAt, attendanceEvidence.id).limit(25);
      let deleted = 0, failed = 0;
      for (const candidate of [...fresh, ...retry]) {
        const [row] = await database.transaction(async tx => {
          const [current] = await tx.select().from(attendanceEvidence).where(eq(attendanceEvidence.id, candidate.id)).for('update');
          if (!current) return [];
          const retrying = current.state === 'deleted' || current.state === 'deleting';
          if (retrying ? current.nextCheckAt > now : current.expiresAt > now) return [];
          // Claim for a bounded period; a crash leaves a durable retry after the lease.
          return tx.update(attendanceEvidence).set({ state: current.state === 'deleted' ? 'deleted' : 'deleting', nextCheckAt: new Date(now.getTime() + 60_000) }).where(eq(attendanceEvidence.id, current.id)).returning();
        });
        if (row) try { await remove(row, 'retention-job'); if (candidate.state !== 'deleted') deleted++; } catch { failed++; }
      }
      return { deleted, failed };
    },
  };
}
