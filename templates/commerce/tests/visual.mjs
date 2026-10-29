import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.COMMERCE_TEST_URL || 'http://127.0.0.1:4174';
const out = path.resolve('test-results/visual');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { checkedAt: new Date().toISOString(), url: base, browser: browser.version(), views: [], keyboard: {}, failures: [] };
try {
  for (const preset of ['editorial', 'market', 'atelier', 'compact']) {
    for (const width of [320, 390, 768, 1440]) {
      for (const reduced of width === 390 || width === 1440 ? [false, true] : [false]) {
        const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
        const page = await context.newPage(); const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await page.goto(base, { waitUntil: 'networkidle' });
          await page.locator('.product-card').first().waitFor();
          await page.getByLabel('Preset desain').selectOption(preset);
          await page.waitForFunction(value => document.querySelector('.commerce-app')?.getAttribute('data-preset') === value, preset);
          await page.evaluate(async () => { await document.fonts.ready; for (const image of document.images) if (!image.complete) await new Promise(resolve => { image.onload = resolve; image.onerror = resolve; }); });
          await page.waitForTimeout(reduced ? 50 : 400);
          const facts = await page.evaluate(() => ({
            viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
            images: [...document.images].map(image => ({ src: image.getAttribute('src'), loaded: image.complete && image.naturalWidth > 0 })),
            emDashes: (document.body.innerText.match(/—/g) || []).length,
            headings: [...document.querySelectorAll('h1,h2')].map(h => h.textContent),
            reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          }));
          const filename = `${preset}-${width}-${reduced ? 'reduced' : 'normal'}.png`;
          await page.screenshot({ path: path.join(out, filename), fullPage: true });
          const checks = { overflow: facts.pageWidth <= width + 1, images: facts.images.every(image => image.loaded), copy: facts.emDashes === 0, runtime: errors.length === 0 };
          report.views.push({ preset, width, reducedMotion: reduced, screenshot: filename, facts, errors, checks });
          for (const [check, passed] of Object.entries(checks)) if (!passed) report.failures.push(`${preset}/${width}/${reduced}: ${check}`);
        } catch (error) { report.failures.push(`${preset}/${width}/${reduced}: ${error.message}`); }
        finally { await context.close(); }
      }
    }
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  const product = page.locator('.product-name').first(); await product.focus(); await product.press('Enter');
  await page.getByRole('dialog').waitFor();
  report.keyboard.dialogFocused = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
  report.keyboard.focusTrapped = true;
  for (let i = 0; i < 18; i++) { await page.keyboard.press('Tab'); if (!await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))) report.keyboard.focusTrapped = false; }
  await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
  report.keyboard.escapeCloses = true;
  report.keyboard.focusRestored = await product.evaluate(element => element === document.activeElement);
  await page.getByRole('button', { name: 'Staf', exact: true }).click();
  await page.getByRole('heading', { name: 'Ringkasan toko' }).waitFor();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('#staff-content > div:last-child')).opacity) > .99);
  await page.screenshot({ path: path.join(out, 'staff-390.png'), fullPage: true });
  await page.getByRole('button', { name: 'Buka menu staf' }).click();
  await page.waitForFunction(() => document.querySelector('.staff-sidebar').getBoundingClientRect().left >= -1);
  await page.screenshot({ path: path.join(out, 'staff-menu-390.png'), fullPage: false });
  report.keyboard.staffMenuFocused = await page.evaluate(() => Boolean(document.activeElement?.closest('.staff-sidebar')));
  report.keyboard.staffMenuTrapped = true;
  for (let i = 0; i < 20; i++) { await page.keyboard.press('Tab'); if (!await page.evaluate(() => Boolean(document.activeElement?.closest('.staff-sidebar')))) report.keyboard.staffMenuTrapped = false; }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.staff-sidebar')?.classList.contains('is-open'));
  report.keyboard.staffMenuClosed = true;
  report.keyboard.staffMenuFocusRestored = await page.getByRole('button', { name: 'Buka menu staf' }).evaluate(element => element === document.activeElement);
  await context.close();
} finally { await browser.close(); }
await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ views: report.views.length, keyboard: report.keyboard, failures: report.failures }, null, 2));
if (report.failures.length || Object.values(report.keyboard).some(value => !value)) process.exitCode = 1;
