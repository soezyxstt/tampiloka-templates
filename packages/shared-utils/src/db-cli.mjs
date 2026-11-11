#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { tursoClient } from './turso.mjs';

const ledger = 'tampiloka_migrations';
const schema = `SELECT type,name,sql FROM sqlite_schema WHERE sql IS NOT NULL
  AND name NOT GLOB 'sqlite_*' AND name NOT GLOB 'libsql_*' AND name NOT GLOB '_litestream_*'
  AND name NOT IN ('_cf_KV','d1_migrations','tampiloka_migrations') ORDER BY type,name`;

function verifySchema(files, rows) {
  const reference = new DatabaseSync(':memory:');
  try {
    for (const file of files) reference.exec(file.sql);
    const expected = reference.prepare(schema).all();
    // Compare SQL too: a table name alone cannot establish constraints or trigger behavior.
    const signature = row => [row.type, row.name, row.sql.replace(/\r\n/g, '\n').trim()];
    if (JSON.stringify(expected.map(signature)) !== JSON.stringify(rows.map(signature))) {
      throw new Error('Database schema differs from the checked-in migrations. Inspect before continuing.');
    }
  } finally { reference.close(); }
}

export async function manageSchema(client, action, directory) {
  if (!['verify', 'adopt', 'migrate'].includes(action)) throw new Error('Usage: tampiloka-db migrate|adopt|verify');
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  if (!names.length) throw new Error('No migrations found.');
  const files = await Promise.all(names.map(async name => {
    const sql = (await readFile(join(directory, name), 'utf8')).replace(/\r\n/g, '\n');
    return { name, sql, sha256: createHash('sha256').update(sql).digest('hex') };
  }));
  const tx = await client.transaction(action === 'verify' ? 'read' : 'write');
  try {
    const fk = await tx.execute('PRAGMA foreign_keys');
    if (fk.rows[0]?.foreign_keys !== 1) throw new Error('Enable Turso foreign keys before proceeding.');
    const found = await tx.execute("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='tampiloka_migrations'");
    if (!found.rows.length && action === 'verify') throw new Error('Turso migration ledger missing.');
    if (!found.rows.length) await tx.execute(`CREATE TABLE ${ledger} (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL)`);
    const applied = (await tx.execute(`SELECT name,sha256 FROM ${ledger} ORDER BY name`)).rows;
    if (applied.some((row, i) => row.name !== files[i]?.name || row.sha256 !== files[i]?.sha256)) {
      throw new Error('Migration history differs from the checked-in files.');
    }
    const pending = files.slice(applied.length);
    const actual = (await tx.execute(schema)).rows;
    if (action === 'adopt') {
      // Explicitly adopt only a fully restored and separately data-verified database.
      verifySchema(files, actual);
    } else {
      verifySchema(files.slice(0, applied.length), actual);
      if (action === 'verify' && pending.length) throw new Error('Unapplied Turso migrations.');
    }
    for (const file of pending) {
      if (action === 'migrate') await tx.executeMultiple(file.sql);
      await tx.execute({ sql: `INSERT INTO ${ledger}(name,sha256) VALUES(?,?)`, args: [file.name,file.sha256] });
    }
    if (action === 'migrate' && pending.length) verifySchema(files, (await tx.execute(schema)).rows);
    await tx.commit();
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  } finally { tx.close(); }
}

if (process.argv[1] && existsSync(process.argv[1]) && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const client = tursoClient(process.env);
  try {
    await manageSchema(client, process.argv[2], join(process.cwd(), 'migrations'));
    console.log('Turso schema verified.');
  } finally { client.close(); }
}
