import test from 'node:test';
import assert from 'node:assert/strict';
import { postgresParameters, resolveDatabase, resolveObjectStorage, runMigrations } from './index.mjs';

test('placeholder conversion leaves literals, comments and dollar quotes alone', () => {
  assert.deepEqual(postgresParameters("select ?, '?', \"?\", $$?$$ -- ?\n, ? /* ? */"), {sql: "select $1, '?', \"?\", $$?$$ -- ?\n, $2 /* ? */", count: 2});
  assert.throws(() => postgresParameters('select ?1'));
  assert.throws(() => postgresParameters("select 'unterminated"));
});
test('D1 binding passes through and unknown providers fail closed', () => {
  const db = {}; assert.equal(resolveDatabase({ DB: db }), db);
  assert.throws(() => resolveDatabase({ DATABASE_PROVIDER: 'other' }));
  assert.throws(() => resolveObjectStorage({ OBJECT_STORAGE_PROVIDER: 'other' }));
});
test('D1 REST batch sends bound values and reports errors', async () => {
  const original = globalThis.fetch; let request;
  globalThis.fetch = async (url, init) => { request = JSON.parse(init.body); return Response.json({ success: true, result: [{success: true, results: [{id: 4}], meta: {changes: 1}}] }); };
  try {
    const db = resolveDatabase({CLOUDFLARE_ACCOUNT_ID:'a', CLOUDFLARE_DATABASE_ID:'b', CLOUDFLARE_API_TOKEN:'c'});
    assert.equal(await db.prepare('select ? as id').bind(4).first('id'), 4);
    assert.deepEqual(request.batch, [{sql:'select ? as id', params:[4]}]);
    await assert.rejects(db.batch([resolveDatabase({DB:{}})]));
    globalThis.fetch = async () => Response.json({success:false, errors:[{message:'failed'}]}, {status:400});
    await assert.rejects(db.prepare('select 1').run(), /D1 query failed/);
  } finally { globalThis.fetch = original; }
});
test('migrations include ledger insert in the same batch and skip applied IDs', async () => {
  const calls = []; let applied = false;
  const db = { prepare(sql) { return {sql, bind(...values) { this.values = values; return this; }, async run() {}, async first() { return applied ? {id:'1'} : null; }}; }, async batch(stmts) { calls.push(stmts); applied = true; } };
  await runMigrations(db, [{id:'1', statements:['CREATE TABLE x (id TEXT)']}]);
  await runMigrations(db, [{id:'1', statements:['CREATE TABLE x (id TEXT)']}]);
  assert.equal(calls.length, 1); assert.equal(calls[0].length, 2); assert.deepEqual(calls[0][1].values, ['1']);
  await assert.rejects(runMigrations(db, [{id:'2', statements:'bad'}]));
});

test('PostgreSQL worker expressions preserve binding order and reject unsupported syntax', async () => {
  const {postgresSQL} = await import('./index.mjs');
  const seed = postgresSQL("INSERT OR IGNORE INTO entities(scope,kind,id,data) SELECT ?,json_extract(value,'$.kind'),json_extract(value,'$.id'),json_extract(value,'$.data') FROM json_each(?)");
  assert.match(seed.sql, /jsonb_array_elements_text\(\(\$2\)::jsonb\) AS _tampiloka_json_each\(value\)/);
  assert.match(seed.sql, /ON CONFLICT DO NOTHING$/);
  assert.equal(seed.count, 2);
  assert.match(postgresSQL("SELECT json_extract(state_json,'$.photoVersion') FROM scopes").sql, /::integer/);
  assert.match(postgresSQL("UPDATE x SET data=json_set(json_insert(data,'$.brand.photo',json(?)),'$.brand.name',?)").sql, /jsonb_set/);
  assert.match(postgresSQL("SELECT instr(lower(name),lower(?))").sql, /strpos/);
  assert.throws(() => postgresSQL('SELECT changes()'), /Unsupported SQLite function/);
  assert.throws(() => postgresSQL("SELECT json_extract(data,'$[0]')"), /path/);
  assert.throws(() => postgresSQL('INSERT OR REPLACE INTO x VALUES (?)'), /Unsupported/);
});

