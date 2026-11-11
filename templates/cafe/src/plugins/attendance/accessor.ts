import { createAttendanceInitializer } from './registration.ts';
import { configureAttendance } from './server-config.ts';
// Shared by HTTP requests and trusted scheduled jobs in this server instance.
export const getAttendanceRuntime = createAttendanceInitializer(configureAttendance);
