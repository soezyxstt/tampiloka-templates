import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import * as schema from './schema.ts';
import { cafeConfig } from '../config/cafe.ts';
import { postgresConnectionConfig } from './provider.mjs';
import { createSqliteDatabase } from './sqlite.ts';
import { createD1StateDatabase } from './d1-state.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _cafeDemoDatabase: PGlite | undefined;
}

// Explicit opt-in: missing production credentials never silently enables demo data.
export const usingDemoDatabase = process.env.CAFE_DEMO_DB === '1';

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      ...postgresConnectionConfig(process.env),
      max: 10,
      connectionTimeoutMillis: 15000,
    });
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

function getDemoDatabase() {
  if (!global._cafeDemoDatabase) {
    global._cafeDemoDatabase = new PGlite(resolve(process.env.CAFE_DEMO_DATA_DIR || `.local/${cafeConfig.venue.outletSlug}/cafe-db`));
  }
  return global._cafeDemoDatabase;
}

const provider = process.env.DATABASE_PROVIDER || 'postgresql';
export const selectedDatabaseProvider = usingDemoDatabase ? 'pglite' : provider;
if (!['postgresql', 'turso', 'd1'].includes(provider)) throw new Error(`Unknown DATABASE_PROVIDER: ${provider}`);
export const pool = usingDemoDatabase || provider !== 'postgresql' ? undefined : createPool();

function sqliteClient() {
  let client: Promise<any> | undefined;
  const getClient = () => client ??= (async () => {
    if (provider === 'd1') {
      const { resolveDatabase } = await import('@tampiloka/storage');
      const d1 = resolveDatabase(process.env);
      return { execute: async ({ sql, args }: any) => {
        const result = await d1.prepare(sql).bind(...args).all();
        const rows = result.results;
        return { columns: rows.length ? Object.keys(rows[0]) : [], rows };
      } };
    }
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error('Missing TURSO_DATABASE_URL');
    const { createClient } = await import('@libsql/client');
    return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  })();
  return {
    execute: async (query: any) => (await getClient()).execute(query),
    transaction: async (mode: 'write') => (await getClient()).transaction(mode),
  };
}
type CafeDatabase = NodePgDatabase<typeof schema>;
function createDatabase(): CafeDatabase {
  const selected = usingDemoDatabase
    ? drizzlePglite(getDemoDatabase(), { schema })
    : provider === 'postgresql' ? drizzlePostgres(pool!, { schema })
    : provider === 'd1' ? createD1StateDatabase(async () => { const { resolveDatabase } = await import('@tampiloka/storage'); return resolveDatabase(process.env); }, cafeConfig.venue.outletSlug)
    : createSqliteDatabase(sqliteClient());
  // Each backend implements the same PostgreSQL-shaped Drizzle query contract.
  return selected as CafeDatabase;
}

// Route discovery/build workers import this module without querying data.
// Open the persisted demo database only when a request actually needs it.
let database: ReturnType<typeof createDatabase> | undefined;
export const db = new Proxy({} as ReturnType<typeof createDatabase>, {
  get(_target, key) {
    database ??= createDatabase();
    const value = Reflect.get(database, key, database);
    return typeof value === 'function' ? value.bind(database) : value;
  },
});
