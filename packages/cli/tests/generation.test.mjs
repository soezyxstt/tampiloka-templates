import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, lstat, readdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),cli=join(root,'packages/cli/bin/tampiloka.mjs');
const run=(...args)=>{const result=spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8'});if(result.error)throw result.error;return result;};
const read=async path=>JSON.parse(await readFile(path,'utf8'));
async function temporary(t){const dir=await mkdtemp(join(tmpdir(),'tampiloka-cli-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}

test('CLI catalog distinguishes working templates from planned systems',()=>{
  const result=run('list','--json');assert.equal(result.status,0,result.stderr);
  const entries=JSON.parse(result.stdout);
  assert.deepEqual(entries.filter(t=>t.status==='available').map(t=>t.id).sort(),['booking','cafe','commerce','school']);
  assert.deepEqual(entries.filter(t=>t.status==='planned').map(t=>t.id).sort(),['dashboard','operations']);
});
test('commerce generation keeps feature level independent of all four preset compositions',async t=>{
  const parent=await temporary(t);
  for(const [preset,level]of [['editorial','catalog'],['market','whatsapp'],['atelier','store'],['compact','advanced']]){
    const name=`client-${preset}`,result=run('create',name,'--out',parent,'--template','commerce','--preset',preset,'--level',level,'--name','Klien Uji','--whatsapp','628123456789','--yes','--json');
    assert.equal(result.status,0,result.stderr);
    const output=join(parent,name),config=await read(join(output,'config/commerce.json')),pkg=await read(join(output,'package.json'));
    assert.equal(config.level,level);assert.equal(config.preset,preset);assert.equal(config.appearance.layout,preset);assert.equal(config.brand.name,'Klien Uji');assert.equal(config.brand.whatsapp,'628123456789');assert.equal(config.bank.accountNumber,'');
    assert.equal(pkg.name,name);assert.equal(pkg.dependencies['@tampiloka/ui-core'],'file:./packages/ui-core');
    assert.equal((await read(join(output,'components.json'))).aliases.ui,'@/components/shadcn');
    assert.ok(!JSON.stringify(pkg).includes('workspace:'));
    assert.equal((await read(join(output,'wrangler.jsonc'))).vars.DEMO_MODE,'false');
    assert.equal((await read(join(output,'wrangler.jsonc'))).d1_databases[0].database_id,'00000000-0000-0000-0000-000000000000');
    assert.equal((await read(join(output,'tampiloka.project.json'))).template,'commerce');
    await assert.rejects(lstat(join(output,'wrangler.demo.jsonc')),{code:'ENOENT'});
    await assert.rejects(lstat(join(output,'node_modules')),{code:'ENOENT'});
    await assert.rejects(lstat(join(output,'.dev.vars')),{code:'ENOENT'});
    await lstat(join(output,'.dev.vars.example'));
    assert.doesNotMatch(await readFile(join(output,'src/main.tsx'),'utf8'), /ui-core\/demo/);
    assert.doesNotMatch(await readFile(join(output,'src/App.tsx'),'utf8'), /DemoToolbar/);
    await assert.rejects(lstat(join(output,'src/components/DemoToolbar.tsx')),{code:'ENOENT'});
    assert.match(await readFile(join(output,'.gitignore'),'utf8'),/\.dev\.vars\*/);
    const doctor=run('doctor','--dir',output,'--json');assert.equal(doctor.status,0,doctor.stderr);assert.equal(JSON.parse(doctor.stdout).ok,true);
  }
});
test('appearance overrides do not change commerce capabilities',async t=>{
  const parent=await temporary(t),result=run('create','custom-brand','--out',parent,'--template','commerce','--preset','editorial','--level','whatsapp','--layout','compact','--theme','ink','--card','framed','--button','outline','--yes','--json');
  assert.equal(result.status,0,result.stderr);
  const config=await read(join(parent,'custom-brand/config/commerce.json'));
  assert.equal(config.level,'whatsapp');assert.deepEqual(config.appearance,{layout:'compact',palette:'ink',card:'framed',button:'outline'});
});
test('cafe generation preserves catalog waiter requests and full presets',async t=>{
  const parent=await temporary(t);
  for(const preset of ['catalog','full']){
    const result=run('create',`cafe-${preset}`,'--out',parent,'--template','cafe','--preset',preset,'--theme','editorial','--yes','--json');
    assert.equal(result.status,0,result.stderr);
    const output=join(parent,`cafe-${preset}`),config=await read(join(output,'config/cafe.json'));
    assert.equal(config.theme,'editorial');assert.ok(config.modules.includes('ordering'));
    if(preset==='catalog')assert.deepEqual(config.modules,['catalog','ordering']);else assert.ok(config.modules.includes('kitchen'));
    const pkg=await read(join(output,'package.json')),lock=await read(join(output,'package-lock.json'));
    assert.equal(pkg.devDependencies['@typescript/native'],'npm:typescript@7.0.2');
    assert.equal(pkg.devDependencies.typescript,'npm:@typescript/typescript6@6.0.2');
    assert.ok(lock.packages['node_modules/@typescript/native']);
    assert.ok(lock.packages['node_modules/@typescript/typescript-linux-x64']);
    assert.ok(lock.packages['node_modules/@typescript/typescript-win32-x64']);
    await lstat(join(output,'components/ui/motion.tsx'));
    await lstat(join(output,'lib/language.tsx'));
    assert.doesNotMatch(await readFile(join(output,'components/cafe/customer-app.tsx'),'utf8'), /@\/demos\/language/);
    assert.equal((await read(join(output,'tampiloka.project.json'))).template,'cafe');
    await assert.rejects(lstat(join(output,'demos')),{code:'ENOENT'});
    await assert.rejects(lstat(join(output,'src/demo-runtime')),{code:'ENOENT'});
  }
});
test('cafe read-only menu is explicit and rejects incompatible selections',async t=>{
  const parent=await temporary(t),result=run('create','menu','--out',parent,'--template','cafe','--modules','catalog','--yes','--json');
  assert.equal(result.status,0,result.stderr);
  const output=join(parent,'menu');
  assert.deepEqual((await read(join(output,'config/cafe.json'))).modules,['catalog']);
  assert.deepEqual((await read(join(output,'tampiloka.project.json'))).modules,['catalog']);
  assert.equal(JSON.parse(result.stdout).preset,null);
  assert.match(await readFile(join(output,'.env.local'),'utf8'),/CAFE_DEMO_DB=0/);
  for(const args of [['--template','cafe','--modules','catalog','--preset','catalog'],['--template','cafe','--modules','ordering'],['--template','commerce','--modules','catalog']])
    assert.notEqual(run('create','invalid-menu','--out',parent,...args,'--yes').status,0);
});
test('invalid selection and path traversal write no output',async t=>{
  const parent=await temporary(t);
  for(const args of [
    ['create','../escape','--out',parent,'--yes'],
    ['create','missing','--out',parent,'--template','dashboard','--yes'],
    ['create','missing','--out',parent,'--template','commerce','--level','marketplace','--yes'],
    ['create','missing','--out',parent,'--template','commerce','--card','pill','--yes'],
    ['create','missing','--out',parent,'--template','cafe','--level','store','--yes'],
    ['create','missing','--out',parent,'--wat','oops','--yes'],
  ]){const result=run(...args);assert.notEqual(result.status,0,args.join(' '));}
  assert.deepEqual(await readdir(parent),[]);
});
test('existing directories and symlink destinations never get overwritten',async t=>{
  const parent=await temporary(t),existing=join(parent,'existing');await mkdir(existing);await writeFile(join(existing,'keep.txt'),'keep');
  assert.notEqual(run('create','existing','--out',parent,'--yes').status,0);assert.equal(await readFile(join(existing,'keep.txt'),'utf8'),'keep');
  await symlink(existing,join(parent,'linked'));
  assert.notEqual(run('create','linked','--out',parent,'--yes').status,0);assert.equal(await readFile(join(existing,'keep.txt'),'utf8'),'keep');
});
test('dry run has no filesystem effects',async t=>{
  const parent=await temporary(t),result=run('create','preview','--out',parent,'--template','commerce','--dry-run','--yes','--json');
  assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).dryRun,true);assert.deepEqual(await readdir(parent),[]);
});

test('optional commerce modules are independent from preset and are validated before generation',async t=>{
  const parent=await temporary(t);
  const flags='promotions,taxes,service-fees,customer-accounts,loyalty-points,membership-tiers';
  const result=run('create','modular-shop','--out',parent,'--template','commerce','--level','store','--preset','market','--features',flags,'--yes','--json');
  assert.equal(result.status,0,result.stderr);
  const config=await read(join(parent,'modular-shop/config/commerce.json'));
  assert.equal(config.level,'store');assert.equal(config.appearance.layout,'market');
  assert.deepEqual(config.modules,{promotions:true,taxes:true,serviceFees:true,customerAccounts:true,loyaltyPoints:true,membershipTiers:true});
  const doctor=run('doctor','--dir',join(parent,'modular-shop'),'--json');assert.equal(doctor.status,0,doctor.stderr);
  const simple=run('create','simple-shop','--out',parent,'--template','commerce','--level','store','--features','none','--yes');
  assert.equal(simple.status,0,simple.stderr);
  assert.ok(Object.values((await read(join(parent,'simple-shop/config/commerce.json'))).modules).every(value=>value===false));
  for(const args of [
    ['--level','catalog','--features','taxes'],
    ['--level','store','--features','loyalty-points'],
    ['--level','store','--features','membership-tiers'],
    ['--level','store','--features','promotions,unknown'],
    ['--level','store','--features','taxes,taxes'],
  ]){
    const rejected=run('create','invalid-module','--out',parent,'--template','commerce',...args,'--yes');
    assert.notEqual(rejected.status,0,args.join(' '));
  }
  assert.deepEqual((await readdir(parent)).sort(),['modular-shop','simple-shop']);
});

test('booking generation supports every independent business and feature level without demo authority',async t=>{
 const parent=await temporary(t);
 for(const preset of ['medical','aesthetic','detailing','consulting'])for(const level of ['catalog','whatsapp','booking','full']){
  const name=`booking-${preset}-${level}`,result=run('create',name,'--out',parent,'--template','booking','--preset',preset,'--level',level,'--layout','minimal-professional','--theme','ochre','--yes','--json');assert.equal(result.status,0,result.stderr);
  const output=join(parent,name),cfg=await read(join(output,'config/booking.json')),pkg=await read(join(output,'package.json'));
  assert.equal(cfg.preset,preset);assert.equal(cfg.level,level);assert.equal(cfg.layout,'minimal-professional');assert.equal(cfg.palette,'ochre');assert.equal(cfg.brand.whatsapp,'');assert.equal(cfg.brand.example,true);
  assert.ok(!JSON.stringify(pkg).includes('workspace:'));assert.equal((await read(join(output,'wrangler.jsonc'))).vars.DEMO_MODE,'false');
  assert.doesNotMatch(await readFile(join(output,'src/components/DemoToolbar.tsx'),'utf8'),/DemoToolbarShell/);assert.doesNotMatch(await readFile(join(output,'src/main.tsx'),'utf8'),/ui-core\/demo/);
  assert.doesNotMatch(await readFile(join(output,'worker/demo.ts'),'utf8'),/scopeRow|UPDATE|INSERT/);
  if(['catalog','whatsapp'].includes(level)){
    const {rawBooking}=await import(pathToFileURL(join(output,'worker/services/bookings.ts')).href);
    await assert.rejects(rawBooking(),{code:'FEATURE_DISABLED',status:403});
  }
  assert.match(await readFile(join(output,'vite.config.ts'),'utf8'),/__PUBLIC_DEMO__:\s*JSON\.stringify\(false\)/);
  assert.match(await readFile(join(output,'scripts/dev.mjs'),'utf8'),/const demo\s*=\s*false;/);
  assert.equal(Boolean(pkg.dependencies.qrcode),level==='full');assert.equal(Boolean(pkg.dependencies.jsqr),level==='full');assert.ok((await read(join(output,'content/client.json'))).services.every(s=>s.preset===preset));
  for(const forbidden of ['wrangler.demo.jsonc','.dev.vars','node_modules','test-results','public/demo-previews','packages/ui-core/src/demo-shell.tsx'])await assert.rejects(lstat(join(output,forbidden)),{code:'ENOENT'});
  const images=await read(join(output,'public/images/manifest.json'));assert.ok(images.assets.every(asset=>asset.file.startsWith(preset)));
  assert.equal(run('doctor','--dir',output,'--json').status,0);
 }
});
test('booking rejects mismatched axes before creating a client directory',async t=>{const parent=await temporary(t);for(const extra of [['--preset','salon'],['--level','store'],['--layout','market'],['--theme','forest'],['--features','loyalty'],['--color','#000000']])assert.notEqual(run('create','invalid-booking','--template','booking','--out',parent,'--yes',...extra).status,0);assert.deepEqual(await readdir(parent),[]);});
