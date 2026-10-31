import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
const base = process.env.SCHOOL_URL ?? 'http://127.0.0.1:5176';
const out = resolve(process.env.SCHOOL_SCREENSHOTS ?? 'test-results/school');
await mkdir(out, { recursive: true });
let server;
if (!process.env.SCHOOL_URL) {
    server = spawn(process.execPath, ['--experimental-strip-types', 'scripts/dev.mjs', '--demo'], { stdio: 'inherit', env: { ...process.env, PORT: '5176' } });
}
for (let n = 0; n < 100; n++) {
    try {
        if ((await fetch(base + '/api/health')).ok)
            break;
    }
    catch { }
    if (n === 99)
        throw new Error('School server did not become ready');
    await delay(300);
}
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}), args: ['--no-sandbox'] });
const results = [];
const errors = [];
let lastPage;
const layouts = ['academic-editorial', 'course-discovery', 'contemporary-learning', 'institutional'];
const presets = ['exam-prep', 'language', 'skills', 'institution'];
const palettes = ['cobalt', 'forest', 'neutral', 'burgundy'];
function track(page) { lastPage = page; page.on('pageerror', e => errors.push(e.message)); }
async function ready(page) { await page.locator('.tl-demo-toolbar').waitFor(); await page.locator('#main-content').waitFor(); await page.evaluate(() => document.fonts.ready); await page.locator('img').evaluateAll(imgs => Promise.all(imgs.filter(i => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight).map(i => i.decode().catch(() => { })))); await page.waitForTimeout(300); }
async function revealAll(page) { await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) {
    scrollTo(0, y);
    await new Promise(r => setTimeout(r, 40));
} await Promise.all([...document.images].map(i => i.decode().catch(() => { }))); scrollTo(0, 0); }); await page.waitForTimeout(500); }
async function overflow(page, label) { const size = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth })); assert.ok(size.body <= size.viewport + 1 && size.document <= size.viewport + 1, `${label}: horizontal page overflow ${JSON.stringify(size)}`); const toolbar = await page.locator('.tl-demo-toolbar').boundingBox(); const measured = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--demo-height'))); assert.ok(Math.abs(measured - toolbar.height) <= 1, `${label}: toolbar height mismatch`); }
async function pick(page, name, label) { await page.getByRole('combobox', { name, exact: true }).click(); await page.getByRole('option', { name: label, exact: true }).click(); }
async function current(page, role = 'student') { const u = new URL(page.url()); const r = await page.request.get(`${base}/api/bootstrap?${u.searchParams}`, { headers: { 'X-Demo-Role': role } }); assert.equal(r.status(), 200); return r.json(); }
async function navigate(page, patch) { const u = new URL(page.url()); for (const [k, v] of Object.entries(patch))
    u.searchParams.set(k, v); await page.goto(u.href); await ready(page); }
