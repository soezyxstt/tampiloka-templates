#!/usr/bin/env node
/** Staff-shell geometry and hit-target checks. Run locally via test:demo-all,
 * or against the public demos with CAFE_DEMO_BASE_DOMAIN=tampiloka.site.
 * Every browser has isolated demo storage; real network writes are blocked.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { DEMOS } from '../demos/manifest.ts';

const base = new URL(process.env.CAFE_DEMO_BASE_URL || 'http://127.0.0.1:4174');
const domain = process.env.CAFE_DEMO_BASE_DOMAIN?.trim();
assert.ok(['http:', 'https:'].includes(base.protocol));
if (domain) assert.match(domain, /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i);
const out = resolve(process.env.CAFE_LAYOUT_OUTPUT || 'test-results/staff-layout');
const widths = [390, 768, 1024, 1279, 1280, 1440, 1920, 2560];
const checks = [], failures = [], pageErrors = [], consoleErrors = [], networkWrites = [];
const startedAt = new Date().toISOString();
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const urlFor = demo => domain
  ? `https://${demo.subdomain}.${domain}/staff`
  : `${base.href.replace(/\/$/, '')}/p/${demo.id}/staff`;
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const top = async page => { await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await settle(page); };
function pass(name, details = {}) { checks.push({ name, ...details }); console.log(`PASS ${name}`); }

async function resize(page, width) {
  const height = width < 768 ? 844 : 1000;
  await page.setViewportSize({ width, height });
  // Chromium can expose the new innerWidth before applying media-query styles.
  // Wait for the responsive contract, never for overflow itself to disappear.
  // A broken breakpoint still fails within 5 seconds; the independent geometry
  // assertions below continue to reject overflow and covered controls.
  await page.waitForFunction(({ width, height }) => {
    const select = document.querySelector('.cafe-staff > header select[aria-label="Petugas aktif"]');
    const aside = document.querySelector('.cafe-staff > aside');
    if (!select || !aside || innerWidth !== width || innerHeight !== height) return false;
    const expectedSelectorWidth = width >= 768 ? 280 : width - 32;
    const expectedSidebarDisplay = width >= 1280 ? 'flex' : 'none';
    return Math.abs(select.parentElement.getBoundingClientRect().width - expectedSelectorWidth) < 1
      && getComputedStyle(aside).display === expectedSidebarDisplay
      && matchMedia('(min-width: 768px)').matches === (width >= 768)
      && matchMedia('(min-width: 1280px)').matches === (width >= 1280);
  }, { width, height }, { timeout: 5000 });
  await page.evaluate(() => document.fonts.ready);
}

async function geometry(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom, display: getComputedStyle(element).display };
    };
    const selectors = ['.demo-back', '.demo-context > summary', '.demo-scenarios > summary', '.cafe-staff > header [aria-label="Petugas aktif"]', '.cafe-staff > header [aria-label="Perbarui data operasional"]', '.cafe-staff > header [aria-label="Keluar dari portal staf"]'];
    const obscured = selectors.flatMap(selector => {
      const element = document.querySelector(selector);
      if (!element) return [{ selector, reason: 'missing' }];
      const r = element.getBoundingClientRect();
      if (!r.width || !r.height) return [{ selector, reason: 'hidden' }];
      return [Math.min(12, r.width / 2), r.width / 2, r.width - Math.min(12, r.width / 2)].flatMap(dx => {
        const x = r.left + dx, y = r.top + r.height / 2;
        if (y < 0 || y >= innerHeight) return [];
        const hit = document.elementFromPoint(x, y);
        return element.contains(hit) ? [] : [{ selector, x, y, coveredBy: hit?.tagName, className: hit?.className }];
      });
    });
    const select = document.querySelector('select[aria-label="Petugas aktif"]');
    let longestLabel = 0, labelSpace = 0;
    if (select) {
      const style = getComputedStyle(select);
      const canvas = document.createElement('canvas').getContext('2d');
      canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      longestLabel = Math.max(...[...select.options].map(option => canvas.measureText(option.textContent).width));
      labelSpace = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    }
    return { width: innerWidth, height: innerHeight, scrollY, scrollWidth: document.documentElement.scrollWidth, root: rect('.cafe-staff'), sidebar: rect('.cafe-staff > aside'), header: rect('.cafe-staff > header'), main: rect('#staff-content'), scenarios: rect('.demo-scenarios'), obscured, longestLabel, labelSpace };
  });
}

async function assertLayout(page, name, { atTop = true } = {}) {
  const g = await geometry(page);
  assert.ok(g.scrollWidth <= g.width + 1, `${name}: horizontal overflow ${g.scrollWidth}/${g.width}`);
  assert.deepEqual(g.obscured, [], `${name}: covered controls ${JSON.stringify(g.obscured)}`);
  if (g.width >= 1280) {
    assert.equal(g.sidebar.display, 'flex', `${name}: desktop sidebar missing`);
    assert.ok(Math.abs(g.header.x - g.sidebar.right) < 1.5, `${name}: duplicate sidebar gutter`);
    assert.ok(Math.abs(g.main.x - g.sidebar.right) < 1.5, `${name}: content under sidebar`);
    if (atTop) {
      assert.ok(g.sidebar.y >= g.scenarios.bottom - 1, `${name}: sidebar overlaps demo controls`);
      assert.ok(Math.abs(g.header.y - g.sidebar.y) < 1.5, `${name}: misaligned sidebar/header`);
      assert.ok(g.main.y >= g.header.bottom - 1, `${name}: content overlaps header`);
    } else if (g.scrollY > 300) {
      assert.ok(Math.abs(g.header.y) < 1.5, `${name}: header not sticky`);
      assert.ok(Math.abs(g.sidebar.y) < 1.5, `${name}: sidebar not sticky`);
      assert.ok(g.sidebar.bottom <= g.height + 1.5, `${name}: sidebar exceeds viewport`);
    }
  } else {
    assert.equal(g.sidebar.display, 'none', `${name}: desktop sidebar visible below breakpoint`);
    assert.ok(Math.abs(g.main.x) < 1.5, `${name}: leftover desktop gutter`);
  }
  assert.ok(g.labelSpace >= g.longestLabel, `${name}: staff name/role clipped (${g.labelSpace}/${g.longestLabel})`);
  pass(name, g);
}

try {
  for (const demo of DEMOS.filter(demo => demo.staffPath !== undefined)) {
    const context = await browser.newContext({ locale: 'id-ID', viewport: { width: 1920, height: 1000 }, reducedMotion: 'reduce' });
    await context.route('**/*', route => {
      if (['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.continue();
      networkWrites.push({ preset: demo.id, method: route.request().method(), url: route.request().url() });
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => pageErrors.push({ preset: demo.id, message: error.message }));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push({ preset: demo.id, message: message.text() }); });
    try {
      const response = await page.goto(urlFor(demo), { waitUntil: 'domcontentloaded', timeout: 120000 });
      assert.ok(response?.ok(), `${demo.id}: HTTP ${response?.status()}`);
      await page.waitForFunction(() => {
        const button = document.querySelector('button[aria-label="Ulangi demo"]');
        return button && !button.disabled;
      }, null, { timeout: 120000 });
      const localOnly = await page.evaluate(async () => (await (await fetch('/api/v1/snapshot?surface=staff')).json()).data?.runtime?.localOnly);
      assert.equal(localOnly, true, 'Refusing interactive checks outside an isolated demo.');
      await page.getByRole('button', { name: 'Nadia Kusuma Manajer Operasional', exact: true }).click();
      await page.locator('.cafe-staff > header').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await top(page);

      // Negative controls live only in this isolated page and are removed before
      // continuing. The test must catch both the original bug and real overflow.
      if (demo.id === 'cashier') {
        const originalPosition = await page.addStyleTag({ content: '.cafe-staff > aside {position:fixed!important;inset:0 auto 0 0!important;width:232px!important;}' });
        const negative = await geometry(page);
        assert.ok(negative.obscured.some(entry => entry.selector === '.demo-back'), 'The regression detector failed to catch the original overlapping sidebar.');
        await page.screenshot({ path: join(out, 'negative-control-fixed-sidebar.png'), animations: 'disabled' });
        await originalPosition.evaluate(element => element.remove());
        await settle(page);
        pass('Negative control catches the original fixed-sidebar overlap');
        await resize(page, 390);
        await top(page);
        const overflow = await page.addStyleTag({ content: '#staff-content { min-width: 500px !important; }' });
        try {
          // Assert that the injected defect has actually reached browser layout.
          await page.waitForFunction(() => { const main=document.getElementById('staff-content'); return main && getComputedStyle(main).minWidth==='500px' && main.getBoundingClientRect().width>=500; }, null, { timeout:5000 });
          await settle(page);
          await assert.rejects(() => assertLayout(page, 'Injected persistent overflow'), /horizontal overflow/);
        } finally {
          await overflow.evaluate(element => element.remove());
          await settle(page);
        }
        pass('Negative control still rejects persistent overflow after viewport synchronization');
      }
      if (demo.id === 'operations') {
        for (let cycle = 1; cycle <= 3; cycle++) {
          for (const width of [1920, 390]) {
            await resize(page, width);
            await top(page);
            await assertLayout(page, `${demo.id} resize cycle ${cycle} ${width}px`);
          }
        }
      }

      for (const width of widths) {
        await resize(page, width);
        await top(page);
        await assertLayout(page, `${demo.id} ${width}px top`);
        if ([390, 1024, 1280, 1920].includes(width)) await page.screenshot({ path: join(out, `${demo.id}-${width}-top.png`), animations: 'disabled' });
        // Trial clicks detect overlays without navigating away or changing data.
        await page.locator('.demo-back').click({ trial: true });
        if ([1280, 1920].includes(width)) {
          await page.locator('.demo-context > summary').click();
          await page.locator('.demo-scenarios > summary').click();
          await top(page);
          await assertLayout(page, `${demo.id} ${width}px expanded disclosures`);
          await page.screenshot({ path: join(out, `${demo.id}-${width}-expanded.png`), animations: 'disabled' });
          await page.locator('.demo-scenarios > summary').click();
          await page.locator('.demo-context > summary').click();
          await top(page);
        }
        await page.evaluate(() => scrollTo({ top: 650, behavior: 'instant' }));
        await settle(page);
        await assertLayout(page, `${demo.id} ${width}px scrolled`, { atTop: false });
        if (width === 1920) await page.screenshot({ path: join(out, `${demo.id}-${width}-scroll.png`), animations: 'disabled' });
      }
      await resize(page, 1920);
      await top(page);
      const newOrder = page.getByRole('button', { name: 'Pesanan baru', exact: true });
      if (await newOrder.count()) {
        await newOrder.click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        assert.ok(await dialog.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(30, r.height / 2))); }), `${demo.id}: dialog is behind the staff shell`);
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        pass(`${demo.id}: new-order dialog remains above staff shell`);
      }
    } catch (error) {
      failures.push({ preset: demo.id, message: error.stack || String(error) });
      console.error(`FAIL ${demo.id}: ${error.message}`);
      await page.screenshot({ path: join(out, `${demo.id}-failure.png`), animations: 'disabled' }).catch(() => {});
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  const report = { startedAt, completedAt: new Date().toISOString(), target: domain || base.href, widths, checks, failures, pageErrors, consoleErrors, networkWrites };
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
}
assert.deepEqual(failures, [], 'Staff layout regression checks failed.');
assert.deepEqual(pageErrors, [], 'Unexpected browser exceptions.');
assert.deepEqual(consoleErrors, [], 'Unexpected console errors.');
assert.deepEqual(networkWrites, [], 'No public-server mutations are permitted.');
console.log(`Staff layout: ${checks.length} checks passed across all nine staff presets.`);
