import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = await mkdtemp(join(tmpdir(), 'school-institution-'));
const base = 'http://127.0.0.1:5182';
const server = spawn(process.execPath, ['--experimental-strip-types', 'scripts/dev.mjs', '--demo'], { env: { ...process.env, PORT: '5182', SCHOOL_DATA_DIR: dir }, stdio: 'inherit' });
let browser;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 300)); }
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const paths = { home: '/', 'school-profile': '/profil', 'school-vision': '/visi-misi', 'school-contact': '/kontak', 'school-admissions': '/penerimaan', 'school-admissions-test': '/penerimaan/jalur-tes', 'school-admissions-achievement': '/penerimaan/jalur-prestasi', 'school-life': '/kehidupan-sekolah', 'school-activities': '/kegiatan', 'school-extracurricular': '/ekstrakurikuler', 'school-immersion': '/immersion', 'school-teachers': '/tenaga-pendidik', news: '/berita', achievements: '/prestasi', gallery: '/galeri', 'school-admin-info': '/informasi' };
  const visit = async (value, extra = '') => { const path = value === 'story' ? `/berita/${encodeURIComponent(new URLSearchParams(extra).get('story'))}` : paths[value]; await page.goto(`${base}${path}?preset=institution&layout=institutional&level=full${extra}`); await page.locator('#main-content').waitFor(); };
  await page.goto(`${base}/?preset=institution&layout=institutional&page=school-profile`);
  await page.getByRole('heading', { name: 'Mengenal sekolah kami', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/profil', 'Old saved page links normalize to routes');
  await visit('home');
  await page.getByRole('heading', { name: 'Banyak cara untuk menemukan minat.' }).waitFor();
  assert.ok(await page.locator('.school a').evaluateAll(links => links.every(link => !new URL(link.href).searchParams.has('page'))), 'Internal links use native route URLs');
  assert.equal(await page.locator('.school-activity-grid a').count(), 4);
  const images = await page.locator('.institution-home img').evaluateAll(items => items.map(item => item.getAttribute('src')));
  assert.equal(new Set(images).size, images.length, 'Initial homepage images should not repeat');
  await page.locator('.institution-footer').scrollIntoViewIfNeeded();
  await page.getByRole('link', { name: 'Profil sekolah', exact: true }).waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.school-journey').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('.school-journey').evaluate(element => getComputedStyle(element).transform), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.school-invite').scrollIntoViewIfNeeded();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-school-reveal]')].every(element => getComputedStyle(element).transform === 'none'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const [route, title] of [['home','Bersama, kita belajar jadi lebih berani.'], ['school-profile','Mengenal sekolah kami'], ['school-vision','Visi dan misi'], ['school-contact','Hubungi sekolah'], ['school-admissions','Penerimaan siswa baru'], ['school-admissions-test','Jalur tes'], ['school-admissions-achievement','Jalur prestasi'], ['school-life','Kehidupan di sekolah'], ['school-activities','Kegiatan sekolah'], ['school-extracurricular','Ekstrakurikuler'], ['school-immersion','Immersion'], ['school-teachers','Pendidik yang hadir untuk setiap proses'], ['news','Kabar dari sekolah'], ['achievements','Karya dan prestasi siswa'], ['gallery','Galeri kegiatan'], ['school-admin-info','Informasi dan layanan sekolah']]) {
    await visit(route); await page.getByRole('heading', { name: title, exact: true }).first().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route}: horizontal overflow`);
  }
  await visit('school-teachers');
  assert.equal(await page.locator('.institution-person').count(), 18);
  const search = page.getByRole('textbox', { name: 'Cari nama atau bidang' });
  await search.fill('Dimas');
  assert.equal(await page.locator('.institution-person').count(), 1);
  await search.fill('tidak-ada');
  await page.getByText('Tidak ada pendidik yang cocok. Coba kata atau bidang lain.').waitFor();
  await search.fill('');
  await page.getByRole('combobox', { name: 'Bidang', exact: true }).click();
  await page.getByRole('option', { name: 'Matematika', exact: true }).click();
  assert.equal(await page.locator('.institution-person').count(), 2);
  await page.getByRole('button', { name: 'Ganti ke bahasa Inggris' }).click();
  await page.getByRole('combobox', { name: 'Subject', exact: true }).waitFor();
  assert.equal(await page.locator('.institution-person').count(), 2, 'Changing language preserves the subject filter');
  await visit('school-admissions');
  const question = page.getByRole('button', { name: 'Apakah calon siswa harus memilih satu jalur?' });
  await question.click(); assert.equal(await question.getAttribute('aria-expanded'), 'true');
  await question.press('Enter'); assert.equal(await question.getAttribute('aria-expanded'), 'false');
  await visit('school-extracurricular');
  assert.equal(await page.locator('.institution-detail-club li').count(), 8);
  assert.ok(await page.locator('.content-section').evaluateAll(sections => sections.every(section => getComputedStyle(section.parentElement).opacity !== '0')), 'School content remains visible before its reveal animation');
  await visit('gallery'); assert.equal(await page.locator('.institution-gallery-grid figure').count(), 8);
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['school-admissions', 'school-teachers', 'school-extracurricular', 'news', 'gallery', 'school-admin-info']) {
      await visit(route);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} overflows at ${width}`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await visit('home');
  await page.getByRole('link', { name: 'Kenali sekolah', exact: true }).click();
  await page.getByRole('heading', { name: 'Mengenal sekolah kami', exact: true }).waitFor();
  const pageFrame = await page.locator('.school > div').last().evaluate(element => { const style = getComputedStyle(element); return { opacity: style.opacity, transform: style.transform }; });
  assert.deepEqual(pageFrame, { opacity: '1', transform: 'none' }, 'Page navigation should not fade or move the entire page');
  await page.goBack(); await page.getByRole('heading', { name: 'Bersama, kita belajar jadi lebih berani.', exact: true }).waitFor();
  await visit('news'); await page.getByRole('link', { name: 'Menemukan ide lewat proyek sains', exact: true }).click();
  await page.getByRole('heading', { name: 'Menemukan ide lewat proyek sains', exact: true }).waitFor();
  assert.match(await page.title(), /Menemukan ide/); await page.reload();
  await page.getByRole('heading', { name: 'Menemukan ide lewat proyek sains', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Ganti ke bahasa Inggris' }).click();
  await page.getByRole('heading', { name: 'Finding ideas through science projects', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/en/news/school-projects');
  await page.goto(`${base}/?preset=institution&layout=institutional&level=full&lang=id&view=staff&page=staff&tab=content`);
  await page.getByRole('heading', { name: 'Kelola konten' }).waitFor();
  await page.getByRole('combobox', { name: 'Jenis konten' }).click(); await page.getByRole('option', { name: 'Kabar dan informasi' }).click();
  await page.getByRole('button', { name: /Menemukan ide lewat proyek sains/ }).click();
  await page.getByLabel('Judul', { exact: true }).fill('Karya sains terbaru');
  await page.getByLabel('Tanggal terbit (YYYY-MM-DD)', { exact: true }).fill('2026-11-02');
  await page.getByRole('button', { name: 'Simpan draf', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Perubahan tersimpan.' }).waitFor();
  await page.getByRole('button', { name: 'Pratinjau', exact: true }).click(); await page.getByRole('heading', { name: 'Karya sains terbaru', exact: true }).waitFor();
  assert.match(new URL(page.url()).pathname, /^\/berita\//);
  assert.equal(new URL(page.url()).searchParams.has('page'), false); await visit('news');
  await page.getByRole('heading', { name: 'Menemukan ide lewat proyek sains', exact: true }).waitFor();
  await page.goto(`${base}/?preset=institution&layout=institutional&level=full&lang=id&view=staff&page=staff&tab=content`);
  await page.getByRole('heading', { name: 'Kelola konten' }).waitFor();
  await page.getByRole('combobox', { name: 'Jenis konten' }).click(); await page.getByRole('option', { name: 'Kabar dan informasi' }).click();
  await page.getByRole('button', { name: /Karya sains terbaru/ }).click();
  await page.getByRole('button', { name: 'Terbitkan', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Perubahan tersimpan.' }).waitFor();
  await visit('story', '&story=school-projects');
  await page.getByRole('heading', { name: 'Karya sains terbaru', exact: true }).waitFor();
  assert.equal(await page.locator('.institution-article time').getAttribute('datetime'), '2026-11-02');
  const bootstrap = await page.request.get(`${base}/api/bootstrap?preset=institution&level=full`, { headers: { 'X-Demo-Role': 'admin' } });
  const homeRecord = (await bootstrap.json()).content.find(record => record.id === 'home');
  const homeDraft = structuredClone(homeRecord.draft);
  homeDraft.blocks.find(block => block.id === 'welcome').heading.id = 'Ruang bertumbuh bersama';
  const published = await page.request.post(`${base}/api/command?preset=institution&level=full`, { headers: { 'X-Demo-Role': 'admin', 'X-School-Request': '1', Origin: base }, data: { action: 'content.publish', payload: { id: 'home', version: homeRecord.version, data: homeDraft }, key: 'publish-home-section' } });
  assert.equal(published.status(), 200);
  await visit('home');
  await page.getByRole('heading', { name: 'Ruang bertumbuh bersama', exact: true }).waitFor();
  await mkdir('test-results/institution', { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['home', 'school-teachers', 'school-admissions', 'school-extracurricular']) {
      await visit(route);
      for (const image of await page.locator('#main-content img').all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(element => element.decode());
        assert.ok(await image.evaluate(element => element.naturalWidth > 0), `${route}: image failed to load`);
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: `test-results/institution/${route}-${width}.png`, fullPage: true });
    }
  }
  assert.deepEqual(errors, []); console.log('Institution routes, directory, FAQ, language, loaded images, draft preview and visitor isolation PASS'); await context.close();
} finally { await browser?.close(); server.kill(); await new Promise(resolve => server.once('exit', resolve)); await rm(dir, { recursive: true, force: true }); }
