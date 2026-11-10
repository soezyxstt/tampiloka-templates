#!/usr/bin/env node
import { chooseDemoStaff, enterTableMenu, openDemoOptions } from './demo-controls.mjs';
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
const selectedIds = process.env.CAFE_DEMO_PRESETS?.split(',');
if (selectedIds) for (const id of selectedIds) assert.ok(DEMOS.some(demo => demo.id === id), `Unknown preset: ${id}`);
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
    const select = document.querySelector('.tl-demo-toolbar [aria-label="Identitas staf demo"]');
    const aside = document.querySelector('.cafe-staff > aside');
    if (!select || !aside || innerWidth !== width || innerHeight !== height) return false;
    const expectedSelectorWidth = select.getBoundingClientRect().width;
    const expectedSidebarDisplay = width >= 1280 ? 'flex' : 'none';
    return expectedSelectorWidth >= 44 && select.getBoundingClientRect().right <= innerWidth + 1
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
    const selectors = ['.tl-demo-brand', '.tl-demo-toolbar [aria-label="Opsi demo"]', '.tl-demo-toolbar [aria-label="Identitas staf demo"]', '.cafe-staff > header [aria-label="Perbarui data operasional"]'];
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
    const select = null;
    let longestLabel = 0, labelSpace = 0;
    if (select) {
      const style = getComputedStyle(select);
      const canvas = document.createElement('canvas').getContext('2d');
      canvas.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      longestLabel = Math.max(...[...select.options].map(option => canvas.measureText(option.textContent).width));
      labelSpace = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    }
    return { width: innerWidth, height: innerHeight, scrollY, scrollWidth: document.documentElement.scrollWidth, toolbar: rect('.tl-demo-toolbar'), root: rect('.cafe-staff'), sidebar: rect('.cafe-staff > aside'), header: rect('.cafe-staff > header'), main: rect('#staff-content'), scenarios: rect('.tl-demo-toolbar'), obscured, longestLabel, labelSpace };
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
      assert.ok(Math.abs(g.header.y - g.toolbar.bottom) < 1.5, `${name}: header not sticky below demo controls`);
      assert.ok(Math.abs(g.sidebar.y - g.toolbar.bottom) < 1.5, `${name}: sidebar not sticky below demo controls`);
      assert.ok(g.sidebar.bottom <= g.height + 1.5, `${name}: sidebar exceeds viewport`);
    }
  } else {
    assert.equal(g.sidebar.display, 'none', `${name}: desktop sidebar visible below breakpoint`);
    assert.ok(Math.abs(g.main.x) < 1.5, `${name}: leftover desktop gutter`);
  }
  assert.ok(g.labelSpace >= g.longestLabel, `${name}: staff name/role clipped (${g.labelSpace}/${g.longestLabel})`);
  pass(name, g);
}

