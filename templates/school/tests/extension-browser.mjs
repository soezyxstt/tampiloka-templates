import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
const base = 'http://127.0.0.1:5178';
const directory = await mkdtemp(join(tmpdir(), 'school-extension-browser-'));
const server = spawn(process.execPath, ['--experimental-strip-types', '--import', './tests/fixtures/registration-extension.mjs', 'scripts/dev.mjs', '--demo'], { stdio: 'inherit', env: { ...process.env, PORT: '5178', SCHOOL_DATA_DIR: directory } });
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
    if (attempt === 60) throw Error('Extension test server did not start');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.goto(base + '/?preset=exam-prep&level=full&lang=en&view=student&page=apply');
  await page.getByLabel('Experience *', { exact: true }).fill('Fictional prior study');
  await page.getByRole('combobox', { name: 'Target exam *', exact: true }).click();
  await page.getByRole('option', { name: 'UTBK', exact: true }).click();
  await page.getByLabel('I understand this application still requires review.', { exact: true }).check();
  const submitted = page.waitForResponse(r => r.url().includes('/api/command') && r.request().postDataJSON().action === 'application.submit');
  await page.getByRole('button', { name: 'Submit application', exact: true }).click();
  const result = await submitted;
  assert.equal(result.status(), 200);
  const data = await result.json();
  assert.equal(data.snapshot.enrollments.find(e => e.id === data.result).answers.experience, 'Fictional prior study');
  await page.locator('.tl-demo-views').getByRole('link', { name: 'Staff', exact: true }).click();
  await page.getByRole('navigation', { name: 'Staff navigation' }).getByRole('link', { name: 'Applications', exact: true }).click();
  await page.locator(`tr[data-enrollment-id="${data.result}"]`).getByRole('button', { name: 'Review', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Experience', { exact: true }).waitFor();
  await dialog.getByText('Fictional prior study', { exact: true }).waitFor();
  await mkdir('test-results/extensions', { recursive: true });
  for (const width of [390, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => !document.getAnimations().some(animation => animation.playState === 'running'));
    await page.screenshot({ path: `test-results/extensions/staff-${width}.png`, fullPage: true });
  }
  console.log('Required extension field: real learner form → Worker → labeled staff answer passed.');
} finally { await browser?.close(); server.kill('SIGTERM'); }
