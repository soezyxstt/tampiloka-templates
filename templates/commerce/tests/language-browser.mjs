import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.COMMERCE_TEST_URL || 'http://127.0.0.1:4174';
const browser = await chromium.launch({ headless: true, ...(process.env.COMMERCE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.COMMERCE_CHROMIUM_EXECUTABLE } : {}) });
try {
  for (const [locale, expected] of [['id-ID', 'id'], ['en-US', 'en'], ['fr-FR', 'en']]) {
    const context = await browser.newContext({ locale, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${base}/?preset=market&level=advanced`, { waitUntil: 'networkidle' });
    await page.locator('.commerce-app').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), expected);
    const other = expected === 'id' ? 'en' : 'id';
    await page.locator('.language-toggle').click();
    assert.equal(await page.locator('html').getAttribute('lang'), other);
    assert.equal(await page.evaluate(() => localStorage.getItem('tampiloka-language-choice')), other);
    const product = other === 'en' ? 'Canvas Book Pouch' : 'Pouch Kanvas Buku';
    await page.getByRole('button', { name: `${other === 'en' ? 'View' : 'Lihat'} ${product}`, exact: true }).first().click();
    const productDialog = page.getByRole('dialog', { name: product, exact: true });
    await productDialog.getByRole('button', { name: other === 'en' ? 'Black' : 'Hitam', exact: true }).click();
    const alternate = productDialog.locator('.variant-field').getByRole('status');
    assert.match(await alternate.textContent(), other === 'en' ? /photos show the Khaki finish/ : /Foto menampilkan warna Khaki/);
    await productDialog.getByRole('button', { name: 'Khaki', exact: true }).click();
    assert.equal(await alternate.count(), 0);
    await productDialog.getByRole('button', { name: other === 'en' ? 'Add to cart' : 'Tambah ke keranjang', exact: true }).click();
    const cart = page.getByRole('dialog', { name: other === 'en' ? /^Cart/ : /^Keranjang/ });
    await cart.waitFor();
    assert.ok(await cart.getByText(product, { exact: true }).count());
    await page.keyboard.press('Escape');
    await cart.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: other === 'en' ? 'Staff' : 'Staf', exact: true }).click();
    await page.getByRole('heading', { name: other === 'en' ? 'Store overview' : 'Ringkasan toko' }).waitFor();
    const staffNav = page.getByRole('navigation', { name: other === 'en' ? 'Staff workspace navigation' : 'Navigasi ruang staf' });
    await staffNav.getByRole('button', { name: other === 'en' ? 'Product' : 'Produk', exact: true }).click();
    await page.getByRole('heading', { name: other === 'en' ? 'Product' : 'Produk', exact: true }).waitFor();
    await staffNav.getByRole('button', { name: other === 'en' ? 'Settings' : 'Pengaturan', exact: true }).click();
    await page.getByRole('heading', { name: other === 'en' ? 'Store settings' : 'Pengaturan toko', exact: true }).waitFor();
    assert.ok(await page.getByText(other === 'en' ? 'Shopping points' : 'Poin belanja', { exact: true }).count());
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('html').getAttribute('lang'), other);
    await page.getByRole('button', { name: other === 'en' ? 'Customer' : 'Pembeli', exact: true }).click();
    await page.getByRole('heading', { name: other === 'en' ? 'Shop by category' : 'Belanja menurut kategori' }).waitFor();
    assert.ok(await page.getByText(other === 'en' ? 'Canvas Book Pouch' : 'Pouch Kanvas Buku').count());
    await context.close();
    console.log(`PASS ${locale}: default ${expected}, toggle, persistence, customer and staff`);
  }
  for (const preset of ['editorial', 'market', 'atelier', 'compact']) {
    const context = await browser.newContext({ locale: 'en-US' });
    const page = await context.newPage();
    await page.goto(`${base}/?preset=${preset}&level=advanced`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(value => document.querySelector('.commerce-app')?.getAttribute('data-preset') === value, preset);
    const opening = page.locator('.shop-hero');
    if (preset === 'editorial') {
      await page.getByRole('region', { name: 'Featured product' }).getByRole('button', { name: 'Next photo' }).click();
      await opening.getByRole('button', { name: /^View product / }).waitFor();
    } else if (preset === 'market') {
      await opening.getByRole('heading', { name: 'Shop by category' }).waitFor();
      await opening.getByRole('button', { name: /Home.*products?/ }).click();
      await page.getByRole('status').filter({ hasText: 'products found' }).waitFor();
    } else if (preset === 'atelier') {
      await opening.getByRole('heading', { name: 'Material study' }).waitFor();
      await opening.getByRole('button', { name: /View .+ details/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: /View photo 2/ }).waitFor();
    } else {
      await opening.getByRole('heading', { name: /catalogue/ }).waitFor();
      await opening.getByRole('textbox', { name: 'Search products' }).fill('zzzz');
      await page.getByRole('heading', { name: 'No products found' }).waitFor();
    }
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await context.close();
    console.log(`PASS ${preset}: English opening`);
  }
  const context = await browser.newContext({ locale: 'en-US' });
  const page = await context.newPage();
  await page.goto(`${base}/?preset=market&level=whatsapp`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'View Canvas Book Pouch', exact: true }).first().click();
  const productDialog = page.getByRole('dialog', { name: 'Canvas Book Pouch', exact: true });
  await productDialog.getByRole('button', { name: 'Khaki', exact: true }).click();
  await productDialog.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('button', { name: 'View WhatsApp message' }).click();
  const message = await page.getByRole('textbox', { name: 'Shopping message preview' }).inputValue();
  assert.match(message, /I would like to order:/);
  assert.match(message, /Canvas Book Pouch/);
  assert.match(message, /Please confirm availability, shipping, and the final total/);
  await context.close();
  console.log('PASS English WhatsApp shopping message');
} finally { await browser.close(); }
