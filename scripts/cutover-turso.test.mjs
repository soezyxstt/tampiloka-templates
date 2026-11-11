import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { transfer } from './cutover-turso.mjs';

const { createClient } = createRequire(new URL('../packages/shared-utils/package.json', import.meta.url))('@libsql/client');

test('stage, restore and verify a D1 export without firing triggers twice', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'cutover-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const dump = join(dir, 'source.sql');
  const staged = join(dir, 'staged');
  await writeFile(dump, `PRAGMA defer_foreign_keys=TRUE;
    CREATE TABLE products (id INTEGER PRIMARY KEY, stock INTEGER);
    CREATE TABLE orders (id INTEGER PRIMARY KEY, note TEXT, payload BLOB);
    CREATE TABLE order_items (id INTEGER PRIMARY KEY, product INTEGER REFERENCES products(id));
    CREATE TRIGGER reserve AFTER INSERT ON order_items BEGIN UPDATE products SET stock=stock-1 WHERE id=NEW.product; END;
    INSERT INTO products VALUES(1, 7);
    INSERT INTO orders VALUES(9007199254740993, 'test; -- literal', X'00FF');
    INSERT INTO order_items VALUES(1,1);
    ANALYZE sqlite_schema;
    INSERT INTO "sqlite_stat1" ("tbl","idx","stat") VALUES('products',NULL,'1');`);
  execFileSync('python3', [fileURLToPath(new URL('stage-d1.py',import.meta.url)), dump, staged]);
  const client = createClient({ url: 'file:' + join(dir,'target.db') });
  try {
    await transfer(client,staged,'commerce','import');
    await transfer(client,staged,'commerce','verify');
    assert.equal((await client.execute('SELECT stock FROM products')).rows[0].stock, 7);
    await assert.rejects(transfer(client,staged,'commerce','import'), /not empty/);
    await client.execute('UPDATE orders SET payload=X\'00FE\'');
    await assert.rejects(transfer(client,staged,'commerce','verify'), /Verification failed/);
  } finally { client.close(); }

  const restore = join(staged, 'restore.sql');
  const original = await readFile(restore, 'utf8');
  const bad = createClient({ url: 'file:' + join(dir, 'bad.db') });
  try {
    await writeFile(restore, original + '\nINSERT INTO missing_table VALUES(1);');
    await assert.rejects(transfer(bad,staged,'commerce','import'));
    assert.equal((await bad.execute("SELECT 1 FROM sqlite_schema WHERE name='orders'")).rows.length, 0);
    await writeFile(restore, original + '\nUPDATE products SET stock=8;');
    await assert.rejects(transfer(bad,staged,'commerce','import'), /Import committed but verification failed/);
    assert.equal((await bad.execute('SELECT stock FROM products')).rows[0].stock, 8);
  } finally { bad.close(); }
});
