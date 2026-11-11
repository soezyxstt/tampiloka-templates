import { and, desc, eq, lt, or } from 'drizzle-orm';
import type { db } from '../../db/index.ts';
import type { AttendancePrincipal, OutletPolicy } from './contracts.ts';
import { attendanceCorrections, attendanceEvents, attendanceEvidence } from './schema.ts';
import { businessDate } from './service.ts';

type Database = typeof db;
const json = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function readAttendance(request: Request, deps: { database: Database; principal: AttendancePrincipal; policy: OutletPolicy; biometricAvailable: boolean; member?: (tenant: string, outlet: string, staff: string) => Promise<boolean> }) {
  const { database, principal, policy } = deps;
  const q = new URL(request.url).searchParams, resource = q.get('resource'), outlet = q.get('outletId') || '';
  const supervisor = principal.supervisorOutletIds.includes(outlet), employee = principal.outletIds.includes(outlet);
  if (policy.tenantId !== principal.tenantId || policy.outletId !== outlet || (!employee && !supervisor)) return json({ error: 'FORBIDDEN' }, 403);
  if (!['status', 'history', 'review'].includes(resource || '')) return json({ error: 'INVALID_REQUEST' }, 400);
  if ((resource === 'status' || resource === 'history') && !employee || resource === 'review' && !supervisor) return json({ error: 'FORBIDDEN' }, 403);
  const staff = resource === 'review' ? q.get('staffId') : principal.staffId;
  if (resource === 'review' && staff !== null && (!staff || !deps.member || !await deps.member(principal.tenantId, outlet, staff))) return json({ error: 'FORBIDDEN' }, 403);
  const scope = and(eq(attendanceEvents.tenantId, principal.tenantId), eq(attendanceEvents.outletId, outlet), staff ? eq(attendanceEvents.staffId, staff) : undefined);
  const render = async (event: typeof attendanceEvents.$inferSelect) => {
    const corrections = await database.select().from(attendanceCorrections).where(and(eq(attendanceCorrections.tenantId, principal.tenantId), eq(attendanceCorrections.outletId, outlet), eq(attendanceCorrections.eventId, event.id))).orderBy(desc(attendanceCorrections.sequence)).limit(51);
    const [evidence] = await database.select().from(attendanceEvidence).where(and(eq(attendanceEvidence.id, event.evidenceKey), eq(attendanceEvidence.tenantId, principal.tenantId), eq(attendanceEvidence.outletId, outlet), eq(attendanceEvidence.claimedEventId, event.id)));
    return { id: event.id, staffId: event.staffId, kind: event.kind, occurredAt: event.occurredAt.toISOString(), businessDate: event.businessDate, shiftId: event.shiftId, sequence: event.sequence, effectiveAt: (corrections[0]?.correctedAt || event.occurredAt).toISOString(), corrections: corrections.slice(0, 50).map(c => ({ id: c.id, supervisorId: c.supervisorId, reason: c.reason, correctedAt: c.correctedAt.toISOString(), recordedAt: c.recordedAt.toISOString(), sequence: c.sequence })), correctionsTruncated: corrections.length > 50, evidence: evidence?.state === 'ready' && evidence.expiresAt > new Date() ? { readUrl: `?${new URLSearchParams({ resource: 'evidence', outletId: outlet, id: evidence.id })}` } : null };
  };
  if (resource === 'status') {
    const key = q.get('idempotencyKey');
    if (key !== null && !/^[A-Za-z0-9_-]{16,128}$/.test(key)) return json({ error: 'INVALID_REQUEST' }, 400);
    const [latest] = await database.select().from(attendanceEvents).where(scope).orderBy(desc(attendanceEvents.sequence)).limit(1);
    const [operation] = key ? await database.select().from(attendanceEvents).where(and(scope, eq(attendanceEvents.idempotencyKey, key))).limit(1) : [];
    const now = new Date();
    return json({ serverTime: now.toISOString(), businessDate: businessDate(now, policy.timezone, policy.businessCutoff), policy: { timezone: policy.timezone, businessCutoff: policy.businessCutoff, maxAccuracyMeters: policy.maxAccuracyMeters, maxLocationAgeMs: policy.maxLocationAgeMs, requireFace: policy.requireFace, requireLiveness: policy.requireLiveness }, capabilities: { capture: employee && (!(policy.requireFace || policy.requireLiveness) || deps.biometricAvailable), review: supervisor }, current: latest ? await render(latest) : null, operation: operation ? await render(operation) : null });
  }
  const rawLimit = q.get('limit') ?? '20'; if (!/^(?:[1-9]|[1-4][0-9]|50)$/.test(rawLimit)) return json({ error: 'INVALID_REQUEST' }, 400);
  let cursor: { time: string; id: string } | undefined;
  if (q.has('cursor')) { try { const raw = q.get('cursor')!; if (raw.length > 512 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw 0; cursor = JSON.parse(Buffer.from(raw, 'base64url').toString()); if (!cursor || typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 128 || typeof cursor.time !== 'string' || new Date(cursor.time).toISOString() !== cursor.time) throw 0; } catch { return json({ error: 'INVALID_REQUEST' }, 400); } }
  const limit = Number(rawLimit);
  const rows = await database.select().from(attendanceEvents).where(and(scope, cursor ? or(lt(attendanceEvents.occurredAt, new Date(cursor.time)), and(eq(attendanceEvents.occurredAt, new Date(cursor.time)), lt(attendanceEvents.id, cursor.id))) : undefined)).orderBy(desc(attendanceEvents.occurredAt), desc(attendanceEvents.id)).limit(limit + 1);
  const page = rows.slice(0, limit), last = page[page.length - 1];
  return json({ events: await Promise.all(page.map(render)), nextCursor: rows.length > limit ? Buffer.from(JSON.stringify({ time: last.occurredAt.toISOString(), id: last.id })).toString('base64url') : null });
}
