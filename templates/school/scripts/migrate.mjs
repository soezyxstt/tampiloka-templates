import { fileURLToPath } from 'node:url';
import { tursoClient } from '@tampiloka/shared-utils/turso';
import { manageSchema } from '@tampiloka/shared-utils/db-cli';
import { readFile } from 'node:fs/promises';
import { resolveDatabase, runMigrations } from '@tampiloka/storage';
import { localEnv } from './env.mjs';
const vars = await localEnv(new URL('../', import.meta.url));

const config = await readFile(new URL('../config/storage.json', import.meta.url), 'utf8').then(JSON.parse).catch(error => { if (error.code === 'ENOENT') return {}; throw error; });
const provider = vars.DATABASE_PROVIDER || config.database || 'turso';
if (provider === 'turso') {
    const client = tursoClient(vars);
    try { await manageSchema(client, 'migrate', fileURLToPath(new URL('../migrations/', import.meta.url))); } finally { client.close(); }
    console.log('Turso schema verified.');
    process.exit(0);
}
if (provider === 'd1') {
    const { spawnSync } = await import('node:child_process');
    const result = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', process.argv.includes('--remote') ? '--remote' : '--local'], { stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exit(result.status ?? 1);
}
if (provider !== 'postgresql') throw new Error(`Unknown database provider: ${provider}`);
let sql = await readFile(new URL('../migrations/0001_school.sql', import.meta.url), 'utf8');
// SQLite integers are 64-bit; PostgreSQL INTEGER cannot hold epoch milliseconds.
if (provider === 'postgresql') sql = sql.replaceAll('expires_at INTEGER', 'expires_at BIGINT');
await runMigrations(resolveDatabase({ ...vars, DATABASE_PROVIDER: provider }), [{ id: '0001_school', statements: sql.split(';').map(statement => statement.trim()).filter(Boolean) }]);
console.log(`School migrations applied to ${provider}.`);
