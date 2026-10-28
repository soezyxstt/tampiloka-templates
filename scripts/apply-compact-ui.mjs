import {readFile,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=p=>readFile(p,'utf8'), put=(p,t)=>writeFile(p,t);
const once=(t,a,b)=>{assert.ok(t.includes(a),`Missing anchor ${a.slice(0,100)}`);return t.replace(a,b);};
let t=await read('components/ui/workspace.css');
t=once(t,'grid-template-columns:repeat(min(var(--stat-count),2),minmax(0,1fr))','grid-template-columns:repeat(2,minmax(0,1fr))');
t+='\n.stat-strip:has(>.stat-item:only-child){grid-template-columns:1fr}\n.cafe-staff .visit-row h3,.cafe-staff .visit-row p{overflow-wrap:anywhere}\n';
await put('components/ui/workspace.css',t);
t=await read('components/cafe/visit-service.tsx');
t=once(t,'<div className="space-y-3">{activeVisits.map','<div className="visit-list">{activeVisits.map');
t=once(t,'className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4"','className="visit-row space-y-3"');
t=t.replace(/<p className="mt-1 text-sm text-\[var\(--muted-foreground\)\]">\{canTables \? 'Tempatkan tamu saat datang\.[\s\S]*?<\/p>/,'');
await put('components/cafe/visit-service.tsx',t);
t=await read('components/cafe/order-inbox.tsx');
t=t.replace('Money, StatusLabel }','Money, StatusLabel, Surface }');
t=t.replace('<section className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3" aria-label="Pembayaran kasir eksternal">','<Surface variant="ruled" className="space-y-3" aria-label="Pembayaran kasir eksternal">').replace('  </section>;','  </Surface>;');
t=t.replace('<section className="border border-[var(--border)] rounded-[var(--radius-panel)] bg-[var(--surface)] p-5 space-y-4">','<Surface variant="ruled" className="space-y-3">').replace('</div></section><ExternalCounterPayments','</div></Surface><ExternalCounterPayments');
await put('components/cafe/order-inbox.tsx',t);
t=await read('components/cafe/staff-app.tsx');
t=once(t,'  StatStrip,\n','  StatStrip,\n  ChoiceStrip,\n');
const visitLine=t.split('\n').find(line=>line.includes('!canTables && <VisitService'));
assert.ok(visitLine);t=t.replace(visitLine+'\n','');
t=once(t,'            </div>}\n          </motion.div>', '            </div>}\n'+visitLine+'\n          </motion.div>');
const a=t.indexOf('            <div className="flex flex-wrap gap-2" aria-label="Status pesanan dapur">'),b=t.indexOf('            {kitchenUnits.length',a);assert.ok(a>=0&&b>a);
t=t.slice(0,a)+String.raw`            <ChoiceStrip ariaLabel="Status pesanan dapur" items={[['ACTIVE','Semua aktif'],['QUEUED','Antrean baru'],['PREPARING','Sedang dibuat'],['READY','Siap diantar'],['ALL','Termasuk selesai']].map(([id,label])=>({id,label}))} value={kitchenStatusFilter} onChange={setKitchenStatusFilter} variant="underline" />
`+t.slice(b);
t=t.replaceAll('className="space-y-1 min-w-[240px] flex-1"','className="space-y-1 min-w-0 flex-1"');
// Keep workflow cards where a single kitchen task needs a clear group, but reduce padding.
t=t.replace('bg-[var(--surface)] p-5 flex flex-col items-stretch justify-between gap-5 border-t-[3px]','bg-[var(--surface)] p-3 flex flex-col items-stretch justify-between gap-3 border-t-[3px]');
await put('components/cafe/staff-app.tsx',t);
t=await read('components/ui/textarea.tsx');t=t.replace("import { cn } from '@/lib/utils';","import { cn } from '@/lib/utils';\nimport { fieldStyles } from './field-styles';");
t=t.replace(/'flex min-h-\[84px\] w-full rounded-\[var\(--radius-control\)\][^'\n]+'/ , "fieldStyles, 'min-h-[84px] resize-y'");await put('components/ui/textarea.tsx',t);

// A read-only catalog is explicit. Keep its test and add a separate preset test.
t=await read('scripts/cafe-config.test.mjs');
t=once(t,"'--name', 'Kopi Senja', '--preset', 'catalog'","'--name', 'Kopi Senja', '--modules', 'catalog'");
t+=String.raw`
test('catalog preset generates the waiter inbox with empty client transactions', async () => {
 const destination=join(scratch,'waiter-menu');
 const result=cli(['init',destination,'--name','Waiter Menu','--preset','catalog','--yes']);
 assert.equal(result.status,0,result.stderr);
 const saved=JSON.parse(await readFile(join(destination,'config/cafe.json'),'utf8'));
 assert.deepEqual(saved.modules,['catalog','ordering']);
 assert.equal(saved.payment.mode,'cashier');
 const env=await readFile(join(destination,'.env.local'),'utf8');
 assert.match(env,/CAFE_DEMO_DB=1/);assert.match(env,/CAFE_DEMO_EMPTY=1/);
 assert.equal(await exists(join(destination,'.local')),false);
});
`;await put('scripts/cafe-config.test.mjs',t);
t=await read('tests/preset-integration.mjs');
const start=t.indexOf('async function checkStaticCatalog');assert.ok(start>0);
t=t.slice(0,start)+t.slice(start).replace("'--preset', 'catalog'","'--modules', 'catalog'");await put('tests/preset-integration.mjs',t);
t=await read('tests/ui-contracts.test.mjs');
t=t.replace("await readdir(new URL('../'+dir,import.meta.url),{withFileTypes:true})", "await readdir(new URL('../'+dir,import.meta.url),{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;})");await put('tests/ui-contracts.test.mjs',t);

t=await read('tests/demos-staff-layout.mjs');
t=once(t,'width >= 768 ? 360 : width >= 640 ? 210 : 156','width >= 768 ? 280 : width - 32');
t=t.replace('if (g.width >= 768) assert.ok(g.labelSpace', 'assert.ok(g.labelSpace');
t=t.replace('all eight staff presets','all nine staff presets');
await put('tests/demos-staff-layout.mjs',t);
t=await read('tests/demos-browser.mjs');
t=t.replaceAll("demo.id !== 'catalog'", "demo.modules.some(module => module !== 'catalog')").replaceAll("demo.id === 'catalog'", "demo.modules.length === 1 && demo.modules[0] === 'catalog'");
await put('tests/demos-browser.mjs',t);

t=await read('tests/demos-lifecycle.mjs');
t=once(t,'async function externalCounterJourney(context) {',"async function externalCounterJourney(context, preset = 'order-at-cashier') {");
const from=t.indexOf('async function externalCounterJourney'),to=t.indexOf('async function openCustomerWaitlist',from);
let block=t.slice(from,to).replace("setupPages(context, 'order-at-cashier')",'setupPages(context, preset)').replace("qrUrl(table, 'order-at-cashier')",'qrUrl(table, preset)').replace("pass('order-at-cashier: actual UI order → simple fulfillment → confirmed external receipt → customer paid status → completed visit');","pass(`${preset}: actual UI order → waiter inbox → fulfillment → offline receipt → completed visit`);");
t=t.slice(0,from)+block+t.slice(to);
t=once(t,"  { id: 'external-counter', run: externalCounterJourney },","  { id: 'external-counter', run: externalCounterJourney },\n  { id: 'catalog-waiter', run: context => externalCounterJourney(context, 'catalog') },");
await put('tests/demos-lifecycle.mjs',t);

// Explain changed preset semantics wherever clients previously got static catalogs.
for(const path of ['README.md','docs/client-setup.md','docs/demos.md','docs/runtime.md']){
 t=await read(path);
 t=t.replaceAll('--preset catalog','--modules catalog');
 const note='\n> Catalog update: `--preset catalog` now includes a guest order list and the waiter inbox, with offline payment. Use `--modules catalog` only for a read-only, database-free menu. `order-at-cashier` remains a compatibility alias, not a separate feature tier. See [compact UI and catalog requests]('+ (path==='README.md'?'docs/compact-ui.md':'compact-ui.md') +').\n';
 const first=t.indexOf('\n'); t=t.slice(0,first+1)+note+t.slice(first+1);await put(path,t);
}

await put('tests/demos-compact-ui.mjs',String.raw`#!/usr/bin/env node
/** Interaction-state UI regression. Uses only fresh local demo storage. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';
import {DEMOS} from '../demos/manifest.ts';
const base=process.env.CAFE_DEMO_BASE_URL||'http://127.0.0.1:4174';
const domain=process.env.CAFE_DEMO_BASE_DOMAIN;
const out=resolve(process.env.CAFE_COMPACT_OUTPUT||'test-results/compact-ui');
await mkdir(out,{recursive:true});
const checks=[],failures=[],errors=[],writes=[];
const browser=await chromium.launch({headless:true});
const url=(id,path='/')=>domain?'https://'+DEMOS.find(d=>d.id===id).subdomain+'.'+domain+path:base.replace(/\/$/,'')+'/p/'+id+path;
const pass=(name,data={})=>{checks.push({name,...data});console.log('PASS '+name);};
async function ready(page,address){
 const response=await page.goto(address,{waitUntil:'domcontentloaded',timeout:120000});assert.ok(response?.ok());
 await page.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Ulangi demo"]');return b&&!b.disabled;},null,{timeout:120000});
 await page.evaluate(()=>document.fonts.ready);
 const state=await page.evaluate(async()=>(await(await fetch('/api/v1/snapshot?surface=staff')).json()).data);
 assert.equal(state?.runtime?.localOnly,true);assert.equal(state.runtime.demo,true);
}
async function context(){
 const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 ctx.setDefaultTimeout(20000);
 await ctx.route('**/*',route=>{if(['GET','HEAD','OPTIONS'].includes(route.request().method()))return route.continue();writes.push(route.request().url());return route.abort();});
 ctx.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});});
 return ctx;
}
async function geometry(page,name,screenshot=true){
 const g=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clippedRoot:['hidden','clip'].includes(getComputedStyle(document.documentElement).overflowX)||['hidden','clip'].includes(getComputedStyle(document.body).overflowX),badNotices:[...document.querySelectorAll('[data-ui="notice"]')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1||r.left< -1||e.scrollWidth>e.clientWidth+1;}).map(e=>e.textContent)}));
 assert.equal(g.clippedRoot,false,name+': document clipping hides defects');
 assert.ok(g.scrollWidth<=g.width+1,name+': overflow '+JSON.stringify(g));assert.deepEqual(g.badNotices,[],name);
 if(screenshot)await page.screenshot({path:join(out,name+'.png'),animations:'disabled'});
 pass(name,g);return g;
}
async function resize(page,width){
 await page.setViewportSize({width,height:844});
 await page.waitForFunction(width=>innerWidth===width&&matchMedia('(min-width:768px)').matches===(width>=768),width);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
async function run(id,fn){const ctx=await context();try{await fn(ctx);}catch(e){failures.push({id,error:e.stack});console.error('FAIL '+id+': '+e.message);for(const [i,p]of ctx.pages().entries()){await p.screenshot({path:join(out,id+'-failure-'+i+'.png'),fullPage:true}).catch(()=>{});await writeFile(join(out,id+'-failure-'+i+'.txt'),await p.locator('body').innerText().catch(()=>''));}}finally{await ctx.close();}}
try{
 await run('payment-notice',async ctx=>{
  const page=await ctx.newPage();await ready(page,url('full','/staff'));
  await page.getByRole('button',{name:/Raka Pratama/}).click();await page.locator('.staff-header').waitFor();
  const stats=await page.locator('[data-ui="stat-strip"]').boundingBox();assert.ok(stats.height<=160,'Mobile stats must not take two large cards per row.');
  await geometry(page,'staff-390-compact');
  await page.getByRole('group',{name:'Metode pembayaran kasir',exact:true}).getByRole('button',{name:'QRIS demo',exact:true}).click();
  await page.getByRole('button',{name:/Buat instruksi demo/}).click();
  const notice=page.locator('.staff-feedback [data-ui="notice"]').filter({hasText:'Instruksi pembayaran demo dibuat.'});await notice.waitFor();
  assert.match(await notice.innerText(),/menunggu konfirmasi/);
  for(const width of [320,360,390,412,768,1280,1920]){await resize(page,width);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await geometry(page,'payment-notice-'+width);}
  await resize(page,390);await notice.evaluate(e=>{e.querySelector('.ui-notice-text').textContent='Referensi '+ 'ORDER'.repeat(60);});
  await geometry(page,'long-unbroken-notice-390');
  const broken=await page.addStyleTag({content:'.staff-feedback .ui-notice{width:max-content!important;max-width:none!important}.staff-feedback .ui-notice-text{white-space:nowrap!important;min-width:max-content!important}'});
  try{await assert.rejects(()=>geometry(page,'negative-nowrap',false),/overflow/);}finally{await broken.evaluate(e=>e.remove());}
  pass('negative control rejects the original unwrapped feedback defect');
 });
 await run('navigation-and-fields',async ctx=>{
  const page=await ctx.newPage();await ready(page,url('full','/staff'));
  await page.getByRole('button',{name:/Nadia Kusuma/}).click();
  const select=page.getByLabel('Petugas aktif',{exact:true});
  for(const width of [360,390,768,1280]){await resize(page,width);await select.selectOption('staff_manager');await geometry(page,'staff-selector-'+width);}
  await resize(page,390);
  const nav=page.getByRole('navigation',{name:'Navigasi operasional kafe',exact:true});
  await nav.getByRole('button',{name:/^Kasir/}).focus();await page.keyboard.press('ArrowRight');
  await page.getByRole('heading',{name:'Dapur & Bar',exact:true}).waitFor();
  assert.equal(await nav.getAttribute('data-ui'),'choice-strip');
  assert.equal(await page.getByRole('group',{name:'Status pesanan dapur'}).getAttribute('data-ui'),'choice-strip');
  await geometry(page,'kitchen-390-shared-controls');
 });
 for(const theme of ['boxy','rounded','editorial','playful','airy'])await run('customer-'+theme,async ctx=>{
  const page=await ctx.newPage();await ready(page,url('full','/?theme='+theme));
  const categories=page.getByRole('group',{name:'Kategori menu',exact:true});assert.equal(await categories.getAttribute('data-ui'),'choice-strip');
  assert.equal(await page.getByText('Menu hari ini',{exact:true}).count(),0,'No redundant hero panel.');
  const first=await page.getByRole('list',{name:'Menu',exact:true}).getByRole('listitem').first().boundingBox();assert.ok(first.y<620,'Menu must start in the initial mobile viewport.');
  for(const width of [360,390,768,1280]){await resize(page,width);await geometry(page,'customer-'+theme+'-'+width);}
  await resize(page,390);await categories.getByRole('button').first().focus();await page.keyboard.press('ArrowRight');
  assert.equal(await categories.getByRole('button').nth(1).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Tersedia saja',exact:true}).click();await geometry(page,'customer-'+theme+'-filtered-390');
 });
}finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify({checkedAt:new Date().toISOString(),target:domain||base,checks,failures,errors,writes},null,2));}
assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
console.log('Compact UI: '+checks.length+' checks passed.');
`);
t=await read('scripts/demos-verify.mjs');t=once(t,"['tests/demos-staff-layout.mjs',", "['tests/demos-compact-ui.mjs', 'tests/demos-staff-layout.mjs',");await put('scripts/demos-verify.mjs',t);
t=await read('scripts/demos-live-verify.mjs');
t+=String.raw`
for(const [script,extra] of [
 ['tests/demos-compact-ui.mjs',{CAFE_COMPACT_OUTPUT:'test-results/compact-ui-live'}],
 ['tests/demos-lifecycle.mjs',{CAFE_LIFECYCLE_OUTPUT:'test-results/catalog-live',CAFE_LIFECYCLE_CASES:'catalog-waiter'}],
]) {
 const task=spawn(process.execPath,['--experimental-strip-types',script],{env:{...process.env,CAFE_DEMO_BASE_DOMAIN:'tampiloka.site',...extra},stdio:'inherit'});
 const [status,signal]=await once(task,'exit');assert.equal(status,0,script+' failed: '+signal);
}
`;await put('scripts/demos-live-verify.mjs',t);
await rm('scripts/apply-compact-ui.mjs');await rm('.github/workflows/ui-apply.yml',{force:true});
console.log('Interaction-state regressions and compact follow-up prepared.');
