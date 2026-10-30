/** Alias target for src/db/index.ts inside the browser demo service graph. */
import type { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from '../db/schema.ts';

export const usingDemoDatabase = true;
export const pool = undefined;
// Production worker chunks must share the same attached database instance.
const workerState = globalThis as typeof globalThis & { __cafeWorkerDatabase?: PgliteDatabase<typeof schema> };

export function attachBrowserWorkerDatabase(client: PGlite): void {
  workerState.__cafeWorkerDatabase = drizzle(client, { schema });
}

export const db = new Proxy({} as PgliteDatabase<typeof schema>, {
  get(_target, key) {
    const database = workerState.__cafeWorkerDatabase;
    if (!database) throw new Error('Penyimpanan worker demo belum siap.');
    const value = Reflect.get(database, key, database);
    return typeof value === 'function' ? value.bind(database) : value;
  },
});
