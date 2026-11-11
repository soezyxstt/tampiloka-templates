import { getAttendanceRuntime } from '@/src/plugins/attendance/accessor';
import { createAttendanceRoute } from '@/src/plugins/attendance/route-handler';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const handle = createAttendanceRoute(getAttendanceRuntime);
export { handle as GET, handle as POST, handle as DELETE };
