import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolveDatabase } from '@tampiloka/storage';
import { cafeConfig } from '../src/config/cafe.ts';
import { D1_STATE_VERSION, encodeCafeState, materializeCafeState } from '../src/db/d1-state.ts';
import { clientCatalogStatements } from '../src/db/client-catalog.ts';

if (process.env.CAFE_DEMO_DB === '1') throw new Error('Client catalog initialization cannot run in demo mode.');
if (!['turso', 'd1'].includes(process.env.DATABASE_PROVIDER || '')) throw new Error('Set DATABASE_PROVIDER to turso or d1.');
const menu = JSON.parse(await readFile(new URL('../content/menu.json', import.meta.url), 'utf8'));
const tables = JSON.parse(await readFile(new URL('../content/tables.json', import.meta.url), 'utf8'));
const statements = clientCatalogStatements(menu, tables, cafeConfig);
const db = resolveDatabase(process.env);
if (process.env.DATABASE_PROVIDER === 'd1') {
  const local = await materializeCafeState();
  try {
    local.sql.exec('BEGIN');
    for (const { sql, args } of statements) local.sql.prepare(sql).run(...args);
    local.sql.exec('COMMIT');
    const json = encodeCafeState(local.exportState());
    await db.prepare('INSERT INTO cafe_state (outlet_id, schema_version, revision, state_json) VALUES (?, ?, 0, ?)').bind(cafeConfig.venue.outletSlug, D1_STATE_VERSION, json).run();
  } finally { local.sql.close(); }
} else {
  if (await db.prepare('SELECT id FROM tenants LIMIT 1').first()) throw new Error('Database already has a tenant; client initialization is for an empty database only.');
  await db.batch(statements.map(({ sql, args }) => db.prepare(sql).bind(...args)));
}
console.log('Client catalog initialized. Ordering remains disabled.');
