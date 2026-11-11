import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir } from 'node:fs/promises';
import { createPostgresDatabase, runMigrations } from '@tampiloka/storage';
import { client, configure, inputFor, owner, action } from './harness.mjs';
import { handle as schoolHandle } from '../../school/worker/api.ts';
import { Store } from '../../school/worker/store.ts';

// Resolve the already installed PGlite from the workspace's Cafe dependency.
const require = createRequire(new URL('../../cafe/package.json', import.meta.url));
const { PGlite } = await import(require.resolve('@electric-sql/pglite'));

test('PostgreSQL migrations, booking capacity and School CAS use the shared adapter', async () => {
  const pg = new PGlite();
  const pool = { async connect() { return { async query(q) {
    const result = typeof q === 'string' ? await pg.query(q) : await pg.query(q.text, q.values);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  }, release() {} }; } };
  const db = createPostgresDatabase(pool);
  try {
    const dir = new URL('../migrations-postgresql/', import.meta.url);
    const migrations = [];
    for (const file of (await readdir(dir)).filter(x => x.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL(file, dir), 'utf8');
      migrations.push({ id: file, statements: sql.split(/^-- @statement\s*$/m).map(x => x.trim()).filter(Boolean) });
    }
    await runMigrations(db, migrations);
    await runMigrations(db, migrations);
    const env = { DB: db, DEMO_MODE: 'true', NOW: () => Date.parse('2026-11-01T12:00:00Z') };
    const c = client(env);
    const health = await c.get('/api/health');
    assert.equal(health.status, 200, JSON.stringify(health.data));
    await configure(c, { preset: 'detailing', level: 'booking' });
    const input = await inputFor(c);
    let first;
    for (let n = 0; n < 2; n++) {
      const result = await c.post('/api/bookings', { ...input, idempotencyKey: crypto.randomUUID() });
      assert.equal(result.status, 200, JSON.stringify(result.data));
      first ??= result.data;
    }
    const rejected = await c.post('/api/bookings', { ...input, idempotencyKey: crypto.randomUUID() });
    assert.equal(rejected.status, 409, JSON.stringify(rejected.data));
    assert.equal(Number((await db.prepare('SELECT COUNT(*) AS n FROM bookings').first()).n), 2);
    const staff = await owner(c);
    const resource = staff.resources[0];
    const edited = await c.put('/api/staff/content/resource', { revision: staff.revision, data: { ...resource, capacity: resource.capacity + 1 } });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    assert.equal(Number((await db.prepare('SELECT COUNT(*) AS n FROM resource_units WHERE scope=? AND resource=?').bind((await db.prepare('SELECT scope FROM bookings WHERE id=?').bind(first.id).first()).scope, resource.id).first()).n), resource.capacity + 1);
    const noted = await action(c, first, 'note', { note: 'Call first', version: first.version });
    assert.equal(noted.status, 200, JSON.stringify(noted.data));
    assert.equal((await action(c, first, 'note', { note: 'Stale', version: first.version })).status, 409);
    await db.prepare('CREATE TABLE rollback_probe (value INTEGER NOT NULL)').run();
    await db.prepare('INSERT INTO rollback_probe(value) VALUES(1)').run();
    await assert.rejects(db.batch([
      db.prepare('UPDATE rollback_probe SET value=2'),
      db.prepare('UPDATE scopes SET revision=revision+1 WHERE id=?').bind('missing'),
      db.prepare('INSERT INTO mutation_guards(id,ok) VALUES(?,changes())').bind('test-guard'),
    ]));
    assert.equal(Number((await db.prepare('SELECT COUNT(*) AS n FROM mutation_guards').first()).n), 0);
    assert.equal((await db.prepare('SELECT value FROM rollback_probe').first()).value, 1);
    const schoolSql = (await readFile(new URL('../../school/migrations/0001_school.sql', import.meta.url), 'utf8')).replaceAll('expires_at INTEGER', 'expires_at BIGINT');
    await runMigrations(db, [{ id: 'school-0001', statements: schoolSql.split(';').map(s => s.trim()).filter(Boolean) }]);
    const schoolResponse = await schoolHandle(new Request('https://school.test/api/bootstrap'), { DB: db, DEMO_MODE: 'true' });
    assert.equal(schoolResponse.status, 200, await schoolResponse.text());
    const secondSchoolResponse = await schoolHandle(new Request('https://school.test/api/bootstrap'), { DB: db, DEMO_MODE: 'true' });
    assert.equal(secondSchoolResponse.status, 200, await secondSchoolResponse.text());
    const store = new Store(db, 'demo:test', () => ({ count: 0 }), 1793534400000);
    assert.equal((await store.load()).revision, 0);
    await store.mutate(state => { state.count++; });
    assert.equal((await store.load()).state.count, 1);
    const stale = await db.prepare('UPDATE school_state SET revision=revision+1 WHERE namespace=? AND revision=?').bind('demo:test', 0).run();
    assert.equal(stale.meta.changes, 0);
    await db.prepare('INSERT INTO school_sessions(token_hash,namespace,user_id,expires_at) VALUES(?,?,?,?)').bind('hash', 'production', 'user', 1793534400000).run();
    assert.ok(await db.prepare('SELECT token_hash FROM school_sessions WHERE token_hash=? AND expires_at>?').bind('hash', 1793534399999).first());
    assert.equal(await db.prepare('SELECT token_hash FROM school_sessions WHERE token_hash=? AND expires_at>?').bind('hash', 1793534400000).first(), null);
  } finally { await pg.close(); }
});
