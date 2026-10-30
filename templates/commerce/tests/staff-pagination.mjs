import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

// A controlled API fixture tests the browser's page/search/action state machine.
// The separate backend SQL suite tests the same contract against real persisted orders.
const base = process.env.COMMERCE_TEST_URL || 'http://127.0.0.1:4174';
const out = 'test-results/staff-pagination';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const report = { checkedAt: new Date().toISOString(), fixture: '301 orders, snapshot limited to 250', checks: [], requests: [], errors: [] };
page.on('pageerror', error => report.errors.push(error.message));
let step = 'bootstrap';
let releaseSlow;
const slowGate = new Promise(resolve => { releaseSlow = resolve; });
let signalSlow;
const slowRequested = new Promise(resolve => { signalSlow = resolve; });
let signalSlowFinished;
const slowFinished = new Promise(resolve => { signalSlowFinished = resolve; });
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  const bootstrap = await (await context.request.get(`${base}/api/bootstrap`)).json();
  assert.equal(bootstrap.demo, true, 'This browser regression must run against the isolated demo.');
  const original = await (await context.request.get(`${base}/api/staff/snapshot`)).json();
  const product = bootstrap.products[0];
  const variant = product.variants[0];
  const shippingMethod = bootstrap.shippingMethods.find(method => method.id === 'pickup');
  const orders = Array.from({ length: 301 }, (_, index) => {
    const number = 301 - index;
    const stamp = new Date(Date.UTC(2026, 9, 29, 0, 0) - index * 60000).toISOString();
    return {
      id: `pagination-order-${number}`, number: `RUPA-P${String(number).padStart(4, '0')}`,
      items: [{ variantId: variant.id, productId: product.id, name: product.name, variantName: variant.name, image: product.images[0], unitPrice: variant.price, quantity: 1, subtotal: variant.price }],
      subtotal: variant.price, discount: 0, shippingFee: 0, total: variant.price, couponCode: null, shippingMethod,
      status: 'confirmed', paymentStatus: 'paid', paymentMethod: 'manual', returnStatus: 'none',
      customer: { name: index === 0 ? 'Pelanggan Lama' : index === 1 ? 'Pelanggan Baru' : `Pelanggan ${number}`, phone: '081234567890', email: '', address: '', city: '', postalCode: '' },
      note: '', paymentReference: 'Referensi pengujian', carrier: '', trackingNumber: '', returnReason: '',
      createdAt: stamp, updatedAt: stamp, expiresAt: null, paymentUrl: null,
      timeline: [{ id: `event-${number}`, action: 'created', label: 'Pesanan dibuat', note: '', createdAt: stamp, actor: 'customer' }],
    };
  });
  const oldest = orders.at(-1);
  assert.equal(original.orders.some(order => order.id === oldest.id), false);
  const respond = (route, value) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) });
  await page.route('**/api/staff/snapshot', route => respond(route, { ...original, orders: orders.slice(0, 250), pagination: { limit: 250, total: 301, hasMore: true }, metrics: { ...original.metrics, orders: 301 } }));
  await page.route(/\/api\/staff\/orders(?:\?|$)/, async route => {
    const params = new URL(route.request().url()).searchParams;
    const q = params.get('q') || '';
    const status = params.get('status') || 'all';
    const limit = Number(params.get('limit'));
    const offset = Number(params.get('offset'));
    report.requests.push({ q, status, limit, offset });
    assert.equal(limit, 50);
    const matches = orders.filter(order => (status === 'all' || order.status === status) && `${order.number} ${order.customer.name} ${order.customer.phone}`.toLowerCase().includes(q.toLowerCase()));
    if (q === 'lama') { signalSlow(); await slowGate; }
    try { await respond(route, { orders: matches.slice(offset, offset + limit), total: matches.length, hasMore: offset + limit < matches.length, limit, offset }); }
    catch (error) { if (q !== 'lama') throw error; /* An aborted stale request cannot deliver a UI update. */ }
    finally { if (q === 'lama') signalSlowFinished(); }
  });
  await page.route(`**/api/staff/orders/${oldest.id}/actions`, async route => {
    assert.equal(route.request().postDataJSON().action, 'process');
    oldest.status = 'processing'; oldest.updatedAt = new Date().toISOString();
    oldest.timeline.push({ id: 'old-order-updated', action: 'process', label: 'Pesanan disiapkan', note: '', createdAt: oldest.updatedAt, actor: 'owner' });
    await respond(route, oldest);
  });

  step = 'page beyond snapshot';
  await page.getByRole('button', { name: 'Staf', exact: true }).click();
  await page.getByRole('heading', { name: 'Ringkasan toko' }).waitFor();
  await page.getByRole('navigation', { name: 'Navigasi ruang staf' }).getByRole('button', { name: /^Pesanan/ }).click();
  await page.getByText('Menampilkan 1 sampai 50 dari 301 pesanan', { exact: true }).waitFor();
  await page.getByRole('combobox', { name: 'Filter status pesanan' }).click(); await page.getByRole('option', { name: 'Siap diproses', exact: true }).click();
  await page.getByText('Menampilkan 1 sampai 50 dari 301 pesanan', { exact: true }).waitFor();
  for (let current = 2; current <= 7; current++) {
    await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
    await page.getByText(`Halaman ${current} dari 7`, { exact: true }).waitFor();
  }
  await page.getByText('Menampilkan 301 sampai 301 dari 301 pesanan', { exact: true }).waitFor();
  await page.getByRole('button', { name: oldest.number, exact: true }).click();
  const detail = page.getByRole('dialog', { name: oldest.number, exact: true });
  await detail.waitFor();
  report.checks.push('Order 301 opens although it is absent from the 250-order snapshot');

  step = 'old order action and detail retention';
  await detail.getByRole('button', { name: 'Mulai siapkan', exact: true }).click();
  const action = page.getByRole('dialog', { name: 'Mulai siapkan', exact: true });
  await action.getByRole('button', { name: 'Mulai siapkan', exact: true }).click();
  await action.waitFor({ state: 'detached' });
  await detail.getByRole('button', { name: 'Siap diambil', exact: true }).waitFor();
  assert.equal(await detail.isVisible(), true);
  await page.keyboard.press('Escape');
  await detail.waitFor({ state: 'detached' });
  await page.getByText('Halaman 6 dari 6', { exact: true }).waitFor();
  await page.getByText('Menampilkan 251 sampai 300 dari 300 pesanan', { exact: true }).waitFor();
  report.checks.push('Action updates the selected old order, keeps its detail open, and clamps a now-empty last page');

  step = 'filter resets page';
  await page.getByRole('combobox', { name: 'Filter status pesanan' }).click(); await page.getByRole('option', { name: 'Sedang disiapkan', exact: true }).click();
  await page.getByText('Halaman 1 dari 1', { exact: true }).waitFor();
  await page.getByText('Menampilkan 1 sampai 1 dari 1 pesanan', { exact: true }).waitFor();
  await page.getByRole('button', { name: oldest.number, exact: true }).waitFor();
  report.checks.push('Server status filtering resets to page one and finds the modified archived order');

  step = 'out of order search responses';
  await page.getByRole('combobox', { name: 'Filter status pesanan' }).click(); await page.getByRole('option', { name: 'Semua status', exact: true }).click();
  await page.getByText('Halaman 1 dari 7', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Berikutnya', exact: true }).click();
  await page.getByText('Halaman 2 dari 7', { exact: true }).waitFor();
  await page.getByLabel('Cari pesanan', { exact: true }).fill('lama');
  await slowRequested;
  await page.getByLabel('Cari pesanan', { exact: true }).fill('baru');
  await page.getByRole('button', { name: orders[1].number, exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: orders[0].number, exact: true }).count(), 0);
  releaseSlow(); await slowFinished;
  await page.waitForTimeout(100);
  assert.equal(await page.getByRole('button', { name: orders[1].number, exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: orders[0].number, exact: true }).count(), 0);
  assert.equal(await page.getByLabel('Cari pesanan', { exact: true }).inputValue(), 'baru');
  assert.equal(report.requests.filter(request => request.q === 'lama' || request.q === 'baru').every(request => request.offset === 0), true);
  report.checks.push('Search resets pagination and a delayed earlier response cannot replace the newest result');
  await page.screenshot({ path: `${out}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  report.mobileGeometry = await page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth, tableViewport: document.querySelector('.table-scroll').clientWidth, tableWidth: document.querySelector('.table-scroll').scrollWidth }));
  assert.equal(report.mobileGeometry.pageWidth <= report.mobileGeometry.width, true);
  await page.screenshot({ path: `${out}/mobile.png`, fullPage: true });
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = { step, message: error.stack };
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
  throw error;
} finally {
  releaseSlow();
  await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: report.checks.length, checks: report.checks, requests: report.requests.length }, null, 2));
