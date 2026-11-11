import 'dotenv/config';
import { sqliteSchema } from '../src/db/sqlite.ts';
import { D1_STATE_SCHEMA } from '../src/db/d1-state.ts';
import { resolveDatabase } from '@tampiloka/storage';

const provider = process.env.DATABASE_PROVIDER;
if (provider !== 'turso' && provider !== 'd1') throw new Error('Set DATABASE_PROVIDER to turso or d1');
if (process.env.CAFE_DEMO_DB === '1') throw new Error('SQLite client initialization cannot run in demo mode.');
const db = resolveDatabase(process.env);
const existing = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1").first();
if (existing) throw new Error('SQLite schema initialization requires an empty database. Use versioned migrations for an existing database.');
await db.batch((provider === 'd1' ? [D1_STATE_SCHEMA] : sqliteSchema()).map(sql => db.prepare(sql)));
console.log(`Initialized Cafe SQLite schema on ${provider}.`);
