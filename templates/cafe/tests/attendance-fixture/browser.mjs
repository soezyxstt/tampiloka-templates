import { chromium } from 'playwright';
import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: -6, longitude: 107, accuracy: 5 }, permissions: ['geolocation', 'camera'], reducedMotion: 'reduce' });
await context.addInitScript(() => {
 const tracks = []; const created = []; const revoked = [];
 const nativeFetch = window.fetch; window.__consumed = { upload: 0, blob: 0, confirmation: 0 };
 window.fetch = async (...args) => { const response = await nativeFetch(...args); const url = response.url; if (url.includes('resource=evidence')) { if (args[1]?.method === 'POST') { const json = response.json.bind(response); response.json = async () => { const data = await json(); const key = data.evidenceKey; Object.defineProperty(data, 'evidenceKey', { get() { queueMicrotask(() => window.__consumed.upload++); return key; } }); return data; }; } else { const blob = response.blob.bind(response); response.blob = () => { const promise = blob(); promise.then(() => queueMicrotask(() => queueMicrotask(() => window.__consumed.blob++))); return promise; }; } } else if (url.includes('resource=status') && url.includes('idempotencyKey=')) { const json = response.json.bind(response); response.json = async () => { const data = await json(); if (data.operation) { const id = data.operation.id; Object.defineProperty(data.operation, 'id', { get() { queueMicrotask(() => window.__consumed.confirmation++); return id; } }); } return data; }; } return response; };
 const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 navigator.mediaDevices.getUserMedia = async (...args) => { const stream = await acquire(...args); tracks.push(...stream.getTracks()); return stream; };
 const create = URL.createObjectURL.bind(URL); const revoke = URL.revokeObjectURL.bind(URL);
 URL.createObjectURL = blob => { const url = create(blob); created.push(url); return url; };
 URL.revokeObjectURL = url => { revoked.push(url); revoke(url); };
 window.__attendanceResources = { tracks, created, revoked };
});
const cookie = role => `${role}.${createHmac('sha256', 'local-test-only-key').update(role).digest('hex')}`;
try {
 const denied = await context.newPage(); await denied.goto('http://127.0.0.1:4189/?lang=en'); await denied.getByText('Attendance is unavailable or access was denied.').waitFor(); await denied.close();
 await context.addCookies([{ name: 'fixture', value: cookie('staff'), url: 'http://127.0.0.1:4189' }]);
 const page = await context.newPage(); await page.goto('http://127.0.0.1:4189/?lang=en');
 await page.getByRole('button', { name: 'Get location' }).click();
 await page.getByText('Accuracy:').waitFor();
 await page.getByRole('button', { name: 'Open camera' }).click();
 await page.getByRole('button', { name: 'Take photo' }).click();
 await page.waitForFunction(() => window.__attendanceResources.tracks.every(track => track.readyState === 'ended'));
 await page.getByRole('button', { name: 'Retake photo' }).click();
 await page.getByRole('button', { name: 'Close camera' }).click();
 await page.waitForFunction(() => window.__attendanceResources.tracks.every(track => track.readyState === 'ended') && window.__attendanceResources.created.every(url => window.__attendanceResources.revoked.includes(url)));
 await page.getByRole('button', { name: 'Open camera' }).click(); await page.getByRole('button', { name: 'Take photo' }).click();
 await page.getByRole('button', { name: 'Submit check-in' }).click();
 await page.getByText('Attendance saved.').waitFor();
 await page.locator('article').filter({ hasText: 'Check-in' }).waitFor({ timeout: 5000 });
 for (const width of [360, 390, 1024]) { await page.setViewportSize({ width, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
 await page.getByRole('button', { name: 'Switch language to Indonesian' }).click(); await page.getByRole('heading', { name: 'Absensi', exact: true }).waitFor(); await page.reload(); await page.getByRole('heading', { name: 'Absensi', exact: true }).waitFor(); await page.getByRole('button', { name: 'Ganti bahasa ke Inggris' }).click();
 const result = await page.evaluate(async () => (await (await fetch('/api/attendance?resource=history&outletId=canonical-outlet')).json()).events.length);
 assert.equal(result, 1);
 const staffForbidden = await page.evaluate(async () => { const history = await (await fetch('/api/attendance?resource=history&outletId=canonical-outlet')).json(); return (await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'correct', outletId: 'canonical-outlet', eventId: history.events[0].id, correctedAt: new Date().toISOString(), reason: 'forged correction' }) })).status; }); assert.equal(staffForbidden, 403);
 console.log('PASS staff capture persisted via real API, 390px, reduced motion');
 await page.getByRole('button', { name: 'Get location' }).click(); await page.getByText('Accuracy:').waitFor();
 await page.getByRole('button', { name: 'Open camera' }).click(); await page.getByRole('button', { name: 'Take photo' }).click();
 await page.getByRole('button', { name: 'Submit check-out' }).click(); await page.getByText('Attendance saved.').waitFor();
 await page.waitForFunction(async () => (await (await fetch('/api/attendance?resource=history&outletId=canonical-outlet')).json()).events.length === 2);
 await context.addCookies([{ name: 'fixture', value: cookie('supervisor'), url: 'http://127.0.0.1:4189' }]);
 await page.reload(); await page.getByText('staff', { exact: false }).first().waitFor();
 assert.equal(await page.getByRole('button', { name: 'Get location' }).count(), 0);
 await page.getByRole('button', { name: 'View photo' }).first().click(); await page.getByAltText('Private attendance photo').waitFor();
 await page.getByRole('button', { name: 'View photo' }).last().click();
 await page.waitForFunction(() => window.__attendanceResources.created.length >= 2 && window.__attendanceResources.revoked.length >= 1);
 await page.getByRole('button', { name: 'Close photo' }).click();
 await page.waitForFunction(() => window.__attendanceResources.created.every(url => window.__attendanceResources.revoked.includes(url)));
 let releaseEvidence; let evidenceArrived; const evidenceWaiting = new Promise(resolve => { evidenceArrived = resolve; }); let evidenceRequests = 0;
 await page.route('**/api/attendance?resource=evidence**', async route => { if (++evidenceRequests === 1) { const response = await route.fetch(); evidenceArrived(); await new Promise(resolve => { releaseEvidence = resolve; }); await route.fulfill({ response }); } else await route.continue(); });
 await page.getByRole('button', { name: 'View photo' }).first().click(); await evidenceWaiting;
 await page.getByRole('button', { name: 'View photo' }).last().click(); await page.getByAltText('Private attendance photo').waitFor();
 const currentImage = await page.getByAltText('Private attendance photo').getAttribute('src'); const evidenceResponse = page.waitForResponse(response => response.url().includes('resource=evidence') && response.request().method() === 'GET'); releaseEvidence(); await evidenceResponse;
 await page.getByRole('button', { name: 'Close photo' }).click(); await page.waitForFunction(() => window.__attendanceResources.created.every(url => window.__attendanceResources.revoked.includes(url)));
 assert.equal(await page.getByAltText('Private attendance photo').count(), 0); assert.ok(currentImage); await page.unroute('**/api/attendance?resource=evidence**');
 console.log('PASS deferred private evidence cannot replace a newer image');
 const trigger = page.getByRole('button', { name: 'Correct time' }).first(); await trigger.click();
 const dialog = page.getByRole('dialog', { name: 'Confirm correction' }); await dialog.waitFor();
 await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); await page.waitForFunction(() => document.activeElement?.textContent === 'Correct time');
 await trigger.click(); await dialog.getByLabel('Reason (at least 5 characters)').fill('abc'); assert.equal(await dialog.getByLabel('Reason (at least 5 characters)').evaluate(el => el.validity.valid), false); await dialog.getByLabel('Correct time').fill('2026-11-11T10:00'); await dialog.getByLabel('Reason (at least 5 characters)').fill('Clock adjustment'); await dialog.getByRole('button', { name: 'Confirm correction' }).click();
 await dialog.waitFor({ state: 'hidden' }); await page.getByText(/Clock adjustment/).waitFor();
 console.log('PASS check-out, supervisor-only review, private evidence, correction and Escape focus return');
 await context.addCookies([{ name: 'fixture', value: cookie('lost'), url: 'http://127.0.0.1:4189' }]); await page.reload();
 await page.getByRole('button', { name: 'Get location' }).click(); await page.getByText('Accuracy:').waitFor(); await page.getByRole('button', { name: 'Open camera' }).click(); await page.getByRole('button', { name: 'Take photo' }).click(); await page.getByRole('button', { name: 'Submit check-in' }).click();
 await page.getByText(/The result is unknown/).waitFor(); const pending = await page.evaluate(() => sessionStorage.getItem('attendance-pending:canonical-outlet')); assert.ok(pending);
 await page.evaluate(() => fetch('/fixture/expire', { method: 'POST' }));
 assert.equal(await page.evaluate(() => sessionStorage.getItem('attendance-pending:canonical-outlet')), pending);
 await page.reload(); await page.getByRole('button', { name: 'Recover previous attempt' }).click(); await page.getByText('Attendance saved.').waitFor();
 await page.waitForFunction(() => document.querySelectorAll('article').length === 3);
 await page.evaluate(() => fetch('/fixture/unexpire', { method: 'POST' }));
 const count = await page.evaluate(async () => (await (await fetch('/api/attendance?resource=history&outletId=canonical-outlet')).json()).events.length); assert.equal(count, 3); assert.equal(await page.evaluate(() => sessionStorage.getItem('attendance-pending:canonical-outlet')), null);
 console.log('PASS lost response reconciled after reload without duplicate');
 await context.addCookies([{ name: 'fixture', value: cookie('delayed'), url: 'http://127.0.0.1:4189' }]); await page.reload();
 await page.getByRole('button', { name: 'Get location' }).click(); await page.getByText('Accuracy:').waitFor(); await page.getByRole('button', { name: 'Open camera' }).click(); await page.getByRole('button', { name: 'Take photo' }).click(); await page.getByRole('button', { name: 'Submit check-out' }).click();
 await page.getByText(/The result is unknown/).waitFor();
 const delayedPending = await page.evaluate(() => sessionStorage.getItem('attendance-pending:canonical-outlet')); assert.ok(delayedPending);
 assert.equal(await page.getByRole('button', { name: 'Open camera' }).count(), 0);
 await page.evaluate(() => fetch('/fixture/expire', { method: 'POST' }));
 assert.equal(await page.evaluate(() => sessionStorage.getItem('attendance-pending:canonical-outlet')), delayedPending);
 await page.route('**/api/attendance', async route => { if (route.request().method() === 'POST' && route.request().postDataJSON()?.action === 'finalize') await route.abort(); else await route.continue(); });
 await page.getByRole('button', { name: 'Recover previous attempt' }).click(); await page.getByText(/Recovery is not confirmed/).waitFor(); assert.ok(await page.evaluate(() => sessionStorage.getItem('attendance-pending:canonical-outlet'))); await page.unroute('**/api/attendance');
 await page.getByRole('button', { name: 'Recover previous attempt' }).click(); await page.getByText(/previous attempt was safely canceled/).waitFor();
 await page.evaluate(() => fetch('/fixture/unexpire', { method: 'POST' }));
 assert.equal(await page.evaluate(async () => (await fetch('/fixture/release', { method: 'POST' })).status), 409);
 assert.equal(await page.evaluate(async () => (await (await fetch('/api/attendance?resource=history&outletId=canonical-outlet')).json()).events.length), 3);
 assert.equal(await page.evaluate(() => sessionStorage.getItem('attendance-pending:canonical-outlet')), null);
 await page.evaluate(() => fetch('/fixture/unexpire', { method: 'POST' }));
 assert.equal(await page.getByRole('button', { name: 'Submit check-out' }).isDisabled(), true);
 await context.addCookies([{ name: 'fixture', value: cookie('staff'), url: 'http://127.0.0.1:4189' }]);
 const oldCommand = JSON.parse(delayedPending);
 const reuseStatus = await page.evaluate(async command => (await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...command, idempotencyKey: crypto.randomUUID() }) })).status, oldCommand); assert.equal(reuseStatus, 422);
 await context.addCookies([{ name: 'fixture', value: cookie('staff'), url: 'http://127.0.0.1:4189' }]); await page.reload();
 let newCommand; await page.route('**/api/attendance', async route => { if (route.request().method() === 'POST') newCommand = route.request().postDataJSON(); await route.continue(); });
 await page.getByRole('button', { name: 'Get location' }).click(); await page.getByText('Accuracy:').waitFor(); await page.getByRole('button', { name: 'Open camera' }).click(); await page.getByRole('button', { name: 'Take photo' }).click(); await page.getByRole('button', { name: 'Submit check-out' }).click(); await page.getByText('Attendance saved.').waitFor(); await page.unroute('**/api/attendance');
 assert.notEqual(newCommand.idempotencyKey, oldCommand.idempotencyKey); assert.notEqual(newCommand.evidenceKey, oldCommand.evidenceKey);
 assert.equal(await page.evaluate(async () => (await (await fetch('/api/attendance?resource=history&outletId=canonical-outlet')).json()).events.length), 4);
 console.log('PASS terminal cancellation blocks delayed original and preserves durable event count');
 await context.addCookies([{ name: 'fixture', value: cookie('disabled'), url: 'http://127.0.0.1:4189' }]); await page.goto('http://127.0.0.1:4189/?lang=en&fixtureOutlet=disabled'); await page.getByText('Attendance capture is unavailable for this session.').waitFor(); assert.equal(await page.getByRole('button', { name: 'Get location' }).count(), 0);
 await page.goto('http://127.0.0.1:4189/?lang=en&fixtureOutlet=missing'); await page.getByText('Attendance is unavailable or access was denied.').waitFor();
 await context.addCookies([{ name: 'fixture', value: cookie('staff'), url: 'http://127.0.0.1:4189' }]);
 const deniedContext = await browser.newContext(); await deniedContext.addCookies([{ name: 'fixture', value: cookie('staff'), url: 'http://127.0.0.1:4189' }]);
 await deniedContext.addInitScript(() => { Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_ok, fail) => fail({ code: 1 }) } }); Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('denied', 'NotAllowedError'); } }); });
 const deniedPage = await deniedContext.newPage(); await deniedPage.goto('http://127.0.0.1:4189/?lang=en'); await deniedPage.getByRole('button', { name: 'Get location' }).click(); await deniedPage.getByText(/Location permission denied/).waitFor(); await deniedPage.getByRole('button', { name: 'Open camera' }).click(); await deniedPage.getByText(/Camera permission denied/).waitFor(); await deniedPage.getByRole('button', { name: 'Switch language to Indonesian' }).click(); await deniedPage.getByText(/Izin kamera ditolak/).waitFor(); await deniedPage.getByRole('button', { name: 'Ambil lokasi' }).click(); await deniedPage.getByText(/Izin lokasi ditolak/).waitFor(); await deniedContext.close();
 for (const name of ['NotFoundError', 'NotReadableError']) {
  const deviceContext = await browser.newContext();
  await deviceContext.addCookies([{ name: 'fixture', value: cookie('staff'), url: 'http://127.0.0.1:4189' }]);
  await deviceContext.addInitScript(errorName => { Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { throw new DOMException('device', errorName); } }); }, name);
  const devicePage = await deviceContext.newPage(); await devicePage.goto('http://127.0.0.1:4189/?lang=en');
  await devicePage.getByRole('button', { name: 'Open camera' }).click(); await devicePage.getByText(/Camera unavailable/).waitFor();
  await devicePage.getByRole('button', { name: 'Switch language to Indonesian' }).click(); await devicePage.getByText(/Kamera tidak tersedia/).waitFor();
  await deviceContext.close();
 }
 for (const scenario of ['missing', 'insecure', 'timeout', 'unavailable']) {
  const c = await browser.newContext(); await c.addCookies([{ name: 'fixture', value: cookie('staff'), url: 'http://127.0.0.1:4189' }]);
  await c.addInitScript(scenario => {
   if (scenario === 'insecure') Object.defineProperty(window, 'isSecureContext', { value: false });
   if (scenario === 'missing') { Object.defineProperty(navigator, 'mediaDevices', { value: undefined }); Object.defineProperty(navigator, 'geolocation', { value: undefined }); }
   if (scenario === 'timeout' || scenario === 'unavailable') Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_ok, fail) => fail({ code: scenario === 'timeout' ? 3 : 2 }) } });
  }, scenario);
  const p = await c.newPage(); await p.goto('http://127.0.0.1:4189/?lang=en');
  await p.getByRole('button', { name: 'Get location' }).click(); await p.getByText(scenario === 'timeout' ? /Location request timed out/ : /Location unavailable/).waitFor();
  await p.getByRole('button', { name: 'Switch language to Indonesian' }).click(); await p.getByText(scenario === 'timeout' ? /Permintaan lokasi habis waktu/ : /Lokasi tidak tersedia/).waitFor();
  if (scenario === 'missing' || scenario === 'insecure') { await p.getByRole('button', { name: 'Buka kamera' }).click(); await p.getByText(/Kamera tidak tersedia/).waitFor(); await p.getByRole('button', { name: 'Ganti bahasa ke Inggris' }).click(); await p.getByText(/Camera unavailable/).waitFor(); }
  await c.close();
 }
 console.log('PASS missing APIs, insecure context, location timeout and unavailable in both languages');
 const raceContext = await browser.newContext({ permissions: ['camera', 'geolocation'], geolocation: { latitude: -6, longitude: 107, accuracy: 5 } });
 await raceContext.addCookies([{ name: 'fixture', value: cookie('staff'), url: 'http://127.0.0.1:4189' }]);
 await raceContext.addInitScript(() => {
  const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (...args) => { const stream = await acquire(...args); window.__lateStream = stream; await new Promise(resolve => { window.__releaseCamera = resolve; }); return stream; };
 });
 const race = await raceContext.newPage(); await race.goto('http://127.0.0.1:4189/?lang=en');
 await race.getByRole('button', { name: 'Open camera' }).click();
 await race.waitForFunction(() => !!window.__releaseCamera); await race.evaluate(() => { window.unmountAttendanceFixture(); window.__releaseCamera(); });
 await race.waitForFunction(() => window.__lateStream.getTracks().every(track => track.readyState === 'ended'));
 assert.equal(await race.locator('video').count(), 0); await raceContext.close();
 console.log('PASS late camera acquisition stops tracks after unmount');
 // Hold the first acquisition while a retry becomes active, then cancel or retain it.
 for (const cancel of [false, true]) {
  const c = await browser.newContext({ permissions: ['camera'] }); await c.addCookies([{ name: 'fixture', value: cookie('staff'), url: 'http://127.0.0.1:4189' }]);
  await c.addInitScript(() => { const acquire = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); let n = 0; navigator.mediaDevices.getUserMedia = async (...args) => { const stream = await acquire(...args); if (++n === 1) { window.__old = stream; await new Promise(resolve => { window.__releaseOld = resolve; }); } else window.__current = stream; return stream; }; });
  const p = await c.newPage(); await p.goto('http://127.0.0.1:4189/?lang=en'); await p.getByRole('button', { name: 'Open camera' }).click(); await p.waitForFunction(() => !!window.__releaseOld); await p.getByRole('button', { name: 'Open camera' }).click(); await p.getByRole('button', { name: 'Take photo' }).waitFor();
  if (cancel) await p.getByRole('button', { name: 'Close camera' }).click();
  await p.evaluate(() => window.__releaseOld()); await p.waitForFunction(() => window.__old.getTracks().every(t => t.readyState === 'ended'));
  if (!cancel) { assert.equal(await p.locator('video').evaluate(el => el.srcObject === window.__current), true); assert.equal(await p.evaluate(() => window.__current.getTracks().every(t => t.readyState === 'live')), true); await p.getByRole('button', { name: 'Close camera' }).click(); }
  else assert.equal(await p.locator('video').count(), 0);
  await c.close(); console.log(`PASS delayed camera acquisition after ${cancel ? 'cancel' : 'retry'} stops old stream`);
 }
 // Hold a real private response until a displayed image is dismissed or the component unmounts.
 await context.addCookies([{ name: 'fixture', value: cookie('supervisor'), url: 'http://127.0.0.1:4189' }]);
 for (const unmount of [false, true]) {
  const p = await context.newPage(); await p.goto('http://127.0.0.1:4189/?lang=en'); await p.getByRole('button', { name: 'View photo' }).first().click(); await p.getByAltText('Private attendance photo').waitFor();
  let release, arrived; const ready = new Promise(resolve => { arrived = resolve; }); await p.route('**/api/attendance?resource=evidence**', async route => { const response = await route.fetch(); arrived(); await new Promise(resolve => { release = resolve; }); await route.fulfill({ response }); });
  const before = await p.evaluate(() => ({ created: window.__attendanceResources.created.length, consumed: window.__consumed.blob })); await p.getByRole('button', { name: 'View photo' }).last().click(); await ready;
  if (unmount) await p.evaluate(() => window.unmountAttendanceFixture()); else await p.getByRole('button', { name: 'Close photo' }).click();
  release(); await p.waitForFunction(n => window.__consumed.blob > n, before.consumed); assert.equal(await p.getByAltText('Private attendance photo').count(), 0);
  await p.waitForFunction(() => window.__attendanceResources.created.every(url => window.__attendanceResources.revoked.filter(value => value === url).length === 1)); assert.equal(await p.evaluate(() => window.__attendanceResources.created.length), before.created);
  await p.close(); console.log(`PASS delayed private evidence after ${unmount ? 'unmount' : 'dismissal'} allocates no stale URL`);
 }
 await context.addCookies([{ name: 'fixture', value: cookie('staff'), url: 'http://127.0.0.1:4189' }]);
 const uploadPage = await context.newPage(); let releaseUpload; let uploadArrived; const arrived = new Promise(resolve => { uploadArrived = resolve; }); let recordsAfterUnmount = 0;
 await uploadPage.route('**/api/attendance**', async route => {
  const request = route.request();
  if (request.method() === 'POST' && request.url().includes('resource=evidence')) { const response = await route.fetch(); uploadArrived(); await new Promise(resolve => { releaseUpload = resolve; }); await route.fulfill({ response }); }
  else { if (request.method() === 'POST' && !request.url().includes('resource=')) recordsAfterUnmount++; await route.continue(); }
 });
 await uploadPage.goto('http://127.0.0.1:4189/?lang=en'); await uploadPage.getByRole('button', { name: 'Get location' }).click(); await uploadPage.getByText('Accuracy:').waitFor();
 await uploadPage.getByRole('button', { name: 'Open camera' }).click(); await uploadPage.getByRole('button', { name: 'Take photo' }).click(); await uploadPage.getByRole('button', { name: /Submit check-(in|out)/ }).click();
 await arrived; await uploadPage.evaluate(() => window.unmountAttendanceFixture()); releaseUpload();
 await uploadPage.waitForResponse(response => response.url().includes('resource=evidence') && response.request().method() === 'POST');
 await uploadPage.waitForFunction(() => window.__consumed.upload === 1);
 assert.equal(recordsAfterUnmount, 0); assert.equal(await uploadPage.evaluate(() => sessionStorage.getItem('attendance-pending:canonical-outlet')), null); await uploadPage.close();
 console.log('PASS late real upload after unmount cannot dispatch a record');
 // A record committed by the real handler remains recoverable if its response is held across unmount.
 const dispatched = await context.newPage(); let releaseRecord, recordArrived; const recordReady = new Promise(resolve => { recordArrived = resolve; }); let recordCount = 0;
 await dispatched.route('**/api/attendance', async route => { if (route.request().method() === 'POST' && route.request().postDataJSON()?.action === 'record') { recordCount++; const response = await route.fetch(); assert.equal(response.status(), 200); recordArrived(); await new Promise(resolve => { releaseRecord = resolve; }); await route.fulfill({ response }); } else await route.continue(); });
 await dispatched.goto('http://127.0.0.1:4189/?lang=en'); await dispatched.getByRole('button', { name: 'Get location' }).click(); await dispatched.getByText('Accuracy:').waitFor(); await dispatched.getByRole('button', { name: 'Open camera' }).click(); await dispatched.getByRole('button', { name: 'Take photo' }).click(); await dispatched.getByRole('button', { name: /Submit check-(in|out)/ }).click(); await recordReady;
 const pendingRecord = await dispatched.evaluate(() => sessionStorage.getItem('attendance-pending:canonical-outlet')); assert.ok(pendingRecord);
 await dispatched.evaluate(() => { window.unmountAttendanceFixture(); window.remountAttendanceFixture(); }); await dispatched.getByRole('button', { name: 'Recover previous attempt' }).click(); await dispatched.getByText('Attendance saved.').waitFor();
 assert.equal(await dispatched.evaluate(() => sessionStorage.getItem('attendance-pending:canonical-outlet')), null); assert.equal(recordCount, 1);
 assert.equal(await dispatched.evaluate(async () => (await (await fetch('/api/attendance?resource=history&outletId=canonical-outlet')).json()).events.length), 5);
 const confirmations = await dispatched.evaluate(() => window.__consumed.confirmation); const responseDone = dispatched.waitForResponse(response => response.url().endsWith('/api/attendance') && response.request().postDataJSON()?.action === 'record'); releaseRecord(); await responseDone; await dispatched.waitForFunction(n => window.__consumed.confirmation > n, confirmations);
 assert.equal(await dispatched.evaluate(() => sessionStorage.getItem('attendance-pending:canonical-outlet')), null); assert.equal(recordCount, 1); assert.equal(await dispatched.evaluate(async () => (await (await fetch('/api/attendance?resource=history&outletId=canonical-outlet')).json()).events.length), 5);
 await dispatched.close(); console.log('PASS dispatched record survives unmount and remount reconciles real committed status without duplicate');
 const cleanup = await context.newPage(); await cleanup.goto('http://127.0.0.1:4189/?lang=en');
 await cleanup.getByRole('button', { name: 'Open camera' }).click(); await cleanup.getByRole('button', { name: 'Take photo' }).click();
 await cleanup.getByAltText('Attendance photo preview').waitFor();
 await cleanup.getByRole('button', { name: 'Retake photo' }).click(); await cleanup.getByRole('button', { name: 'Take photo' }).waitFor();
 await cleanup.evaluate(() => window.unmountAttendanceFixture());
 await cleanup.waitForFunction(() => window.__attendanceResources.tracks.every(track => track.readyState === 'ended') && window.__attendanceResources.created.every(url => window.__attendanceResources.revoked.includes(url)));
 await cleanup.close(); console.log('PASS unmount stops tracks and revokes photo URLs');
 console.log('PASS unavailable and unreadable cameras in English and Indonesian');
 console.log('PASS disabled capability, missing mapping, and denied camera/location');
} finally { await browser.close(); }
