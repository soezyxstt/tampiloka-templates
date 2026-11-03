import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.COMMERCE_TEST_URL || 'http://127.0.0.1:4174';
const captures = process.env.COMMERCE_HERO_CAPTURES;
if (captures) await mkdir(captures, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.COMMERCE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.COMMERCE_CHROMIUM_EXECUTABLE } : {}) });

async function openProduct(page, button) {
  await button.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  const next = dialog.locator('.product-thumbnails button').nth(1);
  await next.click();
  assert.equal(await next.getAttribute('aria-pressed'), 'true');
  await dialog.locator('.product-main-image').evaluate(image => image.decode());
  assert.equal(await dialog.locator('.gallery-caption').isVisible(), true);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
}

try {
  for (const preset of ['editorial', 'market', 'atelier', 'compact']) {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ locale: 'id-ID', viewport: { width, height: width === 1440 ? 900 : 844 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/?preset=${preset}&level=advanced`, { waitUntil: 'networkidle' });
      const opening = page.locator('.shop-hero');
      await opening.locator('h1').waitFor();
      await opening.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      if (captures) await page.screenshot({ path: `${captures}/${preset}-${width}.png` });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);

      if (preset === 'editorial') {
        const first = await opening.locator('h1').textContent();
        const firstSrc = await opening.locator('img').getAttribute('src');
        await opening.getByRole('button', { name: 'Foto berikutnya' }).focus();
        await page.keyboard.press('Enter');
        assert.notEqual(await opening.locator('h1').textContent(), first);
        assert.notEqual(await opening.locator('img').getAttribute('src'), firstSrc);
        await opening.getByRole('button', { name: 'Foto sebelumnya' }).click();
        assert.equal(await opening.locator('h1').textContent(), first);
        await openProduct(page, opening.getByRole('button', { name: `Lihat produk ${first}` }));
      } else if (preset === 'market') {
        const department = opening.locator('.market-department').last();
        const title = await department.locator('strong').textContent();
        await department.focus();
        await page.keyboard.press('Enter');
        assert.ok((await page.locator('.category-sidebar .active').textContent()).includes(title));
        assert.ok(await page.locator('.results-note').isVisible());
        assert.equal(await page.locator('#collection').evaluate(el => document.activeElement === el), true);
        await openProduct(page, page.locator('.product-name').first());
      } else if (preset === 'atelier') {
        assert.equal(await opening.locator('.atelier-plates img').count(), 2);
        await openProduct(page, opening.locator('.atelier-specimen'));
      } else {
        const search = opening.getByRole('textbox', { name: 'Cari produk' });
        await search.fill('zx-no-such-item');
        await page.getByText('Produk belum ditemukan', { exact: true }).waitFor();
        await search.fill('');
        await openProduct(page, opening.locator('.compact-index button').first());
      }
      const card = page.locator('.product-card').first();
      assert.equal(await card.getByRole('button', { name: /^Lihat / }).count(), 1);
      assert.equal(await card.getByRole('button', { name: /^Simpan / }).count(), 1);
      assert.deepEqual(errors, []);
      console.log(`PASS ${preset} ${width}px: opening, product decision, keyboard and overflow`);
      await page.close();
    }
  }

  for (const count of [0, 1]) {
    const context = await browser.newContext({ locale: 'id-ID' });
    const response = await context.request.get(`${base}/api/bootstrap`);
    assert.equal(response.ok(), true);
    const bootstrap = await response.json();
    bootstrap.products = bootstrap.products.slice(0, count);
    await context.route('**/api/bootstrap', route => route.fulfill({ json: bootstrap }));
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.shop-hero h1').count(), 1);
    assert.equal(await page.locator('.retail-campaign').count(), count);
    assert.equal(await page.getByRole('button', { name: 'Foto berikutnya' }).count(), 0);
    if (!count) {
      await page.getByRole('button', { name: 'Lihat koleksi', exact: true }).click();
      assert.equal(await page.locator('#collection').evaluate(el => el === document.activeElement), true);
    }
    console.log(`PASS ${count} products: opening stays usable`);
    await context.close();
  }
} finally {
  await browser.close();
}
