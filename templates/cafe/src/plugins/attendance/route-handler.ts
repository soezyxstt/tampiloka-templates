import type { createAttendanceRuntime } from './runtime.ts';
type Runtime = ReturnType<typeof createAttendanceRuntime>;
export function createAttendanceRoute(getRuntime: () => Promise<Runtime | null>) {
  return async (request: Request) => {
    try {
      const runtime = await getRuntime();
      if (runtime) return await runtime.handle(request);
    } catch {
      return Response.json({ error: 'ATTENDANCE_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json({ error: 'ATTENDANCE_NOT_CONFIGURED' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  };
}
