import { and, desc, eq } from 'drizzle-orm';
import type { db } from '../../db/index.ts';
import { attendanceCorrections, attendanceEvents, attendanceLocks, attendanceEvidence, attendanceCanceled } from './schema.ts';
import { AttendanceError } from './service.ts';
import type { AttendanceEvent, AttendanceRepository } from './contracts.ts';

/** PostgreSQL/PGlite only. Never use the SQLite compatibility adapter here. */
export function createAttendanceRepository(database: typeof db, options: { claimEvidence?: boolean; uploadMaxAgeMs?: number } = {}): AttendanceRepository {
  return {
    async appendEvent(input) {
      return database.transaction(async tx => {
        const scope = and(eq(attendanceLocks.tenantId, input.tenantId), eq(attendanceLocks.outletId, input.outletId), eq(attendanceLocks.staffId, input.staffId));
        await tx.insert(attendanceLocks).values({ tenantId: input.tenantId, outletId: input.outletId, staffId: input.staffId }).onConflictDoNothing();
        await tx.select().from(attendanceLocks).where(scope).for('update');
        const eventScope = and(eq(attendanceEvents.tenantId, input.tenantId), eq(attendanceEvents.outletId, input.outletId), eq(attendanceEvents.staffId, input.staffId));
        const [previousRequest] = await tx.select().from(attendanceEvents).where(and(eventScope, eq(attendanceEvents.idempotencyKey, input.idempotencyKey)));
        if (previousRequest) {
          if (previousRequest.requestHash !== input.requestHash) throw new AttendanceError('IDEMPOTENCY_CONFLICT');
          return previousRequest as AttendanceEvent;
        }
        const [canceled] = await tx.select().from(attendanceCanceled).where(and(eq(attendanceCanceled.tenantId, input.tenantId), eq(attendanceCanceled.outletId, input.outletId), eq(attendanceCanceled.staffId, input.staffId), eq(attendanceCanceled.idempotencyKey, input.idempotencyKey)));
        if (canceled) {
          if (canceled.requestHash !== input.requestHash) throw new AttendanceError('IDEMPOTENCY_CONFLICT');
          throw new AttendanceError('OPERATION_CANCELED');
        }
        if (options.claimEvidence) {
        const [evidence] = await tx.select().from(attendanceEvidence).where(and(eq(attendanceEvidence.id, input.evidenceKey), eq(attendanceEvidence.tenantId, input.tenantId), eq(attendanceEvidence.outletId, input.outletId), eq(attendanceEvidence.staffId, input.staffId))).for('update');
        if (!evidence || evidence.state !== 'ready' || evidence.claimedEventId || evidence.expiresAt <= input.occurredAt || input.occurredAt.getTime() - evidence.createdAt.getTime() > (options.uploadMaxAgeMs ?? 600000)) throw new AttendanceError('INVALID_EVIDENCE');
        await tx.update(attendanceEvidence).set({ claimedEventId: input.id }).where(eq(attendanceEvidence.id, evidence.id));
        }
        const [latest] = await tx.select().from(attendanceEvents).where(eventScope).orderBy(desc(attendanceEvents.sequence)).limit(1);
        if ((input.kind === 'IN' && latest?.kind === 'IN') || (input.kind === 'OUT' && latest?.kind !== 'IN')) throw new AttendanceError('INVALID_TRANSITION');
        const event = { ...input, sequence: (latest?.sequence ?? 0) + 1, shiftId: input.kind === 'IN' ? input.id : latest!.shiftId, businessDate: input.kind === 'IN' ? input.businessDate : latest!.businessDate };
        await tx.insert(attendanceEvents).values(event);
        return event;
      });
    },
    async finalizeEvent(input) {
      return database.transaction(async tx => {
        const scope = and(eq(attendanceLocks.tenantId, input.tenantId), eq(attendanceLocks.outletId, input.outletId), eq(attendanceLocks.staffId, input.staffId));
        await tx.insert(attendanceLocks).values({ tenantId: input.tenantId, outletId: input.outletId, staffId: input.staffId }).onConflictDoNothing();
        await tx.select().from(attendanceLocks).where(scope).for('update');
        const [event] = await tx.select().from(attendanceEvents).where(and(eq(attendanceEvents.tenantId, input.tenantId), eq(attendanceEvents.outletId, input.outletId), eq(attendanceEvents.staffId, input.staffId), eq(attendanceEvents.idempotencyKey, input.idempotencyKey)));
        if (event) {
          if (event.requestHash !== input.requestHash) throw new AttendanceError('IDEMPOTENCY_CONFLICT');
          return { outcome: 'committed' as const, event: event as AttendanceEvent };
        }
        const [canceled] = await tx.select().from(attendanceCanceled).where(and(eq(attendanceCanceled.tenantId, input.tenantId), eq(attendanceCanceled.outletId, input.outletId), eq(attendanceCanceled.staffId, input.staffId), eq(attendanceCanceled.idempotencyKey, input.idempotencyKey)));
        if (canceled) {
          if (canceled.requestHash !== input.requestHash) throw new AttendanceError('IDEMPOTENCY_CONFLICT');
          return { outcome: 'canceled' as const };
        }
        if (options.claimEvidence) {
          const [evidence] = await tx.select().from(attendanceEvidence).where(and(eq(attendanceEvidence.id, input.evidenceKey), eq(attendanceEvidence.tenantId, input.tenantId), eq(attendanceEvidence.outletId, input.outletId), eq(attendanceEvidence.staffId, input.staffId))).for('update');
          if (evidence && !evidence.claimedEventId) await tx.update(attendanceEvidence).set({ claimedEventId: `canceled:${input.idempotencyKey}` }).where(eq(attendanceEvidence.id, evidence.id));
        }
        await tx.insert(attendanceCanceled).values({ tenantId: input.tenantId, outletId: input.outletId, staffId: input.staffId, idempotencyKey: input.idempotencyKey, requestHash: input.requestHash });
        return { outcome: 'canceled' as const };
      });
    },
    async appendCorrection(input) {
      return database.transaction(async tx => {
        const scope = and(eq(attendanceEvents.tenantId, input.tenantId), eq(attendanceEvents.outletId, input.outletId), eq(attendanceEvents.id, input.eventId));
        const [event] = await tx.select().from(attendanceEvents).where(scope).for('update');
        if (!event) throw new AttendanceError('EVENT_NOT_FOUND');
        const [last] = await tx.select().from(attendanceCorrections).where(and(eq(attendanceCorrections.tenantId, input.tenantId), eq(attendanceCorrections.outletId, input.outletId), eq(attendanceCorrections.eventId, input.eventId))).orderBy(desc(attendanceCorrections.sequence)).limit(1);
        const correction = { ...input, sequence: (last?.sequence ?? 0) + 1 };
        await tx.insert(attendanceCorrections).values(correction);
        return correction;
      });
    },
  };
}