async function fillRegistration(page, s) { for (const f of s.registrationFields.filter(f => f.required)) {
    if (f.type === 'select')
        await pick(page, f.label.en + ' *', f.options[0]);
    else if (f.type === 'checkbox')
        await page.getByLabel(f.label.en, { exact: false }).check();
    else
        await page.getByLabel(f.label.en + ' *', { exact: true }).fill('Fictional learning goal');
} await page.getByLabel('I understand this application still requires review.', { exact: true }).check(); }
try {
    for (let i = 0; i < layouts.length; i++)
        for (const width of [360, 390, 1024, 1440])
            for (const reducedMotion of ['no-preference', 'reduce']) {
                const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion });
                const page = await ctx.newPage();
                track(page);
                await page.goto(`${base}/?layout=${layouts[i]}&preset=${presets[i]}&theme=${palettes[i]}&typography=${i % 2 ? 'modern' : 'editorial'}&level=full&view=visitor&lang=en`);
                await ready(page);
                await overflow(page, `${layouts[i]} ${width} ${reducedMotion}`);
                assert.equal(await page.locator('h1').count(), 1);
                assert.equal(await page.locator('html').getAttribute('lang'), 'en');
                const broken = await page.locator('img').evaluateAll(imgs => imgs.filter(i => i.getBoundingClientRect().top < innerHeight && (!i.complete || !i.naturalWidth)).map(i => i.src));
                assert.deepEqual(broken, [], `Missing images ${layouts[i]}`);
                if ([390, 1440].includes(width) && reducedMotion === 'no-preference') {
                    await revealAll(page);
                    await page.screenshot({ path: `${out}/${layouts[i]}-${width}.png`, fullPage: true });
                }
                if (width === 1440 && reducedMotion === 'no-preference') {
                    await page.setViewportSize({ width: 1280, height: 800 });
                    await ready(page);
                    await page.screenshot({ path: `${out}/${layouts[i]}-preview.jpg`, type: 'jpeg', quality: 82 });
                }
                await page.getByRole('combobox', { name: 'Demo theme', exact: true }).click();
                await page.keyboard.press('ArrowDown');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(150);
                await overflow(page, 'after select');
                assert.equal(new URL(page.url()).searchParams.get('level'), 'full');
                const langButton = page.getByRole('button', { name: 'Switch to Indonesian', exact: true });
                await langButton.click();
                assert.equal(await page.locator('html').getAttribute('lang'), 'id');
                await page.reload();
                await ready(page);
                assert.equal(await page.locator('html').getAttribute('lang'), 'id');
                results.push({ layout: layouts[i], preset: presets[i], width, reducedMotion, passed: true });
                await ctx.close();
            }
    // Full end-to-end path for each distinct business configuration.
    for (const preset of presets) {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        track(page);
        await page.goto(`${base}/?preset=${preset}&level=full&layout=course-discovery&theme=cobalt&lang=en&view=visitor`);
        await ready(page);
        await page.locator('.tl-demo-views').getByRole('link', { name: 'Student', exact: true }).click();
        await ready(page);
        await navigate(page, { page: 'apply' });
        const s = await current(page);
        await fillRegistration(page, s);
        await page.getByRole('button', { name: 'Save draft', exact: true }).click();
        await page.getByRole('link', { name: 'Continue application', exact: true }).waitFor();
        await page.getByRole('link', { name: 'Continue application', exact: true }).click();
        await fillRegistration(page, s);
        await page.screenshot({ path: `${out}/${preset}-application-mobile.png`, fullPage: true });
        await page.getByRole('button', { name: 'Submit application', exact: true }).click();
        await page.locator('.enrollment-card .status-submitted').first().waitFor();
        await overflow(page, 'student application');
        let snap = await current(page);
        const id = snap.enrollments.find(e => e.studentId === 'student-sinta').id;
        assert.equal(snap.enrollments.find(e => e.id === id).status, 'submitted');
        await page.locator('.tl-demo-views').getByRole('link', { name: 'Staff', exact: true }).click();
        await ready(page);
        await page.getByRole('navigation', { name: 'Staff navigation' }).getByRole('link', { name: 'Applications', exact: true }).click();
        const row = page.getByRole('row').filter({ hasText: 'Sinta' });
        await row.getByRole('button', { name: 'Review', exact: true }).click();
        await page.getByRole('button', { name: 'Start review', exact: true }).click();
        await page.getByRole('button', { name: 'Accept', exact: true }).click();
        await page.getByRole('dialog').locator('.status-awaiting_payment').first().waitFor();
        await page.keyboard.press('Escape');
        await page.locator('.tl-demo-views').getByRole('link', { name: 'Student', exact: true }).click();
        await ready(page);
        await page.locator('.enrollment-card .status-awaiting_payment').first().waitFor();
        await page.getByRole('button', { name: 'Simulate payment', exact: true }).click();
        await page.locator('.enrollment-card .status-active').first().waitFor();
        snap = await current(page);
        assert.equal(snap.invoices[0].status, 'paid');
        assert.equal(snap.enrollments.find(e => e.id === id).status, 'active');
        await page.screenshot({ path: `${out}/${preset}-portal-mobile.png`, fullPage: true });
        await page.setViewportSize({ width: 1024, height: 900 });
        await navigate(page, { view: 'tutor', page: 'staff', tab: 'academic' });
        await page.getByRole('heading', { name: 'Classes, attendance & resources', exact: true }).waitFor();
        await overflow(page, 'tutor');
        await page.screenshot({ path: `${out}/${preset}-tutor-1024.png`, fullPage: true });
        // Assert the same student record survives language, palette, layout and level changes.
        await navigate(page, { view: 'guardian', page: 'portal', theme: 'forest', layout: 'institutional', lang: 'id' });
        snap = await current(page, 'guardian');
        assert.equal(snap.enrollments.find(e => e.id === id).status, 'active');
        await navigate(page, { view: 'student', page: 'portal', level: 'enrollment', lang: 'en' });
        assert.equal((await current(page)).invoices.length, 0);
        await navigate(page, { level: 'full' });
        assert.equal((await current(page)).invoices[0].status, 'paid');
        await page.getByRole('button', { name: 'Cancel application', exact: true }).click();
        await page.locator('.status-cancelled').first().waitFor();
        assert.equal((await current(page)).enrollments.find(e => e.id === id).status, 'cancelled');
        results.push({ preset, flow: 'apply-draft-review-accept-pay-guardian-cancel', passed: true });
        await ctx.close();
    }
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 } });
    const page = await ctx.newPage();
    track(page);
    await page.goto(`${base}/?level=profile&view=staff&page=staff&tab=content&lang=en`);
    await ready(page);
    await page.getByLabel('Title', { exact: true }).fill('A school that grows with you');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Changes saved.' }).waitFor();
    const visitorBefore = await current(page, 'visitor');
    assert.notEqual(visitorBefore.content.find(c => c.id === 'home').published.title.en, 'A school that grows with you');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Changes saved.' }).waitFor();
    assert.equal((await current(page, 'visitor')).content.find(c => c.id === 'home').published.title.en, 'A school that grows with you');
    await page.screenshot({ path: `${out}/content-studio-1024.png`, fullPage: true });
    for (const tab of ['programs', 'teachers', 'cohorts', 'sessions', 'records', 'accounts', 'finance', 'academic', 'settings']) {
        await navigate(page, { view: 'staff', page: 'staff', tab, level: 'full' });
        await overflow(page, `staff-${tab}`);
        await page.screenshot({ path: `${out}/staff-${tab}-1024.png`, fullPage: true });
    }
    results.push({ flow: 'staff-tabs-1024', passed: true });
    await navigate(page, { view: 'visitor', page: 'home', level: 'profile', unrelated: 'kept' });
    assert.equal(await page.getByRole('link', { name: 'Apply to join', exact: true }).count(), 0);
    assert.equal(await page.locator('.tl-demo-views').getByRole('link', { name: 'Student', exact: true }).count(), 0);
    await pick(page, 'Demo mode', 'WhatsApp');
    await page.getByRole('link', { name: 'Ask about a class', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Discuss your learning needs', exact: true }).waitFor();
    assert.match(await page.locator('main,#main-content').innerText(), /not.*enroll|not.*confirm|not.*register|does not.*enroll/i);
    assert.equal(new URL(page.url()).searchParams.get('unrelated'), 'kept');
    await page.goBack();
    await ready(page);
    assert.equal(new URL(page.url()).searchParams.get('level'), 'whatsapp');
    results.push({ flow: 'cms-publish-profile-whatsapp-deep-link', passed: true });
    await ctx.close();
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log(JSON.stringify({ passed: results.length, results }, null, 2));
}
catch (error) {
    if (lastPage && !lastPage.isClosed()) { await lastPage.screenshot({path: `${out}/failure.png`,fullPage:true}).catch(() => {}); await writeFile(`${out}/failure.html`,await lastPage.content()).catch(() => {}); }
    await writeFile(`${out}/failure.txt`, error.stack ?? String(error));
    throw error;
}
finally {
    await writeFile(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
    await browser.close();
    server?.kill('SIGTERM');
}
