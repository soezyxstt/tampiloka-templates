import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseJsonc } from './jsonc.mjs';

const read = async path => JSON.parse(await readFile(path, 'utf8'));
const write = async (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const themes = ['sand', 'forest', 'ink'];
const levels = ['inventory', 'retail', 'full'];
const presets = ['food', 'retail', 'supplies'];
function choice(value, allowed, name) {
  if (!allowed.includes(value)) throw new Error(`${name} tidak dikenal: ${value}. Pilih ${allowed.join(', ')}.`);
}
export function validateOperations(options) {
  options.level ??= 'full'; options.theme ??= 'sand';
  choice(options.preset, presets, 'Preset operations');
  choice(options.level, levels, 'Level operations');
  choice(options.theme, themes, 'Tema operations');
  for (const key of ['layout', 'card', 'button', 'color', 'features', 'typography', 'phone', 'whatsapp']) {
    if (options[key]) throw new Error(`--${key} tidak berlaku untuk operations. Gunakan config/operations.json untuk konfigurasi usaha.`);
  }
}

/** Kept behind registry availability: planned families cannot be generated publicly. */
export async function createOperations(sourceRoot, destination, target, options, template, copyTree, normalizeDependencies) {
  validateOperations(options);
  const source = join(sourceRoot, template.directory);
  const manifest = await read(join(source, 'template.json'));
  await copyTree(source, destination, { template: true });
  const pkg = await read(join(destination, 'package.json'));
  Object.assign(pkg, { name: target, version: '1.0.0', private: true, packageManager: 'pnpm@10.28.2', pnpm: { onlyBuiltDependencies: ['esbuild', 'workerd'] } });
  pkg.scripts = { ...pkg.scripts, dev: 'node scripts/dev.mjs', test: 'node --test tests/client.test.mjs' };
  for (const key of ['build:demo', 'deploy:demo', 'dev:client', 'test:e2e', 'test:standalone']) delete pkg.scripts[key];
  delete pkg.devDependencies.playwright;
  for (const name of manifest.sharedPackages) {
    const root = join(destination, 'packages', name);
    await copyTree(join(sourceRoot, 'packages', name), root);
    const dep = await read(join(root, 'package.json'));
    delete dep.scripts;
    await normalizeDependencies(root, dep, manifest.sharedPackages, true);
  }
  await normalizeDependencies(destination, pkg, manifest.sharedPackages);
  const config = await read(join(destination, 'config/operations.json'));
  config.business.id = target; config.business.name = options.name || target;
  config.preset = options.preset; config.mode = options.level; config.theme = options.theme;
  config.modules = { pos: options.level !== 'inventory', commercial: options.level === 'full' };
  config.demo = { openingStock: [], prices: [] };
  // Initial catalogue examples remain editable; no example transactions or balances.
  if (options.preset !== 'food') {
    const examples = options.preset === 'retail'
      ? [['shirt', 'SHIRT-01', 'Kaos polos', 'buah'], ['bag', 'BAG-01', 'Tas kanvas', 'buah']]
      : [['paper', 'PAPER-A4', 'Kertas A4', 'lembar'], ['pen', 'PEN-01', 'Pulpen', 'buah']];
    config.products = examples.map(([id, sku, name, baseUnit]) => ({ id, sku, name, variant: '', baseUnit, units: { [baseUnit]: 1 }, fractional: false, active: true }));
  }
  const { validateInstallation } = await import(pathToFileURL(join(source, 'config/validate.ts')).href);
  await write(join(destination, 'config/operations.json'), validateInstallation(config));
  const wrangler = parseJsonc(await readFile(join(destination, 'wrangler.jsonc'), 'utf8'));
  wrangler.name = target; wrangler.vars = { DEMO_MODE: 'false', BACKUP_ENABLED: 'false' };
  // Each generated installation must provision its own storage and schedule.
  wrangler.triggers = { crons: [] };
  delete wrangler.r2_buckets; delete wrangler.env;
  delete wrangler.account_id; delete wrangler.routes;
  await write(join(destination, 'wrangler.jsonc'), wrangler);
  await rm(join(destination, 'wrangler.demo.jsonc'), { force: true });
  let dev = await readFile(join(destination, 'scripts/dev.mjs'), 'utf8');
  dev = dev.replace(/const demo\s*=\s*process\.argv\.includes\(['"]--demo['"]\);/, 'const demo = false;');
  if (!/const demo\s*=\s*false;/.test(dev)) throw new Error('Tidak dapat mengunci development Operations ke mode client.');
  await writeFile(join(destination, 'scripts/dev.mjs'), dev);
  let vite = await readFile(join(destination, 'vite.config.ts'), 'utf8');
  vite = vite.replace(/JSON\.stringify\(mode\s*===\s*['"]demo['"]\)/, 'JSON.stringify(false)');
  if (!/__PUBLIC_DEMO__:\s*JSON\.stringify\(false\)/.test(vite)) throw new Error('Tidak dapat mengunci build Operations ke mode client.');
  await writeFile(join(destination, 'vite.config.ts'), vite);
  let worker = await readFile(join(destination, 'worker/index.ts'), 'utf8');
  worker = worker.replace(/const demo\s*=\s*env\.DEMO_MODE\s*===\s*['"]true['"]/, 'const demo=false');
  if (!/const demo\s*=\s*false/.test(worker)) throw new Error('Tidak dapat mengunci Worker Operations ke mode client.');
  await writeFile(join(destination, 'worker/index.ts'), worker);
  await rm(join(destination, 'tests'), { recursive: true, force: true });
  await mkdir(join(destination, 'tests'));
  await writeFile(join(destination, 'tests/client.test.mjs'), `import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
test('client has independent dependencies and no demo stock',()=>{
 const c=read('config/operations.json'),p=read('package.json'),w=read('wrangler.jsonc');
 assert.deepEqual(c.demo,{openingStock:[],prices:[]});
 assert.equal(w.vars.DEMO_MODE,'false');
 assert.equal(w.vars.BACKUP_ENABLED,'false');
 assert.deepEqual(w.triggers,{crons:[]});
 assert.equal(w.r2_buckets,undefined);
 assert.ok(!Object.values({...p.dependencies,...p.devDependencies}).some(v=>v.startsWith('workspace:')));
 assert.ok(w.durable_objects.bindings.some(b=>b.name==='OPERATIONS'&&b.class_name==='OperationsStore'));
});
`);
  await writeFile(join(destination, 'CLIENT_SETUP.md'), `# ${config.business.name}\n\nOperations: ${config.preset} / ${config.mode} / ${config.theme}.\n\nProyek mandiri dengan paket bersama di packages/. Tidak ada saldo atau transaksi demo. Katalog dan lokasi awal adalah contoh; ubah config/operations.json sebelum inisialisasi. Setelah data tersimpan, gunakan pengaturan terautentikasi untuk perubahan.\n\n1. Pasang Node 22.18+ dan pnpm 10.28.2, lalu pnpm install.\n2. Baca docs/domain.md untuk kontrak autentikasi dan secret Worker; konfigurasikan kredensial unik tanpa memasukkannya ke bundle frontend.\n3. pnpm dev menjalankan mode client. DEMO_MODE harus tetap false.\n4. Jalankan pnpm test, pnpm typecheck dan pnpm build di mesin yang memadai. Periksa alur domain dan seluruh uji penerimaan sebelum pilot.\n5. Gunakan akun Cloudflare milik organisasi; wrangler.jsonc membuat namespace Durable Object SQLite melalui migrasi v1. Konfigurasikan secret lalu deploy setelah verifikasi.\n\nData persediaan awal dimasukkan melalui dokumen penerimaan atau impor tervalidasi. Tetapkan harga dan profil sebelum kasir dipakai. Lihat docs/operator-guide.md dan keputusan V01–V12; uji pemulihan pada instalasi kosong terpisah. Cadangan terjadwal dinonaktifkan saat generasi; ikuti docs/backup.md untuk menyiapkan bucket privat, secret, retensi dan jadwal milik instalasi ini.\n`);
  return config;
}

export async function doctorOperations(directory) {
  const checks = [], add = (name, status, detail) => checks.push({ name, status, detail });
  try {
    const raw = await read(join(directory, 'config/operations.json'));
    const { validateInstallation } = await import(pathToFileURL(join(directory, 'config/validate.ts')).href);
    const c = validateInstallation(raw);
    add('Konfigurasi', 'pass', `${c.business.name} / ${c.preset} / ${c.mode} / ${c.theme}`);
    add('Data demo', c.demo.openingStock.length || c.demo.prices.length ? 'fail' : 'pass', 'Instalasi client tidak membawa saldo atau harga demo.');
  } catch (error) { add('Konfigurasi', 'fail', error.message); }
  for (const file of ['src/main.tsx', 'worker/index.ts', 'config/validate.ts', 'docs/operator-guide.md', 'CLIENT_SETUP.md']) {
    try { await access(join(directory, file)); add(file, 'pass', 'Ada'); } catch { add(file, 'fail', 'Tidak ada'); }
  }
  try {
    const pkg = await read(join(directory, 'package.json'));
    for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
      if (version.startsWith('workspace:')) add(name, 'fail', 'Dependensi workspace belum mandiri.');
      if (version.startsWith('file:')) {
        try { await access(join(directory, version.slice(5), 'package.json')); add(name, 'pass', 'Paket lokal ada.'); }
        catch { add(name, 'fail', 'Paket lokal hilang.'); }
      }
    }
    const w = parseJsonc(await readFile(join(directory, 'wrangler.jsonc'), 'utf8'));
    add('Mode client', w.vars?.DEMO_MODE === 'false' ? 'pass' : 'fail', 'DEMO_MODE=false');
    add('Penyimpanan', w.durable_objects?.bindings?.some(b => b.name === 'OPERATIONS' && b.class_name === 'OperationsStore') ? 'pass' : 'fail', 'Binding OPERATIONS ke OperationsStore.');
  } catch (error) { add('Paket/deployment', 'fail', error.message); }
  add('Verifikasi operasional', 'warn', 'Doctor memeriksa berkas; transaksi, hak akses, secret, backup dan pemulihan harus diuji terpisah.');
  return { command: 'doctor', ok: checks.every(c => c.status !== 'fail'), directory, template: 'operations', checks };
}
