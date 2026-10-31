import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'test-results/school'); await mkdir(out, { recursive: true });
const data = await mkdtemp(join(tmpdir(), 'school-browser-'));
const server = spawn(process.execPath, ['--experimental-strip-types', 'scripts/dev.mjs'], { cwd: root, env: { ...process.env, DEMO_MODE: 'true', PORT: '5176', SCHOOL_DATA_DIR: data }, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = ''; server.stdout.on('data', x => logs += x); server.stderr.on('data', x => logs += x);
const base = 'http://127.0.0.1:5176';
for (let i = 0; i < 200; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); if (i === 199) throw Error(logs); }
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const errors = [], results = []; let lastPage;
const layouts = ['academic-editorial', 'course-discovery', 'contemporary-learning', 'institutional'];
const presets = ['exam-prep', 'language', 'skills', 'institution'];
const palettes = ['cobalt', 'forest', 'neutral', 'burgundy'];
async function ready(page) { await page.locator('.school').waitFor(); await page.locator('#main-content').waitFor(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300); }
async function check(page) {
  const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, toolbar: document.querySelector('.tl-demo-toolbar')?.getBoundingClientRect().height, offset: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--demo-height')) }));
  assert.ok(sizes.scroll <= sizes.width + 1, `horizontal overflow ${JSON.stringify(sizes)}`);
  assert.ok(Math.abs(sizes.toolbar - sizes.offset) <= 1, 'toolbar height is measured');
  assert.equal(await page.locator('h1').count(), 1);
}
async function reveal(page) { await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } window.scrollTo(0, 0); }); await page.waitForTimeout(350); }
async function chromeContrast(page) {
  return page.evaluate(() => {
    const rgb = color => (color.match(/[\d.]+/g) || []).map(Number);
    const lum = color => { const a = rgb(color).slice(0, 3).map(c => { c /= 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }); return a[0] * .2126 + a[1] * .7152 + a[2] * .0722; };
    const contrast = (a, b) => { const v = [lum(a), lum(b)].sort((x, y) => y - x); return (v[0] + .05) / (v[1] + .05); };
    const toolbar = getComputedStyle(document.querySelector('.tl-demo-toolbar'));
    const selected = getComputedStyle(document.querySelector('.tl-demo-views .is-selected'));
    const select = getComputedStyle(document.querySelector('.tl-demo-select'));
    const menuEl = document.querySelector('[role=listbox]');
    const menu = menuEl && getComputedStyle(menuEl);
    return { opaque: rgb(toolbar.backgroundColor)[3] !== 0, text: contrast(toolbar.color, toolbar.backgroundColor), selected: contrast(selected.color, selected.backgroundColor), border: contrast(select.borderTopColor, toolbar.backgroundColor), menu: menu ? contrast(menu.color, menu.backgroundColor) : null, menuOpaque: menu ? rgb(menu.backgroundColor)[3] !== 0 : null };
  });
}
async function capture(page, options) {
  // Start at scroll zero so fixed chrome is not captured in the middle of a full-page image.
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
  await page.waitForTimeout(250);
  return page.screenshot(options);
}
async function clickNav(page, name) { await page.locator('.tl-demo-views').getByRole('link', { name, exact: true }).click(); await ready(page); }
async function pick(page, name, option) { await page.getByRole('combobox', { name, exact: true }).click(); await page.getByRole('option', { name: option, exact: true }).click(); }
async function waitStatus(page, value) { await page.locator(`.status-${value}`).first().waitFor(); }
try {
  for (const [i, layout] of layouts.entries()) for (const width of [360, 390, 1024, 1440]) for (const reduced of ['no-preference', 'reduce']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: reduced }); const page = await context.newPage(); lastPage=page; page.on('pageerror', e => errors.push(String(e)));
    const url = `${base}/?preset=${presets[i]}&level=full&layout=${layout}&theme=${palettes[i]}&typography=${i === 0 ? 'editorial' : 'modern'}&lang=en&view=visitor&campaign=preserved#main-content`;
    await page.goto(url); await ready(page); await check(page);
    const chrome = await chromeContrast(page);
    assert.ok(chrome.opaque, 'demo toolbar needs opaque background');
    assert.ok(chrome.text >= 4.5, 'demo text contrast');
    assert.ok(chrome.selected >= 4.5, 'selected role contrast');
    assert.ok(chrome.border >= 3, 'demo selector boundary contrast');
    const themeBefore = new URL(page.url()).searchParams.get('theme');
    const theme = page.getByRole('combobox', { name: 'Demo theme', exact: true }); await theme.focus(); await page.keyboard.press('Enter');
    assert.ok(await page.getByRole('listbox').isVisible());
    const menu = await chromeContrast(page);
    assert.ok(menu.menuOpaque && menu.menu >= 4.5, 'dropdown needs opaque contrasting surface');
    await page.keyboard.press('Escape'); assert.equal(await theme.evaluate(el => el === document.activeElement), true);
    const nextPalette = palettes[(i + 1) % palettes.length]; await pick(page, 'Demo theme', nextPalette[0].toUpperCase() + nextPalette.slice(1));
    assert.equal(new URL(page.url()).searchParams.get('level'), 'full'); assert.equal(new URL(page.url()).searchParams.get('layout'), layout);
    await pick(page, 'Demo theme', themeBefore[0].toUpperCase() + themeBefore.slice(1));
    await page.getByRole('button', { name: 'Switch to Indonesian' }).click(); await ready(page); assert.equal(new URL(page.url()).searchParams.get('lang'), 'id');
    await page.reload(); await ready(page); assert.ok(await page.getByRole('combobox', { name: 'Mode demo', exact: true }).isVisible());
    assert.equal(new URL(page.url()).searchParams.get('campaign'), 'preserved'); assert.equal(new URL(page.url()).hash, '#main-content');
    await page.getByRole('button', { name: 'Ganti ke bahasa Inggris' }).click(); await ready(page);
    await reveal(page); assert.ok(await page.locator('img').evaluateAll(imgs => imgs.every(x => x.complete && x.naturalWidth > 0)), 'photographs and brand assets loaded');
    if (reduced === 'no-preference' && [390, 1440].includes(width)) await capture(page, { path: join(out, `${layout}-${width}.png`), fullPage: true });
    if (width === 1440 && reduced === 'no-preference') { await page.setViewportSize({ width: 1280, height: 800 }); await ready(page); await capture(page, { path: join(out, `${layout}-preview.jpg`), type: 'jpeg', quality: 84 }); }
    results.push({ name: `visual ${layout} ${width} ${reduced}`, ok: true, chrome }); await context.close();
  }
  for (const preset of presets) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await context.newPage(); lastPage=page; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${base}/?preset=${preset}&level=full&layout=academic-editorial&theme=cobalt&lang=en&view=visitor`); await ready(page);
    await page.getByRole('link', { name: 'Apply to join', exact: true }).first().click(); await page.getByRole('heading', { name: 'Start your application' }).waitFor();
    await page.getByRole('combobox', { name: 'Class & intake' }).click(); await page.getByRole('option').first().click();
    const form = page.locator('form.form-stack');
    if (preset === 'exam-prep') await pick(page, 'Target exam *', 'UTBK');
    if (preset === 'language') await pick(page, 'Current level *', 'Pemula / Beginner');
    if (preset === 'skills') await form.getByRole('textbox', { name: 'Your goal *' }).fill('Practice a useful professional skill.');
    if (preset === 'institution') await pick(page, 'Entry year *', 'Kelas 10');
    await form.locator('input[type=checkbox]').check();
    if(preset==='exam-prep') {
      await page.getByRole('button', { name: 'Save draft', exact:true }).click(); await waitStatus(page,'draft');
      await page.getByRole('button', { name: 'Continue draft', exact:true }).click(); await page.getByRole('heading',{name:'Start your application'}).waitFor();
      assert.equal(await page.getByRole('combobox',{name:'Target exam *'}).innerText(),'UTBK');
    }
    await capture(page, { path: join(out, `${preset}-application-mobile.png`), fullPage: true });
    await page.getByRole('button', { name: 'Submit application', exact: true }).click(); await waitStatus(page, 'submitted');
    await clickNav(page, 'Staff'); await page.locator('.workspace-nav').getByRole('link', { name: 'Applications', exact: true }).click(); await ready(page);
    await page.getByRole('button', { name: 'Review application', exact: true }).first().click();
    await page.getByRole('button', { name: 'accepted', exact: true }).click(); await page.getByRole('button', { name: 'Save decision', exact: true }).click(); await waitStatus(page, 'awaiting_payment');
    await clickNav(page, 'Student'); await waitStatus(page, 'awaiting_payment');
    await page.getByRole('button', { name: 'Simulate successful payment', exact: true }).click(); await waitStatus(page, 'active');
    assert.ok(await page.getByRole('link', { name: 'Download', exact: true }).count());
    await check(page); await capture(page, { path: join(out, `${preset}-student-mobile.png`), fullPage: true });
    const before = new URL(page.url()); before.searchParams.set('view', 'guardian'); await page.goto(before.href); await ready(page); await waitStatus(page, 'active');
    await page.getByRole('button', { name: 'Appearance & demo options', exact:true }).click(); await page.getByRole('button', {name:'Try as tutor',exact:true}).click(); await ready(page); await page.getByRole('heading',{name:'Learning & attendance',exact:true}).waitFor();
    const changeLevel = new URL(page.url()); changeLevel.searchParams.set('level','enrollment');changeLevel.searchParams.set('view','student');changeLevel.searchParams.set('page','portal');await page.goto(changeLevel.href);await ready(page);await waitStatus(page,'active');
    assert.equal(await page.getByRole('button',{name:'Simulate successful payment',exact:true}).count(),0);
    changeLevel.searchParams.set('level','full');await page.goto(changeLevel.href);await ready(page);await waitStatus(page,'active');
    await page.getByRole('button', { name: 'Cancel application', exact: true }).click(); await page.getByRole('button', {name:'Confirm cancellation',exact:true}).click(); await waitStatus(page,'cancelled');
    results.push({ name: `enrollment staff payment guardian tutor cancellation ${preset}`, ok: true }); await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 } }); const p = await context.newPage(); lastPage=p; p.on('pageerror', e => errors.push(String(e)));
  await p.goto(`${base}/?preset=exam-prep&level=profile&lang=en&view=staff&page=staff&tab=content`); await ready(p);
  await p.getByLabel('Title', { exact: true }).fill('A school that grows with you');
  await p.getByRole('button', { name: 'Save draft', exact: true }).click(); await p.getByRole('status').filter({ hasText: 'Changes saved.' }).first().waitFor();
  await p.getByRole('button', { name: 'Publish', exact: true }).click(); await p.waitForTimeout(350);
  await capture(p, { path: join(out, 'content-studio-1024.png'), fullPage: true });
  await clickNav(p, 'Visitor'); await p.getByRole('heading', { level: 1, name: 'A school that grows with you' }).waitFor();
  assert.equal(await p.getByRole('link', { name: 'Apply to join', exact: true }).count(), 0);
  await pick(p, 'Demo mode', 'WhatsApp'); await ready(p); await p.getByRole('link', { name: 'Ask on WhatsApp', exact: true }).first().click(); await p.getByRole('heading', { name: 'Discuss your learning needs' }).waitFor();
  assert.ok(await p.getByText('This is an inquiry, not an enrollment confirmation.', { exact: false }).count());
  await pick(p, 'Demo mode', 'Full'); await ready(p); await clickNav(p, 'Staff');
  for (const name of ['Overview', 'Programs', 'Intakes', 'Schedule', 'Learner records', 'Tuition', 'Learning', 'Accounts & access', 'Settings']) { await p.locator('.workspace-nav').getByRole('link', { name, exact: true }).click(); await ready(p); await check(p); }
  await capture(p, { path: join(out, 'staff-1024.png'), fullPage: true });
  results.push({ name: 'CMS publication, Profile/WhatsApp gates and staff screens', ok: true });
  await context.close();
  const navctx = await browser.newContext({viewport:{width:390,height:844}}); const nav = await navctx.newPage(); lastPage=nav;nav.on('pageerror',e=>errors.push(String(e)));
  await nav.goto(`${base}/?preset=language&level=full&lang=en&layout=course-discovery&theme=forest&view=visitor&campaign=keep#main-content`);await ready(nav);
  await nav.getByRole('button',{name:'Appearance & demo options',exact:true}).click();
  await pick(nav,'Page layout','Institutional');await pick(nav,'Typography','humanist');await nav.getByRole('button',{name:'Close',exact:true}).click();await ready(nav);
  assert.equal(new URL(nav.url()).searchParams.get('layout'),'institutional');assert.equal(new URL(nav.url()).searchParams.get('theme'),'forest');assert.equal(new URL(nav.url()).searchParams.get('preset'),'language');
  await nav.reload();await ready(nav);assert.equal(await nav.locator('html').getAttribute('data-typography'),'humanist');
  await pick(nav,'Demo theme','Burgundy');await nav.goBack();await ready(nav);assert.equal(new URL(nav.url()).searchParams.get('theme'),'forest');await nav.goForward();await ready(nav);assert.equal(new URL(nav.url()).searchParams.get('theme'),'burgundy');
  await pick(nav,'Business preset','Skills training');await ready(nav);assert.equal(new URL(nav.url()).searchParams.get('layout'),'institutional');assert.equal(new URL(nav.url()).searchParams.get('theme'),'burgundy');assert.equal(new URL(nav.url()).searchParams.get('campaign'),'keep');assert.equal(new URL(nav.url()).hash,'#main-content');
  results.push({name:'appearance, typography, preset and browser history remain independent',ok:true});await navctx.close();
  assert.deepEqual(errors, []);
} catch(error) {
  if(lastPage && !lastPage.isClosed()) {await lastPage.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});await writeFile(join(out,'failure.html'),await lastPage.content().catch(()=>''));await writeFile(join(out,'failure.txt'),String(error));}
  throw error;
} finally {
  await writeFile(join(out, 'results.json'), JSON.stringify({ results, errors }, null, 2)); await writeFile(join(out, 'server.log'), logs);
  await browser.close(); server.kill('SIGTERM'); await rm(data, { recursive: true, force: true });
}
console.log(`School browser checks passed: ${results.length}. Screenshots: ${out}`);
