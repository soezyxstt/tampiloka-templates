import { fileURLToPath } from 'node:url';
import { tursoClient } from '@tampiloka/shared-utils/turso';
import { manageSchema } from '@tampiloka/shared-utils/db-cli';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolveDatabase, runMigrations } from '@tampiloka/storage';
import { localEnv, migrationProvider } from './env.mjs';
import { parseSQLiteMigration } from './sqlite-migrations.mjs';

const root = new URL('../', import.meta.url);
let selected = {};
try { selected = JSON.parse(await readFile(new URL('config/storage.json', root), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const vars = await localEnv(root);
const demo = process.argv.includes('--demo');
const provider = migrationProvider(vars, selected, demo);
if (provider === 'd1') {
  const args = ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', process.argv.includes('--remote') ? '--remote' : '--local', '--config', 'wrangler.jsonc'];
  const result = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}
if (provider === 'turso') {
  const client = tursoClient(vars);
  try { await manageSchema(client, 'migrate', fileURLToPath(new URL('../migrations/', import.meta.url))); } finally { client.close(); }
  console.log('Turso schema verified.');
  process.exit(0);
}
if (provider !== 'turso' && provider !== 'postgresql') throw new Error(`Unknown database provider: ${provider}`);
const db = resolveDatabase({ ...vars, DATABASE_PROVIDER: provider });
const directory = provider === 'postgresql' ? 'migrations-postgresql/' : 'migrations/';
const files = (await readdir(new URL(directory, root))).filter(name => name.endsWith('.sql')).sort();
const migrations = [];
for (const file of files) {
  const sql = await readFile(new URL(`${directory}${file}`, root), 'utf8');
  if (provider === 'postgresql') {
    migrations.push({ id: file, statements: sql.split(/^-- @statement\s*$/m).map(x => x.trim()).filter(Boolean) });
    continue;
  }
  migrations.push({ id: file, statements: parseSQLiteMigration(sql, file) });
}
await runMigrations(db, migrations);
console.log(`Applied Booking migrations to ${provider}.`);
