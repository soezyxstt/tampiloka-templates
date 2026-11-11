/** Resolved only by a trusted server authentication and authorization adapter. */
export interface AttendancePrincipal {
  tenantId: string; staffId: string;
  outletIds: readonly string[]; supervisorOutletIds: readonly string[];
}
export interface PrincipalAdapter<Request> { authenticate(request: Request): Promise<AttendancePrincipal | null> }
/** Resolve the exact host route pair from trusted server data; multiple matches fail closed. */
export type AttendanceOutletResolver = (tenantSlug: string, outletSlug: string) => Promise<readonly { tenantId: string; outletId: string }[]>;
export interface OutletPolicy {
  tenantId: string; outletId: string; latitude: number; longitude: number; radiusMeters: number;
  maxAccuracyMeters: number; maxLocationAgeMs: number; timezone: string; businessCutoff: string;
  requireFace: boolean; requireLiveness: boolean;
}
export interface LocationEvidence { latitude: number; longitude: number; accuracyMeters: number; capturedAt: string }
/** Implementations must resolve server-side ownership, privacy and upload completion. */
export interface EvidenceVerifier { verify(input: { key: string; principal: AttendancePrincipal; outletId: string }): Promise<boolean> }
export interface BiometricProvider {
  verify(input: { key: string; principal: AttendancePrincipal; outletId: string; requireFace: boolean; requireLiveness: boolean }): Promise<{ face: boolean; liveness: boolean }>;
}
export interface AttendanceCommand { outletId: string; kind: 'IN' | 'OUT'; idempotencyKey: string; location: LocationEvidence; evidenceKey: string }
export interface AttendanceEvent {
  id: string; tenantId: string; outletId: string; staffId: string; kind: 'IN' | 'OUT'; occurredAt: Date;
  businessDate: string; shiftId: string; sequence: number; latitude: number; longitude: number; accuracyMeters: number;
  evidenceKey: string; idempotencyKey: string; requestHash: string;
}
export interface AttendanceCorrection { id: string; tenantId: string; outletId: string; eventId: string; supervisorId: string; reason: string; correctedAt: Date; recordedAt: Date; sequence: number }
/** Repository operations MUST run atomically and serialize per tenant/outlet/staff.
 * appendEvent checks replay and open-shift state within that transaction. Corrections append only. */
export interface AttendanceRepository {
  appendEvent(input: Omit<AttendanceEvent, 'shiftId' | 'sequence' | 'businessDate'> & { businessDate: string }): Promise<AttendanceEvent>;
  finalizeEvent(input: { tenantId: string; outletId: string; staffId: string; idempotencyKey: string; requestHash: string; evidenceKey: string }): Promise<{ outcome: 'canceled' } | { outcome: 'committed'; event: AttendanceEvent }>;
  appendCorrection(input: Omit<AttendanceCorrection, 'sequence'>): Promise<AttendanceCorrection>;
}
