import {readFile,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=p=>readFile(p,'utf8'),put=(p,t)=>writeFile(p,t);
const once=(t,a,b)=>{assert.ok(t.includes(a),'Missing anchor: '+a);return t.replace(a,b);};
let t=await read('components/cafe/staff-app.tsx');
t=once(t,'<div className="flex flex-wrap items-center gap-3">\n\n                <AnimatedSegmentedControl','<div className="min-w-0 max-w-full flex flex-wrap items-center gap-3">\n\n                <AnimatedSegmentedControl');
await put('components/cafe/staff-app.tsx',t);
t=await read('demos/showcase.css');t+='\n/* Narrow demo chrome wraps rather than making the whole app wider. */\n@media(max-width:359px){.demo-toolbar{flex-wrap:wrap;gap:0}.demo-toolbar-actions{margin-left:auto;min-width:0;flex-wrap:wrap}.demo-back{flex:0 0 auto}}\n';await put('demos/showcase.css',t);
t=await read('tests/demos-compact-ui.mjs');
t=once(t,"await page.waitForFunction(width=>innerWidth===width&&matchMedia('(min-width:768px)').matches===(width>=768),width);",String.raw`await page.waitForFunction(width=>{
   if(innerWidth!==width||matchMedia('(min-width:768px)').matches!==(width>=768)||matchMedia('(min-width:1280px)').matches!==(width>=1280))return false;
   const account=document.querySelector('.staff-account'),aside=document.querySelector('.staff-sidebar');
   return !account||Math.abs(account.getBoundingClientRect().width-(width>=768?280:width-32))<1&&getComputedStyle(aside).display===(width>=1280?'flex':'none');
  },width,{timeout:5000});`);
await put('tests/demos-compact-ui.mjs',t);
t=await read('scripts/cafe.mjs');
t=once(t,'Menu-only projects serve editable static content without a database. Ordering', 'Use --modules catalog for a read-only menu without a database. The catalog\npreset includes guest lists and the waiter inbox with offline payment. Ordering');await put('scripts/cafe.mjs',t);

// Verify JS as well as CSS before running actual browser journeys on live hosts.
await put('scripts/demos-live-verify.mjs',String.raw`#!/usr/bin/env node
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
`);
t=await read('.github/workflows/ci.yml');
t+=String.raw`
  client_presets:
    if: github.event_name == 'pull_request' || (github.event_name == 'push' && github.ref == 'refs/heads/main')
    runs-on: ubuntu-latest
    timeout-minutes: 25
    env:
      NEXT_TELEMETRY_DISABLED: '1'
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        if: hashFiles('demos/manifest.ts') != ''
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
        if: hashFiles('demos/manifest.ts') != ''
      - name: Verify HTTP flows in all nine fresh CLI presets and explicit read-only catalog
        if: hashFiles('demos/manifest.ts') != ''
        run: npm run test:presets
`;
await put('.github/workflows/ci.yml',t);
await rm('scripts/apply-compact-ui.mjs');await rm('.github/workflows/ui-apply.yml');
