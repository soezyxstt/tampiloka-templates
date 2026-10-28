#!/usr/bin/env node
/** Verify matching release assets, then exercise live browser-local demos. */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {resolve,join} from 'node:path';
import {DEMOS} from '../demos/manifest.ts';
const output=resolve('test-results/staff-layout-live');await mkdir(output,{recursive:true});
const html=await readFile('dist-demos/index.html','utf8');
const paths=[html.match(/href="([^"]+\.css)"/)?.[1],html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1]];
assert.ok(paths.every(path=>path&&/^\/assets\/[a-zA-Z0-9_.-]+\.(?:css|js)$/.test(path)),'Expected hashed CSS and JS entries.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const assets=await Promise.all(paths.map(async path=>({path,hash:hash(await readFile(join('dist-demos',path.slice(1))))})));
const hosts=['https://cafe.tampiloka.site',...DEMOS.map(demo=>'https://'+demo.subdomain+'.tampiloka.site')];
const deadline=Date.now()+180000;let results=[];
while(Date.now()<deadline){
 results=await Promise.all(hosts.map(async host=>{
  try{
   const page=await fetch(host,{headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});const text=await page.text();
   if(!page.ok||!paths.every(path=>text.includes(path)))return {host,ready:false,status:page.status};
   const observed=await Promise.all(assets.map(async asset=>{const r=await fetch(new URL(asset.path,host),{signal:AbortSignal.timeout(15000)});const actual=hash(Buffer.from(await r.arrayBuffer()));return {...asset,actual,status:r.status,ready:r.ok&&actual===asset.hash};}));
   return {host,ready:observed.every(asset=>asset.ready),status:page.status,assets:observed};
  }catch(error){return {host,ready:false,error:error.message};}
 }));
 if(results.every(r=>r.ready))break;
 console.log('Waiting for matching release assets:',results.filter(r=>!r.ready));await new Promise(r=>setTimeout(r,5000));
}
await writeFile(join(output,'deployment.json'),JSON.stringify({commit:process.env.GITHUB_SHA||null,checkedAt:new Date().toISOString(),assets,results},null,2));
assert.ok(results.every(r=>r.ready),'Not every public host serves the exact tested CSS and JS.');
console.log('PASS all '+hosts.length+' public hosts serve exact tested CSS and JS.');
for(const [script,extra] of [
 ['tests/demos-staff-layout.mjs',{CAFE_LAYOUT_OUTPUT:output}],
 ['tests/demos-compact-ui.mjs',{CAFE_COMPACT_OUTPUT:'test-results/compact-ui-live'}],
 ['tests/demos-lifecycle.mjs',{CAFE_LIFECYCLE_OUTPUT:'test-results/catalog-live',CAFE_LIFECYCLE_CASES:'catalog-waiter'}],
]){
 const task=spawn(process.execPath,['--experimental-strip-types',script],{env:{...process.env,CAFE_DEMO_BASE_DOMAIN:'tampiloka.site',...extra},stdio:'inherit'});
 const [code,signal]=await once(task,'exit');assert.equal(code,0,script+' failed ('+(signal||code)+').');
}
