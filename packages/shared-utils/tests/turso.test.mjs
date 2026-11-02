import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';
import { databaseFromClient, tursoClient } from '../src/turso.mjs';
import { manageSchema } from '../src/db-cli.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'tampiloka-libsql-'));
  const client = createClient({ url: pathToFileURL(join(dir, 'test.sqlite')).href });
  t.after(async () => { client.close(); await rm(dir, {recursive:true, force:true}); });
  return { dir, client };
}

test('libSQL binding keeps changes() and guard failures in the same transaction', async t => {
  const {client} = await fixture(t);
  const db = databaseFromClient(client);
  const q = (sql, ...args) => db.prepare(sql).bind(...args);
  await db.batch([q('CREATE TABLE stock(id TEXT PRIMARY KEY, qty INTEGER)'),q('CREATE TABLE guard(ok INTEGER CHECK(ok=1))')]);
  const result = await q('INSERT INTO stock VALUES(?,?)','hat',3).run();
  assert.equal(result.meta.changes, 1);
  const guard = q('INSERT INTO guard VALUES(changes())');
  await db.batch([q('UPDATE stock SET qty=qty-1 WHERE id=?','hat'),guard]);
  await assert.rejects(db.batch([q('DELETE FROM stock'),q('UPDATE stock SET qty=0 WHERE id=?','missing'),guard]), /CHECK/i);
  assert.deepEqual((await q('SELECT id,qty FROM stock').all()).results,[{id:'hat',qty:2}]);
  assert.equal(await q('SELECT qty FROM stock').first('qty'),2);
  assert.equal(await q('SELECT * FROM stock WHERE 0').first(),null);
});

test('remote migrations are atomic, repeatable and detect drift on restored databases', async t => {
  const {dir,client} = await fixture(t);
  const file = join(dir,'0001.sql');
  const sql = 'CREATE TABLE demo(id INTEGER PRIMARY KEY,value INTEGER);\nCREATE TRIGGER initial_value AFTER INSERT ON demo BEGIN UPDATE demo SET value=10 WHERE id=new.id; END;';
  await writeFile(file,sql);
  await client.executeMultiple(sql);
  await assert.rejects(manageSchema(client,'migrate',dir),/schema differs/);
  await manageSchema(client,'adopt',dir);
  await manageSchema(client,'migrate',dir);
  await manageSchema(client,'verify',dir);
  await writeFile(join(dir,'0002.sql'),'CREATE TABLE second(id INTEGER); INVALID STATEMENT;');
  await assert.rejects(manageSchema(client,'migrate',dir));
  assert.equal((await client.execute("SELECT COUNT(*) AS n FROM sqlite_schema WHERE name='second'")).rows[0].n,0);
  await writeFile(join(dir,'0002.sql'),'CREATE TABLE second(id INTEGER);');
  await manageSchema(client,'migrate',dir);
  await manageSchema(client,'verify',dir);
  await writeFile(file,sql+'\n-- changed');
  await assert.rejects(manageSchema(client,'verify',dir),/history differs/);
});

test('hosted client rejects missing credentials and non-TLS transport', () => {
  assert.throws(() => tursoClient({}), /credentials/);
  assert.throws(() => tursoClient({TURSO_DATABASE_URL:'http://turso.invalid',TURSO_AUTH_TOKEN:'test'}), /secure/);
});
