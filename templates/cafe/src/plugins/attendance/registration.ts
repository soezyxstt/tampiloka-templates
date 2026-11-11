import type { createAttendanceRuntime } from './runtime.ts';

type Runtime = ReturnType<typeof createAttendanceRuntime>;
/** One lazy configuration per module instance. A failed initialization can be retried. */
export function createAttendanceInitializer(factory: () => Runtime | null | Promise<Runtime | null>) {
  let initialized: Promise<Runtime | null> | undefined;
  return () => {
    if (!initialized) initialized = Promise.resolve().then(factory).catch(error => { initialized = undefined; throw error; });
    return initialized;
  };
}
