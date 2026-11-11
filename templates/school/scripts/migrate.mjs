import { readFile } from 'node:fs/promises';
import { resolveDatabase, runMigrations } from '@tampiloka/storage';
import { localEnv } from './env.mjs';
const vars = await localEnv(new URL('../', import.meta.url));

const config = await readFile(new URL('../config/storage.json', import.meta.url), 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return {}; throw error; });
const provider = vars.DATABASE_PROVIDER || config.database || 'd1';
if (provider === 'd1' && !vars.CLOUDFLARE_ACCOUNT_ID) throw new Error('For D1 use pnpm db:local or pnpm db:remote with the native Wrangler binding, or provide Cloudflare REST credentials.');
let sql = await readFile(new URL('../migrations/0001_school.sql', import.meta.url), 'utf8');
// SQLite integers are 64-bit; PostgreSQL INTEGER cannot hold epoch milliseconds.
if (provider === 'postgresql') sql = sql.replaceAll('expires_at INTEGER', 'expires_at BIGINT');
await runMigrations(resolveDatabase({ ...vars, DATABASE_PROVIDER: provider }), [{ id: '0001_school', statements: sql.split(';').map(statement => statement.trim()).filter(Boolean) }]);
console.log(`School migrations applied to ${provider}.`);
