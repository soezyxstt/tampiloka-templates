import { readFile, readdir } from 'node:fs/promises';
import { resolveDatabase, runMigrations } from '@tampiloka/storage';
import { storageEnv } from './env.mjs';
import { splitPostgresMigration } from './postgresql-migrations.mjs';

// Wrangler owns the native D1 migration ledger; never apply both ledgers to one database.
const env = await storageEnv(new URL('../', import.meta.url));
const provider = env.DATABASE_PROVIDER;
if (!['turso', 'postgresql'].includes(provider)) throw new Error('Use db:local/db:remote for D1; select turso or postgresql for this runner.');
const directory = new URL(provider === 'postgresql' ? '../migrations-postgresql/' : '../migrations/', import.meta.url);
const files = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
const migrations = [];
for (const name of files) {
  const sql = await readFile(new URL(name, directory), 'utf8');
  if (provider === 'postgresql') {
    migrations.push({id:name, statements:splitPostgresMigration(sql, name)});
    continue;
  }
  const statements = [];
  let current = '', trigger = false;
  for (const line of sql.split('\n')) {
    if (/^\s*--/.test(line)) continue;
    current += line + '\n';
    if (/^\s*CREATE\s+TRIGGER\b/i.test(line)) trigger = true;
    if ((trigger ? /(?:^\s*END;|\bBEGIN\s+SELECT\s+.*;\s*END;)\s*$/i : /;\s*$/).test(line)) {
      const statement = current.trim();
      if (!/^PRAGMA\b/i.test(statement)) statements.push(statement);
      current = ''; trigger = false;
    }
  }
  if (current.trim()) throw new Error(`Unterminated SQL in ${name}`);
  migrations.push({id:name,statements});
}
await runMigrations(resolveDatabase(env), migrations);
console.log('Commerce migrations applied.');