async function verifyFloorService(page, context, demo) {
  await resize(page, 1024);
  const floor = p => p.locator('.staff-mobile-nav').getByRole('button', { name: /^Meja & Antrean/ });
  await floor(page).click();
  const read = p => p.evaluate(async () => (await (await fetch('/api/v1/snapshot?surface=staff')).json()).data);
  const initial = await read(page);
  for (const room of initial.rooms) {
    await page.getByRole('combobox', { name: 'Area kunjungan', exact: true }).selectOption(room.id);
    for (const table of initial.tables.filter(t => t.roomId === room.id)) {
      const node = page.locator(`svg [data-table-id="${table.id}"]`);
      assert.equal(await node.locator('[data-chair]').count(), table.capacity, `${table.label}: configured chair count`);
      await node.focus(); await page.keyboard.press('Space');
      assert.equal(await node.getAttribute('aria-pressed'), 'true');
      const details = page.locator('[aria-label="Detail meja terpilih"]');
      await details.getByRole('heading', { name: `Meja ${table.label}`, exact: true }).waitFor();
      assert.ok((await details.innerText()).includes(`${Number(table.widthMm) / 10} × ${Number(table.heightMm) / 10} cm`));
    }
  }
  pass('Floor map: all nine table selections, configured chairs, dimensions and keyboard operation');
  await page.getByRole('combobox', { name: 'Area kunjungan', exact: true }).selectOption('room_indoor');
  await page.locator('svg [data-table-id="tbl_m04"]').click();
  for (const width of [390, 768, 1024, 1280, 1440]) {
    await resize(page, width); await top(page);
    const measure = await page.evaluate(() => {
      const map = document.querySelector('[data-testid="floor-plan-svg-container"]');
      const panel = document.querySelector('[aria-label="Detail meja terpilih"]');
      const canvas = map.querySelector('svg');
      const r = map.getBoundingClientRect(), d = panel.getBoundingClientRect();
      return { width: innerWidth, scroll: document.documentElement.scrollWidth, map: { x:r.x, right:r.right }, panel: {x:d.x, right:d.right}, labels: [...canvas.querySelectorAll('text')].map(e => parseFloat(getComputedStyle(e).fontSize) * e.getScreenCTM().a), targets: [...canvas.querySelectorAll('rect[class*="hit"]')].map(e => { const b=e.getBoundingClientRect();return {width:b.width,height:b.height}; }) };
    });
    assert.ok(measure.scroll <= width + 1, `Floor map contains its own scrolling at ${width}px`);
    assert.ok(measure.labels.every(size => size >= 11.99), `Floor labels at least 12px at ${width}px`);
    assert.ok(measure.targets.every(r => r.width >= 43.99 && r.height >= 43.99), 'Table hit zones retain 44px targets');
    if (width >= 1024) assert.ok(measure.panel.x >= measure.map.right, 'Map and contextual actions use horizontal space');
    await page.screenshot({path:join(out, `floor-service-${width}.png`),animations:'disabled'});
    pass(`Floor service ${width}px: no document overflow, legible labels and accessible table targets`);
  }
  for (const width of [390, 768]) {
    await resize(page, width);
    const selected = page.locator('svg [data-table-id="tbl_m04"]');
    await selected.focus(); await page.keyboard.press('Enter');
    const detail = page.getByRole('dialog', {name:'Detail meja',exact:true});
    await detail.getByRole('heading',{name:'Meja M04',exact:true}).waitFor();
    await detail.getByRole('button',{name:'Tinjau kepulangan',exact:true}).click();
    await page.getByRole('dialog',{name:'Selesaikan kunjungan',exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await detail.waitFor();
    await page.screenshot({path:join(out, `floor-detail-${width}.png`),animations:'disabled'});
    await page.keyboard.press('Escape');
    await detail.waitFor({state:'hidden'});
    assert.equal(await selected.evaluate(e=>document.activeElement===e),true,'Closing details returns keyboard focus to the selected SVG table');
    pass(`Floor service ${width}px: table detail sheet, nested departure review, Escape and focus return`);
  }
  await resize(page, 1024); await top(page);
  const observer = await context.newPage();
  observer.on('pageerror', error => pageErrors.push({ preset: demo.id, message: error.message }));
  await observer.setViewportSize({width:768,height:1000});
  await observer.goto(urlFor(demo)+'?staff=staff_waiter&lang=id');
  await observer.locator('button[aria-label="Opsi demo"]:not(:disabled)').waitFor({timeout:120000});
  await floor(observer).click();
  const tableId='tbl_m05';
  await page.locator(`svg [data-table-id="${tableId}"]`).click();
  await observer.locator(`svg [data-table-id="${tableId}"]`).click();
  await page.getByRole('button',{name:'Tandai bersih & siap',exact:true}).click();
  await observer.getByRole('button',{name:'Tempatkan tamu di sini',exact:true}).waitFor();
  assert.equal(await observer.locator(`svg [data-table-id="${tableId}"]`).getAttribute('data-state'),'ready');
  // Disable through the editor, then reactivate and inspect/clean from visits.
  await page.getByRole('group',{name:'Sub-menu operasional lantai',exact:true}).getByRole('button',{name:'Atur denah',exact:true}).click();
  await page.getByRole('button',{name:/^Meja M05 ·/}).click();
  await page.getByRole('button',{name:'Nonaktifkan Sementara',exact:true}).click();
  await observer.getByRole('button',{name:'Aktifkan meja',exact:true}).waitFor();
  assert.equal(await observer.locator(`svg [data-table-id="${tableId}"]`).getAttribute('data-state'),'inactive');
  await observer.getByRole('button',{name:'Aktifkan meja',exact:true}).click();
  await observer.getByRole('button',{name:'Tandai bersih & siap',exact:true}).waitFor();
  assert.equal(await observer.getByRole('button',{name:'Tempatkan tamu di sini',exact:true}).count(),0,'Reactivation cannot bypass cleaning');
  await observer.getByRole('button',{name:'Tandai bersih & siap',exact:true}).click();
  await observer.getByRole('button',{name:'Tempatkan tamu di sini',exact:true}).waitFor();
  await page.getByRole('group',{name:'Sub-menu operasional lantai',exact:true}).getByRole('button',{name:'Kunjungan aktif',exact:true}).click();
  await page.locator(`svg [data-table-id="${tableId}"]`).click();
  await page.getByRole('button',{name:'Tempatkan tamu di sini',exact:true}).click();
  const seating=page.getByRole('dialog',{name:'Tempatkan tamu',exact:true});
  assert.equal(await seating.getByLabel('Meja untuk tamu',{exact:true}).inputValue(),tableId,'Clicking a ready table preselects exactly that table');
  await seating.getByLabel('Nama tamu',{exact:true}).fill('Rani Denah');
  await seating.getByRole('button',{name:'Mulai kunjungan',exact:true}).click();
  await observer.getByRole('article',{name:'Kunjungan Rani Denah',exact:true}).waitFor();
  assert.equal(await observer.locator(`svg [data-table-id="${tableId}"]`).getAttribute('data-state'),'occupied');
  await observer.getByRole('button',{name:'Tinjau kepulangan',exact:true}).click();
  await observer.getByRole('dialog',{name:'Selesaikan kunjungan',exact:true}).getByRole('button',{name:'Konfirmasi tamu pulang',exact:true}).click();
  await page.getByRole('button',{name:'Tandai bersih & siap',exact:true}).waitFor();
  await observer.close();
  await page.screenshot({path:join(out,'floor-service-cross-tab.png'),animations:'disabled'});
  await page.getByRole('button',{name:'Ganti bahasa ke Inggris',exact:true}).click();
  await page.getByRole('button',{name:'Mark clean & ready',exact:true}).waitFor();
  assert.equal(await page.locator(`svg [data-table-id="${tableId}"]`).getAttribute('data-state'),'dirty');
  assert.ok((await page.locator(`svg [data-table-id="${tableId}"]`).getAttribute('aria-label')).includes('2 seats'));
  await page.reload();
  await page.locator('button[aria-label="Demo options"]:not(:disabled)').waitFor({timeout:120000});
  await page.locator('.staff-mobile-nav').getByRole('button',{name:/^Tables & waitlist/}).click();
  await page.locator(`svg [data-table-id="${tableId}"]`).click();
  await page.getByRole('button',{name:'Mark clean & ready',exact:true}).waitFor();
  await page.screenshot({path:join(out,'floor-service-en-reload.png'),animations:'disabled'});
  pass('Two staff tabs: cleaning, deactivation, reactivation, seating and departure sync without refresh; locale and reload retain business state');
}

try {
  for (const demo of DEMOS.filter(demo => demo.staffPath !== undefined && (!selectedIds || selectedIds.includes(demo.id)))) {
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
        const button = document.querySelector('button[aria-label="Opsi demo"]');
        return button && !button.disabled;
      }, null, { timeout: 120000 });
      const localOnly = await page.evaluate(async () => (await (await fetch('/api/v1/snapshot?surface=staff')).json()).data?.runtime?.localOnly);
      assert.equal(localOnly, true, 'Refusing interactive checks outside an isolated demo.');
      await chooseDemoStaff(page, 'staff_manager');
      await page.locator('.cafe-staff > header').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await top(page);

      // Negative controls live only in this isolated page and are removed before
      // continuing. The test must catch both the original bug and real overflow.
      if (demo.id === 'cashier') {
        const originalPosition = await page.addStyleTag({ content: '.cafe-staff > aside {position:fixed!important;inset:0 auto 0 0!important;width:232px!important;z-index:1000!important;}' });
        await page.waitForFunction(() => { const side = document.querySelector('.cafe-staff > aside'); return side && getComputedStyle(side).position === 'fixed' && side.getBoundingClientRect().y === 0; });
        await settle(page);
        const negative = await geometry(page);
        assert.ok(negative.obscured.some(entry => entry.selector === '.tl-demo-brand'), 'The regression detector failed to catch the original sidebar overlapping demo context.');
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
        await page.locator('.tl-demo-brand').click({ trial: true });
        if ([1280, 1920].includes(width)) {
          await openDemoOptions(page);
          const tools = page.getByRole('dialog', { name: 'Pengaturan' });
          await tools.getByText('Data untuk mencoba alur operasional', { exact: true }).click();
          const popup = await tools.boundingBox();
          assert.ok(popup.x >= -1 && popup.x + popup.width <= width + 1, 'Demo tools stay within the viewport');
          await page.screenshot({ path: join(out, `${demo.id}-${width}-expanded.png`), animations: 'disabled' });
          await page.keyboard.press('Escape');
          await top(page);
          await top(page);
        }
        await page.evaluate(() => scrollTo({ top: 650, behavior: 'instant' }));
        await settle(page);
        await assertLayout(page, `${demo.id} ${width}px scrolled`, { atTop: false });
        if (width === 1920) await page.screenshot({ path: join(out, `${demo.id}-${width}-scroll.png`), animations: 'disabled' });
      }
      await resize(page, 1920);
      await top(page);
      const newOrder = page.locator('#staff-content').getByRole('heading', { level: 1 }).locator('..').getByRole('button', { name: 'Pesanan baru', exact: true });
      if (await newOrder.count()) {
        await newOrder.click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        assert.ok(await dialog.evaluate(element => { const r = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(30, r.height / 2))); }), `${demo.id}: dialog is behind the staff shell`);
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        pass(`${demo.id}: new-order dialog remains above staff shell`);
      }
      if (demo.id === 'full') await verifyFloorService(page, context, demo);
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
console.log(`Staff layout: ${checks.length} checks passed across ${selectedIds?.length || DEMOS.length} selected staff presets.`);

