import { readFile, readdir } from 'node:fs/promises';
import { resolveDatabase, runMigrations } from '@tampiloka/storage';
import { storageEnv } from './env.mjs';

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
    // Statements are terminated outside the dollar-quoted PL/pgSQL function bodies.
    const statements = sql.split(/(\$\$)/).reduce((state, part) => {
      if (part === '$$') { state.current += part; state.quoted = !state.quoted; }
      else if (state.quoted) state.current += part;
      else { const chunks = part.split(';'); state.current += chunks.shift(); for (const chunk of chunks) { if (state.current.trim()) state.statements.push(state.current.trim()); state.current = chunk; } }
      return state;
    }, { statements: [], current: '', quoted: false });
    if (statements.quoted || statements.current.trim()) throw new Error(`Unterminated SQL in ${name}`);
    migrations.push({id:name, statements:statements.statements});
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
