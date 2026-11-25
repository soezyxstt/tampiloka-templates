import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const load = path => import(pathToFileURL(join(root, path)).href);
const { parseJsonc } = await load('packages/cli/src/jsonc.mjs');
const { tursoClient } = await load('packages/shared-utils/src/turso.mjs');
const { manageSchema } = await load('packages/shared-utils/src/db-cli.mjs');
const { transfer } = await load('scripts/cutover-turso.mjs');

const family = process.argv[2];
const sources = {
  booking: { id:'c7a803d3-5f89-4091-8ae9-06bfa16ce279', origin:'https://booking.tampiloka.site' },
  commerce:{ id:'4236b694-99df-4e48-82a6-f4d5a8ce457e', origin:'https://ecommerce.tampiloka.site' },
  school: { id:'5f81449b-a3c9-435d-bdae-ecf86d47ba89', origin:'https://school.tampiloka.site' },
};
assert.ok(Object.hasOwn(sources, family), 'Only the three public demo databases are permitted.');
const source = sources[family];
const name = 'tampiloka-'+family+'-demo';
const cwd = join(root, 'templates', family);
const config = parseJsonc(readFileSync(join(cwd,'wrangler.demo.jsonc'),'utf8'));
assert.equal(config.name,name);
assert.equal(config.vars.DEMO_MODE,'true');
const url = config.vars.TURSO_DATABASE_URL;
assert.equal(new URL(url).hostname,name+'-soezyxstt.aws-ap-south-1.turso.io');
for(const key of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_D1_MIGRATION_TOKEN','CLOUDFLARE_ACCOUNT_ID','TURSO_AUTH_TOKEN','EXPECTED_MAIN_SHA']) assert.ok(process.env[key], 'Missing '+key);
process.env.TURSO_DATABASE_URL=url;
const run = (cmd,args,dir=root,env=process.env) => execFileSync(cmd,args,{cwd:dir,stdio:'inherit',env});
const checkMain = () => {
  const actual=execFileSync('git',['ls-remote','origin','refs/heads/main'],{cwd:root,encoding:'utf8'}).split(/\s+/)[0];
  assert.equal(actual,process.env.EXPECTED_MAIN_SHA,'main changed; stop before modifying or deploying.');
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),actual,'Checkout is not the expected main commit.');
};
const account='/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID;
async function cf(method,path,body) {
  const token=path.startsWith('/d1/') ? process.env.CLOUDFLARE_D1_MIGRATION_TOKEN : process.env.CLOUDFLARE_API_TOKEN;
  const r=await fetch('https://api.cloudflare.com/client/v4'+account+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});
  const result=await r.json();
  if(!r.ok || !result.success) throw new Error('Cloudflare '+method+' '+path+' failed: HTTP '+r.status+' codes '+(result.errors||[]).map(x=>x.code).join(','));
  return result.result;
}
const d1Path='/d1/database/'+source.id+'/query';
async function query(sql) {
  const [r]=await cf('POST',d1Path,{sql});
  assert.ok(r.success,'D1 query failed');
  return r.results;
}
async function batch(statements) {
  const results=await cf('POST',d1Path,{batch:statements.map(sql=>({sql}))});
  assert.equal(results.length,statements.length);
  assert.ok(results.every(r=>r.success),'D1 batch failed');
}
const quote = name => '"'+name.replaceAll('"','""')+'"';
const schema = "SELECT type,name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name NOT GLOB 'libsql_*' AND name NOT GLOB '_litestream_*' AND name NOT IN ('_cf_KV','d1_migrations','tampiloka_migrations') ORDER BY type,name";
const allFiles = readdirSync(join(cwd,'migrations')).filter(x=>x.endsWith('.sql')).sort();
function schemaSignature(rows) { return rows.map(row=>[row.type,row.name,row.sql.replace(/\r\n/g,'\n').trim()]); }
function referenceFor(names) {
  const db=new DatabaseSync(':memory:');
  try {
    for(const file of names) db.exec(readFileSync(join(cwd,'migrations',file),'utf8'));
    return schemaSignature(db.prepare(schema).all());
  } finally { db.close(); }
}
function checkSchema(names, rows) {
  const expected=referenceFor(names);
  const actual=schemaSignature(rows);
  if(JSON.stringify(expected)!==JSON.stringify(actual)) {
    const mismatches=[...new Set([...expected,...actual].map(x=>x[1]))].filter(name=>JSON.stringify(expected.find(x=>x[1]===name))!==JSON.stringify(actual.find(x=>x[1]===name)));
    throw new Error('Source schema differs from checked-in migration prefix: '+mismatches.join(', '));
  }
}
const guardPrefix='__tl_cutover_guard_';
const expiration=Math.floor(Date.now()/1000)+1200;
let guards=[];
let freezeAttempted=false;
let target;
const work=mkdtempSync(join(tmpdir(),'tl-cutover-'));
try {
  checkMain();
  const dbInfo=await cf('GET','/d1/database/'+source.id);
  assert.equal(dbInfo.name,name,'Wrong D1 database.');
  const worker=await cf('GET','/workers/scripts/'+name+'/settings');
  assert.ok(worker.bindings.some(b=>b.type==='d1'&&b.name==='DB'&&b.id===source.id),'Worker is not bound to the expected old D1 database.');
  assert.ok(!worker.bindings.some(b=>b.name==='TURSO_DATABASE_URL'),'Worker already has a Turso binding.');
  const history=(await query('SELECT name FROM d1_migrations ORDER BY id')).map(x=>x.name);
  assert.ok(history.length && history.every((file,i)=>file===allFiles[i]),'D1 migration history is not a prefix of the checked-in files.');
  const rows=await query(schema);
  checkSchema(history,rows);
  assert.ok(!(await query("SELECT name FROM sqlite_schema WHERE name GLOB '"+guardPrefix+"*'")).length,'Existing freeze guards require operator inspection.');
  target=tursoClient(process.env);
  const existing=await target.execute("SELECT name FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT GLOB 'sqlite_*' AND name NOT GLOB 'libsql_*' AND name NOT GLOB '_litestream_*'");
  assert.equal(existing.rows.length,0,'Turso target is not empty. Refusing to overwrite or re-import.');
  const fk=await target.execute('PRAGMA foreign_keys');
  assert.equal(fk.rows[0]?.[0],1,'Turso foreign keys must be enabled.');
  const prefix=join(work,'prefix');
  mkdirSync(prefix,{mode:0o700});
  for(const file of history) copyFileSync(join(cwd,'migrations',file),join(prefix,file));
  // A time-bounded write barrier covers all D1 application writers, including cron jobs.
  // The guard automatically stops rejecting writes after twenty minutes even if the runner dies.
  const tables=rows.filter(r=>r.type==='table').map(r=>r.name).concat('d1_migrations');
  const freeze=[];
  for(const [i,table] of tables.entries()) for(const operation of ['INSERT','UPDATE','DELETE']) {
    const guard=guardPrefix+i+'_'+operation.toLowerCase();
    guards.push(guard);
    freeze.push('CREATE TRIGGER '+quote(guard)+' BEFORE '+operation+' ON '+quote(table)+' WHEN unixepoch() < '+expiration+" BEGIN SELECT RAISE(ABORT, 'Demo database maintenance; retry later'); END;");
  }
  checkMain();
  freezeAttempted=true;
  await batch(freeze);
  const installed=await query("SELECT name FROM sqlite_schema WHERE name GLOB '"+guardPrefix+"*'");
  assert.deepEqual(installed.map(x=>x.name).sort(),[...guards].sort(),'Source write guards missing.');
  console.log('D1 write barrier active for '+family+'; expires '+new Date(expiration*1000).toISOString());
  run('pnpm',['exec','wrangler','d1','export',name,'--remote','--output',join(work,'source.sql')],cwd,{...process.env,CLOUDFLARE_API_TOKEN:process.env.CLOUDFLARE_D1_MIGRATION_TOKEN});
  // Remove only our temporary write guards from the private export. Preserve all application
  // triggers, data, and original D1 migration history. No raw data is uploaded as an artifact.
  const python=String.raw`
import importlib.util, pathlib, re, sys
root, work = map(pathlib.Path, sys.argv[1:])
spec=importlib.util.spec_from_file_location('stage_d1',root/'scripts/stage-d1.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
raw=(work/'source.sql').read_text(encoding='utf-8')
guard=re.compile(r'^CREATE\s+TRIGGER\s+(?:IF\s+NOT\s+EXISTS\s+)?["\x60\[]?__tl_cutover_guard_',re.I)
clean='\n'.join(stmt for stmt in mod.statements(raw) if not guard.match(mod.strip_comments(stmt).strip()))
(work/'clean.sql').write_text(clean,encoding='utf-8')
mod.stage(work/'clean.sql',work/'staged')
`;
  run('python3',['-c',python,root,work]);
  const snapshot=new DatabaseSync(join(work,'staged','source.sqlite'),{readOnly:true});
  try {
    assert.deepEqual(snapshot.prepare('SELECT name FROM d1_migrations ORDER BY id').all().map(x=>x.name),history,'Snapshot migration history changed.');
    assert.equal(snapshot.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name GLOB '"+guardPrefix+"*'").get().n,0,'Freeze guards must not be copied.');
    checkSchema(history,snapshot.prepare(schema).all());
  } finally {snapshot.close();}
  // Existing transfer tool compares all typed row digests, schema, foreign keys and integrity.
  await transfer(target,join(work,'staged'),family,'import');
  await manageSchema(target,'adopt',prefix);
  await manageSchema(target,'migrate',join(cwd,'migrations'));
  await manageSchema(target,'verify',join(cwd,'migrations'));
  console.log('Verified original data and all checked-in migration checksums.');
  checkMain();
  assert.ok(expiration-Math.floor(Date.now()/1000)>120,'Write barrier is too close to expiry; do not switch traffic.');
  const active=await query("SELECT name FROM sqlite_schema WHERE name GLOB '"+guardPrefix+"*'");
  assert.deepEqual(active.map(x=>x.name).sort(),[...guards].sort(),'Source write guards changed before switch.');
  const secret=join(work,'worker-secrets.json');
  writeFileSync(secret,JSON.stringify({TURSO_AUTH_TOKEN:process.env.TURSO_AUTH_TOKEN}),{mode:0o600});
  run('pnpm',['exec','wrangler','deploy','--config','wrangler.demo.jsonc','--secrets-file',secret],cwd);
  const settings=await cf('GET','/workers/scripts/'+name+'/settings');
  assert.ok(settings.bindings.some(b=>b.name==='TURSO_DATABASE_URL'&&b.text===url),'Worker has not switched to the expected Turso URL.');
  assert.ok(!settings.bindings.some(b=>b.type==='d1'&&b.name==='DB'),'Old D1 binding is still present.');
  assert.ok(settings.bindings.some(b=>b.name==='TURSO_AUTH_TOKEN'&&b.type==='secret_text'),'Worker Turso secret is missing.');
  await manageSchema(target,'verify',join(cwd,'migrations'));
  run('node',['scripts/demo-release.mjs','verify',family,join('templates',family,'dist'),source.origin]);
  console.log('Worker switched to Turso with verified release identity for '+family+'.');
} finally {
  try {
    if(freezeAttempted && guards.length) {
      await batch(guards.map(name=>'DROP TRIGGER IF EXISTS '+quote(name)));
      assert.equal((await query("SELECT name FROM sqlite_schema WHERE name GLOB '"+guardPrefix+"*'")).length,0,'Source guards not cleared.');
      console.log('Old D1 retained and temporary write guards removed.');
    }
  } finally {
    target?.close();
    rmSync(work,{recursive:true,force:true});
  }
}
