import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { tursoClient } from '../packages/shared-utils/src/turso.mjs';

const objects = `SELECT type,name,sql FROM sqlite_schema WHERE sql IS NOT NULL
 AND name NOT GLOB 'sqlite_*' AND name NOT GLOB 'libsql_*' AND name NOT GLOB '_litestream_*'
 ORDER BY type,name`;
const families = {
  commerce: ['products', 'order_items', 'orders'],
  booking: ['bookings', 'tickets', 'access_grants'],
  school: ['school_state', 'school_sessions', 'school_visitors'],
};
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const tuples = rows => rows.map(row => [row.type, row.name, row.sql]);
const digest = input => createHash('sha256').update(input).digest('hex');

async function compareTable(db, client, name) {
  const table = quote(name);
  const columns = db.prepare(`SELECT name FROM pragma_table_xinfo(?) ORDER BY cid`).all(name);
  // Keep SQLite storage classes, binary bytes and 64-bit integers intact.
  const fields = columns.map(({name}, i) => {
    const c = quote(name);
    return `typeof(${c}) AS t${i}, CASE typeof(${c})
      WHEN 'integer' THEN CAST(${c} AS TEXT) WHEN 'blob' THEN hex(${c}) ELSE ${c} END AS v${i}`;
  }).join(',');
  const select = `SELECT ${fields} FROM ${table}`;
  const rowHash = row => digest(JSON.stringify(columns.map((_, i) => [row['t'+i], row['v'+i]])));
  const expected = Array.from(db.prepare(select).iterate(), rowHash);
  const actual = [];
  // The target stays offline throughout verification. Order pages explicitly.
  const info = db.prepare('SELECT wr FROM pragma_table_list WHERE name=?').get(name);
  const order = info.wr ? db.prepare('SELECT name FROM pragma_table_info(?) WHERE pk>0 ORDER BY pk').all(name).map(c=>quote(c.name)).join(',') : 'rowid';
  const size = 20;
  for (let offset = 0; ; offset += size) {
    const { rows } = await client.execute({ sql: `${select} ORDER BY ${order} LIMIT ? OFFSET ?`, args: [size,offset] });
    actual.push(...rows.map(rowHash));
    if (rows.length < size) break;
  }
  const fingerprint = hashes => digest(hashes.sort().join(''));
  if (expected.length !== actual.length || fingerprint(expected) !== fingerprint(actual)) {
    throw new Error(`Verification failed for table ${name}.`);
  }
  console.log(`${name}: ${actual.length} rows, SHA-256 ${fingerprint(actual)}`);
}

async function importEmptyTarget(client, directory) {
  const sql = readFileSync(join(directory,'restore.sql'),'utf8');
  if (Buffer.byteLength(JSON.stringify(sql)) > 4_000_000) throw new Error('Use the fresh-database --from-file path for snapshots larger than 4 MB.');
  const tx = await client.transaction('write');
  let committing = false;
  try {
    const [fk, existing] = await tx.batch(['PRAGMA foreign_keys', objects]);
    if (fk.rows[0]?.[0] !== 1) throw new Error('Enable foreign keys on the target database.');
    if (existing.rows.length) throw new Error('Target database is not empty. Refusing to import.');
    await tx.executeMultiple('PRAGMA defer_foreign_keys=ON;\n' + sql);
    committing = true;
    await tx.commit();
  } catch (error) {
    if (!tx.closed) await tx.rollback().catch(() => {});
    if (committing) throw new Error('Commit was not confirmed. Keep the target offline and run verify before any retry.', { cause: error });
    throw error;
  } finally { tx.close(); }
}

async function verifyTarget(client, db, source, tables) {
  // Each query opens its own short read. There are no target writers until cutover.
  const [fk, violations, integrity, actualSchema] = await Promise.all([
    client.execute('PRAGMA foreign_keys'), client.execute('PRAGMA foreign_key_check'),
    client.execute('PRAGMA integrity_check'), client.execute(objects),
  ]);
  if (fk.rows[0]?.[0] !== 1 || violations.rows.length) throw new Error('Target foreign-key check failed.');
  if (integrity.rows.length !== 1 || integrity.rows[0][0] !== 'ok') throw new Error('Target SQLite integrity check failed.');
  if (JSON.stringify(tuples(source)) !== JSON.stringify(tuples(actualSchema.rows))) throw new Error('Target schema differs from source.');
  if (db.prepare("SELECT 1 FROM sqlite_schema WHERE name='sqlite_sequence'").get()) tables.push('sqlite_sequence');
  for (const name of tables) await compareTable(db, client, name);
}

export async function transfer(client, directory, family, action) {
  if (!Object.hasOwn(families, family) || !['import','verify'].includes(action)) throw new Error('Expected import|verify and commerce|booking|school.');
  const db = new DatabaseSync(join(directory, 'source.sqlite'), { readOnly: true });
  try {
    const source = db.prepare(objects).all();
    const tables = source.filter(obj => obj.type === 'table').map(obj => obj.name);
    if (!families[family].every(name => tables.includes(name)) || tables.includes('_cf_KV')) {
      throw new Error('Wrong family or platform-internal tables in source. Check the export before importing.');
    }
    if (action === 'import') await importEmptyTarget(client, directory);
    try {
      await verifyTarget(client, db, source, tables);
    } catch (error) {
      if (action === 'import') throw new Error('Import committed but verification failed. Keep the target offline and rerun verify.', { cause: error });
      throw error;
    }
  } finally { db.close(); }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [action, family, directory, host] = process.argv.slice(2);
  assert.ok(host && directory && new URL(process.env.TURSO_DATABASE_URL).hostname === host,
    'Confirm the destination hostname as the last argument.');
  const client = tursoClient(process.env);
  try { await transfer(client, directory, family, action); } finally { client.close(); }
}
