import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const cli=resolve('packages/cli/bin/tampiloka.mjs');
const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
const read=async p=>JSON.parse(await readFile(p,'utf8'));
test('provider choices validate, default and persist in generated Worker projects',async t=>{
  const parent=await mkdtemp(join(tmpdir(),'cli-storage-'));t.after(()=>rm(parent,{recursive:true,force:true}));
  for(const family of ['cafe','commerce','booking','school']){
    const result=run('create',`dry-${family}`,'--out',parent,'--template',family,'--yes','--dry-run','--json');
    assert.equal(result.status,0,result.stderr);const plan=JSON.parse(result.stdout);
    assert.equal(plan.database,family==='cafe'?'postgresql':'turso');assert.equal(plan.objectStorage,'s3');
  }
  assert.notEqual(run('create','bad','--out',parent,'--database','sqlite','--yes').status,0);
  assert.notEqual(run('create','bad','--out',parent,'--object-storage','r2','--yes').status,0);
  const result=run('create','client','--out',parent,'--template','booking','--database','turso','--object-storage','uploadthing','--yes','--json');
  assert.equal(result.status,0,result.stderr);const dir=join(parent,'client');
  assert.deepEqual(await read(join(dir,'config/storage.json')),{database:'turso',objectStorage:'uploadthing'});
  const w=await read(join(dir,'wrangler.jsonc'));assert.equal(w.vars.DATABASE_PROVIDER,'turso');assert.equal(w.vars.OBJECT_STORAGE_PROVIDER,'uploadthing');assert.equal(w.d1_databases,undefined);
  const doctor=run('doctor','--dir',dir,'--json');assert.equal(doctor.status,0,doctor.stderr);const checks=JSON.parse(doctor.stdout).checks;
  assert.equal(checks.find(c=>c.name==='TURSO_DATABASE_URL').status,'warn');assert.equal(checks.find(c=>c.name==='UPLOADTHING_TOKEN').status,'warn');
});

test('generated provider examples, bindings, migration files and Cafe lock match selections', async t => {
  const parent=await mkdtemp(join(tmpdir(),'cli-providers-'));t.after(()=>rm(parent,{recursive:true,force:true}));
  for(const family of ['cafe','commerce','booking','school']) for(const [database,objectStorage] of [['turso','uploadthing'],['postgresql','s3'],['d1','s3']]) {
    const name=`${family}-${database}`;
    const result=run('create',name,'--out',parent,'--template',family,'--database',database,'--object-storage',objectStorage,'--yes','--json');
    assert.equal(result.status,0,result.stderr);
    const dir=join(parent,name), example=await readFile(join(dir,family==='cafe'?'.env.example':'.dev.vars.example'),'utf8');
    for(const [key,value] of Object.entries({DATABASE_PROVIDER:database,OBJECT_STORAGE_PROVIDER:objectStorage})) {
      assert.deepEqual([...example.matchAll(new RegExp(`^${key}=(.*)$`,'gm'))].map(m=>m[1]),[value]);
    }
    if(family==='cafe') {
      const pkg=await read(join(dir,'package.json')), lock=await read(join(dir,'package-lock.json'));
      assert.equal(pkg.dependencies['@tampiloka/storage'],'file:./packages/storage');
      assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies);
      assert.deepEqual(lock.packages[''].devDependencies,pkg.devDependencies);
      assert.equal(lock.packages['node_modules/@tampiloka/storage'].resolved,'packages/storage');
      await access(join(dir,'packages/storage/index.mjs'));
      await access(join(dir,'scripts/migrate-sqlite.ts'));
    } else {
      const w=await read(join(dir,'wrangler.jsonc'));
      assert.equal(w.vars.DATABASE_PROVIDER,database);
      assert.equal(w.vars.OBJECT_STORAGE_PROVIDER,objectStorage);
      assert.equal(Boolean(w.d1_databases),database==='d1');
      if (database==='d1') assert.deepEqual(w.d1_databases[0],{binding:'DB',database_name:`${name}-db`,database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:'migrations'});
      assert.deepEqual(Object.keys(w.vars).sort(),['DATABASE_PROVIDER','DEMO_MODE','OBJECT_STORAGE_PROVIDER']);
      assert.equal(w.vars.DEMO_MODE,'false');
      assert.doesNotMatch(JSON.stringify(w), /libsql:\/\/|turso\.io|AUTH_TOKEN/);
      if(family==='commerce') assert.match(example,/^DEMO_MODE=false$/m);
      assert.equal(w.r2_buckets,undefined);
      await access(join(dir,'scripts/migrate.mjs'));
      if(family!=='school') await access(join(dir,'migrations-postgresql'));
    }
  }
});
