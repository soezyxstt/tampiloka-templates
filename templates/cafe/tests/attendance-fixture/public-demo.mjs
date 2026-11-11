import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ configFile: 'demos/vite.config.mts', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
 const context = await browser.newContext();
 await context.addInitScript(() => { window.__cameraCalls = 0; if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { window.__cameraCalls++; throw new Error('unexpected camera'); }; });
 const page = await context.newPage(); const requests = [];
 page.on('request', request => { if (request.url().includes('/api/attendance')) requests.push(request.url()); });
 for (const path of ['/p/full/?lang=en', '/p/full/staff?lang=en']) {
  await page.goto(`${origin}${path}`); await page.waitForFunction(() => document.querySelector('button[aria-label="Demo options"]') || document.querySelector('button[aria-label="Opsi demo"]'), null, { timeout: 120000 });
  await page.reload(); await page.waitForFunction(() => document.querySelector('button[aria-label="Demo options"]') || document.querySelector('button[aria-label="Opsi demo"]'), null, { timeout: 120000 });
  assert.equal(await page.getByRole('link', { name: /attendance|absensi/i }).count(), 0);
  assert.equal(await page.evaluate(() => window.__cameraCalls), 0);
 }
 assert.deepEqual(requests, []); await context.close(); console.log('PASS public Vite customer/staff deep links and reload: no attendance requests, link or camera');
} finally { await browser.close(); await server.close(); }
