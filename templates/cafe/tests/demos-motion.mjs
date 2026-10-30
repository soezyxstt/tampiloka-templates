#!/usr/bin/env node
/** Real animation-enabled interaction tests. Never write to a live server. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright';
import {DEMOS} from '../demos/manifest.ts';
const base=process.env.CAFE_DEMO_BASE_URL||'http://127.0.0.1:4174';
const domain=process.env.CAFE_DEMO_BASE_DOMAIN;
const out=resolve(process.env.CAFE_MOTION_OUTPUT||'test-results/motion');
await mkdir(out,{recursive:true});
const checks=[],failures=[],errors=[],writes=[];
const browser=await chromium.launch({headless:true});
const url=(id,path='/')=>domain?'https://'+DEMOS.find(d=>d.id===id).subdomain+'.'+domain+path:base.replace(/\/$/,'')+'/p/'+id+path;
const pass=(name,detail={})=>{checks.push({name,...detail});console.log('PASS '+name);};
async function ready(page,address){
 const response=await page.goto(address,{waitUntil:'domcontentloaded',timeout:120000});assert.ok(response?.ok());
 await page.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Ulangi demo"]');return b&&!b.disabled;},null,{timeout:120000});
 await page.evaluate(()=>document.fonts.ready);
 const state=await page.evaluate(async()=>(await(await fetch('/api/v1/snapshot?surface=staff')).json()).data);
 assert.equal(state?.runtime?.localOnly,true);assert.equal(state.runtime.demo,true);
}
async function run(id,width,reduce,fn){
 const ctx=await browser.newContext({locale:'id-ID',viewport:{width,height:900},reducedMotion:reduce?'reduce':'no-preference',recordVideo:{dir:join(out,'video'),size:{width:Math.min(width,1280),height:900}}});
 ctx.setDefaultTimeout(20000);
 await ctx.addInitScript(()=>{window.__motionEvents=[];document.addEventListener('animationstart',e=>window.__motionEvents.push({name:e.animationName,ui:e.target.getAttribute?.('data-ui'),at:performance.now()}),true);});
 await ctx.route('**/*',route=>{if(['GET','HEAD','OPTIONS'].includes(route.request().method()))return route.continue();writes.push(route.request().url());return route.abort();});
 ctx.on('page',page=>{page.on('pageerror',e=>errors.push({id,error:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({id,error:m.text()});});});
 try{await fn(ctx);}catch(e){failures.push({id,error:e.stack});console.error('FAIL '+id+': '+e.message);for(const [i,p]of ctx.pages().entries()){await p.screenshot({path:join(out,id+'-failure-'+i+'.png'),fullPage:true}).catch(()=>{});await writeFile(join(out,id+'-failure-'+i+'.txt'),await p.locator('body').innerText().catch(()=>''));}}
 finally{await ctx.close();}
}
async function geometry(page,name){
 const g=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clipped:['hidden','clip'].includes(getComputedStyle(document.body).overflowX)||['hidden','clip'].includes(getComputedStyle(document.documentElement).overflowX)}));
 assert.ok(g.scrollWidth<=g.width+1,name+': '+JSON.stringify(g));assert.equal(g.clipped,false,'No root overflow masking');
 await page.screenshot({path:join(out,name+'.png')});pass(name,g);
}
async function dialogJourney(page,reduce,name){
 const trigger=page.getByRole('button',{name:'Menu profil, pesanan, dan layanan meja',exact:true});
 await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Lainnya',exact:true});await dialog.waitFor();
 const style=await dialog.evaluate(e=>({name:getComputedStyle(e).animationName,duration:getComputedStyle(e).animationDuration,state:e.getAttribute('data-state')}));
 assert.equal(style.state,'open');
 assert.equal(style.name,reduce?'none':'cafe-dialog-in');
 if(!reduce)assert.ok(parseFloat(style.duration)>0,'Dialog needs a real entrance duration');
 await page.waitForTimeout(320);
 await page.keyboard.press('Tab');
 assert.equal(await dialog.evaluate(e=>e.contains(document.activeElement)),true,'Focus must remain in dialog');
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 assert.equal(await trigger.evaluate(e=>e===document.activeElement),true,'Close must restore opener focus');
 if(!reduce){const events=await page.evaluate(()=>window.__motionEvents);for(const event of ['cafe-overlay-in','cafe-dialog-in','cafe-overlay-out','cafe-dialog-out'])assert.ok(events.some(e=>e.name===event),'Missing actual animation event '+event);}
 pass(name+' dialog enter/exit, Escape, focus trap and focus restore',style);
 await trigger.click();await dialog.waitFor();await page.waitForTimeout(300);
 await page.locator('[data-ui="dialog-overlay"]').click({position:{x:5,y:5}});await dialog.waitFor({state:'hidden'});
 pass(name+' outside dismissal');
}
async function sampleAfterClick(button,selector){
 return button.evaluate(async(e,selector)=>{e.click();const samples=[];const end=performance.now()+620;while(performance.now()<end){await new Promise(r=>requestAnimationFrame(r));const el=document.querySelector(selector);if(el){const s=getComputedStyle(el);samples.push({opacity:Number(s.opacity),transform:s.transform,x:el.getBoundingClientRect().x,text:el.textContent.slice(0,70)});}}return samples;},selector);
}
try{
 for(const reduce of [false,true])await run('customer-'+(reduce?'reduced':'animated'),390,reduce,async ctx=>{
  const page=await ctx.newPage();await ready(page,url('full'));await page.waitForTimeout(350);
  const heading=page.locator('#customer-content h1 [data-ui="reveal-text"]');
  assert.equal(await heading.evaluate(e=>getComputedStyle(e).animationName),reduce?'none':'cafe-text-reveal');
  if(!reduce)assert.ok((await page.evaluate(()=>window.__motionEvents)).some(e=>e.name==='cafe-text-reveal'));
  pass('text reveal '+(reduce?'respects reduced motion':'runs by default'));
  await dialogJourney(page,reduce,reduce?'reduced':'animated');
  const category=page.getByRole('group',{name:'Kategori menu',exact:true});
  const samples=await sampleAfterClick(category.getByRole('button').nth(1),'[aria-label="Kategori menu"] [data-ui="choice-indicator"]');
  assert.ok(samples.length>2);
  if(!reduce)assert.ok(new Set(samples.map(s=>Math.round(s.x*10))).size>2,'Indicator must move through intermediate positions, not jump');
  assert.equal(await category.getByRole('button').nth(1).getAttribute('aria-pressed'),'true');
  await category.getByRole('button').nth(1).focus();await page.keyboard.press('End');await page.keyboard.press('Home');
  assert.equal(await category.getByRole('button').first().getAttribute('aria-pressed'),'true');
  pass('category indicator and keyboard '+(reduce?'reduced':'animated'),{frames:samples.length});
  const nav=page.getByRole('navigation',{name:'Navigasi pelanggan',exact:true});
  const panels=await sampleAfterClick(nav.getByRole('button',{name:'Keranjang',exact:true}),'#customer-content [data-ui="motion-panel"][data-motion-present="true"]');
  await page.getByRole('heading',{name:'Keranjang',exact:true}).waitFor();
  if(!reduce)assert.ok(panels.some(s=>s.opacity>0.01&&s.opacity<0.99),'New screen must pass through a visible fade');
  else assert.ok(panels.every(s=>s.transform==='none'||s.transform==='matrix(1, 0, 0, 1, 0, 0)'),'Reduced motion must not slide the screen');
  await nav.getByRole('button',{name:'Menu',exact:true}).click();await nav.getByRole('button',{name:'Pesanan',exact:true}).click();await nav.getByRole('button',{name:'Keranjang',exact:true}).click();
  await page.waitForTimeout(700);assert.equal(await page.locator('#customer-content [data-ui="motion-panel"]').count(),1);
  await page.getByRole('heading',{name:'Keranjang',exact:true}).waitFor();
  pass('screen fade and rapid switching '+(reduce?'reduced':'animated'));
  await geometry(page,'customer-'+(reduce?'reduced':'animated')+'-390');
 });
 for(const width of [390,1280])await run('staff-motion-'+width,width,false,async ctx=>{
  const page=await ctx.newPage();await ready(page,url('full','/staff'));
  await page.getByRole('button',{name:/Raka Pratama/}).click();await page.locator('.staff-header').waitFor();await page.waitForTimeout(350);
  const nav=page.getByRole('navigation',{name:width>=1280?'Navigasi operasional desktop':'Navigasi operasional kafe',exact:true});
  const samples=await sampleAfterClick(nav.getByRole('button',{name:/^Dapur/}),'#staff-content>[data-ui="motion-panel"][data-motion-present="true"]');
  assert.ok(samples.some(s=>s.opacity>0.01&&s.opacity<0.99),'Staff screen switch must animate');
  await nav.getByRole('button',{name:/^Kasir/}).click();await page.waitForTimeout(500);
  const input=page.getByLabel('Cari tagihan berdasarkan meja atau pelanggan',{exact:true});await input.fill('Anisa');
  await page.locator('#staff-content>[data-ui="motion-panel"]').evaluate(e=>e.dataset.persistenceProbe='same');
  const eventCount=await page.evaluate(()=>window.__motionEvents.filter(e=>e.name==='cafe-text-reveal').length);
  await page.getByRole('button',{name:'Perbarui data operasional',exact:true}).click();await page.waitForTimeout(600);
  assert.equal(await input.inputValue(),'Anisa');assert.equal(await page.locator('#staff-content>[data-ui="motion-panel"]').getAttribute('data-persistence-probe'),'same');
  assert.equal(await page.evaluate(()=>window.__motionEvents.filter(e=>e.name==='cafe-text-reveal').length),eventCount,'Polling must not replay heading reveals');
  pass('staff transition keeps form state on refresh '+width);
  const trigger=page.getByRole('button',{name:'Pesanan baru',exact:true}).first();await trigger.click();await page.getByRole('dialog').waitFor();await page.waitForTimeout(350);
  assert.equal(await page.locator('[data-ui="dialog-content"]').evaluate(e=>getComputedStyle(e).animationName),'cafe-dialog-in');
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
  await geometry(page,'staff-motion-'+width);
 });
 for(const demo of DEMOS)await run('preset-'+demo.id,1024,false,async ctx=>{
  const page=await ctx.newPage();await ready(page,url(demo.id,'/staff'));await page.getByRole('button',{name:/Raka Pratama/}).click();
  const nav=page.getByRole('navigation',{name:'Navigasi operasional kafe',exact:true});await nav.waitFor();await page.waitForTimeout(300);
  await nav.getByRole('button').last().click();await page.waitForTimeout(500);
  assert.equal(await page.locator('#staff-content>[data-ui="motion-panel"]').count(),1);
  await nav.getByRole('button').first().click();await page.waitForTimeout(500);
  assert.equal(await page.locator('#staff-content>[data-ui="motion-panel"]').count(),1);
  await geometry(page,'preset-'+demo.id+'-motion');
 });
}finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify({checkedAt:new Date().toISOString(),target:domain||base,checks,failures,errors,writes},null,2));}
assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
console.log('Shared motion: '+checks.length+' checks passed.');
