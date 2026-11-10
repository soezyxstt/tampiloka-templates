#!/usr/bin/env node
import { chooseDemoStaff, enterTableMenu, openDemoOptions } from './demo-controls.mjs';
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
 await page.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Opsi demo"]');return b&&!b.disabled;},null,{timeout:120000});
 await page.evaluate(()=>document.fonts.ready);
 await enterTableMenu(page);
 const state=await page.evaluate(async()=>(await(await fetch('/api/v1/snapshot?surface=staff')).json()).data);
 assert.equal(state?.runtime?.localOnly,true);assert.equal(state.runtime.demo,true);
}
async function context(){
 const ctx=await browser.newContext({locale:'id-ID',viewport:{width:390,height:844},reducedMotion:'reduce'});
 ctx.setDefaultTimeout(20000);
 await ctx.route('**/*',route=>{if(['GET','HEAD','OPTIONS'].includes(route.request().method()))return route.continue();writes.push(route.request().url());return route.abort();});
 ctx.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});});
 return ctx;
}
async function geometry(page,name,screenshot=true){
 const g=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].flatMap(e=>{const r=e.getBoundingClientRect();if(!r.width||r.right<=innerWidth+1)return [];for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){if(['auto','scroll','hidden','clip'].includes(getComputedStyle(p).overflowX))return [];}const s=getComputedStyle(e);return [{tag:e.tagName,cls:typeof e.className==='string'?e.className:'svg',text:e.textContent.slice(0,75),x:r.x,right:r.right,width:r.width,minWidth:s.minWidth,display:s.display,wrap:s.flexWrap,parent:e.parentElement?.className}];}).slice(0,15),clippedRoot:['hidden','clip'].includes(getComputedStyle(document.documentElement).overflowX)||['hidden','clip'].includes(getComputedStyle(document.body).overflowX),badNotices:[...document.querySelectorAll('[data-ui="notice"],[data-sonner-toast]')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1||r.left< -1||e.scrollWidth>e.clientWidth+1;}).map(e=>e.textContent)}));
 assert.equal(g.clippedRoot,false,name+': document clipping hides defects');
 assert.ok(g.scrollWidth<=g.width+1,name+': overflow '+JSON.stringify(g));assert.deepEqual(g.badNotices,[],name+': notification overflow');
 if(screenshot)await page.screenshot({path:join(out,name+'.png'),animations:'disabled'});
 pass(name,g);return g;
}
async function resize(page,width){
 await page.setViewportSize({width,height:844});
 await page.waitForFunction(width=>{
   if(innerWidth!==width||matchMedia('(min-width:768px)').matches!==(width>=768)||matchMedia('(min-width:1280px)').matches!==(width>=1280))return false;
   const account=document.querySelector('.staff-account'),aside=document.querySelector('.staff-sidebar');
   return !account||Math.abs(account.getBoundingClientRect().width-(width>=768?280:width-32))<1&&getComputedStyle(aside).display===(width>=1280?'flex':'none');
  },width,{timeout:5000});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
async function run(id,fn){const ctx=await context();try{await fn(ctx);}catch(e){failures.push({id,error:e.stack});console.error('FAIL '+id+': '+e.message);for(const [i,p]of ctx.pages().entries()){await p.screenshot({path:join(out,id+'-failure-'+i+'.png'),fullPage:true}).catch(()=>{});await writeFile(join(out,id+'-failure-'+i+'.txt'),await p.locator('body').innerText().catch(()=>''));}}finally{await ctx.close();}}
try{
 await run('payment-notice',async ctx=>{
  const page=await ctx.newPage();await ready(page,url('full','/staff'));
  await chooseDemoStaff(page);await page.locator('.staff-header').waitFor();
  assert.equal(await page.locator('[data-ui="stat-strip"]').count(),0,'Summary cards must not compete with cashier tasks.');
  await page.getByRole('navigation',{name:'Tugas kasir dan pesanan'}).getByRole('button',{name:/^Tagihan/}).click();
  await geometry(page,'staff-390-compact');
  await page.getByRole('group',{name:'Metode pembayaran kasir',exact:true}).getByRole('button',{name:'QRIS',exact:true}).click();
  await page.getByRole('button',{name:/Buat instruksi pembayaran/}).click();
  const notice=page.locator('[data-sonner-toast]').filter({hasText:'Instruksi pembayaran dibuat.'});await notice.waitFor();await notice.hover();
  assert.match(await notice.innerText(),/menunggu konfirmasi/i);

  await resize(page,390);await notice.evaluate(e=>{e.querySelector('[data-title]').textContent='Referensi '+ 'ORDER'.repeat(60);});
  await geometry(page,'long-unbroken-notice-390');
  const broken=await page.addStyleTag({content:'[data-sonner-toast]{width:max-content!important;max-width:none!important}[data-sonner-toast] [data-title]{white-space:nowrap!important;min-width:max-content!important}'});
  try{await assert.rejects(()=>geometry(page,'negative-nowrap',false),/overflow/);}finally{await broken.evaluate(e=>e.remove());}
  pass('negative control rejects the original unwrapped feedback defect');
  for(const width of [320,360,390,412,768,1280,1920]){await resize(page,width);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await geometry(page,'payment-notice-'+width);}
 });
 await run('navigation-and-fields',async ctx=>{
  const page=await ctx.newPage();await ready(page,url('full','/staff'));
  await chooseDemoStaff(page, 'staff_manager');
  const select=page.getByRole('combobox',{name:'Identitas staf demo',exact:true});
  for(const width of [360,390,768,1280]){await resize(page,width);await chooseDemoStaff(page, 'staff_manager');await geometry(page,'staff-selector-'+width);}
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
  const leadDish = page.getByRole('list', { name: 'Menu', exact: true }).getByRole('listitem').first();
  const first = await leadDish.boundingBox();
  assert.ok(first.y < 620, 'Menu must start in the initial mobile viewport.');
  if (theme === 'editorial') {
    const details = leadDish.getByRole('button', { name: /^Lihat / });
    const name = await details.textContent();
    const photo = leadDish.locator('img');
    await photo.scrollIntoViewIfNeeded();
    const box = await photo.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
    const dialog = page.getByRole('dialog', { name, exact: true });
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    const favorite = leadDish.getByRole('button', { name: /ke favorit$/ });
    await favorite.click();
    assert.equal(await leadDish.getByRole('button', { name: /dari favorit$/ }).getAttribute('aria-pressed'), 'true');
    await leadDish.getByRole('button', { name: /^Tambah / }).click();
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
  }
  for(const width of [360,390,768,1280]){await resize(page,width);await geometry(page,'customer-'+theme+'-'+width);}
  await resize(page,390);await categories.getByRole('button').first().focus();await page.keyboard.press('ArrowRight');
  assert.equal(await categories.getByRole('button').nth(1).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Tersedia saja',exact:true}).click();await geometry(page,'customer-'+theme+'-filtered-390');
 });
}finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify({checkedAt:new Date().toISOString(),target:domain||base,checks,failures,errors,writes},null,2));}
assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
console.log('Compact UI: '+checks.length+' checks passed.');
