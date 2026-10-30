/** Shared demo navigation: real controls, same-origin mode changes and deep links. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = (process.env.CAFE_DEMO_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const browser = await chromium.launch({ headless: true, ...(process.env.CAFE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.CAFE_CHROMIUM_EXECUTABLE } : {}) });
const context = await browser.newContext({ locale: 'id-ID', viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.setDefaultTimeout(30000);
const ready = async () => {
  await page.waitForFunction(() => { const reset = document.querySelector('.tl-demo-actions button'); return reset && !reset.disabled; }, null, { timeout: 120000 });
};
try {
  await page.goto(`${base}/?lang=en`);
  await ready();
  assert.equal(await page.locator('html').getAttribute('lang'), 'en', 'The gallery locale takes priority over the browser locale.');
  assert.equal(await page.getByRole('combobox', { name: 'Demo mode', exact: true }).textContent(), 'Full service', 'The hub opens an interactive demo immediately.');
  assert.equal(await page.locator('.tl-demo-brand').getAttribute('href'), 'https://tampiloka.site/en/templates');
  const localOnly = await page.evaluate(async () => (await (await fetch('/api/v1/snapshot?surface=staff')).json()).data?.runtime?.localOnly);
  assert.equal(localOnly, true);

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const mode = page.getByRole('combobox', { name: 'Demo mode', exact: true });
    await mode.click();
    const menu = page.getByRole('listbox');
    await menu.waitFor();
    const box = await menu.boundingBox();
    assert.ok(box.x >= -1 && box.x + box.width <= width + 1, `Mode options stay within ${width}px.`);
    await page.keyboard.press('Escape');
    assert.equal(await mode.evaluate(element => document.activeElement === element), true, 'Escape restores focus to the select.');
    const geometry = await page.evaluate(() => ({
      width: innerWidth, scroll: document.documentElement.scrollWidth,
      short: [...document.querySelectorAll('.tl-demo-toolbar button,.tl-demo-toolbar a,.tl-demo-language')].filter(element => element.getBoundingClientRect().height < 43).map(element => element.textContent),
    }));
    assert.ok(geometry.scroll <= geometry.width + 1, `No document overflow at ${width}px.`);
    assert.deepEqual(geometry.short, [], 'Demo controls keep a 44px touch target.');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Add Iced Jasmine Leaf Tea', exact: true }).click();
  await page.getByRole('dialog', { name: 'Iced Jasmine Leaf Tea', exact: true }).getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.locator('[data-ui="customer-cart-bar"]').waitFor();
  await page.waitForFunction(() => {
    const language = document.querySelector('.tl-demo-language')?.getBoundingClientRect();
    const cart = document.querySelector('[data-ui="customer-cart-bar"]')?.getBoundingClientRect();
    return language && cart && language.bottom <= cart.top - 8;
  });
  await page.evaluate(() => scrollTo({ top: 500, behavior: 'instant' }));
  const header = await page.locator('[data-ui="customer-header"]').boundingBox();
  const toolbar = await page.locator('.tl-demo-toolbar').boundingBox();
  assert.ok(Math.abs(header.y - (toolbar.y + toolbar.height)) < 1.5, 'Customer header stays visible below demo controls.');

  await page.getByRole('combobox', { name: 'Demo theme', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'airy');
  assert.equal(new URL(page.url()).searchParams.get('theme'), 'airy');
  await page.getByRole('navigation', { name: 'Demo view' }).getByRole('link', { name: 'Staff', exact: true }).click();
  await ready();
  assert.equal(await page.getByRole('link', { name: 'Staff', exact: true }).getAttribute('aria-current'), 'page');
  await page.getByRole('combobox', { name: 'Demo mode', exact: true }).click();
  await page.getByRole('option', { name: 'Cashier', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/p/cashier/staff');
  await ready();
  assert.match(new URL(page.url()).pathname, /\/p\/cashier\/staff$/);
  assert.equal(new URL(page.url()).origin, new URL(base).origin);
  assert.equal(new URL(page.url()).searchParams.get('theme'), 'airy');
  assert.equal(new URL(page.url()).searchParams.get('lang'), 'en');
  assert.equal(await page.getByRole('navigation', { name: 'Demo view' }).getByRole('link', { name: 'Customer', exact: true }).count(), 0, 'Staff-only modes omit the customer action.');

  await page.getByRole('combobox', { name: 'Demo mode', exact: true }).click();
  await page.getByRole('option', { name: 'Order, pay at the counter', exact: true }).click();
  await page.waitForURL(url => url.pathname === '/p/order-at-cashier/staff');
  await ready();
  assert.match(new URL(page.url()).pathname, /\/p\/order-at-cashier\/staff$/, 'Mode changes preserve the active staff view when available.');
  await page.getByRole('navigation', { name: 'Demo view' }).getByRole('link', { name: 'Customer', exact: true }).click();
  await ready();
  await page.getByPlaceholder('Search menu', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Switch language to Indonesian' }).click();
  await page.reload();
  await ready();
  assert.equal(await page.locator('html').getAttribute('lang'), 'id');
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'airy');
  assert.match(new URL(page.url()).pathname, /\/p\/order-at-cashier\/$/);
  assert.equal(await page.locator('.cafe-language-toggle').count(), 1);
  const table = await page.evaluate(async () => {
    const snapshot = (await (await fetch('/api/v1/snapshot?surface=staff')).json()).data;
    return snapshot.tables.find(entry => entry.active && entry.qrToken);
  });
  assert.ok(table?.qrToken);
  const deepLink = new URL(`/t/dapur-pagi/cafe-order/m/${encodeURIComponent(table.qrToken)}`, base);
  deepLink.search = new URLSearchParams({ theme: 'airy', lang: 'id', source: 'gallery' }).toString();
  deepLink.hash = 'receipt';
  await page.goto(deepLink.href);
  await ready();
  assert.equal(new URL(page.url()).pathname, deepLink.pathname, 'Mounting the workspace must keep the table route.');
  await page.getByRole('navigation', { name: 'Tampilan demo' }).getByRole('link', { name: 'Staf', exact: true }).click();
  await ready();
  await page.getByRole('navigation', { name: 'Tampilan demo' }).getByRole('link', { name: 'Pelanggan', exact: true }).click();
  await ready();
  await page.reload();
  await ready();
  const restored = new URL(page.url());
  assert.equal(restored.pathname, deepLink.pathname, 'A staff roundtrip and reload restore the table route.');
  assert.equal(restored.searchParams.get('source'), 'gallery');
  assert.equal(restored.hash, '#receipt');
  assert.deepEqual(errors, []);
  console.log('PASS shared explorer: responsive controls, keyboard, theme, mode, role, locale and reload');
} finally { await context.close(); await browser.close(); }
