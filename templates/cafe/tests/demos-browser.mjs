#!/usr/bin/env node
/**
 * Static showcase checks against Cloudflare Pages or the nine public demo hosts.
 *
 * PLAYWRIGHT_BROWSERS_PATH=/tmp/cafe-browsers node --experimental-strip-types tests/demos-browser.mjs
 * CAFE_DEMO_BASE_DOMAIN=tampiloka.site node --experimental-strip-types tests/demos-browser.mjs
 *
 * Each preset gets an isolated browser context. All snapshot reads use the
 * installed in-page fetch facade. Real network mutations are blocked, and the
 * full UI workflow requires runtime.localOnly === true before every write.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { DEMOS } from '../demos/manifest.ts';

const baseUrl = new URL(process.env.CAFE_DEMO_BASE_URL || 'http://127.0.0.1:4174');
assert.ok(['http:', 'https:'].includes(baseUrl.protocol), 'CAFE_DEMO_BASE_URL must use HTTP or HTTPS.');
const baseDomain = process.env.CAFE_DEMO_BASE_DOMAIN?.trim();
if (baseDomain) assert.match(baseDomain, /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i, 'CAFE_DEMO_BASE_DOMAIN must be a hostname without a protocol or path.');
const selectedIds = process.env.CAFE_DEMO_PRESETS?.split(',').map(value => value.trim()).filter(Boolean);
if (selectedIds) for (const id of selectedIds) assert.ok(DEMOS.some(demo => demo.id === id), `Unknown demo preset: ${id}`);
const demos = selectedIds ? DEMOS.filter(demo => selectedIds.includes(demo.id)) : DEMOS;
assert.ok(demos.length, 'Select at least one demo preset.');
const out = resolve(process.env.CAFE_DEMO_OUTPUT || fileURLToPath(new URL('../test-results/demos/', import.meta.url)));
const bootTimeout = Number(process.env.CAFE_DEMO_TIMEOUT_MS || 120000);
assert.ok(Number.isFinite(bootTimeout) && bootTimeout > 0, 'CAFE_DEMO_TIMEOUT_MS must be positive.');
const actionTimeout = 30000;
const startedAt = new Date().toISOString();
const runId = Date.now().toString(36);
const results = [];
const checks = [];
await mkdir(out, { recursive: true });

function demoUrl(demo, path = '/') {
  if (baseDomain) return new URL(path, `https://${demo.subdomain}.${baseDomain}`).href;
  const root = baseUrl.href.replace(/\/$/, '');
  return `${root}/p/${demo.id}${path.startsWith('/') ? path : `/${path}`}`;
}

function tableUrl(demo, qrToken, billToken) {
  const url = new URL(`/t/dapur-pagi/${demo.subdomain}/m/${encodeURIComponent(qrToken)}`, demoUrl(demo));
  if (billToken) url.searchParams.set('bill', billToken);
  return url.href;
}

function pass(name, detail = {}) {
  checks.push({ name, ...detail });
  console.log(`PASS ${name}`);
}

async function ready(page) {
  await page.waitForFunction(() => {
    const reset = document.querySelector('button[aria-label="Ulangi demo"]');
    return (reset && !reset.disabled) || document.querySelector('.demo-loading[role="alert"]');
  }, null, { timeout: bootTimeout });
  const error = page.locator('.demo-loading[role="alert"]');
  if (await error.count()) throw new Error(`Demo initialization failed: ${await error.innerText()}`);
  await page.evaluate(() => document.fonts.ready);
  assert.match(await page.title(), /demo/i, 'The page title should identify the showcase.');
}

async function open(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: bootTimeout });
  assert.ok(response?.ok(), `${url} returned HTTP ${response?.status()}.`);
  await ready(page);
}

async function localSnapshot(page, label = 'snapshot') {
  // Do not replace this with Node fetch: the demo API intentionally exists only
  // inside the browser after its local adapter has been installed.
  const response = await page.evaluate(async timeout => {
    const request = await fetch('/api/v1/snapshot?surface=staff', {
      cache: 'no-store', signal: AbortSignal.timeout(timeout),
    });
    const text = await request.text();
    let body;
    try { body = JSON.parse(text); } catch { throw new Error(`Local API returned non-JSON (${request.status}): ${text.slice(0, 180)}`); }
    return { status: request.status, body };
  }, actionTimeout);
  assert.equal(response.status, 200, `${label}: ${JSON.stringify(response.body.error || response.body).slice(0, 800)}`);
  const snapshot = response.body.data;
  assert.equal(snapshot?.runtime?.localOnly, true, `${label}: refusing mutations without runtime.localOnly === true.`);
  assert.equal(snapshot.runtime.demo, true, `${label}: refusing mutations outside an explicit demo.`);
  return snapshot;
}

async function localClick(page, locator, label) {
  await localSnapshot(page, label);
  await locator.click();
}

async function pollSnapshot(page, predicate, label) {
  const deadline = Date.now() + actionTimeout;
  while (Date.now() < deadline) {
    const snapshot = await localSnapshot(page, label);
    const value = predicate(snapshot);
    if (value) return { snapshot, value };
    await page.waitForTimeout(400);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function assertPresence(locator, expected, description) {
  assert.equal(await locator.count() > 0, expected, description);
}

async function checkGeometry(page, preset, surface, screenshotName) {
  await page.waitForFunction(() => [...document.images].every(image => {
    const rect = image.getBoundingClientRect();
    const style = getComputedStyle(image);
    const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth && style.visibility !== 'hidden' && style.display !== 'none';
    return !visible || image.complete;
  }), null, { timeout: 15000 });
  const geometry = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    brokenVisibleImages: [...document.images].filter(image => {
      const rect = image.getBoundingClientRect();
      const style = getComputedStyle(image);
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth && style.visibility !== 'hidden' && style.display !== 'none' && (!image.complete || image.naturalWidth === 0);
    }).map(image => image.currentSrc || image.src),
  }));
  assert.ok(geometry.scrollWidth <= geometry.width + 1, `${preset} ${surface} overflows: ${geometry.scrollWidth}px at ${geometry.width}px.`);
  assert.deepEqual(geometry.brokenVisibleImages, [], `${preset} ${surface} has broken visible images.`);
  await page.screenshot({ path: join(out, screenshotName), fullPage: false });
  return { surface, ...geometry, screenshot: screenshotName };
}

async function checkCustomer(page, demo) {
  const modules = new Set(demo.modules);
  await page.getByPlaceholder('Cari menu', { exact: true }).waitFor();
  const nav = page.getByRole('navigation', { name: 'Navigasi pelanggan', exact: true });
  await nav.waitFor();
  await assertPresence(nav.getByRole('button', { name: 'Keranjang', exact: true }), modules.has('ordering'), `${demo.id}: cart follows ordering capability.`);
  await assertPresence(nav.getByRole('button', { name: 'Pesanan', exact: true }), modules.has('ordering'), `${demo.id}: orders follow ordering capability.`);
  await assertPresence(nav.getByRole('button', { name: 'Panggil pelayan', exact: true }), modules.has('tables'), `${demo.id}: waiter controls follow table service.`);
  await assertPresence(page.getByRole('button', { name: /^Tambah / }), modules.has('ordering'), `${demo.id}: add-to-cart controls follow ordering capability.`);
  await assertPresence(page.locator('.demo-toolbar').getByRole('link', { name: 'Staf', exact: true }), demo.staffPath !== undefined, `${demo.id}: staff route is only offered when enabled.`);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), demo.theme, `${demo.id}: manifest theme is applied.`);
  const geometry = await checkGeometry(page, demo.id, 'customer', `${demo.id}-customer-390.png`);

  await page.getByRole('button', { name: 'Menu profil, pesanan, dan layanan meja', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Lainnya', exact: true });
  await drawer.waitFor();
  await assertPresence(drawer.getByRole('button', { name: /^Member(?:\s|$)/ }), modules.has('loyalty') || modules.has('marketing'), `${demo.id}: membership controls follow enabled modules.`);
  await assertPresence(drawer.getByRole('button', { name: /^Antrean meja(?:\s|$)/ }), modules.has('tables'), `${demo.id}: waitlist is absent when table service is off.`);
  await assertPresence(drawer.getByRole('button', { name: /^Pembayaran(?:\s|$)/ }), modules.has('ordering'), `${demo.id}: payment/receipt access requires an order flow.`);
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
  if (!modules.has('payments')) {
    assert.equal(await page.getByRole('button', { name: /^(Buat QRIS|Buat Virtual Account)$/ }).count(), 0, `${demo.id}: no online-payment creation control.`);
  }
  pass(`${demo.id}: customer modules and mobile layout`, { preset: demo.id, ...geometry });
  return geometry;
}

async function signInStaff(page) {
  if (await page.getByRole('heading', { name: 'Ruang operasional', exact: true }).count()) {
    await page.getByRole('button', { name: /Raka Pratama/ }).click();
  }
  await page.getByRole('navigation', { name: 'Navigasi operasional kafe', exact: true }).waitFor();
}

async function checkStaff(page, demo) {
  await signInStaff(page);
  const modules = new Set(demo.modules);
  const nav = page.getByRole('navigation', { name: 'Navigasi operasional kafe', exact: true });
  const expectedSections = [
    [/^Kasir & Pesanan/, modules.has('cashier')],
    [/^Pesanan masuk/, modules.has('ordering') && !modules.has('cashier')],
    [/^Dapur & Bar/, modules.has('kitchen')],
    [/^Meja & Antrean/, modules.has('tables')],
    [/^Katalog & Stok/, modules.has('catalog') || modules.has('cashier')],
    [/^Laporan & Shift/, modules.has('dashboard')],
  ];
  for (const [name, enabled] of expectedSections) {
    await assertPresence(nav.getByRole('button', { name }), enabled, `${demo.id}: ${name} capability navigation.`);
  }
  await assertPresence(page.getByRole('button', { name: /^Pesanan baru$/i }), modules.has('cashier'), `${demo.id}: POS creation is only available to cashier packages.`);
  await assertPresence(page.getByRole('region', { name: 'Shift kasir', exact: true }), modules.has('cashier'), `${demo.id}: cash shift controls are available without requiring reports.`);
  await assertPresence(page.locator('.demo-toolbar').getByRole('link', { name: 'Pelanggan', exact: true }), modules.has('catalog'), `${demo.id}: no customer link in staff-only packages.`);
  if (!modules.has('payments')) {
    assert.equal(await page.getByRole('button', { name: /^(QRIS demo|VA demo|Simulasikan lunas)$/ }).count(), 0, `${demo.id}: online payment controls are disabled.`);
  }
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), demo.theme, `${demo.id}: staff theme follows the manifest.`);
  const geometry = await checkGeometry(page, demo.id, 'staff', `${demo.id}-staff-1024.png`);
  pass(`${demo.id}: staff modules and tablet layout`, { preset: demo.id, ...geometry });
  return geometry;
}

async function fullWorkflow(context, customer, staff, demo, baseline) {
  const customerName = `Showcase ${runId}`;
  const posName = `POS ${runId}`;
  const table = baseline.tables.find(entry => entry.id === 'tbl_m06' && entry.active) || baseline.tables.find(entry => entry.active && entry.physicalState !== 'OUT_OF_SERVICE');
  const tea = baseline.catalog.find(entry => entry.id === 'item_teh_melati' && entry.isAvailable);
  const pastry = baseline.catalog.find(entry => entry.id === 'item_croissant' && entry.isAvailable);
  assert.ok(table?.qrToken && tea && pastry, 'The full showcase needs its available sample table, tea, and pastry.');
  const qrUrl = tableUrl(demo, table.qrToken);
  await open(customer, qrUrl);
  await localSnapshot(customer, 'before customer cart changes');
  await customer.getByRole('button', { name: `Tambah ${tea.name}`, exact: true }).click();
  await customer.getByRole('dialog').getByRole('button', { name: 'Tambah ke keranjang', exact: true }).click();
  await customer.getByRole('navigation', { name: 'Navigasi pelanggan', exact: true }).getByRole('button', { name: 'Keranjang', exact: true }).click();
  await customer.getByText(tea.name, { exact: true }).first().waitFor();
  await customer.reload({ waitUntil: 'domcontentloaded' });
  await ready(customer);
  await customer.getByRole('navigation', { name: 'Navigasi pelanggan', exact: true }).getByRole('button', { name: 'Keranjang', exact: true }).click();
  await customer.getByText(tea.name, { exact: true }).first().waitFor();
  await customer.locator('#guest-name-input').fill(customerName);
  assert.equal(await customer.getByText('Verifikasi meja', { exact: true }).count(), 0, 'The table QR route should retain its table context after reload.');
  pass('full: customer cart persists after reload', { preset: demo.id });

  await localClick(customer, customer.getByRole('button', { name: /Periksa pesanan ·/ }), 'before customer price review');
  await localClick(customer, customer.getByRole('dialog').getByRole('button', { name: 'Kirim pesanan', exact: true }), 'before customer submission');
  await customer.getByRole('dialog').waitFor({ state: 'hidden' });
  const submitted = await pollSnapshot(customer, snapshot => snapshot.orderRequests.find(entry => entry.customerName === customerName), 'customer order request');
  assert.equal(submitted.value.state, 'REQUESTED', 'The seeded full demo should allow explicit staff acceptance.');

  // Both pages deliberately share this context and origin; no Node-side API call
  // or direct service command creates/accepts the order for the UI.
  assert.equal(customer.context(), context);
  assert.equal(staff.context(), context);
  assert.equal(new URL(customer.url()).origin, new URL(staff.url()).origin);
  await staff.getByRole('button', { name: 'Perbarui data operasional', exact: true }).click();
  const incoming = staff.locator('#incoming-orders .divide-y > div').filter({ hasText: customerName });
  await incoming.waitFor();
  await localClick(staff, incoming.getByRole('button', { name: 'Terima', exact: true }), 'before staff acceptance');
  await incoming.waitFor({ state: 'hidden' });
  const accepted = await pollSnapshot(staff, snapshot => snapshot.orders.find(entry => entry.customerName === customerName), 'accepted customer order');
  const order = accepted.value;
  const bill = accepted.snapshot.bills.find(entry => entry.allocatedUnits.some(unit => unit.orderId === order.id));
  assert.ok(bill?.id, 'Staff acceptance must create the customer bill.');
  pass('full: customer UI order appears and is accepted in a second staff tab', { preset: demo.id, orderId: order.id, billId: bill.id });

  await customer.getByRole('button', { name: 'Perbarui', exact: true }).click();
  await customer.getByRole('button', { name: 'Menu profil, pesanan, dan layanan meja', exact: true }).click();
  await customer.getByRole('dialog').getByRole('button', { name: /^Pembayaran(?:\s|$)/ }).click();
  await customer.getByLabel('Pilih tagihan meja', { exact: true }).selectOption(bill.id);
  await localClick(customer, customer.getByRole('button', { name: 'Buat QRIS', exact: true }), 'before demo QR creation');
  await customer.getByAltText('Kode QR demo, tidak dapat dibayar', { exact: true }).waitFor();
  const pending = await pollSnapshot(customer, snapshot => snapshot.bills.find(entry => entry.id === bill.id)?.attempts.find(attempt => attempt.status === 'PENDING'), 'pending demo QR payment');
  assert.ok(pending.value.id);
  await checkGeometry(customer, demo.id, 'demo payment', 'full-payment-390.png');
  await staff.getByRole('button', { name: 'Perbarui data operasional', exact: true }).click();
  const simulation = staff.getByRole('region', { name: 'Simulasi pembayaran', exact: true }).locator('.divide-y > div').filter({ hasText: customerName });
  await simulation.waitFor();
  await localClick(staff, simulation.getByRole('button', { name: 'Simulasikan lunas', exact: true }), 'before simulated settlement');
  const settled = await pollSnapshot(staff, snapshot => {
    const current = snapshot.bills.find(entry => entry.id === bill.id);
    return current?.paymentState === 'SETTLED' && current;
  }, 'simulated payment settlement');
  assert.equal(settled.value.balanceIdr, 0);
  assert.equal(settled.value.receipts.length, 1, 'The new bill has one simulated receipt.');
  pass('full: nonpayable customer QR is settled through the staff demo control', { preset: demo.id, billId: bill.id });

  await staff.getByRole('button', { name: /^Pesanan baru$/i }).first().click();
  const pos = staff.getByRole('dialog');
  await pos.locator('#pos-name').fill(posName);
  for (const item of [tea, pastry]) {
    await pos.getByRole('button', { name: new RegExp(item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    await pos.getByRole('button', { name: 'Tambah', exact: true }).click();
  }
  await pos.locator('#pos-discount').fill('5000');
  await localClick(staff, pos.getByRole('button', { name: 'Periksa pesanan', exact: true }), 'before POS price review');
  await pos.getByText('Pesanan siap dibuat', { exact: true }).waitFor();
  await staff.screenshot({ path: join(out, 'full-pos-review-1024.png'), fullPage: false });
  await localClick(staff, pos.getByRole('button', { name: /^Buat tagihan/ }), 'before POS order creation');
  await pos.waitFor({ state: 'hidden' });
  const sale = await pollSnapshot(staff, snapshot => snapshot.orders.find(entry => entry.customerName === posName), 'POS sale');
  const posBill = sale.snapshot.bills.find(entry => entry.allocatedUnits.some(unit => unit.orderId === sale.value.id));
  assert.equal(posBill?.discountIdr, 5000, 'The UI discount must persist on the bill.');
  assert.equal(posBill.allocatedUnits.length, 2, 'Both POS line items must persist.');
  pass('full: two-line POS order retains its Rp5,000 discount', { preset: demo.id, billId: posBill.id, totalIdr: posBill.originalTotalIdr });

  await staff.reload({ waitUntil: 'domcontentloaded' });
  await ready(staff);
  await signInStaff(staff);
  const afterReload = await localSnapshot(staff, 'reload persistence');
  assert.equal(afterReload.bills.find(entry => entry.id === bill.id)?.paymentState, 'SETTLED');
  assert.equal(afterReload.bills.find(entry => entry.id === posBill.id)?.discountIdr, 5000);
  await staff.locator('input[placeholder*="Cari meja atau pelanggan"]').fill(posName);
  await staff.getByText(posName, { exact: false }).first().waitFor();
  await open(customer, tableUrl(demo, table.qrToken, bill.shareToken));
  await customer.getByRole('heading', { name: 'Pembayaran', exact: true }).waitFor();
  assert.equal(await customer.getByLabel('Pilih tagihan meja', { exact: true }).inputValue(), bill.id);
  await customer.getByText('Lunas', { exact: true }).first().waitFor();
  pass('full: staff reload and customer bill link preserve the sale and settlement', { preset: demo.id });

  await localSnapshot(staff, 'before toolbar reset');
  staff.once('dialog', dialog => dialog.accept());
  await Promise.all([
    staff.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: bootTimeout }),
    staff.getByRole('button', { name: 'Ulangi demo', exact: true }).click(),
  ]);
  await ready(staff);
  const reset = await localSnapshot(staff, 'after toolbar reset');
  assert.equal(reset.orders.some(entry => [customerName, posName].includes(entry.customerName)), false, 'Reset removes both test orders.');
  assert.equal(reset.bills.some(entry => [bill.id, posBill.id].includes(entry.id)), false, 'Reset removes both test bills.');
  assert.equal(reset.orders.length, baseline.orders.length, 'Reset restores the seeded order count.');
  await open(customer, qrUrl);
  await customer.getByRole('navigation', { name: 'Navigasi pelanggan', exact: true }).getByRole('button', { name: 'Keranjang', exact: true }).click();
  await customer.getByText('Keranjang masih kosong', { exact: true }).waitFor();
  pass('full: toolbar reset restores sample data and clears the customer cart', { preset: demo.id });
}

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
  ...(process.env.CAFE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CAFE_CHROMIUM_EXECUTABLE } : {}),
});

try {
  for (const demo of demos) {
    const result = { id: demo.id, url: demoUrl(demo), theme: demo.theme, modules: demo.modules, status: 'running', views: [], pageErrors: [], consoleErrors: [], blockedNetworkMutations: [] };
    const started = Date.now();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    context.setDefaultTimeout(actionTimeout);
    await context.route('**/*', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        result.blockedNetworkMutations.push({ method: route.request().method(), url: route.request().url() });
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    context.on('page', page => {
      page.on('pageerror', error => result.pageErrors.push({ url: page.url(), message: error.message }));
      page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push({ url: page.url(), message: message.text() }); });
    });
    try {
      const hasCustomer = demo.customerPath !== undefined;
      const hasStaff = demo.staffPath !== undefined;
      const first = await context.newPage();
      if (!hasCustomer) await first.setViewportSize({ width: 1024, height: 768 });
      await open(first, demoUrl(demo));
      let baseline;
      if (demo.modules.some(module => module !== 'catalog')) {
        baseline = await localSnapshot(first, `${demo.id} local runtime guard`);
        result.runtime = baseline.runtime;
        assert.ok(baseline.catalog.length > 0, `${demo.id}: sample menu is seeded.`);
        pass(`${demo.id}: in-browser API is explicitly local-only`, { preset: demo.id });
      }
      if (hasCustomer) result.views.push(await checkCustomer(first, demo));
      let staff;
      if (hasStaff) {
        staff = hasCustomer ? await context.newPage() : first;
        await staff.setViewportSize({ width: 1024, height: 768 });
        if (hasCustomer) await open(staff, demoUrl(demo, '/staff'));
        await localSnapshot(staff, `${demo.id} staff runtime guard`);
        result.views.push(await checkStaff(staff, demo));
      }
      if (demo.id === 'full') await fullWorkflow(context, first, staff, demo, baseline);
      assert.deepEqual(result.pageErrors, [], `${demo.id}: browser page errors.`);
      assert.deepEqual(result.blockedNetworkMutations, [], `${demo.id}: the local facade must not attempt a network write.`);
      result.status = 'passed';
      pass(`${demo.id}: no page errors or network mutations`, { preset: demo.id });
    } catch (error) {
      result.status = 'failed';
      result.error = error.stack || String(error);
      for (const [index, page] of context.pages().entries()) {
        await page.screenshot({ path: join(out, `${demo.id}-failure-${index}.png`), fullPage: true }).catch(() => {});
        await writeFile(join(out, `${demo.id}-failure-${index}.txt`), await page.locator('body').innerText().catch(() => 'Page text unavailable.'));
      }
      console.error(`FAIL ${demo.id}: ${error.message}`);
    } finally {
      result.durationMs = Date.now() - started;
      results.push(result);
      await context.close();
      await writeFile(join(out, 'demos-browser.json'), JSON.stringify({ status: 'running', startedAt, baseUrl: baseUrl.href, baseDomain: baseDomain || null, allPresets: demos.length === DEMOS.length, checks, presets: results }, null, 2));
    }
  }
} finally {
  await browser.close();
}

const failures = results.filter(result => result.status !== 'passed');
await writeFile(join(out, 'demos-browser.json'), JSON.stringify({
  status: failures.length ? 'failed' : 'passed', startedAt, finishedAt: new Date().toISOString(),
  baseUrl: baseUrl.href, baseDomain: baseDomain || null, allPresets: demos.length === DEMOS.length,
  checks, presets: results,
}, null, 2));
console.log(`${results.length - failures.length}/${results.length} demo presets passed; ${checks.length} checks recorded in ${out}.`);
if (failures.length) process.exitCode = 1;
