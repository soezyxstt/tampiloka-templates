import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.CAFE_TEST_URL || 'http://127.0.0.1:3000';
const config = JSON.parse(await readFile(new URL('../config/cafe.json', import.meta.url), 'utf8'));
const out = process.env.CAFE_TEST_OUTPUT || new URL('../test-results/browser/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.CAFE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CAFE_CHROMIUM_EXECUTABLE } : {}) });
const checks = [];
const errors = [];
const snapshot = async () => (await (await fetch(`${base}/api/v1/snapshot?surface=staff`)).json()).data;
const check = (name, detail = {}) => { checks.push({ name, ...detail }); console.log(`PASS ${name}`); };
const track = page => page.on('pageerror', error => errors.push(error.message));
try {
  const initial = await snapshot();
  assert.equal(initial.runtime.demo, true, 'Browser mutations may only run against an explicit demo.');
  const table = initial.tables.find(entry => entry.id === 'tbl_m06') || initial.tables.find(entry => entry.active);
  const item = initial.catalog.find(entry => entry.id === 'item_teh_melati');
  assert.ok(table && item?.isAvailable);
  const unique = `Browser ${Date.now()}`;
  const customerContext = await browser.newContext({ locale: 'id-ID', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const customer = await customerContext.newPage(); track(customer);
  await customer.goto(`${base}/t/${config.venue.tenantSlug}/${config.venue.outletSlug}/m/${table.qrToken}`, { waitUntil: 'networkidle' });
  assert.equal(await customer.title(), config.brand.name);
  await customer.getByPlaceholder('Cari menu', { exact: true }).fill('tidak-ada-menu-ini');
  await customer.getByText('Menu tidak ditemukan', { exact: true }).waitFor();
  await customer.getByRole('button', { name: 'Reset pencarian', exact: true }).click();
  check('mobile search, empty results and reset');
  await customer.getByRole('button', { name: `Tambah ${item.name}`, exact: true }).click();
  await customer.getByRole('dialog').waitFor();
  await customer.getByRole('button', { name: 'Tambah ke keranjang', exact: true }).click();
  await customer.getByRole('button', { name: 'Keranjang', exact: true }).click();
  await customer.locator('#guest-name-input').fill(unique);
  assert.equal(await customer.getByText('Verifikasi meja', { exact: true }).count(), 0, 'QR entry must not demand GPS again.');
  await customer.screenshot({ path: `${out}/customer-cart.png`, fullPage: true });
  await customer.getByRole('button', { name: /Periksa pesanan ·/ }).click();
  await customer.getByRole('button', { name: 'Kirim pesanan', exact: true }).click();
  await customer.getByRole('dialog').waitFor({ state: 'hidden' });
  let full = await snapshot();
  const request = full.orderRequests.find(entry => entry.customerName === unique);
  assert.ok(request, 'Customer submission persisted.');
  check('QR menu → item → cart → submit without duplicate GPS', { requestId: request.id });
  const staffContext = await browser.newContext({ locale: 'id-ID', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const staff = await staffContext.newPage(); track(staff);
  await staff.goto(`${base}/staff/${config.venue.tenantSlug}/${config.venue.outletSlug}`, { waitUntil: 'networkidle' });
  await staff.getByRole('button', { name: /Raka Pratama/ }).click();
  if (request.state === 'REQUESTED') {
    const row = staff.locator('#incoming-orders .divide-y > div').filter({ hasText: unique });
    await row.getByRole('button', { name: 'Terima', exact: true }).click();
  }
  full = await snapshot();
  let order = full.orders.find(entry => entry.customerName === unique);
  assert.ok(order, 'Accepted order exists.');
  const bill = full.bills.find(entry => entry.allocatedUnits.some(unit => unit.orderId === order.id));
  assert.ok(bill, 'Order has a bill.');
  check('staff acceptance creates order and bill');
  await customer.getByRole('button', { name: 'Menu profil, pesanan, dan layanan meja', exact: true }).click();
  await customer.getByRole('dialog').getByRole('button', { name: /Pembayaran/ }).click();
  await customer.waitForTimeout(9000); // The running app polls every 8 s.
  await customer.getByLabel('Pilih tagihan meja', { exact: true }).selectOption(bill.id);
  await customer.getByRole('button', { name: 'Buat QRIS', exact: true }).click();
  await customer.getByAltText('Kode QR demo, tidak dapat dibayar').waitFor();
  await customer.screenshot({ path: `${out}/customer-payment-demo.png`, fullPage: true });
  full = await snapshot();
  const onlineBill = full.bills.find(entry => entry.id === bill.id);
  assert.ok(onlineBill.attempts.some(entry => entry.status === 'PENDING'));
  check('online payment creates a nonpayable QR demo and remains pending');
  const sharedBillPage = await customerContext.newPage(); track(sharedBillPage);
  await sharedBillPage.goto(`${base}/t/${config.venue.tenantSlug}/${config.venue.outletSlug}/m/${table.qrToken}?bill=${encodeURIComponent(bill.shareToken)}`, { waitUntil: 'networkidle' });
  await sharedBillPage.getByRole('heading', { name: 'Pembayaran', exact: true }).waitFor();
  assert.equal(await sharedBillPage.getByLabel('Pilih tagihan meja', { exact: true }).inputValue(), bill.id);
  await sharedBillPage.getByAltText('Kode QR demo, tidak dapat dibayar').waitFor();
  await sharedBillPage.close();
  check('shared bill URL opens its payment screen on the first render');
  await staff.getByRole('button', { name: 'Perbarui data operasional', exact: true }).click();
  await staff.getByRole('region', { name: 'Simulasi pembayaran' }).locator('.divide-y > div').filter({ hasText: unique }).getByRole('button', { name: 'Simulasikan lunas', exact: true }).click();
  full = await snapshot();
  assert.equal(full.bills.find(entry => entry.id === bill.id).paymentState, 'SETTLED');
  check('staff can simulate verified settlement without a real payment');
  // Multi-line POS, manual discount and explicit server-price review.
  await staff.getByRole('button', { name: 'Pesanan baru', exact: true }).first().click();
  const pos = staff.getByRole('dialog');
  await pos.locator('#pos-name').fill(`POS ${unique}`);
  await pos.getByRole('button', { name: new RegExp(item.name) }).click();
  await pos.getByRole('button', { name: 'Tambah', exact: true }).click();
  const second = initial.catalog.find(entry => entry.id === 'item_croissant');
  await pos.getByRole('button', { name: new RegExp(second.name) }).click();
  await pos.getByRole('button', { name: 'Tambah', exact: true }).click();
  await pos.locator('#pos-discount').fill('5000');
  await pos.getByRole('button', { name: 'Periksa pesanan', exact: true }).click();
  await pos.getByText('Pesanan siap dibuat', { exact: true }).waitFor();
  await staff.screenshot({ path: `${out}/cashier-order-review.png`, fullPage: true });
  await pos.getByRole('button', { name: /Buat tagihan/ }).click();
  await pos.waitFor({ state: 'hidden' });
  full = await snapshot();
  const posOrder = full.orders.find(entry => entry.customerName === `POS ${unique}`);
  assert.ok(posOrder);
  const posBill = full.bills.find(entry => entry.allocatedUnits.some(unit => unit.orderId === posOrder.id));
  assert.equal(posBill.discountIdr, 5000);
  assert.equal(posBill.allocatedUnits.length, 2);
  check('multi-item cashier order + Rp5,000 discount + server review', { totalIdr: posBill.originalTotalIdr });
  // Check viewport geometry, broken images, all five theme contracts.
  for (const theme of Object.keys({ boxy:1, rounded:1, editorial:1, playful:1, airy:1 })) {
    await customer.goto(`${base}/?theme=${theme}`, { waitUntil: 'networkidle' });
    await customer.evaluate(() => document.fonts.ready);
    assert.equal(await customer.evaluate(() => document.documentElement.dataset.theme), theme);
    const geometry = await customer.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, broken: [...document.images].filter(image => !image.complete || image.naturalWidth === 0).length }));
    assert.ok(geometry.scroll <= geometry.width + 1, `${theme} overflow`); assert.equal(geometry.broken, 0);
    await customer.screenshot({ path: `${out}/theme-${theme}-mobile.png` });
  }
  check('five themes render at 390px without overflow or broken images');
  assert.deepEqual(errors, []);
  check('no browser page errors');
} catch (error) {
  for (const [index, context] of browser.contexts().entries()) {
    for (const [pageIndex, page] of context.pages().entries()) {
      await page.screenshot({ path: `${out}/failure-${index}-${pageIndex}.png`, fullPage: true }).catch(() => {});
    }
  }
  await writeFile(`${out}/browser-workflows.json`, JSON.stringify({ status: 'failed', checks, errors, error: error.stack }, null, 2));
  throw error;
} finally { await browser.close(); }
await writeFile(`${out}/browser-workflows.json`, JSON.stringify({ status: 'passed', checks, errors }, null, 2));
console.log(`${checks.length} browser workflows passed.`);
