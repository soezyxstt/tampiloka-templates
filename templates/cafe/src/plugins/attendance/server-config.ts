/** Server-only host integration point. Replace this factory with trusted adapters.
 * It is imported by the route in each server instance; never import in client code.
 */
import type { createAttendanceRuntime } from './runtime.ts';
export function configureAttendance(): ReturnType<typeof createAttendanceRuntime> | null {
  return null;
}
