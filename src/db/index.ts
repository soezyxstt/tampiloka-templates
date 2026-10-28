import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { resolve } from 'node:path';
import * as schema from './schema.ts';
import { cafeConfig } from '../config/cafe.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _cafeDemoDatabase: PGlite | undefined;
}

// Explicit opt-in: missing production credentials never silently enables demo data.
export const usingDemoDatabase = process.env.CAFE_DEMO_DB === '1';

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
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

export const pool = usingDemoDatabase ? undefined : createPool();
function createDatabase() {
  return usingDemoDatabase
    ? drizzlePglite(getDemoDatabase(), { schema })
    : drizzlePostgres(pool!, { schema });
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