test('known worker SQL runs against PGlite when already installed', async t => {
  const {globSync} = await import('node:fs');
  const {pathToFileURL} = await import('node:url');
  const matches = globSync('node_modules/.pnpm/@electric-sql+pglite@*/node_modules/@electric-sql/pglite/dist/index.js');
  if (!matches.length) return t.skip('PGlite is not installed');
  const {PGlite} = await import(pathToFileURL(matches[0]).href);
  const {postgresSQL} = await import('./index.mjs');
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE entities(scope text, kind text, id text PRIMARY KEY, data text); CREATE TABLE mutation_guards(id text PRIMARY KEY, ok integer CHECK(ok=1));');
    const run = (sql, values = []) => db.query(postgresSQL(sql).sql, values);
    const insert = "INSERT OR IGNORE INTO entities(scope,kind,id,data) SELECT ?,json_extract(value,'$.kind'),json_extract(value,'$.id'),json_extract(value,'$.data') FROM json_each(?)";
    const values = ['s', JSON.stringify([{kind:'service', id:'1', data:{name:'Hi'}}])];
    assert.equal((await run(insert, values)).affectedRows, 1);
    assert.equal((await run(insert, values)).affectedRows, 0);
    await run("UPDATE entities SET data=json_set(data,'$.image',?) WHERE id=?", ['image','1']);
    const row = (await run("SELECT data,instr(lower(json_extract(data,'$.name')),lower(?)) AS found FROM entities", ['hi'])).rows[0];
    assert.deepEqual(JSON.parse(row.data), {name:'Hi', image:'image'}); assert.equal(row.found, 1);
    await db.exec('BEGIN');
    const update = await run("UPDATE entities SET data=? WHERE id=?", ['changed','missing']);
    await assert.rejects(run('INSERT INTO mutation_guards(id,ok) VALUES(?,?)', ['guard',update.affectedRows]));
    await db.exec('ROLLBACK');
    assert.equal(JSON.parse((await run('SELECT data FROM entities')).rows[0].data).name, 'Hi');
  } finally { await db.close(); }
});

