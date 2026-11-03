import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

// Exercise the generated client through its built Worker and HTTPS libSQL backend.
const root = resolve(process.cwd(), '../..');
const temp = await mkdtemp(join(tmpdir(), 'school-client-browser-'));
const client = join(temp, 'school-client');
const persist = join(temp, 'worker-state');
const base = 'http://127.0.0.1:5185';
const env = { ...process.env, CI: 'true', AUTH_SECRET: 'test-only-secret-0123456789-0123456789', BOOTSTRAP_ADMIN_EMAIL: 'admin@example.test', BOOTSTRAP_ADMIN_PASSWORD: 'test-only-password-123' };
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', timeout: 240000, shell: process.platform === 'win32' && command === 'pnpm' });
  if (result.error || result.status !== 0) throw result.error ?? new Error(`${command} failed (${result.status})`);
}
let server, browser;
try {
  run(process.execPath, [join(root, 'packages/cli/bin/tampiloka.mjs'), 'create', 'school-client', '--template', 'school', '--preset', 'institution', '--level', 'full', '--name', 'SchoolClient', '--yes', '--out', temp], root);
  const configPath = join(client, 'config/institution.json');
  const brand = JSON.parse(await readFile(configPath, 'utf8'));
  Object.assign(brand, { name: 'Sekolah Cakra Uji', address: 'Jalan Uji 12', email: 'test@example.test', logo: '/images/client/logo.jpg', heroImage: '/images/client/hero.jpg' });
  await writeFile(configPath, JSON.stringify(brand, null, 2));
  await writeFile(join(client, '.dev.vars'), ['AUTH_SECRET', 'BOOTSTRAP_ADMIN_EMAIL', 'BOOTSTRAP_ADMIN_PASSWORD', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'].map(key => `${key}=${JSON.stringify(env[key])}`).join('\n'));
  await mkdir(join(client, 'public/images/client'), { recursive: true });
  await copyFile(join(root, 'templates/school/public/images/institution/classroom.jpg'), join(client, 'public/images/client/logo.jpg'));
  await copyFile(join(root, 'templates/school/public/images/institution/students.jpg'), join(client, 'public/images/client/hero.jpg'));
  if (process.env.SCHOOL_TEST_PNPM_JS) run(process.execPath, [process.env.SCHOOL_TEST_PNPM_JS, 'install', '--no-frozen-lockfile'], client);
  else run('pnpm', ['install', '--no-frozen-lockfile'], client);
  run(process.execPath, [join(client, 'node_modules/vite/bin/vite.js'), 'build'], client);
  run(process.execPath, ['scripts/build-worker.mjs'], client);
  assert.ok(env.TURSO_DATABASE_URL && env.TURSO_AUTH_TOKEN, 'HTTPS libSQL fixture configuration is required');
  // Use the generated client's production migration tool and its own migration files.
  run('pnpm', ['db:remote'], client);
  run('pnpm', ['exec', 'tampiloka-db', 'verify'], client);
  // Re-running migrate proves the recorded history is accepted without replaying SQL.
  run('pnpm', ['db:remote'], client);
  server = spawn(process.execPath, [join(client, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--local', '--no-bundle', '--ip', '127.0.0.1', '--port', '5185', '--persist-to', persist], { cwd: client, env, stdio: 'inherit' });
  let ready = false, healthFailure = 'no response';
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Wrangler exited before readiness (${server.exitCode})`);
    try { const response = await fetch(`${base}/api/health`); if (response.ok) { ready = true; break; } healthFailure = `HTTP ${response.status}: ${await response.text()}`; } catch (error) { healthFailure = String(error); }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  assert.ok(ready, `Local client backend did not become ready: ${healthFailure}`);
  const snapshot = await (await fetch(`${base}/api/bootstrap`, { headers: { 'X-Demo-Role': 'admin' } })).json();
  assert.equal(snapshot.demo, false);
  assert.equal(snapshot.institution.name, 'Sekolah Cakra Uji');
  assert.equal(snapshot.actor, null, 'A demo role header must not authenticate a client');
  assert.deepEqual(snapshot.tutors, []);
  assert.deepEqual(snapshot.cohorts, []);
  const forbidden = await fetch(`${base}/api/command`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-School-Request': '1', 'X-Demo-Role': 'admin' }, body: JSON.stringify({ action: 'settings.save', payload: {}, key: 'client-browser-test' }) });
  assert.ok([401, 403].includes(forbidden.status), `Unauthenticated staff command returned ${forbidden.status}`);
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/');
  await page.getByRole('heading', { name: 'Sekolah Cakra Uji', exact: true }).waitFor();
  const hero = page.locator('.school-opening-image img');
  assert.equal(await hero.getAttribute('src'), '/images/client/hero.jpg');
  await hero.evaluate(image => image.decode());
  assert.ok(await hero.evaluate(image => image.naturalWidth > 0), 'Client hero image must load');
  await mkdir('test-results/client', { recursive: true });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `test-results/client/home-${width}.png`, fullPage: true });
  }
  for (const [path, heading] of [['/profil', 'Profil sekolah'], ['/tenaga-pendidik', 'Pendidik yang hadir untuk setiap proses'], ['/berita', 'Kabar dari sekolah'], ['/en/school-profile', 'School profile']]) {
    const response = await page.goto(base + path);
    assert.equal(response.status(), 200, `${path} should serve the built SPA`);
    await page.getByRole('heading', { name: heading, exact: true }).first().waitFor();
    await page.reload();
    await page.getByRole('heading', { name: heading, exact: true }).first().waitFor();
    assert.equal(new URL(page.url()).pathname, path);
    assert.doesNotMatch(await page.locator('body').innerText(), /Nusa Cendekia|Ayu Prameswari|Raka Wicaksana|Penerimaan 2027/);
    const logo = page.locator('.site-nav .institution-logo');
    assert.equal(await logo.getAttribute('src'), '/images/client/logo.jpg');
    assert.ok(await logo.evaluate(image => image.complete && image.naturalWidth > 0), 'Client logo must load');
    await page.getByText('Sekolah Cakra Uji', { exact: true }).first().waitFor();
  }
  const admin = await page.goto(`${base}/admin/content`);
  assert.equal(admin.status(), 200);
  await page.reload();
  await page.getByRole('heading', { name: /masuk|sign in/i }).first().waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Kelola konten' }).count(), 0);
  await page.goto(base + '/halaman-yang-tidak-ada');
  await page.getByRole('heading', { name: 'Halaman tidak ditemukan', exact: true }).waitFor();
  const headers = { 'X-School-Request': '1', Origin: base };
  const login = await page.request.post(`${base}/api/auth/login`, { headers, data: { email: env.BOOTSTRAP_ADMIN_EMAIL, password: env.BOOTSTRAP_ADMIN_PASSWORD } });
  assert.equal(login.status(), 200, 'Client CMS needs real authentication');
  const authenticated = await (await page.request.get(`${base}/api/bootstrap`)).json();
  assert.equal(authenticated.actor.role, 'admin');
  const homeRecord = authenticated.content.find(record => record.id === 'home');
  const data = structuredClone(homeRecord.draft);
  data.image = '/images/client/logo.jpg';
  data.blocks.find(block => block.id === 'welcome').heading.id = 'Belajar bersama di Sekolah Cakra Uji';
  const publication = await page.request.post(`${base}/api/command`, { headers, data: { action: 'content.publish', payload: { id: 'home', version: homeRecord.version, data }, key: 'client-home-publication' } });
  assert.equal(publication.status(), 200);
  const galleryData = { ...structuredClone(data), title: { id: 'Pentas seni sekolah', en: 'School arts performance' }, image: '/images/client/hero.jpg', attributes: {}, blocks: [] };
  const saved = await page.request.post(`${base}/api/command`, { headers, data: { action: 'content.save', payload: { id: 'client-gallery', collection: 'gallery', data: galleryData }, key: 'client-gallery-save' } });
  assert.equal(saved.status(), 200);
  const galleryRecord = (await (await page.request.get(`${base}/api/bootstrap`)).json()).content.find(record => record.id === 'client-gallery');
  const galleryPublication = await page.request.post(`${base}/api/command`, { headers, data: { action: 'content.publish', payload: { id: galleryRecord.id, version: galleryRecord.version, data: galleryData }, key: 'client-gallery-publish' } });
  assert.equal(galleryPublication.status(), 200);
  await page.request.post(`${base}/api/auth/logout`, { headers });
  await page.goto(base + '/');
  await page.getByRole('heading', { name: 'Belajar bersama di Sekolah Cakra Uji', exact: true }).waitFor();
  assert.equal(await page.locator('.school-opening-image img').getAttribute('src'), '/images/client/logo.jpg', 'Published CMS image overrides the initial configured hero');
  for (const [path, title] of [['/galeri', 'Pentas seni sekolah'], ['/en/gallery', 'School arts performance']]) {
    await page.goto(base + path);
    const image = page.getByRole('img', { name: title, exact: true });
    await image.waitFor();
    assert.equal(await image.getAttribute('src'), '/images/client/hero.jpg');
    assert.ok(await image.evaluate(image => image.complete && image.naturalWidth > 0));
    assert.doesNotMatch(await page.locator('.institution-gallery').innerText(), /fiktif|fictional|illustrative|ilustrasi/i);
  }
  assert.deepEqual(errors, []);
  console.log('Generated institution client: client routes, branding, isolation and staff authorization PASS');
} finally {
  await browser?.close();
  if (server) { server.kill(); await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); }); }
  await rm(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}
