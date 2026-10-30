#!/usr/bin/env node
/**
 * Executable customer/staff visit acceptance tests for the static public demos.
 *
 * PLAYWRIGHT_BROWSERS_PATH=/tmp/cafe-browsers npm run test:demo-lifecycle
 * CAFE_DEMO_BASE_DOMAIN=tampiloka.site npm run test:demo-lifecycle
 *
 * UI journeys use the same browser profile in a mobile customer tab and a tablet
 * staff tab. Each case gets a separate profile. Fixture loading is only allowed
 * after verifying that the runtime is an isolated IndexedDB demo. Network writes
 * are blocked, including when this suite runs against the public demo domains.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { DEMOS } from '../demos/manifest.ts';
import { DEMO_SCENARIOS } from '../src/demo-runtime/scenario-catalog.ts';
import { LIFECYCLE_FIXTURES as F, LIFECYCLE_CASES } from './demos-lifecycle-fixtures.mjs';

const baseUrl = new URL(process.env.CAFE_DEMO_BASE_URL || 'http://127.0.0.1:4174');
const baseDomain = process.env.CAFE_DEMO_BASE_DOMAIN?.trim();
assert.ok(['http:', 'https:'].includes(baseUrl.protocol));
if (baseDomain) assert.match(baseDomain, /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i);
const out = resolve(process.env.CAFE_LIFECYCLE_OUTPUT || fileURLToPath(new URL('../test-results/lifecycle/', import.meta.url)));
const timeout = Number(process.env.CAFE_DEMO_TIMEOUT_MS || 120000);
const selectedCases = process.env.CAFE_LIFECYCLE_CASES?.split(',').map(value => value.trim()).filter(Boolean);
const results = [];
const checks = [];
const entryAssets = new Set();
const startedAt = new Date().toISOString();
await mkdir(out, { recursive: true });

function urlFor(preset = 'full', path = '/') {
  const demo = DEMOS.find(entry => entry.id === preset);
  assert.ok(demo, `Unknown preset ${preset}`);
  return baseDomain
    ? new URL(path, `https://${demo.subdomain}.${baseDomain}`).href
    : `${baseUrl.href.replace(/\/$/, '')}/p/${demo.id}${path.startsWith('/') ? path : `/${path}`}`;
}
function qrUrl(table, preset = 'full', billToken) {
  const demo = DEMOS.find(entry => entry.id === preset);
  const url = new URL(`/t/dapur-pagi/${demo.subdomain}/m/${encodeURIComponent(table.qrToken)}`, urlFor(preset));
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
  }, null, { timeout });
  const error = page.locator('.demo-loading[role="alert"]');
  if (await error.count()) throw new Error(`Demo failed to initialize: ${await error.innerText()}`);
  await page.evaluate(() => document.fonts.ready);
  const entry = await page.evaluate(() => {
    const script = document.querySelector('script[type="module"][src]');
    return script ? new URL(script.src).pathname : null;
  });
  assert.ok(entry, 'The tested demo must expose its built application entry.');
  entryAssets.add(entry);
  assert.equal(entryAssets.size, 1, 'Application bundle changed during the test run. Rebuild and rerun against one frozen deployment.');
}
async function open(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  assert.ok(response?.ok(), `HTTP ${response?.status()}: ${url}`);
  await ready(page);
}
async function snapshot(page) {
  const response = await page.evaluate(async () => {
    const response = await fetch('/api/v1/snapshot?surface=staff', { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    return { status: response.status, body: await response.json() };
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  const data = response.body.data;
  assert.equal(data?.runtime?.localOnly, true, 'Refusing test writes outside a local-only browser demo.');
  assert.equal(data.runtime.demo, true);
  return data;
}
async function command(page, command, payload) {
  await snapshot(page);
  const response = await page.evaluate(async ({ command, payload }) => {
    const response = await fetch('/api/v1/snapshot', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, payload, surface: 'staff' }), signal: AbortSignal.timeout(30000),
    });
    return { status: response.status, body: await response.json() };
  }, { command, payload });
  assert.equal(response.status, 200, `${command}: ${JSON.stringify(response.body)}`);
  return response.body.data;
}
async function poll(page, predicate, label) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const data = await snapshot(page);
    const value = predicate(data);
    if (value) return { snapshot: data, value };
    await page.waitForTimeout(150);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function staffLogin(page) {
  if (await page.getByRole('heading', { name: 'Ruang operasional', exact: true }).count()) {
    await page.getByRole('button', { name: /Raka Pratama/ }).click();
  }
  await page.getByRole('navigation', { name: 'Navigasi operasional kafe' }).waitFor();
}
async function refreshStaff(page) {
  await page.getByRole('button', { name: 'Perbarui data operasional', exact: true }).click();
  await page.getByRole('button', { name: 'Perbarui data operasional', exact: true }).waitFor();
}
async function section(page, name) {
  await page.getByRole('navigation', { name: 'Navigasi operasional kafe', exact: true }).getByRole('button', { name }).click();
}
async function geometry(page, label) {
  const measure = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    broken: [...document.images].filter(image => {
      const r = image.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 && image.complete && image.naturalWidth === 0;
    }).map(image => image.currentSrc || image.src),
  }));
  assert.ok(measure.scrollWidth <= measure.width + 1, `${label} overflows (${measure.scrollWidth}px at ${measure.width}px).`);
  assert.deepEqual(measure.broken, [], `${label} has broken visible images.`);
  await page.screenshot({ path: join(out, `${label}.png`), fullPage: false });
  return measure;
}
async function setupPages(context, preset = 'full') {
  const staff = await context.newPage();
  await staff.setViewportSize({ width: 1024, height: 768 });
  await open(staff, urlFor(preset, '/staff'));
  await staffLogin(staff);
  const baseline = await snapshot(staff);
  const customer = await context.newPage();
  await customer.setViewportSize({ width: 390, height: 844 });
  return { staff, customer, baseline };
}
async function setPolicy(staff, policy) {
  await section(staff, /^Pengaturan/);
  await staff.getByLabel('Pembayaran makan di tempat', { exact: true }).selectOption(policy);
  await staff.getByLabel('Pembayaran bawa pulang', { exact: true }).selectOption(policy);
  await staff.getByLabel('Terima otomatis pesanan tambahan tamu aktif', { exact: true }).uncheck();
  await staff.getByRole('button', { name: 'Simpan alur pemesanan', exact: true }).click();
  await poll(staff, data => data.outlet.paymentPolicy === policy && data.outlet.takeawayPaymentPolicy === policy && !data.outlet.autoAcceptParticipant, 'saved ordering policy');
  await section(staff, /^Kasir & Pesanan/);
}
async function seat(staff, fixture) {
  await section(staff, /^Meja & Antrean/);
  await staff.getByRole('button', { name: 'Tempatkan tamu', exact: true }).click();
  const dialog = staff.getByRole('dialog', { name: 'Tempatkan tamu', exact: true });
  await dialog.getByLabel('Nama tamu', { exact: true }).fill(fixture.name);
  await dialog.getByLabel('Jumlah tamu', { exact: true }).fill(String(fixture.partySize || 2));
  await dialog.getByLabel('Meja untuk tamu', { exact: true }).selectOption(fixture.tableId);
  await dialog.getByRole('button', { name: 'Mulai kunjungan', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const seated = await poll(staff, data => data.visits.find(visit => visit.customerName === fixture.name && visit.status === 'OPEN'), 'seated guest');
  assert.equal(seated.value.primaryTableId, fixture.tableId);
  assert.equal(seated.snapshot.tables.find(table => table.id === fixture.tableId)?.physicalState, 'OCCUPIED');
  assert.equal(seated.snapshot.orders.filter(order => order.visitId === seated.value.id).length, 0, 'A seated visit exists before the first order.');
  return seated.value;
}
async function orderFromCustomer(customer, staff, fixture, itemId, expectedOrderCount = 1) {
  const before = await snapshot(customer);
  await customer.getByRole('navigation', { name: 'Navigasi pelanggan', exact: true }).getByRole('button', { name: 'Menu', exact: true }).click();
  for (const id of Array.isArray(itemId) ? itemId : [itemId]) {
    const item = before.catalog.find(entry => entry.id === id);
    assert.ok(item?.isAvailable, `${id} must be orderable in the fixture.`);
    await customer.getByRole('button', { name: `Tambah ${item.name}`, exact: true }).click();
    await customer.getByRole('dialog').getByRole('button', { name: 'Tambah ke keranjang', exact: true }).click();
  }
  await customer.getByRole('navigation', { name: 'Navigasi pelanggan', exact: true }).getByRole('button', { name: 'Keranjang', exact: true }).click();
  await customer.locator('#guest-name-input').fill(fixture.name);
  await customer.getByRole('button', { name: /Periksa pesanan ·/ }).click();
  await customer.getByRole('dialog').getByRole('button', { name: 'Kirim pesanan', exact: true }).click();
  await customer.getByRole('dialog').waitFor({ state: 'hidden' });
  const requested = await poll(customer, data => data.orderRequests.find(request => request.customerName === fixture.name && request.state === 'REQUESTED'), 'pending customer request');
  await refreshStaff(staff);
  const count = requested.snapshot.orders.filter(order => order.customerName === fixture.name).length;
  assert.equal(count, expectedOrderCount - 1, 'Submitting creates one request without silently accepting it.');
  return requested.value;
}
async function accept(staff, customerName, requestId) {
  await section(staff, /^Kasir & Pesanan|^Pesanan masuk/);
  await refreshStaff(staff);
  const row = staff.locator('#incoming-orders .divide-y > div').filter({ hasText: customerName });
  await row.getByRole('button', { name: 'Terima', exact: true }).click();
  const accepted = await poll(staff, data => data.orderRequests.find(request => request.id === requestId && request.state === 'ACCEPTED'), 'accepted request');
  const order = accepted.snapshot.orders.find(order => order.id === accepted.value.acceptedOrderId);
  assert.ok(order);
  const bill = accepted.snapshot.bills.find(bill => bill.lifecycle !== 'VOID' && bill.allocatedUnits.some(unit => unit.orderId === order.id));
  assert.ok(bill);
  return { order, bill, snapshot: accepted.snapshot };
}
async function customerOrders(customer) {
  await customer.getByRole('navigation', { name: 'Navigasi pelanggan', exact: true }).getByRole('button', { name: 'Pesanan', exact: true }).click();
  await customer.getByRole('button', { name: 'Perbarui', exact: true }).click();
}
async function orderPaymentLabel(customer, orderId, label) {
  await customerOrders(customer);
  const article = customer.locator(`[data-order-id="${orderId}"]`);
  await article.getByText(new RegExp(`^${label}$`, 'i')).waitFor();
  return article;
}
async function customerPayment(customer, billId) {
  await customerOrders(customer);
  await customer.getByRole('button', { name: 'Lihat tagihan dan pembayaran', exact: true }).click();
  await customer.getByLabel('Pilih tagihan meja', { exact: true }).selectOption(billId);
}
async function createQr(customer, billId) {
  await customerPayment(customer, billId);
  await customer.getByRole('button', { name: 'Buat QRIS', exact: true }).click();
  await customer.getByAltText('Kode QR demo, tidak dapat dibayar', { exact: true }).waitFor();
  const pending = await poll(customer, data => data.bills.find(bill => bill.id === billId)?.attempts.find(attempt => attempt.status === 'PENDING'), 'pending QR');
  return pending.value;
}
async function simulateQr(staff, customerName, attemptId, action) {
  await section(staff, /^Kasir & Pesanan|^Pesanan masuk/);
  await refreshStaff(staff);
  const row = staff.getByRole('region', { name: 'Simulasi pembayaran', exact: true }).locator('.divide-y > div').filter({ hasText: customerName });
  await row.getByRole('button', { name: action === 'CANCEL' ? 'Batalkan' : action === 'EXPIRE' ? 'Kedaluwarsa' : 'Simulasikan lunas', exact: true }).click();
  await poll(staff, data => data.bills.some(bill => bill.attempts.some(attempt => attempt.id === attemptId && !['CREATING', 'PENDING', 'UNKNOWN'].includes(attempt.status))), `QR ${action}`);
}
async function ensureCashShift(staff) {
  const data = await snapshot(staff);
  if (data.cashShifts.some(shift => shift.state === 'OPEN')) return;
  const region = staff.getByRole('region', { name: 'Shift kasir', exact: true });
  await region.getByRole('button', { name: 'Buka shift', exact: true }).click();
  await region.getByLabel('Modal awal laci (Rp)', { exact: true }).fill('500000');
  await region.getByRole('button', { name: 'Buka shift kasir', exact: true }).click();
  await poll(staff, data => data.cashShifts.some(shift => shift.state === 'OPEN'), 'cash shift open');
}
async function selectBill(staff, billId, name, paid = false) {
  await section(staff, /^Kasir & Pesanan/);
  await refreshStaff(staff);
  await staff.getByLabel('Cari tagihan berdasarkan meja atau pelanggan', { exact: true }).fill(name);
  await staff.getByRole('group', { name: 'Filter pembayaran tagihan', exact: true }).getByRole('button', { name: paid ? 'Semua' : 'Belum lunas', exact: true }).click();
  await staff.locator(`button[data-bill-id="${billId}"]`).click();
}
async function cash(staff, billId, customerName, amount, tender = amount) {
  await selectBill(staff, billId, customerName);
  await ensureCashShift(staff);
  await staff.getByRole('group', { name: 'Metode pembayaran kasir', exact: true }).getByRole('button', { name: 'Tunai', exact: true }).click();
  await staff.getByLabel('Jumlah bayar (Rp)', { exact: true }).fill('0');
  await staff.getByLabel('Tunai diterima (Rp)', { exact: true }).fill(String(tender));
  assert.equal(await staff.getByRole('button', { name: /^Terima tunai/ }).isEnabled(), false, 'An explicit Rp0 must not fall back to charging the entire bill.');
  await staff.getByLabel('Jumlah bayar (Rp)', { exact: true }).fill(String(amount));
  await staff.getByLabel('Tunai diterima (Rp)', { exact: true }).fill(String(tender));
  const before = await snapshot(staff);
  const receipts = before.bills.find(bill => bill.id === billId).receipts.length;
  await staff.getByRole('button', { name: /^Terima tunai/ }).click();
  const paid = await poll(staff, data => {
    const bill = data.bills.find(entry => entry.id === billId);
    return bill.receipts.length === receipts + 1 && bill;
  }, 'cash receipt');
  const receipt = paid.value.receipts.find(receipt => !before.bills.find(bill => bill.id === billId).receipts.some(old => old.id === receipt.id));
  assert.equal(receipt.amountIdr, amount);
  assert.equal(receipt.changeIdr, tender - amount);
  return paid.value;
}
async function kitchen(staff, orderId, terminal = 'DELIVERED') {
  await section(staff, /^Dapur & Bar/);
  await refreshStaff(staff);
  const units = (await snapshot(staff)).orderUnits.filter(unit => unit.orderId === orderId);
  assert.ok(units.length);
  for (const unit of units) {
    const card = staff.locator(`[data-unit-id="${unit.id}"]`);
    for (const [status, label] of [['PREPARING', 'Mulai siapkan'], ['READY', 'Siap diantar'], [terminal, terminal === 'PICKED_UP' ? 'Sudah diambil' : 'Disajikan']]) {
      await card.getByRole('button', { name: label, exact: true }).click();
      await poll(staff, data => data.orderUnits.find(current => current.id === unit.id)?.fulfillmentStatus === status, `${unit.id} ${status}`);
    }
  }
}
async function departureReview(staff, visit, expectedAllowed) {
  const floorNav = staff.getByRole('navigation', { name: 'Navigasi operasional kafe', exact: true }).getByRole('button', { name: /^Meja & Antrean/ });
  if (await floorNav.count()) {
    await floorNav.click();
    await staff.getByRole('group', { name: 'Sub-menu operasional lantai', exact: true }).getByRole('button', { name: 'Denah & Kunjungan Meja', exact: true }).click();
  }
  else await section(staff, /^Kasir & Pesanan|^Pesanan masuk/);
  await refreshStaff(staff);
  const card = staff.getByRole('article', { name: `Kunjungan ${visit.customerName}`, exact: true });
  await card.getByRole('button', { name: visit.mode === 'TAKEAWAY' ? 'Selesaikan pengambilan' : 'Tinjau kepulangan', exact: true }).click();
  const dialog = staff.getByRole('dialog', { name: 'Selesaikan kunjungan', exact: true });
  const confirm = dialog.getByRole('button', { name: visit.mode === 'TAKEAWAY' ? 'Konfirmasi pengambilan selesai' : 'Konfirmasi tamu pulang', exact: true });
  assert.equal(await confirm.isEnabled(), expectedAllowed, 'Departure eligibility shown by the UI matches the scenario.');
  return { dialog, confirm };
}
async function assertBlocked(staff, visit, expectedField) {
  const data = await snapshot(staff);
  const current = data.visits.find(entry => entry.id === visit.id);
  assert.equal(current.lifecycleSummary.canDepart, false);
  if (expectedField) assert.ok(current.lifecycleSummary[expectedField] > 0, `${expectedField} must block departure.`);
  const { dialog } = await departureReview(staff, visit, false);
  await geometry(staff, `blocked-${expectedField || 'departure'}-1024`);
  await staff.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
}
async function closeAndClean(staff, visit, table) {
  const { dialog, confirm } = await departureReview(staff, visit, true);
  await confirm.click();
  await dialog.waitFor({ state: 'hidden' });
  const closed = await poll(staff, data => data.visits.find(entry => entry.id === visit.id)?.status === 'CLOSED' && data, 'closed visit');
  if (!table) return closed.value;
  assert.equal(closed.value.tables.find(entry => entry.id === table.id).physicalState, 'NEEDS_CLEANING');
  assert.ok(closed.value.visits.find(entry => entry.id === visit.id).departedAt);
  await staff.getByRole('button', { name: new RegExp(`^Meja ${table.label} ·`) }).click();
  await staff.getByRole('button', { name: 'Tandai Bersih & Siap Pakai', exact: true }).click();
  await poll(staff, data => data.tables.find(entry => entry.id === table.id)?.physicalState === 'AVAILABLE', 'clean available table');
  return closed.value;
}

async function prepayJourney(context) {
  const { staff, customer, baseline } = await setupPages(context);
  const fixture = F.prepay;
  await setPolicy(staff, fixture.policy);
  const visit = await seat(staff, fixture);
  const table = baseline.tables.find(table => table.id === fixture.tableId);
  await open(customer, qrUrl(table));
  const request = await orderFromCustomer(customer, staff, fixture, fixture.itemId);
  await assertBlocked(staff, visit, 'pendingRequestCount');
  const first = await accept(staff, fixture.name, request.id);
  assert.equal(first.order.visitId, visit.id);
  assert.ok(first.snapshot.orderUnits.filter(unit => unit.orderId === first.order.id).every(unit => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT'));
  await assertBlocked(staff, visit, 'outstandingBalanceIdr');
  await orderPaymentLabel(customer, first.order.id, 'Belum Dibayar');
  const cancelledQr = await createQr(customer, first.bill.id);
  await assertBlocked(staff, visit, 'pendingPaymentCount');
  await simulateQr(staff, fixture.name, cancelledQr.id, 'CANCEL');
  assert.equal((await snapshot(staff)).bills.find(bill => bill.id === first.bill.id).receipts.length, 0);
  const qr = await createQr(customer, first.bill.id);
  await simulateQr(staff, fixture.name, qr.id, 'SETTLE');
  const paidFirst = (await snapshot(staff)).bills.find(bill => bill.id === first.bill.id);
  assert.equal(paidFirst.balanceIdr, 0);
  assert.equal(paidFirst.receipts.length, 1);
  await orderPaymentLabel(customer, first.order.id, 'Lunas');
  await assertBlocked(staff, visit, 'unfinishedUnitCount');
  await kitchen(staff, first.order.id);
  const addonRequest = await orderFromCustomer(customer, staff, fixture, fixture.addonId, 2);
  const addon = await accept(staff, fixture.name, addonRequest.id);
  assert.equal(addon.order.visitId, visit.id, 'Additional order belongs to the original visit.');
  assert.notEqual(addon.bill.id, first.bill.id);
  await orderPaymentLabel(customer, first.order.id, 'Lunas');
  const addonArticle = await orderPaymentLabel(customer, addon.order.id, 'Belum Dibayar');
  assert.equal(await addonArticle.getByText('Lunas', { exact: true }).count(), 0, 'The earlier paid bill cannot mark an additional unpaid order as paid.');
  await geometry(customer, 'addon-payment-status-390');
  const partial = await cash(staff, addon.bill.id, fixture.name, fixture.partialPaymentIdr, fixture.partialTenderIdr);
  assert.equal(partial.paymentState, 'PARTIALLY_PAID');
  await orderPaymentLabel(customer, addon.order.id, 'Dibayar Sebagian');
  await assertBlocked(staff, visit, 'outstandingBalanceIdr');
  const settled = await cash(staff, addon.bill.id, fixture.name, partial.balanceIdr);
  assert.equal(settled.paymentState, 'SETTLED');
  assert.equal(settled.receipts.length, 2);
  await kitchen(staff, addon.order.id);
  const beforeDeparture = await snapshot(staff);
  assert.equal(beforeDeparture.visits.find(entry => entry.id === visit.id).status, 'OPEN', 'Serving and payment do not silently end the visit.');
  assert.equal(beforeDeparture.tables.find(entry => entry.id === table.id).physicalState, 'OCCUPIED');
  await closeAndClean(staff, visit, table);
  await customer.reload({ waitUntil: 'domcontentloaded' });
  await ready(customer);
  await geometry(customer, 'completed-visit-customer-390');
  await geometry(staff, 'completed-visit-staff-1024');
  pass('prepay: actual UI seating → order → cancelled QR → paid QR → kitchen → add-on → partial cash → delivered → departure → clean', { visitId: visit.id, bills: [first.bill.id, addon.bill.id] });
}

async function payLaterJourney(context) {
  const { staff, customer, baseline } = await setupPages(context);
  const fixture = F.payLater;
  await setPolicy(staff, fixture.policy);
  const visit = await seat(staff, fixture);
  const table = baseline.tables.find(table => table.id === fixture.tableId);
  await open(customer, qrUrl(table));
  const request = await orderFromCustomer(customer, staff, fixture, fixture.itemId);
  const sale = await accept(staff, fixture.name, request.id);
  assert.ok(sale.snapshot.orderUnits.filter(unit => unit.orderId === sale.order.id).every(unit => unit.fulfillmentStatus === 'QUEUED'));
  assert.equal(sale.bill.receipts.length, 0);
  await kitchen(staff, sale.order.id);
  await assertBlocked(staff, visit, 'outstandingBalanceIdr');
  await cash(staff, sale.bill.id, fixture.name, sale.bill.balanceIdr, 50000);
  await orderPaymentLabel(customer, sale.order.id, 'Lunas');
  await customer.getByRole('navigation', { name: 'Navigasi pelanggan', exact: true }).getByRole('button', { name: 'Panggil pelayan', exact: true }).click();
  await customer.getByRole('button', { name: 'Alat makan', exact: true }).click();
  await customer.getByLabel('Catatan tambahan (opsional)', { exact: true }).fill('Dua sendok untuk uji layanan meja.');
  await customer.getByRole('button', { name: 'Kirim permintaan', exact: true }).click();
  const service = await poll(staff, data => data.serviceRequests.find(request => request.visitId === visit.id && request.state === 'OPEN'), 'customer service request');
  await assertBlocked(staff, visit, 'unresolvedServiceCount');
  await staff.getByRole('group', { name: 'Sub-menu operasional lantai', exact: true }).getByRole('button', { name: /^Panggilan & Antrean/ }).click();
  const serviceRow = staff.locator(`[data-service-request-id="${service.value.id}"]`);
  await serviceRow.getByText('Alat makan', { exact: true }).waitFor();
  await serviceRow.getByRole('button', { name: 'Tangani', exact: true }).click();
  await poll(staff, data => data.serviceRequests.find(request => request.id === service.value.id)?.state === 'ACKNOWLEDGED', 'staff acknowledged table service');
  await serviceRow.getByRole('button', { name: 'Selesai', exact: true }).click();
  await poll(staff, data => data.serviceRequests.find(request => request.id === service.value.id)?.state === 'RESOLVED', 'resolved table service');
  await closeAndClean(staff, visit, table);
  pass('pay-later: kitchen serves an unpaid order; departure waits for cash settlement and customer service resolution', { visitId: visit.id });
}

async function posSale(staff, fixture) {
  const data = await snapshot(staff);
  await section(staff, /^Kasir & Pesanan/);
  await staff.getByRole('button', { name: /^Pesanan baru$/i }).first().click();
  const dialog = staff.getByRole('dialog', { name: 'Pesanan baru', exact: true });
  await dialog.locator('#pos-name').fill(fixture.name);
  for (const id of fixture.itemIds) {
    const item = data.catalog.find(entry => entry.id === id);
    await dialog.getByRole('button', { name: new RegExp(item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    await dialog.getByRole('button', { name: 'Tambah', exact: true }).click();
  }
  await dialog.locator('#pos-discount').fill(String(fixture.discountIdr));
  await dialog.getByRole('button', { name: 'Periksa pesanan', exact: true }).click();
  await dialog.getByRole('button', { name: /^Buat tagihan/ }).click();
  await dialog.waitFor({ state: 'hidden' });
  const sale = await poll(staff, data => data.orders.find(order => order.customerName === fixture.name), 'POS order');
  const bill = sale.snapshot.bills.find(bill => bill.allocatedUnits.some(unit => unit.orderId === sale.value.id));
  const visit = sale.snapshot.visits.find(visit => visit.id === sale.value.visitId);
  assert.equal(bill.discountIdr, fixture.discountIdr);
  return { order: sale.value, bill, visit };
}
async function takeawayJourney(context) {
  const { staff } = await setupPages(context);
  await setPolicy(staff, F.takeaway.policy);
  const sale = await posSale(staff, F.takeaway);
  assert.equal(sale.visit.mode, 'TAKEAWAY');
  assert.equal(sale.visit.primaryTableId, null);
  await cash(staff, sale.bill.id, F.takeaway.name, sale.bill.balanceIdr, 100000);
  await assertBlocked(staff, sale.visit, 'unfinishedUnitCount');
  await kitchen(staff, sale.order.id, 'PICKED_UP');
  await closeAndClean(staff, sale.visit);
  pass('takeaway: discounted POS order → cash → kitchen → pickup → explicit visit completion', { visitId: sale.visit.id });
}
async function rejectionJourney(context) {
  const { staff, customer, baseline } = await setupPages(context);
  const fixture = F.rejected;
  await setPolicy(staff, 'PREPAY');
  const visit = await seat(staff, fixture);
  const table = baseline.tables.find(table => table.id === fixture.tableId);
  await open(customer, qrUrl(table));
  const request = await orderFromCustomer(customer, staff, fixture, fixture.itemId);
  await section(staff, /^Kasir & Pesanan/);
  await refreshStaff(staff);
  const row = staff.locator('#incoming-orders .divide-y > div').filter({ hasText: fixture.name });
  await row.getByRole('button', { name: 'Tolak', exact: true }).click();
  const rejection = staff.getByRole('dialog', { name: 'Tolak pesanan', exact: true });
  await rejection.getByLabel('Alasan penolakan', { exact: true }).fill('Pilihan menu perlu diganti sesuai permintaan pelanggan.');
  await rejection.getByRole('button', { name: 'Konfirmasi penolakan', exact: true }).click();
  await rejection.waitFor({ state: 'hidden' });
  await poll(staff, data => data.orderRequests.find(entry => entry.id === request.id)?.state === 'REJECTED', 'rejected request');
  await customerOrders(customer);
  await customer.getByText('Pesanan dibatalkan', { exact: true }).waitFor();
  const data = await snapshot(staff);
  assert.equal(data.orders.filter(order => order.visitId === visit.id).length, 0);
  assert.equal(data.bills.filter(bill => bill.visitId === visit.id).length, 0);
  await closeAndClean(staff, visit, table);
  pass('rejection: declined customer request creates no order or debt and no longer blocks the visit');
}

async function cancellationRefundJourney(context) {
  const { staff } = await setupPages(context);
  await setPolicy(staff, 'PREPAY');
  const fixture = { name: 'Nadia Uji Refund', itemIds: ['item_teh_melati'], discountIdr: 0 };
  const sale = await posSale(staff, fixture);
  const unit = sale.bill.allocatedUnits[0];
  const partial = await cash(staff, sale.bill.id, fixture.name, 10000, 20000);
  await cash(staff, sale.bill.id, fixture.name, partial.balanceIdr);
  const before = await snapshot(staff);
  const beforeBill = before.bills.find(bill => bill.id === sale.bill.id);
  const beforeShift = before.cashShifts.find(shift => shift.state === 'OPEN');
  assert.equal(beforeBill.receipts.length, 2);
  assert.ok(beforeBill.receipts.every(receipt => receipt.amountIdr < beforeBill.originalTotalIdr), 'Fixture requires refunding across more than one receipt.');
  await selectBill(staff, sale.bill.id, fixture.name, true);
  await staff.locator(`[data-unit-id="${unit.id}"]`).getByRole('button', { name: 'Batalkan', exact: true }).click();
  const dialog = staff.getByRole('dialog', { name: 'Batalkan item', exact: true });
  await dialog.getByLabel('Alasan Pembatalan', { exact: true }).fill(F.cancellationReason);
  await dialog.getByLabel('Stok', { exact: true }).selectOption('RESTOCK');
  await dialog.getByRole('button', { name: 'Batalkan item', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const cancelled = await poll(staff, data => data.orderUnits.find(entry => entry.id === unit.id)?.fulfillmentStatus === 'CANCELLED' && data, 'cancelled paid item');
  const bill = cancelled.value.bills.find(entry => entry.id === sale.bill.id);
  assert.equal(bill.balanceIdr, 0);
  assert.equal(bill.refundedIdr, bill.verifiedReceiptsIdr);
  assert.equal(bill.refunds.filter(refund => refund.state === 'SUCCEEDED').reduce((sum, refund) => sum + refund.amountIdr, 0), beforeBill.originalTotalIdr);
  assert.equal(bill.receipts.reduce((sum, receipt) => sum + receipt.refundedFromReceiptIdr, 0), beforeBill.originalTotalIdr);
  assert.equal(cancelled.value.cashShifts.find(shift => shift.id === beforeShift.id).expectedCashIdr, beforeShift.expectedCashIdr - beforeBill.originalTotalIdr);
  assert.equal(await staff.locator(`[data-unit-id="${unit.id}"]`).getByRole('button', { name: 'Batalkan', exact: true }).count(), 0, 'A cancelled item cannot be refunded a second time through the UI.');
  await closeAndClean(staff, sale.visit);
  pass('refund: one item paid in two cash receipts is cancelled and fully refunded once, with cash ledger reconciliation', { billId: bill.id });
}

async function deferredRefundJourney(context) {
  const { staff } = await setupPages(context);
  await setPolicy(staff, 'PREPAY');
  const fixture = { name: 'Mira Uji Refund Tertunda', itemIds: ['item_teh_melati'], discountIdr: 0 };
  const sale = await posSale(staff, fixture);
  const unit = sale.bill.allocatedUnits[0];
  await cash(staff, sale.bill.id, fixture.name, sale.bill.balanceIdr);
  await selectBill(staff, sale.bill.id, fixture.name, true);
  await staff.locator(`[data-unit-id="${unit.id}"]`).getByRole('button', { name: 'Batalkan', exact: true }).click();
  const dialog = staff.getByRole('dialog', { name: 'Batalkan item', exact: true });
  await dialog.getByLabel('Alasan Pembatalan', { exact: true }).fill(F.cancellationReason);
  await dialog.getByRole('checkbox', { name: 'Kembalikan kelebihan pembayaran sekarang', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Batalkan item', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await poll(staff, data => data.orderUnits.find(unit => unit.id === sale.bill.allocatedUnits[0].id)?.fulfillmentStatus === 'CANCELLED', 'deferred refund cancellation');
  await assertBlocked(staff, sale.visit, 'refundDueIdr');
  await selectBill(staff, sale.bill.id, fixture.name, true);
  await staff.locator(`[data-unit-id="${unit.id}"]`).getByRole('button', { name: 'Selesaikan pengembalian', exact: true }).click();
  const refund = staff.getByRole('dialog', { name: 'Selesaikan pengembalian', exact: true });
  await refund.getByLabel('Alasan pengembalian', { exact: true }).fill('Pengembalian tunai diserahkan kepada pelanggan.');
  await refund.getByRole('button', { name: 'Catat pengembalian', exact: true }).click();
  await refund.waitFor({ state: 'hidden' });
  const resolved = await poll(staff, data => {
    const bill = data.bills.find(bill => bill.id === sale.bill.id);
    return bill.refundedIdr === bill.verifiedReceiptsIdr && bill.balanceIdr === 0 && bill;
  }, 'resolved deferred refund');
  assert.equal(resolved.value.adjustments.filter(adjustment => adjustment.category === 'UNIT_CANCELLED').length, 1, 'Completing the deferred refund cannot add another item credit.');
  await closeAndClean(staff, sale.visit);
  pass('deferred refund: cancellation leaves a visible obligation and blocks departure until the refund is recorded');
}

async function splitMergeJourney(context) {
  const { staff, customer, baseline } = await setupPages(context);
  const fixture = { name: 'Ayu Uji Pisah Gabung', tableId: 'tbl_m06', partySize: 2 };
  await setPolicy(staff, 'PAY_LATER');
  const visit = await seat(staff, fixture);
  const table = baseline.tables.find(table => table.id === fixture.tableId);
  await open(customer, qrUrl(table));
  const request = await orderFromCustomer(customer, staff, fixture, ['item_teh_melati', 'item_croissant']);
  const sale = await accept(staff, fixture.name, request.id);
  const originalTotal = sale.bill.originalTotalIdr;
  await selectBill(staff, sale.bill.id, fixture.name);
  await staff.getByRole('button', { name: 'Pisah / Gabung Tagihan', exact: true }).click();
  await staff.locator(`[data-unit-id="${sale.bill.allocatedUnits[0].id}"]`).getByRole('checkbox').check();
  await staff.getByPlaceholder('Nama tagihan baru', { exact: true }).fill(`Split ${fixture.name}`);
  await staff.getByRole('button', { name: 'Pisahkan', exact: true }).click();
  const split = await poll(staff, data => {
    const bills = data.bills.filter(bill => bill.visitId === visit.id && bill.lifecycle !== 'VOID');
    return bills.length === 2 && bills;
  }, 'two split bills');
  const child = split.value.find(bill => bill.id !== sale.bill.id);
  assert.equal(split.value.reduce((sum, bill) => sum + bill.originalTotalIdr, 0), originalTotal);
  assert.equal(new Set(split.value.flatMap(bill => bill.allocatedUnits.map(unit => unit.id))).size, 2);
  await orderPaymentLabel(customer, sale.order.id, 'Belum Dibayar');
  await selectBill(staff, child.id, fixture.name);
  const toggle = staff.getByRole('button', { name: 'Pisah / Gabung Tagihan', exact: true });
  if (await toggle.count()) await toggle.click();
  await staff.getByLabel('Tagihan tujuan penggabungan', { exact: true }).selectOption(sale.bill.id);
  await staff.getByRole('button', { name: 'Gabung', exact: true }).click();
  const merged = await poll(staff, data => {
    const bill = data.bills.find(bill => bill.id === sale.bill.id);
    return bill.allocatedUnits.length === 2 && data.bills.find(bill => bill.id === child.id)?.lifecycle === 'VOID' && bill;
  }, 'merged original bill');
  assert.equal(merged.value.originalTotalIdr, originalTotal);
  await cash(staff, sale.bill.id, fixture.name, merged.value.balanceIdr);
  await orderPaymentLabel(customer, sale.order.id, 'Lunas');
  await kitchen(staff, sale.order.id);
  await closeAndClean(staff, visit, table);
  pass('split/merge: unit ownership, charge totals and customer payment status remain correct through split, merge and settlement');
}

// Scenario-backed exception and financial cases are defined below. Their setup
// uses the same public, local-only scenario loader offered in the demo toolbar.
async function loadScenario(staff, scenarioId) {
  const loaded = await command(staff, 'LOAD_DEMO_SCENARIO', { scenarioId });
  await refreshStaff(staff);
  return loaded;
}
async function exceptionJourney(context) {
  const { staff } = await setupPages(context);
  const fixture = await loadScenario(staff, 'paylater-served');
  const data = await snapshot(staff);
  const visit = data.visits.find(entry => entry.id === fixture.result.visitId);
  const bill = data.bills.find(entry => entry.id === fixture.result.billId);
  assert.equal(bill.balanceIdr, 41580);
  const { dialog } = await departureReview(staff, visit, false);
  await dialog.getByRole('button', { name: 'Catat kepulangan dengan masalah', exact: true }).click();
  const confirm = dialog.getByRole('button', { name: 'Catat kepulangan bermasalah', exact: true });
  assert.equal(await confirm.isEnabled(), false, 'A manager exception requires a meaningful reason.');
  await dialog.getByLabel('Alasan kepulangan dengan masalah', { exact: true }).fill('Pergi');
  assert.equal(await confirm.isEnabled(), false);
  await dialog.getByLabel('Alasan kepulangan dengan masalah', { exact: true }).fill(F.exceptionReason);
  assert.equal(await confirm.isEnabled(), true);
  await confirm.click();
  await dialog.waitFor({ state: 'hidden' });
  const departed = await poll(staff, data => data.visits.find(entry => entry.id === visit.id)?.status === 'CLOSED' && data, 'exception departure');
  const afterVisit = departed.value.visits.find(entry => entry.id === visit.id);
  const afterBill = departed.value.bills.find(entry => entry.id === bill.id);
  assert.equal(afterVisit.financialIssueNote, F.exceptionReason);
  assert.equal(afterBill.balanceIdr, 41580, 'An exception closes the physical visit without erasing debt.');
  assert.equal(afterBill.receipts.length, 0);
  assert.equal(departed.value.tables.find(entry => entry.id === visit.primaryTableId).physicalState, 'NEEDS_CLEANING');
  await staff.getByRole('region', { name: 'Tindak lanjut kunjungan', exact: true }).getByText(F.exceptionReason, { exact: true }).waitFor();
  pass('manager exception: short reasons blocked, departure recorded, unpaid debt retained and shown for follow-up');
}

async function externalCounterJourney(context, preset = 'order-at-cashier') {
  const { staff, customer, baseline } = await setupPages(context, preset);
  const fixture = { name: 'Tono Uji Kasir Eksternal', tableId: 'tbl_m06' };
  const table = baseline.tables.find(table => table.id === fixture.tableId);
  await open(customer, qrUrl(table, preset));
  const request = await orderFromCustomer(customer, staff, fixture, 'item_teh_melati');
  const sale = await accept(staff, fixture.name, request.id);
  const visit = sale.snapshot.visits.find(visit => visit.id === sale.order.visitId);
  assert.ok(sale.bill.balanceIdr > 0);
  await orderPaymentLabel(customer, sale.order.id, 'Belum Dibayar');
  await staff.locator(`[data-order-id="${sale.order.id}"]`).getByRole('button', { name: 'Tandai selesai', exact: true }).click();
  await poll(staff, data => data.orderUnits.filter(unit => unit.orderId === sale.order.id).every(unit => unit.fulfillmentStatus === 'DELIVERED'), 'simple order fulfillment');
  await assertBlocked(staff, visit, 'outstandingBalanceIdr');
  const counter = staff.getByRole('region', { name: 'Pembayaran kasir eksternal', exact: true });
  await counter.locator(`[data-bill-id="${sale.bill.id}"]`).getByRole('button', { name: 'Konfirmasi pembayaran kasir', exact: true }).click();
  const dialog = staff.getByRole('dialog', { name: 'Konfirmasi pembayaran kasir', exact: true });
  const confirm = dialog.getByRole('button', { name: 'Catat pembayaran kasir', exact: true });
  assert.equal(await confirm.isEnabled(), false);
  await dialog.getByLabel('Referensi pembayaran kasir', { exact: true }).fill('EXT-TEST-0042');
  assert.equal(await confirm.isEnabled(), false, 'A reference alone is insufficient without cashier verification.');
  await dialog.getByRole('checkbox', { name: 'Pembayaran sudah diterima dan diverifikasi oleh kasir.', exact: true }).check();
  await confirm.click();
  await dialog.waitFor({ state: 'hidden' });
  const paid = await poll(staff, data => {
    const bill = data.bills.find(bill => bill.id === sale.bill.id);
    return bill.paymentState === 'SETTLED' && bill;
  }, 'external register settlement');
  assert.equal(paid.value.receipts.length, 1);
  assert.equal(paid.value.receipts[0].method, 'EXTERNAL_COUNTER');
  assert.equal(paid.value.receipts[0].referenceCode, 'EXT-TEST-0042');
  await orderPaymentLabel(customer, sale.order.id, 'Lunas');
  await closeAndClean(staff, visit);
  const completed = await snapshot(staff);
  assert.equal(completed.cashShifts.length, 0, 'A separate register confirmation does not fabricate a POS drawer.');
  assert.equal(completed.tables.find(entry => entry.id === table.id).physicalState, 'AVAILABLE', 'A package without floor controls must release the table for the next visit.');
  await geometry(customer, 'external-counter-customer-390');
  await geometry(staff, 'external-counter-staff-1024');
  pass(`${preset}: actual UI order → waiter inbox → fulfillment → offline receipt → completed visit`);
}

async function openCustomerWaitlist(customer) {
  await customer.getByRole('button', { name: 'Menu profil, pesanan, dan layanan meja', exact: true }).click();
  await customer.getByRole('dialog', { name: 'Lainnya', exact: true }).getByRole('button', { name: /^Antrean meja(?:\s|$)/ }).click();
  await customer.getByRole('heading', { name: 'Antrean meja', exact: true }).waitFor();
}
async function waitlistJourney(context) {
  const { staff, customer } = await setupPages(context);
  await loadScenario(staff, 'empty');
  const table = (await snapshot(staff)).tables.find(table => table.id === 'tbl_m06');
  const name = 'Lina Uji Antrean';
  await open(customer, urlFor('full'));
  await openCustomerWaitlist(customer);
  await customer.getByLabel('Nama tamu', { exact: true }).fill(name);
  await customer.getByLabel('Jumlah orang', { exact: true }).fill('2');
  await customer.getByRole('button', { name: 'Ambil antrean', exact: true }).click();
  const joined = await poll(staff, data => data.waitlistEntries.find(entry => entry.customerName === name), 'customer waitlist entry');
  const customerTicket = customer.locator(`[data-waitlist-id="${joined.value.id}"]`);
  await customerTicket.getByText('Menunggu', { exact: true }).waitFor();
  await section(staff, /^Meja & Antrean/);
  await refreshStaff(staff);
  const floorTabs = staff.getByRole('group', { name: 'Sub-menu operasional lantai', exact: true });
  await floorTabs.getByRole('button', { name: /^Panggilan & Antrean/ }).click();
  const staffTicket = staff.locator(`[data-waitlist-id="${joined.value.id}"]`);
  await staffTicket.getByLabel(`Meja untuk ${name}`, { exact: true }).selectOption(table.id);
  await staffTicket.getByRole('button', { name: 'Panggil tamu', exact: true }).click();
  await poll(staff, data => data.waitlistEntries.find(entry => entry.id === joined.value.id)?.status === 'CALLED', 'staff calls waiting guest');
  await customer.getByRole('button', { name: 'Perbarui antrean', exact: true }).click();
  await customerTicket.getByText('Dipanggil', { exact: true }).waitFor();
  await floorTabs.getByRole('button', { name: 'Denah & Kunjungan Meja', exact: true }).click();
  await staff.getByRole('button', { name: 'Tempatkan tamu', exact: true }).click();
  const seating = staff.getByRole('dialog', { name: 'Tempatkan tamu', exact: true });
  assert.equal(await seating.getByLabel('Meja untuk tamu', { exact: true }).locator(`option[value="${table.id}"]`).count(), 0, 'A held waitlist table is unavailable to a different walk-in guest.');
  await seating.getByRole('button', { name: 'Kembali', exact: true }).click();
  await floorTabs.getByRole('button', { name: /^Panggilan & Antrean/ }).click();
  await staffTicket.getByRole('button', { name: 'Tempatkan di meja', exact: true }).click();
  const seated = await poll(staff, data => data.visits.find(visit => visit.customerName === name && visit.status === 'OPEN'), 'waitlisted guest seated');
  assert.equal(seated.value.primaryTableId, table.id);
  await customer.getByRole('button', { name: 'Perbarui antrean', exact: true }).click();
  await customerTicket.getByText('Sudah Duduk', { exact: true }).waitFor();
  await customer.reload({ waitUntil: 'domcontentloaded' });
  await ready(customer);
  await openCustomerWaitlist(customer);
  await customer.locator(`[data-waitlist-id="${joined.value.id}"]`).getByText('Sudah Duduk', { exact: true }).waitFor();
  await geometry(customer, 'waitlist-own-ticket-390');
  await closeAndClean(staff, seated.value, table);
  await customer.getByRole('button', { name: 'Perbarui antrean', exact: true }).click();
  await customer.locator(`[data-waitlist-id="${joined.value.id}"]`).getByText('Kunjungan selesai', { exact: true }).waitFor();
  pass('waitlist: customer joins → staff holds and calls table → own ticket refreshes and survives reload → staff seats → visit completes');
}

function assertScenarioState(scenarioId, data) {
  const table = data.tables.find(table => table.id === 'tbl_m06');
  const activeBills = data.bills.filter(bill => bill.lifecycle !== 'VOID');
  const totalBalance = activeBills.reduce((sum, bill) => sum + bill.balanceIdr, 0);
  const visit = data.visits[0];
  if (scenarioId === 'empty') {
    assert.equal(data.orders.length, 0); assert.equal(data.visits.length, 0); assert.equal(data.bills.length, 0);
    return;
  }
  if (scenarioId === 'waitlist') {
    assert.equal(data.waitlistEntries.filter(entry => entry.status === 'CALLED').length, 1);
    assert.equal(data.waitlistEntries.filter(entry => entry.status === 'WAITING').length, 1);
    assert.equal(data.waitlistEntries.find(entry => entry.status === 'CALLED').heldTableId, table.id);
    return;
  }
  assert.ok(visit, `${scenarioId}: a visit exists.`);
  if (scenarioId === 'walk-in') {
    assert.equal(table.physicalState, 'OCCUPIED'); assert.equal(data.orders.length, 0); assert.equal(activeBills.length, 0);
  } else if (scenarioId === 'pending-request') {
    assert.equal(visit.lifecycleSummary.pendingRequestCount, 1); assert.equal(visit.lifecycleSummary.canDepart, false);
  } else if (scenarioId === 'rejected-request') {
    assert.equal(data.orderRequests[0].state, 'REJECTED'); assert.equal(activeBills.length, 0); assert.equal(visit.lifecycleSummary.canDepart, true);
  } else if (scenarioId === 'prepay-unpaid') {
    assert.equal(totalBalance, 41580); assert.ok(data.orderUnits.every(unit => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT'));
  } else if (scenarioId === 'partial-payment') {
    assert.equal(totalBalance, 31580); assert.equal(activeBills[0].verifiedReceiptsIdr, 10000); assert.equal(activeBills[0].paymentState, 'PARTIALLY_PAID');
    assert.ok(data.orderUnits.every(unit => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT'));
  } else if (scenarioId === 'payment-pending') {
    assert.equal(visit.lifecycleSummary.pendingPaymentCount, 1); assert.equal(activeBills[0].verifiedReceiptsIdr, 0); assert.equal(totalBalance, 41580);
  } else if (scenarioId === 'kitchen-pending') {
    assert.equal(totalBalance, 0); assert.equal(visit.lifecycleSummary.unfinishedUnitCount, 2); assert.equal(visit.lifecycleSummary.canDepart, false);
  } else if (scenarioId === 'paylater-served') {
    assert.equal(totalBalance, 41580); assert.ok(data.orderUnits.every(unit => unit.fulfillmentStatus === 'DELIVERED')); assert.equal(visit.lifecycleSummary.canDepart, false);
  } else if (scenarioId === 'ready-to-depart') {
    assert.equal(totalBalance, 0); assert.equal(visit.lifecycleSummary.canDepart, true); assert.equal(table.physicalState, 'OCCUPIED');
  } else if (scenarioId === 'addon-unpaid') {
    assert.equal(data.visits.length, 1); assert.equal(data.orders.length, 2); assert.equal(activeBills.length, 2); assert.equal(totalBalance, 20790);
    assert.equal(activeBills.filter(bill => bill.paymentState === 'SETTLED').length, 1);
    assert.equal(activeBills.filter(bill => bill.paymentState === 'UNPAID').length, 1);
  } else if (scenarioId === 'dirty-table') {
    assert.equal(visit.status, 'CLOSED'); assert.equal(table.physicalState, 'NEEDS_CLEANING'); assert.equal(totalBalance, 0);
  } else if (scenarioId === 'takeaway-ready') {
    assert.equal(visit.mode, 'TAKEAWAY'); assert.equal(totalBalance, 0); assert.equal(visit.lifecycleSummary.unfinishedUnitCount, 2);
    assert.ok(data.orderUnits.every(unit => unit.fulfillmentStatus === 'READY'));
  }
}
async function scenarioPicker(context) {
  const { staff } = await setupPages(context);
  const picker = staff.getByLabel('Skenario uji', { exact: true });
  await staff.getByText('Data untuk mencoba alur operasional', { exact: true }).click();
  await picker.waitFor();
  const options = await picker.locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
  assert.deepEqual([...options].sort(), DEMO_SCENARIOS.map(scenario => scenario.id).sort(), 'Full demo offers every declared deterministic scenario.');
  for (const scenarioId of options) {
    if (!await picker.isVisible()) await staff.getByText('Data untuk mencoba alur operasional', { exact: true }).click();
    await picker.selectOption(scenarioId);
    await snapshot(staff);
    staff.once('dialog', dialog => dialog.accept());
    await Promise.all([
      staff.waitForNavigation({ waitUntil: 'domcontentloaded', timeout }),
      staff.getByRole('button', { name: 'Muat skenario', exact: true }).click(),
    ]);
    await ready(staff);
    await staffLogin(staff);
    const data = await snapshot(staff);
    assert.ok(data.catalog.length > 0);
    assertScenarioState(scenarioId, data);
    pass(`fixture: ${scenarioId} loads with the expected visit, bill and fulfillment state`);
  }
}

const cases = [
  { id: 'prepay-addon-close', run: prepayJourney },
  { id: 'paylater-close', run: payLaterJourney },
  { id: 'takeaway-close', run: takeawayJourney },
  { id: 'reject-request', run: rejectionJourney },
  { id: 'cancel-refund', run: cancellationRefundJourney },
  { id: 'deferred-refund', run: deferredRefundJourney },
  { id: 'split-merge', run: splitMergeJourney },
  { id: 'exception-departure', run: exceptionJourney },
  { id: 'external-counter', run: externalCounterJourney },
  { id: 'catalog-waiter', run: context => externalCounterJourney(context, 'catalog') },
  { id: 'waitlist-customer-staff', run: waitlistJourney },
  { id: 'scenario-picker', run: scenarioPicker },
];
if (selectedCases) for (const id of selectedCases) assert.ok(cases.some(entry => entry.id === id), `Unknown lifecycle case: ${id}`);
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.CAFE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CAFE_CHROMIUM_EXECUTABLE } : {}) });
try {
  for (const item of cases.filter(entry => !selectedCases || selectedCases.includes(entry.id))) {
    const result = { id: item.id, title: LIFECYCLE_CASES.find(entry => entry.id === item.id)?.title || item.id, status: 'running', pageErrors: [], consoleErrors: [], networkMutations: [] };
    const start = Date.now();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    context.setDefaultTimeout(30000);
    context.on('page', page => {
      page.on('pageerror', error => result.pageErrors.push({ url: page.url(), message: error.message }));
      page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push({ url: page.url(), message: message.text() }); });
    });
    await context.route('**/*', async route => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
        result.networkMutations.push({ method: route.request().method(), url: route.request().url() });
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    try {
      await item.run(context);
      assert.deepEqual(result.pageErrors, [], `${item.id}: page errors`);
      assert.deepEqual(result.consoleErrors, [], `${item.id}: unexpected console errors`);
      assert.deepEqual(result.networkMutations, [], `${item.id}: local workflow attempted a network mutation`);
      result.status = 'passed';
    } catch (error) {
      result.status = 'failed';
      result.error = error.stack || String(error);
      console.error(`FAIL ${item.id}: ${error.message}`);
      for (const [index, page] of context.pages().entries()) {
        await page.screenshot({ path: join(out, `${item.id}-failure-${index}.png`), fullPage: true }).catch(() => {});
        await writeFile(join(out, `${item.id}-failure-${index}.txt`), await page.locator('body').innerText().catch(() => 'Page unavailable.'));
      }
    } finally {
      result.durationMs = Date.now() - start;
      results.push(result);
      await context.close();
      await writeFile(join(out, 'lifecycle-browser.json'), JSON.stringify({ status: 'running', startedAt, baseUrl: baseUrl.href, baseDomain, entryAssets: [...entryAssets], cases: results, checks }, null, 2));
    }
  }
} finally { await browser.close(); }
const failed = results.filter(result => result.status !== 'passed');
await writeFile(join(out, 'lifecycle-browser.json'), JSON.stringify({ status: failed.length ? 'failed' : 'passed', startedAt, finishedAt: new Date().toISOString(), baseUrl: baseUrl.href, baseDomain: baseDomain || null, entryAssets: [...entryAssets], cases: results, checks }, null, 2));
console.log(`${results.length - failed.length}/${results.length} lifecycle cases passed; ${checks.length} checks recorded in ${out}.`);
if (failed.length) process.exitCode = 1;
