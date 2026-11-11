const required = (env, key) => {
  const value = env[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${key}`);
  return value;
};

// Recognize SQL strings, identifiers and comments before translating anonymous placeholders.
export function postgresParameters(sql) {
  let out = '', i = 0, count = 0;
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1];
    if (c === "'" || c === '"') {
      const start = i++;
      let closed = false;
      while (i < sql.length) {
        if (sql[i++] === c) { if (sql[i] === c) i++; else { closed = true; break; } }
      }
      if (!closed) throw new Error('Unterminated SQL quote');
      out += sql.slice(start, i); continue;
    }
    if (c === '-' && n === '-') {
      const end = sql.indexOf('\n', i); const next = end < 0 ? sql.length : end + 1;
      out += sql.slice(i, next); i = next; continue;
    }
    if (c === '/' && n === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unterminated SQL comment');
      out += sql.slice(i, end + 2); i = end + 2; continue;
    }
    if (c === '$') {
      const tag = sql.slice(i).match(/^\$[a-zA-Z_][a-zA-Z_0-9]*\$|^\$\$/)?.[0];
      if (tag) { const end = sql.indexOf(tag, i + tag.length); if (end < 0) throw new Error('Unterminated dollar quote'); out += sql.slice(i, end + tag.length); i = end + tag.length; continue; }
      if (/\d/.test(n || '')) throw new Error('Use anonymous ? placeholders, not PostgreSQL positional parameters');
    }
    if (c === '?') {
      if (/\d/.test(n || '') || n === '|' || n === '&') throw new Error('Unsupported SQL placeholder or operator');
      out += `$${++count}`; i++; continue;
    }
    out += c; i++;
  }
  return { sql: out, count };
}

// Translate the deliberately small SQLite expression subset used by worker queries.
// Parsing is quote-aware and recursive, so commas in nested expressions stay intact.
export function postgresSQL(sql) {
  function translate(input) {
    let out = '';
    for (let i = 0; i < input.length;) {
      if (input[i] === "'" || input[i] === '"') {
        const q = input[i], start = i++; let closed = false;
        while (i < input.length) { if (input[i++] === q) { if (input[i] === q) i++; else { closed = true; break; } } }
        if (!closed) throw new Error('Unterminated SQL quote');
        out += input.slice(start, i); continue;
      }
      if (input.startsWith('--', i) || input.startsWith('/*', i)) {
        const block = input[i] === '/', end = block ? input.indexOf('*/', i + 2) : input.indexOf('\n', i + 2);
        if (block && end < 0) throw new Error('Unterminated SQL comment');
        const next = end < 0 ? input.length : end + (block ? 2 : 1); out += input.slice(i, next); i = next; continue;
      }
      const match = input.slice(i).match(/^([a-zA-Z_][a-zA-Z_0-9]*)\s*\(/);
      if (!match) { out += input[i++]; continue; }
      const name = match[1].toLowerCase();
      const randomId = input.slice(i).match(/^lower\s*\(\s*hex\s*\(\s*randomblob\s*\(\s*16\s*\)\s*\)\s*\)/i);
      if (randomId) { out += "replace(gen_random_uuid()::text, '-', '')"; i += randomId[0].length; continue; }
      let j = i + match[0].length, depth = 1, quote = null, start = j; const args = [];
      for (; j < input.length && depth; j++) {
        const c = input[j];
        if (quote) { if (c === quote) { if (input[j+1] === quote) j++; else quote = null; } continue; }
        if (c === "'" || c === '"') { quote = c; continue; }
        if (c === '(') depth++;
        else if (c === ')') { if (--depth === 0) { args.push(input.slice(start, j).trim()); break; } }
        else if (c === ',' && depth === 1) { args.push(input.slice(start, j).trim()); start = j + 1; }
      }
      if (depth) throw new Error('Unterminated SQL function');
      const a = args.map(translate);
      const path = (v) => { const m = v.match(/^'\$((?:\.[A-Za-z_][A-Za-z_0-9]*)+)'$/); if (!m) throw new Error('Unsupported SQLite JSON path'); return "'{" + m[1].slice(1).replaceAll('.', ',') + "}'"; };
      if (name === 'json_extract') {
        if (a.length !== 2) throw new Error('Unsupported json_extract');
        const p = path(a[1]);
        const numeric = /\.(?:photoVersion|sampleGalleryVersion|tick|unit)'$/.test(a[1]);
        out += `(((${a[0]})::jsonb #>> ${p})${numeric ? '::bigint' : ''})`;
      } else if (name === 'json_each') {
        if (a.length !== 1) throw new Error('Unsupported json_each');
        out += `jsonb_array_elements_text((${a[0]})::jsonb) AS _tampiloka_json_each(value)`;
      } else if (name === 'json' || name === 'json_set' || name === 'json_insert') {
        if (name === 'json') { if (a.length !== 1) throw new Error('Unsupported json'); out += `((${a[0]})::jsonb)`; }
        else {
          if (a.length < 3 || a.length % 2 !== 1) throw new Error(`Unsupported ${name}`);
          let expr = `((${a[0]})::jsonb)`;
          for (let k = 1; k < a.length; k += 2) {
            const p = path(a[k]); const raw = args[k+1].trim();
            const value = /^json\s*\(/i.test(raw) ? a[k+1] : /^-?\d+(?:\.\d+)?$/.test(raw) ? `to_jsonb(${a[k+1]})` : `to_jsonb((${a[k+1]})::text)`;
            const updated = `jsonb_set(${expr}, ${p}, COALESCE(${value}, 'null'::jsonb), true)`;
            expr = name === 'json_insert' ? `(CASE WHEN ${expr} #> ${p} IS NULL THEN ${updated} ELSE ${expr} END)` : updated;
          }
          out += `(${expr})::text`;
        }
      } else if (name === 'instr') { if (a.length !== 2) throw new Error('Unsupported instr'); out += `strpos(${a.join(', ')})`; }
      else if (name === 'changes' || name.startsWith('json_') || ['json','randomblob','strftime','iif'].includes(name)) throw new Error(`Unsupported SQLite function: ${name}`);
      else out += input.slice(i, i + match[0].length) + a.join(', ') + ')';
      i = j + 1;
    }
    return out;
  }
  // Number the original bindings before rewriting: json_insert can repeat its
  // input expression, and those repetitions must refer to the same parameters.
  const parameterized = postgresParameters(sql);
  let translated = translate(parameterized.sql);
  if (/\b(?:INSERT\s+OR\s+(?!IGNORE\b)|REPLACE\s+INTO|PRAGMA|COLLATE\s+NOCASE)\b/i.test(translated)) throw new Error('Unsupported SQLite SQL');
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(translated)) {
    if (/\bON\s+CONFLICT\b/i.test(translated) || /;\s*\S/.test(translated)) throw new Error('Unsupported INSERT OR IGNORE');
    translated = translated.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO').replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
  }
  return { sql: translated, count: parameterized.count };
}

