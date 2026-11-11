import type { AttendanceCommand, OutletPolicy, PrincipalAdapter } from './contracts.ts';
import { AttendanceError, createAttendanceService } from './service.ts';

/** Mount only on a server after providing real authentication and trusted policy lookup. */
export function createAttendanceHandler(deps: {
  principal: PrincipalAdapter<Request>;
  policy: (tenantId: string, outletId: string) => Promise<OutletPolicy | null>;
  service: ReturnType<typeof createAttendanceService>;
}) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== 'POST') return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405 });
      const principal = await deps.principal.authenticate(request);
      if (!principal) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.outletId !== 'string') throw new AttendanceError('INVALID_REQUEST');
      if (body.action === 'record') {
        const policy = await deps.policy(principal.tenantId, body.outletId);
        if (!policy) throw new AttendanceError('FORBIDDEN');
        const result = await deps.service.record(principal, policy, body as AttendanceCommand);
        return Response.json({ id: result.id, kind: result.kind, occurredAt: result.occurredAt, businessDate: result.businessDate, shiftId: result.shiftId });
      }
      if (body.action === 'finalize') {
        const policy = await deps.policy(principal.tenantId, body.outletId);
        if (!policy) throw new AttendanceError('FORBIDDEN');
        const result = await deps.service.finalize(principal, policy, body as AttendanceCommand);
        if (result.outcome === 'canceled') return Response.json(result);
        const { id, kind, occurredAt, businessDate, shiftId } = result.event;
        return Response.json({ outcome: 'committed', event: { id, kind, occurredAt, businessDate, shiftId } });
      }
      if (body.action === 'correct') {
        const policy = await deps.policy(principal.tenantId, body.outletId);
        if (!policy || policy.tenantId !== principal.tenantId || policy.outletId !== body.outletId) throw new AttendanceError('FORBIDDEN');
        const result = await deps.service.correct(principal, { tenantId: principal.tenantId, outletId: body.outletId, eventId: body.eventId, correctedAt: body.correctedAt, reason: body.reason });
        return Response.json({ id: result.id, eventId: result.eventId, sequence: result.sequence });
      }
      throw new AttendanceError('INVALID_REQUEST');
    } catch (error) {
      if (error instanceof SyntaxError) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 });
      if (error instanceof AttendanceError) return Response.json({ error: error.code }, { status: error.code === 'FORBIDDEN' ? 403 : error.code === 'EVENT_NOT_FOUND' ? 404 : error.code === 'BIOMETRIC_UNAVAILABLE' ? 503 : ['IDEMPOTENCY_CONFLICT', 'INVALID_TRANSITION', 'OPERATION_CANCELED'].includes(error.code) ? 409 : 422 });
      return Response.json({ error: 'ATTENDANCE_UNAVAILABLE' }, { status: 503 });
    }
  };
}
