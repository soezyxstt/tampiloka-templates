import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.COMMERCE_TEST_URL || 'http://127.0.0.1:4174';
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const alreadySaved of [true, false]) {
    const context = await browser.newContext({ locale: 'id-ID' });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    const data = await (await context.request.get(`${base}/api/bootstrap`)).json();
    assert.equal(data.demo, true, 'Recovery checks must run against the isolated demo.');
    const items = [{ variantId: data.products[0].variants[0].id, quantity: 1 }];
    const quoteResponse = await context.request.post(`${base}/api/quote`, { data: { items, shippingMethodId: 'pickup' } });
    assert.equal(quoteResponse.ok(), true);
    const quote = await quoteResponse.json();
    const payload = { items, shippingMethodId: 'pickup', customer: { name: 'Pembeli pemulihan demo', phone: '081234567890', email: '', address: '', city: '', postalCode: '' }, paymentMethod: 'manual', expectedTotal: quote.total, note: '' };
    const key = randomUUID();
    if (alreadySaved) {
      const response = await context.request.post(`${base}/api/orders`, { data: { ...payload, idempotencyKey: key } });
      assert.equal(response.ok(), true, await response.text());
    }
    await page.evaluate(({ payload, key }) => {
      localStorage.setItem('tampiloka-commerce-cart', JSON.stringify(payload.items));
      sessionStorage.setItem('tampiloka-checkout-attempt', JSON.stringify({ key, payload, fingerprint: JSON.stringify(payload) }));
    }, { payload, key });
    await page.goto(`${base}/#/${alreadySaved ? 'orders' : 'checkout'}`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    if (!alreadySaved) await page.getByRole('button', { name: 'Periksa dan lanjutkan permintaan sebelumnya', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    const ordersResponse = await context.request.get(`${base}/api/orders/my`);
    const { orders } = await ordersResponse.json();
    assert.equal(orders.length, 1);
    const local = await page.evaluate(() => ({ attempt: sessionStorage.getItem('tampiloka-checkout-attempt'), cart: JSON.parse(localStorage.getItem('tampiloka-commerce-cart') || '[]') }));
    assert.equal(local.attempt, null);
    assert.deepEqual(local.cart, []);
    results.push(alreadySaved ? 'saved request recovered in order history without creating a duplicate' : 'unsaved request safely retried using its original key and payload');
    await context.close();
  }
} finally { await browser.close(); }
await mkdir('test-results/recovery', { recursive: true });
await writeFile('test-results/recovery/report.json', JSON.stringify({ checkedAt: new Date().toISOString(), url: base, results }, null, 2));
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