function result(rows, changes = 0, extra = {}) { return { success: true, results: rows, meta: { changes, ...extra } }; }
class Statement {
  constructor(db, sql, values = []) { this.db = db; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.db, this.sql, values); }
  async all() { return (await this.db._execute([this]))[0]; }
  async run() { return this.all(); }
  async first(column) { const row = (await this.all()).results[0]; return row == null ? null : column === undefined ? row : row[column] ?? null; }
  async raw(options) { const rows = (await this.all()).results; const values = rows.map(row => Object.values(row)); return options?.columnNames && rows.length ? [Object.keys(rows[0]), ...values] : values; }
}
function database(execute) {
  const db = { prepare(sql) { if (typeof sql !== 'string') throw new TypeError('SQL must be a string'); return new Statement(db, sql); },
    async batch(statements) { if (!statements.every(s => s instanceof Statement && s.db === db)) throw new Error('Batch statements must belong to this database'); return execute(statements); }, _execute: execute };
  return db;
}
function restD1(env) {
  const account = required(env, 'CLOUDFLARE_ACCOUNT_ID'), id = required(env, 'CLOUDFLARE_DATABASE_ID'), token = required(env, 'CLOUDFLARE_API_TOKEN');
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(id)}/query`;
  return database(async statements => {
    if (!statements.length) return [];
    const batch = statements.map(s => ({ sql: s.sql, params: s.values }));
    const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ batch }) });
    const data = await response.json();
    if (!response.ok || !data.success || !Array.isArray(data.result) || data.result.some(r => !r.success)) throw new Error(`D1 query failed: ${JSON.stringify(data.errors || data.result)}`);
    return data.result;
  });
}
function turso(env) {
  const url = required(env, 'TURSO_DATABASE_URL'), authToken = env.TURSO_AUTH_TOKEN;
  let client;
  async function getClient() { return client ||= import('@libsql/client/web').then(m => m.createClient({ url, authToken })); }
  return database(async statements => {
    if (!statements.length) return [];
    const c = await getClient();
    const rows = await c.batch(statements.map(s => ({ sql: s.sql, args: s.values })), 'write');
    return rows.map(r => result(r.rows.map(row => ({ ...row })), r.rowsAffected, { last_row_id: r.lastInsertRowid == null ? undefined : Number(r.lastInsertRowid) }));
  });
}
function postgresNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new RangeError('PostgreSQL numeric value is not finite');
  // PostgreSQL emits numeric in decimal notation. Check the original digits,
  // before Number can round an out-of-range integer into another value.
  const integer = /^([+-]?\d+)(?:\.0*)?$/.exec(value);
  if (integer && (BigInt(integer[1]) > BigInt(Number.MAX_SAFE_INTEGER) || BigInt(integer[1]) < BigInt(Number.MIN_SAFE_INTEGER))) {
    throw new RangeError('PostgreSQL integer exceeds JavaScript safe range');
  }
  return number;
}
function postgres(env) {
  const connectionString = required(env, 'DATABASE_URL');
  // A Worker socket belongs to the invocation that created it. Never cache a
  // driver pool across invocations; use an external pooler for connection reuse.
  return createPostgresDatabase({ async connect() {
    const pg = await import('pg');
    const client = new (pg.Client || pg.default.Client)({ connectionString });
    try { await client.connect(); }
    catch (error) { await client.end().catch(() => {}); throw error; }
    return { query: (...args) => client.query(...args), release: () => client.end() };
  } });
}
// Accept a pg-compatible pool so the production execution path can be tested in process.
export function createPostgresDatabase(pool) {
  return database(async statements => {
    if (!statements.length) return [];
    const queries = statements.map((s, index) => {
      const guard = /^\s*INSERT\s+INTO\s+mutation_guards\s*\(\s*id\s*,\s*ok\s*\)\s*VALUES\s*\(\s*\?\s*,\s*changes\s*\(\s*\)\s*\)\s*;?\s*$/i.test(s.sql);
      if (guard && index === 0) throw new Error('changes() guard requires a preceding statement in the same batch');
      const parsed = postgresSQL(guard ? 'INSERT INTO mutation_guards(id,ok) VALUES(?,?)' : s.sql);
      if (parsed.count !== s.values.length + Number(guard)) throw new Error('SQL placeholder count does not match bindings');
      return { text: parsed.sql, values: s.values, guard };
    });
    const pg = await import('pg');
    const pgTypes = pg.types || pg.default.types;
    const types = { getTypeParser(oid, format) { return (oid === 20 || oid === 1700) && format !== 'binary' ? postgresNumber : pgTypes.getTypeParser(oid, format); } };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const query of queries) { const r = await client.query({ text: query.text, values: query.guard ? [...query.values, results.at(-1).meta.changes] : query.values, types }); results.push(result(r.rows, r.rowCount || 0)); }
      await client.query('COMMIT'); return results;
    } catch (error) { try { await client.query('ROLLBACK'); } catch {} throw error; }
    finally { await client.release(); }
  });
}
export function resolveDatabase(env) {
  switch (env.DATABASE_PROVIDER || 'd1') {
    case 'd1': return env.DB || restD1(env);
    case 'turso': return turso(env);
    case 'postgresql': return postgres(env);
    default: throw new Error(`Unknown DATABASE_PROVIDER: ${env.DATABASE_PROVIDER}`);
  }
}

function s3(env) {
  const endpoint = required(env, 'S3_ENDPOINT'), bucket = required(env, 'S3_BUCKET');
  const accessKeyId = required(env, 'S3_ACCESS_KEY_ID'), secretAccessKey = required(env, 'S3_SECRET_ACCESS_KEY');
  let sdk;
  async function getSdk() { return sdk ||= import('@aws-sdk/client-s3').then(m => ({ ...m, client: new m.S3Client({ endpoint, region: env.S3_REGION || 'auto', forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } }) })); }
  return {
    async put(key, body, options = {}) { const m = await getSdk(); await m.client.send(new m.PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: options.contentType })); return { key, ...(env.S3_PUBLIC_URL ? { url: `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}` } : {}) }; },
    async get(key) { const m = await getSdk(); try { const r = await m.client.send(new m.GetObjectCommand({ Bucket: bucket, Key: key })); return { body: await r.Body.transformToByteArray(), contentType: r.ContentType }; } catch (e) { if (e.$metadata?.httpStatusCode === 404 || e.name === 'NoSuchKey') return null; throw e; } },
    async delete(key) { const m = await getSdk(); await m.client.send(new m.DeleteObjectCommand({ Bucket: bucket, Key: key })); }
  };
}
function uploadthing(env) {
  const token = required(env, 'UPLOADTHING_TOKEN');
  let api;
  async function getApi() { return api ||= import('uploadthing/server').then(m => new m.UTApi({ token })); }
  return {
    privateUploads: true,
    async put(key, body, options = {}) {
      const u = await getApi();
      const bytes = body instanceof Uint8Array ? body : new Uint8Array(await new Response(body).arrayBuffer());
      const file = new File([bytes], key.split('/').pop() || 'upload', { type: options.contentType || 'application/octet-stream' });
      const r = await u.uploadFiles(file, { acl: 'private' });
      if (r.error || !r.data) throw new Error(`UploadThing upload failed: ${r.error?.message || 'missing result'}`);
      return { key: r.data.key };
    },
    async get(key) {
      const u = await getApi();
      const signed = await u.generateSignedURL(key);
      const response = await fetch(signed.url);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`UploadThing download failed: ${response.status}`);
      return { body: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get('content-type') || undefined };
    },
    async delete(key) { const u = await getApi(); const r = await u.deleteFiles(key); if (!r.success) throw new Error('UploadThing delete failed'); }
  };
}
export function resolveObjectStorage(env) {
  switch (env.OBJECT_STORAGE_PROVIDER) {
    case 's3': return s3(env);
    case 'uploadthing': return uploadthing(env);
    default: throw new Error(`Unknown OBJECT_STORAGE_PROVIDER: ${env.OBJECT_STORAGE_PROVIDER}`);
  }
}

// Explicit statement arrays avoid splitting triggers, quoted semicolons and procedural SQL.
export async function runMigrations(db, migrations) {
  await db.prepare('CREATE TABLE IF NOT EXISTS _tampiloka_migrations (id TEXT PRIMARY KEY)').run();
  for (const migration of migrations) {
    if (!migration.id || !Array.isArray(migration.statements) || !migration.statements.every(s => typeof s === 'string' && s.trim())) throw new Error('Migration requires an id and non-empty SQL statements array');
    if (await db.prepare('SELECT id FROM _tampiloka_migrations WHERE id = ?').bind(migration.id).first()) continue;
    await db.batch([...migration.statements.map(sql => db.prepare(sql)), db.prepare('INSERT INTO _tampiloka_migrations (id) VALUES (?)').bind(migration.id)]);
  }
}