// Intercept only the optional SDK imports; the adapter code and its lazy imports run unchanged.
test('provider adapters invoke their SDKs and PostgreSQL parsers fail closed', async () => {
  const { registerHooks } = await import('node:module');
  const modules = {
    'pg': `export const types = { getTypeParser: (oid, format) => value => 'fallback:' + oid + ':' + format + ':' + value };`,
    '@aws-sdk/client-s3': `
      export class S3Client { constructor(options) { globalThis.__storageMocks.s3Options = options; } send(command) { return globalThis.__storageMocks.send(command); } }
      export class PutObjectCommand { constructor(input) { this.input = input; this.kind = 'put'; } }
      export class GetObjectCommand { constructor(input) { this.input = input; this.kind = 'get'; } }
      export class DeleteObjectCommand { constructor(input) { this.input = input; this.kind = 'delete'; } }
    `,
    'uploadthing/server': `export class UTApi { constructor(options) { globalThis.__storageMocks.utOptions = options; return globalThis.__storageMocks.ut; } }`
  };
  const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(modules, specifier)) return { url: 'data:text/javascript,' + encodeURIComponent(modules[specifier]), shortCircuit: true };
    return nextResolve(specifier, context);
  } });
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.__storageMocks = {
    async send(command) { calls.push(command); if (this.s3Error) throw this.s3Error; return command.kind === 'get' ? { Body: { transformToByteArray: async () => new Uint8Array([7]) }, ContentType: 'image/png' } : {}; },
    ut: {
      async uploadFiles(file, options) { calls.push({ file, options }); return this.uploadResult || { data: { key: 'opaque/provider-key' } }; },
      async generateSignedURL(key) { calls.push({ signedKey: key }); return { url: 'https://private.example/signed' }; },
      async deleteFiles(key) { calls.push({ deleteKey: key }); return this.deleteResult || { success: true }; }
    }
  };
  try {
    const s3 = resolveObjectStorage({ OBJECT_STORAGE_PROVIDER: 's3', S3_ENDPOINT: 'https://s3.example', S3_BUCKET: 'bucket', S3_REGION: 'region-1', S3_ACCESS_KEY_ID: 'access', S3_SECRET_ACCESS_KEY: 'secret' });
    assert.deepEqual(await s3.put('dir/a', 'body', { contentType: 'image/png' }), { key: 'dir/a' });
    assert.deepEqual(globalThis.__storageMocks.s3Options, { endpoint: 'https://s3.example', region: 'region-1', forcePathStyle: true, credentials: { accessKeyId: 'access', secretAccessKey: 'secret' } });
    assert.deepEqual(calls[0].input, { Bucket: 'bucket', Key: 'dir/a', Body: 'body', ContentType: 'image/png' });
    assert.deepEqual(await s3.get('dir/a'), { body: new Uint8Array([7]), contentType: 'image/png' });
    await s3.delete('dir/a');
    assert.deepEqual(calls.slice(1, 3).map(c => [c.kind, c.input]), [['get', { Bucket: 'bucket', Key: 'dir/a' }], ['delete', { Bucket: 'bucket', Key: 'dir/a' }]]);
    globalThis.__storageMocks.s3Error = { $metadata: { httpStatusCode: 404 } };
    assert.equal(await s3.get('missing'), null);
    const failure = new Error('S3 denied'); globalThis.__storageMocks.s3Error = failure;
    await assert.rejects(s3.get('x'), e => e === failure);
    await assert.rejects(s3.delete('x'), e => e === failure);
    await assert.rejects(s3.put('x', 'body'), e => e === failure);
    delete globalThis.__storageMocks.s3Error;
    const defaultS3 = resolveObjectStorage({ OBJECT_STORAGE_PROVIDER: 's3', S3_ENDPOINT: 'https://s3.example', S3_BUCKET: 'bucket', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'b' });
    await defaultS3.delete('x'); assert.equal(globalThis.__storageMocks.s3Options.region, 'auto');

    const ut = resolveObjectStorage({ OBJECT_STORAGE_PROVIDER: 'uploadthing', UPLOADTHING_TOKEN: 'token' });
    const uploaded = await ut.put('requested/name.png', new Uint8Array([1, 2]), { contentType: 'image/png' });
    assert.deepEqual(globalThis.__storageMocks.utOptions, { token: 'token' });
    assert.equal(ut.privateUploads, true); assert.deepEqual(uploaded, { key: 'opaque/provider-key' });
    const uploadCall = calls.find(c => c.file);
    assert.deepEqual(uploadCall.options, { acl: 'private' }); assert.equal(uploadCall.file.name, 'name.png');
    assert.equal(uploadCall.file.type, 'image/png'); assert.deepEqual(new Uint8Array(await uploadCall.file.arrayBuffer()), new Uint8Array([1, 2]));
    globalThis.fetch = async url => { assert.equal(url, 'https://private.example/signed'); return new Response(new Uint8Array([3]), { headers: { 'content-type': 'image/png' } }); };
    assert.deepEqual(await ut.get(uploaded.key), { body: new Uint8Array([3]), contentType: 'image/png' });
    await ut.delete(uploaded.key);
    assert.ok(calls.some(c => c.signedKey === uploaded.key)); assert.ok(calls.some(c => c.deleteKey === uploaded.key));
    globalThis.fetch = async () => new Response(null, { status: 404 }); assert.equal(await ut.get(uploaded.key), null);
    globalThis.fetch = async () => new Response(null, { status: 403 }); await assert.rejects(ut.get(uploaded.key), /download failed: 403/);
    globalThis.__storageMocks.ut.uploadResult = { error: { message: 'denied' } }; await assert.rejects(ut.put('x', 'body'), /upload failed: denied/);
    globalThis.__storageMocks.ut.deleteResult = { success: false }; await assert.rejects(ut.delete(uploaded.key), /delete failed/);

    const { createPostgresDatabase } = await import('./index.mjs');
    const queries = []; let mode = 'success';
    const sqlError = Object.assign(new Error('constraint'), { code: '23505' });
    const db = createPostgresDatabase({ async connect() { return { async query(q) {
      queries.push(q);
      if (typeof q === 'string') return {};
      const parse20 = q.types.getTypeParser(20, 'text'), parseNumeric = q.types.getTypeParser(1700, 'text');
      assert.equal(q.types.getTypeParser(20, 'binary')('x'), 'fallback:20:binary:x');
      assert.equal(q.types.getTypeParser(23, 'text')('x'), 'fallback:23:text:x');
      if (mode === 'unsafe') parseNumeric('9007199254740992.000');
      if (mode === 'sqlerror') throw sqlError;
      assert.throws(() => parse20('-9007199254740992'), /safe range/);
      assert.throws(() => parseNumeric('Infinity'), /not finite/);
      return { rows: [{ bigint: parse20('9007199254740991'), decimal: parseNumeric('12.25'), aggregate: parseNumeric('42.000') }], rowCount: 1 };
    }, release() { queries.push('release'); } }; } });
    assert.deepEqual(await db.prepare('SELECT ?').bind(1).first(), { bigint: 9007199254740991, decimal: 12.25, aggregate: 42 });
    mode = 'unsafe'; await assert.rejects(db.prepare('SELECT 1').run(), /safe range/);
    assert.deepEqual(queries.slice(-2), ['ROLLBACK', 'release']);
    mode = 'sqlerror'; await assert.rejects(db.prepare('SELECT 1').run(), e => e === sqlError && e.code === '23505');
    assert.deepEqual(queries.slice(-2), ['ROLLBACK', 'release']);
  } finally { hooks.deregister(); globalThis.fetch = originalFetch; delete globalThis.__storageMocks; }
});
