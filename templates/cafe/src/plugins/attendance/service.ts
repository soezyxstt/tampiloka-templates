import { createHash, randomUUID } from 'node:crypto';
import type { AttendanceCommand, AttendancePrincipal, AttendanceRepository, BiometricProvider, EvidenceVerifier, OutletPolicy } from './contracts.ts';

export class AttendanceError extends Error { code: string; constructor(code: string, message = code) { super(message); this.code = code; } }
const fail = (code: string): never => { throw new AttendanceError(code); };
function allowed(p: AttendancePrincipal, tenant: string, outlet: string, supervisor = false) {
  if (!p?.tenantId || !p.staffId || p.tenantId !== tenant || !(supervisor ? p.supervisorOutletIds : p.outletIds)?.includes(outlet)) fail('FORBIDDEN');
}
export function businessDate(now: Date, timezone: string, cutoff: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff)) return fail('INVALID_POLICY');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const day = `${get('year')}-${get('month')}-${get('day')}`;
  if (`${get('hour')}:${get('minute')}` >= cutoff) return day;
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
}
export function validateLocation(location: AttendanceCommand['location'], policy: OutletPolicy, now: Date) {
  const { latitude: lat, longitude: lon, accuracyMeters: accuracy, capturedAt } = location || {};
  const numbers = [lat, lon, accuracy, policy.latitude, policy.longitude, policy.radiusMeters, policy.maxAccuracyMeters, policy.maxLocationAgeMs];
  if (!numbers.every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || Math.abs(policy.latitude) > 90 || Math.abs(policy.longitude) > 180 || accuracy < 0 || policy.radiusMeters <= 0 || policy.maxAccuracyMeters <= 0 || policy.maxLocationAgeMs <= 0) fail('INVALID_LOCATION');
  const age = now.getTime() - Date.parse(capturedAt);
  if (!Number.isFinite(age) || age < 0 || age > policy.maxLocationAgeMs) fail('STALE_LOCATION');
  if (accuracy > policy.maxAccuracyMeters) fail('LOW_ACCURACY');
  const radians = (n: number) => n * Math.PI / 180;
  const dlat = radians(lat - policy.latitude), dlon = radians(lon - policy.longitude);
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(radians(lat)) * Math.cos(radians(policy.latitude)) * Math.sin(dlon / 2) ** 2;
  const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  // The full reported uncertainty circle must fit within the outlet fence.
  if (distance + accuracy > policy.radiusMeters) fail('OUTSIDE_GEOFENCE');
}
function identity(command: AttendanceCommand) {
  if (!['IN', 'OUT'].includes(command.kind) || !/^[A-Za-z0-9_-]{16,128}$/.test(command.idempotencyKey) || typeof command.evidenceKey !== 'string' || !command.evidenceKey || command.evidenceKey.length > 512 || !command.location || ![command.location.latitude, command.location.longitude, command.location.accuracyMeters].every(Number.isFinite) || typeof command.location.capturedAt !== 'string' || command.location.capturedAt.length > 100) fail('INVALID_REQUEST');
  return createHash('sha256').update(JSON.stringify([command.kind, command.location.latitude, command.location.longitude, command.location.accuracyMeters, command.location.capturedAt, command.evidenceKey])).digest('hex');
}
export function createAttendanceService(deps: { repository: AttendanceRepository; evidence: EvidenceVerifier; biometric?: BiometricProvider; clock?: () => Date }) {
  const clock = deps.clock ?? (() => new Date());
  return {
    async record(principal: AttendancePrincipal, policy: OutletPolicy, command: AttendanceCommand) {
      allowed(principal, policy.tenantId, command.outletId);
      if (policy.outletId !== command.outletId) fail('FORBIDDEN');
      const requestHash = identity(command);
      const now = clock(); validateLocation(command.location, policy, now);
      if (!await deps.evidence.verify({ key: command.evidenceKey, principal, outletId: command.outletId })) fail('INVALID_EVIDENCE');
      if (policy.requireFace || policy.requireLiveness) {
        if (!deps.biometric) fail('BIOMETRIC_UNAVAILABLE');
        const result = await deps.biometric!.verify({ key: command.evidenceKey, principal, outletId: command.outletId, requireFace: policy.requireFace, requireLiveness: policy.requireLiveness });
        if ((policy.requireFace && result.face !== true) || (policy.requireLiveness && result.liveness !== true)) fail('BIOMETRIC_REJECTED');
      }
      return deps.repository.appendEvent({ id: randomUUID(), tenantId: principal.tenantId, outletId: command.outletId, staffId: principal.staffId, kind: command.kind, occurredAt: now, businessDate: businessDate(now, policy.timezone, policy.businessCutoff), latitude: command.location.latitude, longitude: command.location.longitude, accuracyMeters: command.location.accuracyMeters, evidenceKey: command.evidenceKey, idempotencyKey: command.idempotencyKey, requestHash });
    },
    async finalize(principal: AttendancePrincipal, policy: OutletPolicy, command: AttendanceCommand) {
      allowed(principal, policy.tenantId, command.outletId);
      if (policy.outletId !== command.outletId) fail('FORBIDDEN');
      const requestHash = identity(command);
      return deps.repository.finalizeEvent({ tenantId: principal.tenantId, outletId: command.outletId, staffId: principal.staffId, idempotencyKey: command.idempotencyKey, requestHash, evidenceKey: command.evidenceKey });
    },
    async correct(principal: AttendancePrincipal, input: { tenantId: string; outletId: string; eventId: string; correctedAt: string; reason: string }) {
      allowed(principal, input.tenantId, input.outletId, true);
      const correctedAt = new Date(input.correctedAt), reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      if (!input.eventId || !Number.isFinite(correctedAt.getTime()) || reason.length < 5 || reason.length > 1000) fail('INVALID_CORRECTION');
      return deps.repository.appendCorrection({ id: randomUUID(), tenantId: input.tenantId, outletId: input.outletId, eventId: input.eventId, supervisorId: principal.staffId, reason, correctedAt, recordedAt: clock() });
    },
  };
}
