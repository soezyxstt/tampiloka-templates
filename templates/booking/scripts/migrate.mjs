import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolveDatabase, runMigrations } from '@tampiloka/storage';
import { localEnv } from './env.mjs';

const root = new URL('../', import.meta.url);
let selected = {};
try { selected = JSON.parse(await readFile(new URL('config/storage.json', root), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const vars = await localEnv(root);
const demo = process.argv.includes('--demo');
const provider = demo ? 'd1' : (vars.DATABASE_PROVIDER || selected.database || 'd1');
if (provider === 'd1') {
  const args = ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', process.argv.includes('--remote') ? '--remote' : '--local', '--config', demo ? 'wrangler.demo.jsonc' : 'wrangler.jsonc'];
  const result = spawnSync('pnpm', args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
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
  // The checked-in migration format ends each statement on its own line; trigger
  // bodies contain semicolons and terminate only at END;.
  const statements = []; let current = '', trigger = false;
  for (const line of sql.split('\n')) {
    if (!current.trim() && /^CREATE TRIGGER\b/i.test(line.trim())) trigger = true;
    current += line + '\n';
    if ((!trigger && /;\s*$/.test(line)) || (trigger && /^END;\s*$/i.test(line.trim()))) {
      if (!/^\s*PRAGMA\s/i.test(current)) statements.push(current.trim());
      current = ''; trigger = false;
    }
  }
  if (current.trim()) throw new Error(`Incomplete SQL in ${file}`);
  migrations.push({ id: file, statements });
}
await runMigrations(db, migrations);
console.log(`Applied Booking migrations to ${provider}.`);
