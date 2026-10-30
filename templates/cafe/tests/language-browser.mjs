import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = (process.env.CAFE_DEMO_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, ...(process.env.CAFE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CAFE_CHROMIUM_EXECUTABLE } : {}) });
try {
  for (const [locale, expected] of [['id-ID', 'id'], ['en-US', 'en'], ['fr-FR', 'en']]) {
    const context = await browser.newContext({ locale });
    const page = await context.newPage();
    await page.goto(base);
    await page.waitForFunction(expected => document.documentElement.lang === expected, expected);
    await page.getByRole('heading', { name: expected === 'id' ? 'Demo kafe' : 'Cafe demos', exact: true }).waitFor();
    await context.close();
    console.log(`PASS ${locale} defaults to ${expected}`);
  }
  const context = await browser.newContext({ locale: 'fr-FR' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('button', { name: 'Switch language to Indonesian' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('tampiloka-language-choice')), 'id');
  await page.goto(`${base}/p/order-at-cashier/`);
  await page.getByRole('button', { name: 'Ulangi demo' }).waitFor({ timeout: 120000 });
  await page.getByPlaceholder('Cari menu').waitFor({ timeout: 120000 });
  const localOnly = await page.evaluate(async () => (await (await fetch('/api/v1/snapshot?surface=staff')).json()).data?.runtime?.localOnly === true);
  assert.equal(localOnly, true, 'Order checks require the local-only demo runtime.');
  await page.getByRole('button', { name: 'Ganti bahasa ke Inggris' }).click();
  await page.getByPlaceholder('Search menu').waitFor();
  await page.getByRole('button', { name: 'Add Iced Jasmine Leaf Tea' }).click();
  await page.getByRole('dialog', { name: 'Iced Jasmine Leaf Tea' }).getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('navigation', { name: 'Customer navigation' }).getByRole('button', { name: 'Cart', exact: true }).click();
  await page.getByText('Menu subtotal', { exact: true }).waitFor();
  await page.getByText('Service charge (5%)', { exact: true }).waitFor();
  await page.getByText('Restaurant tax / PB1 (10%)', { exact: true }).waitFor();
  await page.getByText('Bill total', { exact: true }).waitFor();
  assert.match(await page.getByText('Service charge (5%)', { exact: true }).locator('..').innerText(), /900/);
  assert.match(await page.getByText('Restaurant tax \/ PB1 (10%)', { exact: true }).locator('..').innerText(), /1[.,]890/);
  assert.match(await page.getByText('Bill total', { exact: true }).locator('..').innerText(), /20[.,]790/);
  await page.getByPlaceholder('Your name').fill('Demo guest');
  await page.getByRole('button', { name: /Review order/ }).click();
  const confirmation = page.getByRole('dialog', { name: 'Submit order?' });
  await confirmation.waitFor({ timeout: 120000 });
  await confirmation.getByRole('button', { name: 'Submit order', exact: true }).click();
  await page.getByRole('navigation', { name: 'Customer navigation' }).getByRole('button', { name: 'Orders', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Staff', exact: true }).click();
  await page.getByRole('button', { name: 'Reset demo' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: /Raka Pratama/ }).first().click();
  await page.getByRole('navigation', { name: 'Desktop operations navigation' }).waitFor();
  assert.deepEqual(errors, []);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.reload();
  await page.getByRole('button', { name: 'Switch language to Indonesian' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('tampiloka-language-choice')), 'en');
  await context.close();
  console.log('PASS choice persists across customer, staff and reload');
} finally {
  await browser.close();
}
