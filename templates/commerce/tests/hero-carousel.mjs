import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run against the local demo preview: pnpm preview, then node tests/hero-carousel.mjs.
const base = process.env.COMMERCE_TEST_URL || 'http://127.0.0.1:4174';
const browser = await chromium.launch({ headless: true, ...(process.env.COMMERCE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.COMMERCE_CHROMIUM_EXECUTABLE } : {}) });
try {
  const openings = new Set();
  for (const preset of ['editorial', 'market', 'atelier', 'compact']) {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ locale: 'id-ID', viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/?preset=${preset}&level=advanced`, { waitUntil: 'networkidle' });
      await page.waitForFunction(value => document.querySelector('.commerce-app')?.getAttribute('data-preset') === value, preset);
      const hero = page.getByRole('region', { name: 'Produk pilihan' });
      await hero.waitFor();
      const slide = hero.locator('[aria-roledescription="slide"]');
      assert.match(await slide.getAttribute('aria-label'), /^1 dari [2-5]$/);
      assert.equal(await hero.locator('.shop-hero-image').evaluate(image => image.complete && image.naturalWidth > 0), true);
      const first = await hero.locator('.shop-hero-product strong').textContent();
      openings.add(first);
      await hero.getByRole('button', { name: 'Foto berikutnya' }).focus();
      await page.keyboard.press('Enter');
      assert.notEqual(await hero.locator('.shop-hero-product strong').textContent(), first);
      await hero.getByRole('button', { name: 'Foto sebelumnya' }).click();
      assert.equal(await hero.locator('.shop-hero-product strong').textContent(), first);
      await hero.getByRole('button', { name: `Lihat detail ${first}` }).click();
      const dialog = page.getByRole('dialog', { name: first, exact: true });
      await dialog.waitFor();
      const second = dialog.locator('.product-thumbnails button').nth(1);
      await second.click();
      assert.equal(await second.getAttribute('aria-pressed'), 'true');
      await dialog.locator('.product-main-image').evaluate(image => image.decode());
      assert.equal(await dialog.locator('.gallery-caption').isVisible(), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []);
      console.log(`PASS ${preset} ${width}px: carousel, keyboard, product detail, overflow`);
      await page.close();
    }
  }
  assert.equal(openings.size, 4, 'All four layouts feature distinct leads from the seeded catalogue');
  for (const count of [0, 1]) {
    const context = await browser.newContext({ locale: 'id-ID' });
    const response = await context.request.get(`${base}/api/bootstrap`);
    assert.equal(response.ok(), true);
    const bootstrap = await response.json();
    bootstrap.products = bootstrap.products.slice(0, count);
    await context.route('**/api/bootstrap', route => route.fulfill({ json: bootstrap }));
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    const hero = page.getByRole('region', { name: 'Produk pilihan' });
    assert.equal(await hero.count(), count);
    if (count) {
      assert.equal(await hero.getByRole('button', { name: 'Foto berikutnya' }).count(), 0);
      assert.match(await hero.locator('[aria-roledescription="slide"]').getAttribute('aria-label'), /^1 dari 1$/);
    }
    assert.equal(await page.getByRole('button', { name: 'Lihat koleksi', exact: true }).count(), 1);
    console.log(`PASS ${count} produk: hero remains usable`);
    await context.close();
  }
} finally {
  await browser.close();
}
