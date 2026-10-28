#!/usr/bin/env node
/** Wait for the tested CSS artifact on every public host, then check live layouts.
 * Runs after a verified main push. Never changes Cloudflare configuration or data.
 */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve, join } from 'node:path';
import { DEMOS } from '../demos/manifest.ts';

const output = resolve('test-results/staff-layout-live');
await mkdir(output, { recursive: true });
const html = await readFile('dist-demos/index.html', 'utf8');
const cssPath = html.match(/href="([^"]+\.css)"/)?.[1];
assert.ok(cssPath && /^\/assets\/[a-zA-Z0-9_.-]+\.css$/.test(cssPath), 'Expected one hashed CSS asset in the built demo.');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const expectedHash = sha256(await readFile(join('dist-demos', cssPath.slice(1))));
const hosts = ['https://cafe.tampiloka.site', ...DEMOS.map(demo => `https://${demo.subdomain}.tampiloka.site`)];
const deadline = Date.now() + 180000;
let results = [];
while (Date.now() < deadline) {
  results = await Promise.all(hosts.map(async host => {
    try {
      const page = await fetch(host, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
      const markup = await page.text();
      if (!page.ok || !markup.includes(cssPath)) return { host, ready: false, status: page.status, reason: 'The tested stylesheet is not published yet.' };
      const css = await fetch(new URL(cssPath, host), { signal: AbortSignal.timeout(15000) });
      const actualHash = sha256(Buffer.from(await css.arrayBuffer()));
      return { host, ready: css.ok && actualHash === expectedHash, status: page.status, cssStatus: css.status, cssPath, sha256: actualHash };
    } catch (error) { return { host, ready: false, reason: error.message }; }
  }));
  if (results.every(result => result.ready)) break;
  console.log('Waiting for matching Cloudflare assets:', results.filter(result => !result.ready));
  await new Promise(resolve => setTimeout(resolve, 5000));
}
await writeFile(join(output, 'deployment.json'), JSON.stringify({ commit: process.env.GITHUB_SHA || null, checkedAt: new Date().toISOString(), cssPath, expectedHash, results }, null, 2));
assert.ok(results.every(result => result.ready), 'Cloudflare has not published the exact tested stylesheet on every public demo host.');
console.log(`PASS all ${hosts.length} public demo hosts serve the exact tested CSS ${cssPath}`);
const child = spawn(process.execPath, ['--experimental-strip-types', 'tests/demos-staff-layout.mjs'], {
  env: { ...process.env, CAFE_DEMO_BASE_DOMAIN: 'tampiloka.site', CAFE_LAYOUT_OUTPUT: output }, stdio: 'inherit',
});
const [code, signal] = await once(child, 'exit');
assert.equal(code, 0, `Deployed staff layout checks failed (${signal || code}).`);

for(const [script,extra] of [
 ['tests/demos-compact-ui.mjs',{CAFE_COMPACT_OUTPUT:'test-results/compact-ui-live'}],
 ['tests/demos-lifecycle.mjs',{CAFE_LIFECYCLE_OUTPUT:'test-results/catalog-live',CAFE_LIFECYCLE_CASES:'catalog-waiter'}],
]) {
 const task=spawn(process.execPath,['--experimental-strip-types',script],{env:{...process.env,CAFE_DEMO_BASE_DOMAIN:'tampiloka.site',...extra},stdio:'inherit'});
 const [status,signal]=await once(task,'exit');assert.equal(status,0,script+' failed: '+signal);
}
