import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

// Run against an actual preview/deployment, never a mocked API or a live store.
// Start `pnpm preview`, then `pnpm test:e2e`. Override COMMERCE_BASE_URL for the public demo.
const base = (process.env.COMMERCE_BASE_URL || 'http://127.0.0.1:4174').replace(/\/$/, '');
const output = resolve(process.env.COMMERCE_TEST_OUTPUT || 'test-results/browser');
await mkdir(output, { recursive: true });
// Honor the managed network proxy for public deployments; loopback stays local.
const proxyAddress = !['localhost', '127.0.0.1', '::1'].includes(new URL(base).hostname)
  ? (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) : undefined;
const proxyUrl = proxyAddress ? new URL(proxyAddress) : undefined;
const proxy = proxyUrl ? { server: proxyUrl.origin, username: decodeURIComponent(proxyUrl.username), password: decodeURIComponent(proxyUrl.password) } : undefined;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(proxy ? { proxy } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const runtimeErrors = [];
const checks = [];
page.on('pageerror', error => runtimeErrors.push(error.message));
let step = 'startup';
const check = (name, detail = {}) => { checks.push({ name, ...detail }); console.log(`PASS ${name}`); };
const json = async path => { const response = await context.request.get(`${base}/api${path}`); assert.equal(response.ok(), true, `${path}: ${response.status()}`); return response.json(); };
const actionResponse = () => page.waitForResponse(response => response.request().method() === 'POST' && /\/api\/(?:staff\/)?orders\/[^/]+\/actions$/.test(new URL(response.url()).pathname));
const closeDialog = async () => { await page.keyboard.press('Escape'); };
const openOrders = async () => {
  await page.getByRole('button', { name: 'Pembeli', exact: true }).click();
  await page.getByRole('navigation', { name: 'Navigasi toko' }).getByRole('button', { name: 'Pesanan saya', exact: true }).click();
  await page.getByRole('heading', { name: 'Pesanan saya', exact: true }).waitFor();
};
const openStaffOrder = async order => {
  await page.getByRole('button', { name: 'Staf', exact: true }).click();
  await page.getByRole('heading', { name: 'Ringkasan toko' }).waitFor();
  await page.getByRole('navigation', { name: 'Navigasi ruang staf' }).getByRole('button', { name: /^Pesanan/ }).click();
  await page.getByRole('button', { name: order.number, exact: true }).click();
  return page.getByRole('dialog', { name: order.number, exact: true });
};
const staffAction = async (order, button, title, fields = {}) => {
  await page.getByRole('dialog', { name: order.number, exact: true }).getByRole('button', { name: button, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  for (const [label, value] of Object.entries(fields)) await dialog.getByLabel(label, { exact: true }).fill(value);
  const response = actionResponse();
  await dialog.getByRole('button', { name: title, exact: true }).click();
  const result = await response;
  assert.equal(result.ok(), true, await result.text());
  await dialog.waitFor({ state: 'hidden' });
  return result.json();
};
const addProduct = async (name, variant) => {
  await page.locator('.product-card').filter({ has: page.getByRole('button', { name, exact: true }) }).getByRole('button', { name: `Lihat ${name}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name, exact: true });
  assert.equal(await dialog.getAttribute('data-slot'), 'dialog-content');
  const shippingDetails = dialog.getByRole('button', { name: 'Pengiriman dan pengembalian' });
  await shippingDetails.click();
  assert.equal(await shippingDetails.getAttribute('aria-expanded'), 'true');
  if (variant) await dialog.getByRole('button', { name: variant, exact: true }).click();
  await dialog.getByRole('button', { name: 'Tambah ke keranjang', exact: true }).click();
  await page.getByRole('dialog', { name: /^Keranjang/ }).waitFor();
  assert.equal(await page.getByRole('dialog', { name: /^Keranjang/ }).getAttribute('data-slot'), 'sheet-content');
};
const checkout = async ({ payment = 'manual', pickup = false, coupon = '' } = {}) => {
  await page.getByRole('button', { name: 'Lanjut ke checkout', exact: true }).click();
  await page.getByRole('heading', { name: 'Selesaikan pesanan' }).waitFor();
  await page.getByLabel('Nama lengkap', { exact: true }).fill('Pelanggan Uji Tampiloka');
  await page.getByLabel('Nomor WhatsApp', { exact: true }).fill('081234567890');
  if (pickup) await page.getByRole('radiogroup', { name: 'Metode pengiriman' }).getByRole('radio', { name: /Ambil di toko/ }).check();
  else {
    await page.getByLabel('Alamat lengkap', { exact: true }).fill('Jalan Contoh 12, alamat simulasi');
    await page.getByLabel('Kota / kabupaten', { exact: true }).fill('Bandung');
    await page.getByLabel('Kode pos', { exact: true }).fill('40111');
  }
  await page.getByRole('radiogroup', { name: 'Metode pembayaran' }).locator(`[role="radio"][value="${payment}"]`).check();
  if (coupon) {
    await page.getByLabel('Kode promo', { exact: true }).fill(coupon);
    await page.getByRole('button', { name: 'Pakai', exact: true }).click();
    await page.getByText(`Potongan ${coupon}`, { exact: true }).waitFor();
  }
  const saved = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/orders');
  await page.getByRole('button', { name: 'Buat pesanan', exact: true }).click();
  const response = await saved;
  assert.equal(response.ok(), true, await response.text());
  const order = await response.json();
  await page.getByRole('dialog', { name: order.number, exact: true }).waitFor();
  return order;
};

try {
  const health = await json('/health');
  assert.equal(health.demo, true, 'This test only runs against an explicit demo, never production.');
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('combobox', { name: 'Tingkat fitur' }).waitFor();
  if ((await page.getByRole('combobox', { name: 'Tingkat fitur' }).textContent()) !== 'Toko lengkap') {
    const configured = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/demo/config');
    await page.getByRole('combobox', { name: 'Tingkat fitur' }).click(); await page.getByRole('option', { name: 'Toko lengkap', exact: true }).click();
    assert.equal((await configured).ok(), true);
  }
  const initial = await json('/bootstrap');
  assert.equal(initial.demo, true);
  assert.equal(initial.config.level, 'advanced');
  assert.equal(initial.products.length, 8);
  const initialStock = initial.products.find(p => p.id === 'linen-shirt').variants.find(v => v.id === 'linen-shirt-m').stock;
  check('Actual Worker and D1 respond; a new visitor receives an isolated demo');

  const hero = page.getByRole('region', { name: 'Produk pilihan' });
  const firstHeroProduct = await hero.locator('.shop-hero-product strong').textContent();
  await hero.getByRole('button', { name: 'Foto berikutnya' }).focus();
  await page.keyboard.press('Enter');
  assert.notEqual(await hero.locator('.shop-hero-product strong').textContent(), firstHeroProduct);
  await hero.getByRole('button', { name: 'Foto sebelumnya' }).click();
  assert.equal(await hero.locator('.shop-hero-product strong').textContent(), firstHeroProduct);
  check('Hero carousel changes products and supports keyboard navigation');

  const presetTrigger = page.getByRole('combobox', { name: 'Preset desain' });
  const originalPreset = await presetTrigger.textContent();
  await presetTrigger.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'option');
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.activeElement?.textContent === 'Compact');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.commerce-app')?.getAttribute('data-preset') === 'compact');
  await presetTrigger.click();
  await page.getByRole('option', { name: originalPreset, exact: true }).click();
  await page.waitForFunction(value => document.querySelector('.commerce-app')?.getAttribute('data-preset') === value, initial.config.preset);
  check('Preset select supports keyboard navigation and restores the chosen preset');

  step = 'search-and-product';
  await page.getByRole('button', { name: 'Filter produk' }).click();
  const stockFilter = page.getByRole('checkbox', { name: 'Hanya stok tersedia' });
  await stockFilter.check();
  assert.equal(await stockFilter.isChecked(), true);
  await stockFilter.uncheck();
  assert.equal(await stockFilter.isChecked(), false);
  await page.getByRole('button', { name: 'Filter produk' }).click();
  await page.getByRole('textbox', { name: 'Cari produk', exact: true }).fill('tidak-ada-produk-ini');
  await page.getByRole('heading', { name: 'Produk belum ditemukan' }).waitFor();
  await page.getByRole('button', { name: 'Hapus filter', exact: true }).click();
  await page.getByRole('button', { name: 'Simpan Kemeja Katun Senja', exact: true }).click();
  await page.getByRole('button', { name: 'Hapus Kemeja Katun Senja dari simpanan', exact: true }).waitFor();
  assert.ok((await json('/bootstrap')).wishlist.includes('linen-shirt'));
  check('Search empty state resets and wishlist persists on the server');

  step = 'manual-checkout';
  await addProduct('Kemeja Katun Senja', 'M');
  const order = await checkout({ coupon: 'RUPA10' });
  assert.equal(order.subtotal, 329000);
  assert.equal(order.discount, 32900);
  assert.equal(order.shippingFee, 18000);
  assert.equal(order.total, 314100);
  assert.ok(order.trackingCode?.length >= 20);
  assert.equal((await json('/bootstrap')).products.find(p => p.id === 'linen-shirt').variants.find(v => v.id === 'linen-shirt-m').stock, initialStock - 1);
  await page.screenshot({ path: `${output}/checkout-order.png`, fullPage: true });
  check('Variant → cart → coupon → shipping → manual checkout uses server total and reserves stock', { orderNumber: order.number, total: order.total });

  step = 'cross-device-tracking';
  const otherContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const other = await otherContext.newPage();
  await other.goto(`${base}/#/orders`, { waitUntil: 'networkidle' });
  await other.getByText('Lacak pesanan dengan kode akses', { exact: true }).click();
  await other.getByLabel('Nomor pesanan', { exact: true }).fill(order.number);
  await other.getByLabel('Kode akses', { exact: true }).fill(order.trackingCode);
  await other.getByRole('button', { name: 'Lacak', exact: true }).click();
  const tracked = other.getByRole('dialog', { name: order.number, exact: true });
  await tracked.waitFor();
  assert.equal(await tracked.getByRole('button', { name: 'Saya sudah transfer', exact: true }).count(), 0);
  const ownOther = await otherContext.request.get(`${base}/api/orders/my`);
  assert.equal((await ownOther.json()).orders.length, 0);
  const forbidden = await otherContext.request.get(`${base}/api/orders/${order.id}`);
  assert.equal(forbidden.status(), 404);
  await other.screenshot({ path: `${output}/tracking-mobile.png`, fullPage: true });
  await otherContext.close();
  check('Another device can track with its access code; demo ownership and mutations remain isolated');

  step = 'manual-payment-and-fulfilment';
  await page.getByRole('button', { name: 'Saya sudah transfer', exact: true }).click();
  const evidence = page.getByRole('dialog', { name: 'Konfirmasi transfer', exact: true });
  await evidence.getByLabel('Nama pengirim dan nomor referensi', { exact: true }).fill('PEMBAYARAN-DEMO-001, bukan transfer nyata');
  let responsePromise = actionResponse();
  await evidence.getByRole('button', { name: 'Kirim', exact: true }).click();
  assert.equal((await (await responsePromise).json()).paymentStatus, 'pending_verification');
  await evidence.waitFor({ state: 'hidden' });
  await closeDialog();
  await openStaffOrder(order);
  let updated = await staffAction(order, 'Konfirmasi pembayaran', 'Konfirmasi pembayaran', { 'Referensi transaksi': 'VERIFIKASI-DEMO-001' });
  assert.equal(updated.paymentStatus, 'paid');
  updated = await staffAction(order, 'Mulai siapkan', 'Mulai siapkan');
  assert.equal(updated.status, 'processing');
  updated = await staffAction(order, 'Kirim pesanan', 'Kirim pesanan', { 'Kurir': 'Kurir simulasi', 'Nomor resi / bukti serah terima': 'DEMO-RESI-001' });
  assert.equal(updated.status, 'shipped');
  await closeDialog();
  await openOrders();
  await page.getByRole('button').filter({ hasText: order.number }).last().click();
  responsePromise = actionResponse();
  await page.getByRole('button', { name: 'Pesanan diterima', exact: true }).click();
  assert.equal((await (await responsePromise).json()).status, 'completed');
  check('Buyer submits transfer reference; staff verifies, prepares, ships; buyer confirms receipt');

  step = 'review-return-refund';
  await page.getByRole('button', { name: 'Tulis ulasan', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Tulis ulasan', exact: true });
  await review.getByLabel('Pengalamanmu', { exact: true }).fill('Ulasan simulasi: varian dan status pesanan dapat diperiksa.');
  await review.getByRole('button', { name: 'Simpan ulasan', exact: true }).click();
  await review.waitFor({ state: 'hidden' });
  assert.ok((await json('/bootstrap')).reviews.some(item => item.productId === 'linen-shirt' && item.orderId === order.id));
  await page.getByRole('button', { name: 'Ajukan retur', exact: true }).click();
  const returnDialog = page.getByRole('dialog', { name: 'Ajukan retur', exact: true });
  await returnDialog.getByLabel('Alasan dan kondisi barang', { exact: true }).fill('Simulasi retur, ukuran kurang sesuai dan barang masih utuh.');
  responsePromise = actionResponse();
  await returnDialog.getByRole('button', { name: 'Kirim', exact: true }).click();
  assert.equal((await (await responsePromise).json()).returnStatus, 'requested');
  await returnDialog.waitFor({ state: 'hidden' });
  await closeDialog();
  await openStaffOrder(order);
  updated = await staffAction(order, 'Setujui retur', 'Setujui retur');
  assert.equal(updated.returnStatus, 'approved');
  updated = await staffAction(order, 'Barang retur diterima', 'Terima barang retur');
  assert.equal(updated.returnStatus, 'received');
  updated = await staffAction(order, 'Kembalikan dana', 'Catat pengembalian dana', { 'Referensi transaksi': 'REFUND-DEMO-001', 'Alasan / catatan': 'Simulasi: pengembalian dana sudah dicatat, tidak ada uang dipindahkan.' });
  assert.equal(updated.paymentStatus, 'refunded');
  const afterReturn = await json('/bootstrap');
  assert.equal(afterReturn.products.find(p => p.id === 'linen-shirt').variants.find(v => v.id === 'linen-shirt-m').stock, initialStock);
  await page.screenshot({ path: `${output}/staff-refund.png`, fullPage: true });
  check('Verified buyer review and full return → receive → recorded refund restores stock');
  await closeDialog();

  step = 'demo-gateway';
  await page.getByRole('button', { name: 'Pembeli', exact: true }).click();
  await addProduct('Cangkir Pagi', 'Pasir');
  const gatewayOrder = await checkout({ payment: 'midtrans', pickup: true });
  const paymentResponse = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/demo/payment');
  await page.getByRole('button', { name: 'Bayar berhasil', exact: true }).click();
  assert.equal((await (await paymentResponse).json()).paymentStatus, 'paid');
  await page.getByRole('button', { name: 'Bayar berhasil', exact: true }).waitFor({ state: 'hidden' });
  check('Gateway demo reports a successful payment without transferring money', { orderNumber: gatewayOrder.number });
  await closeDialog();

  step = 'levels-and-whatsapp';
  await page.getByRole('button', { name: 'Pembeli', exact: true }).click();
  await page.getByRole('combobox', { name: 'Tingkat fitur' }).click(); await page.getByRole('option', { name: 'Katalog', exact: true }).click();
  await page.getByRole('button', { name: /^Keranjang,/ }).waitFor({ state: 'hidden' });
  assert.equal((await json('/bootstrap')).capabilities.checkout, false);
  assert.equal(await page.getByRole('button', { name: /^Keranjang,/ }).count(), 0);
  await page.getByRole('combobox', { name: 'Tingkat fitur' }).click(); await page.getByRole('option', { name: 'Keranjang + WhatsApp', exact: true }).click();
  await page.getByRole('button', { name: /^Keranjang,/ }).waitFor();
  await addProduct('Kaos Harian', 'S');
  await page.getByRole('button', { name: 'Lihat pesan WhatsApp', exact: true }).click();
  const message = page.getByRole('dialog', { name: 'Contoh pesan WhatsApp', exact: true });
  await message.waitFor();
  assert.match(await message.getByRole('textbox', { name: 'Contoh pesan belanja' }).inputValue(), /Kaos Harian/);
  assert.equal(context.pages().length, 1);
  await page.screenshot({ path: `${output}/whatsapp-preview.png`, fullPage: true });
  check('Catalog removes checkout; WhatsApp level produces a reviewable shopping message without sending it');
  await closeDialog();
  await closeDialog();

  step = 'final';
  assert.deepEqual(runtimeErrors, []);
  check('No uncaught browser runtime errors during the customer and staff journey');
  await writeFile(`${output}/report.json`, JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, runtimeErrors }, null, 2));
  console.log(`\n${checks.length} end-to-end scenarios passed. Evidence: ${output}`);
} catch (error) {
  await page.screenshot({ path: `${output}/failure-${step}.png`, fullPage: true }).catch(() => {});
  await writeFile(`${output}/failure.json`, JSON.stringify({ base, step, message: error.message, checks, runtimeErrors }, null, 2));
  console.error(`FAILED at ${step}: ${error.stack}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
