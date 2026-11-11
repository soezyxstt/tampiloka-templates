import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, access, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DEFAULT_CONFIG, MODULES, PRESETS, THEMES, applyPreset, foregroundForColor, readableAccent, validateConfig } from '../src/config/catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(join(tmpdir(), 'cafe-cli-test-'));
after(async () => { await rm(scratch, { recursive: true, force: true }); });
const config = () => structuredClone(DEFAULT_CONFIG);
const exists = async path => { try { await access(path); return true; } catch { return false; } };

const fixture = join(scratch, 'template');
await mkdir(join(fixture, 'scripts'), { recursive: true });
await mkdir(join(fixture, 'src', 'config'), { recursive: true });
await mkdir(join(fixture, 'config'), { recursive: true });
await mkdir(join(fixture, 'content'), { recursive: true });
await copyFile(join(root, 'scripts', 'cafe.mjs'), join(fixture, 'scripts', 'cafe.mjs'));
await copyFile(join(root, 'src', 'config', 'catalog.mjs'), join(fixture, 'src', 'config', 'catalog.mjs'));
await writeFile(join(fixture, 'config', 'cafe.json'), JSON.stringify(DEFAULT_CONFIG));
await writeFile(join(fixture, 'content', 'menu.json'), JSON.stringify({ schemaVersion: 1, sample: true, items: [] }));
await writeFile(join(fixture, 'content', 'tables.json'), JSON.stringify({ schemaVersion: 1, tables: [] }));
const fonts = ['@fontsource/manrope', '@fontsource/source-sans-3'];
const showcasePackages = ['@noble/hashes', '@vitejs/plugin-react', 'vite', 'wrangler'];
const fixturePackage = {
  name: 'template', private: true,
  scripts: {
    cafe: 'node scripts/cafe.mjs', build: 'next build', demo: 'node scripts/run-demo.mjs',
    'test:config': 'node --test scripts/cafe-config.test.mjs',
    'test:browser-runtime': 'node --test tests/browser-runtime-crypto.test.mjs',
    'test:demo-browser': 'node tests/demos-browser.mjs',
    'test:attendance:browser': 'node tests/attendance-fixture/run.mjs',
    test: 'npm run test:config && npm run test:browser-runtime',
    'demos:dev': 'vite --config demos/vite.config.ts',
    'demos:build': 'vite build --config demos/vite.config.ts',
    'demos:deploy': 'wrangler pages deploy dist-demos --project-name tampiloka-cafe-demos',
  },
  dependencies: { next: '15.5.28', react: '19.2.1' },
  devDependencies: { typescript: '5.9.3', ...Object.fromEntries([...showcasePackages, ...fonts].map(name => [name, '1.0.0'])) },
};
const fixtureLock = {
  name: 'template', lockfileVersion: 3,
  packages: {
    '': { name: 'template', dependencies: fixturePackage.dependencies, devDependencies: fixturePackage.devDependencies },
    'node_modules/next': { version: '15.5.28', dependencies: { shared: '1.0.0', 'nested-parent': '1.0.0' }, optionalDependencies: { 'optional-native': '1.0.0' }, peerDependencies: { react: '19.2.1', 'peer-helper': '1.0.0' } },
    'node_modules/react': { version: '19.2.1' },
    'node_modules/typescript': { version: '5.9.3', dev: true },
    'node_modules/shared': { version: '1.0.0' },
    'node_modules/nested-parent': { version: '1.0.0', dependencies: { shared: '2.0.0' } },
    'node_modules/nested-parent/node_modules/shared': { version: '2.0.0', integrity: 'sha512-retain-nested-version' },
    'node_modules/optional-native': { version: '1.0.0', optional: true, os: ['darwin'] },
    'node_modules/peer-helper': { version: '1.0.0' },
    ...Object.fromEntries(showcasePackages.map(name => [`node_modules/${name}`, { version: '1.0.0', dev: true, dependencies: { shared: '1.0.0', 'showcase-private': '1.0.0' } }])),
    ...Object.fromEntries(fonts.map(name => [`node_modules/${name}`, { version: '1.0.0', dev: true }])),
    'node_modules/showcase-private': { version: '1.0.0', dev: true },
  },
};
await writeFile(join(fixture, 'package.json'), JSON.stringify(fixturePackage));
await writeFile(join(fixture, 'package-lock.json'), JSON.stringify(fixtureLock));
for (const directory of ['app', '.local/cafe-db', '.git', '.github/workflows/nested', '.github/private', 'node_modules/private-package', 'public/benchmarks', 'public/images', 'src/nested', 'src/demo-runtime', 'demos', 'tests/browser-runtime-harness', 'tests/attendance-fixture']) await mkdir(join(fixture, directory), { recursive: true });
await writeFile(join(fixture, 'app', 'page.tsx'), 'export default function Page() { return null; }');
await writeFile(join(fixture, '.env.local'), 'SECRET_PAYMENT_KEY=must-not-copy');
await writeFile(join(fixture, '.env.production'), 'LIVE_DATABASE_PASSWORD=must-not-copy');
await writeFile(join(fixture, '.env.example'), 'CAFE_DEMO_DB=1');
await writeFile(join(fixture, '.local/cafe-db/private.db'), 'private client sales');
await writeFile(join(fixture, '.git/config'), 'private git credentials');
await writeFile(join(fixture, '.github/workflows/ci.yml'), 'name: Verify template\njobs:\n  verify:\n    steps:\n      - run: npm run build\n      - run: npm run demos:build --if-present\n');
await writeFile(join(fixture, '.github/workflows/deploy.yml'), 'private deployment workflow');
await writeFile(join(fixture, '.github/workflows/nested/ci.yml'), 'unreviewed nested workflow');
await writeFile(join(fixture, '.github/private/.env.local'), 'PRIVATE_DEPLOY_TOKEN=must-not-copy');
await writeFile(join(fixture, '.github/deployment.json'), 'private deployment settings');
await writeFile(join(fixture, 'node_modules/private-package/index.js'), 'dependencies must not copy');
await writeFile(join(fixture, 'public/benchmarks/reference.png'), 'benchmark screenshot');
await writeFile(join(fixture, 'public/images/menu.svg'), '<svg />');
await writeFile(join(fixture, 'src/nested/.env.local'), 'NESTED_SECRET=must-not-copy');
await writeFile(join(fixture, 'src/nested/service-account.json'), '{"private_key":"must-not-copy"}');
await symlink(join(fixture, '.env.local'), join(fixture, 'src/nested/linked-secret.txt'));
await writeFile(join(fixture, 'demos/manifest.ts'), 'public nine-host portfolio');
await writeFile(join(fixture, 'src/demo-runtime/index.ts'), 'browser-only database adapter');
await writeFile(join(fixture, 'tests/browser-runtime.integration.mjs'), 'browser runtime integration');
await writeFile(join(fixture, 'tests/browser-runtime-crypto.test.mjs'), 'browser runtime crypto checks');
await writeFile(join(fixture, 'tests/browser-runtime-harness/main.ts'), 'browser runtime test harness');
await writeFile(join(fixture, 'tests/attendance-fixture/run.mjs'), 'repository fixture');
await writeFile(join(fixture, 'tests/demos-browser.mjs'), 'public portfolio browser tests');
await writeFile(join(fixture, 'tests/preset-integration.mjs'), 'normal client integration');
await writeFile(join(fixture, 'scripts/generate-demo-schema.ts'), 'browser-only schema generator');


test('every named package is a valid independent configuration', () => {
  for (const id of Object.keys(PRESETS)) {
    const result = validateConfig(applyPreset(config(), id));
    assert.deepEqual(new Set(result.modules), new Set(PRESETS[id].modules), id);
    assert.equal(result.payment.mode, PRESETS[id].paymentMode, id);
  }
});

test('all five structural themes preserve the same service modules', () => {
  for (const theme of Object.keys(THEMES)) {
    const input = applyPreset(config(), 'cashier');
    input.theme = theme;
    assert.deepEqual(validateConfig(input).modules, ['cashier']);
  }
});

test('custom cashier with online payment works without customer ordering', () => {
  const input = config(); input.modules = ['cashier', 'payments']; input.payment.mode = 'online';
  assert.deepEqual(validateConfig(input).modules, ['payments', 'cashier']);
});

test('missing module dependencies fail with actionable reasons', () => {
  for (const [modules, message] of [
    [['ordering'], /ordering requires catalog/],
    [['catalog', 'payments'], /payments requires ordering or cashier/],
    [['kitchen'], /kitchen requires ordering or cashier/],
    [['dashboard'], /dashboard requires ordering or cashier/],
    [['loyalty'], /loyalty requires ordering or cashier/],
  ]) {
    const input = config(); input.modules = modules; input.payment.mode = modules.includes('payments') ? 'online' : 'cashier';
    assert.throws(() => validateConfig(input), message);
  }
});

test('all 512 module combinations agree with the documented dependency rules', () => {
  const ids = Object.keys(MODULES);
  for (let mask = 0; mask < 2 ** ids.length; mask += 1) {
    const modules = ids.filter((_, index) => mask & (1 << index));
    const has = id => modules.includes(id);
    const valid = modules.length > 0 && (!has('ordering') || has('catalog'))
      && ['payments', 'kitchen', 'dashboard', 'loyalty'].every(id => !has(id) || has('ordering') || has('cashier'))
      && (!has('marketing') || has('catalog') || has('cashier'));
    const input = config(); input.modules = modules; input.payment.mode = has('payments') ? 'online' : 'cashier';
    if (valid) assert.doesNotThrow(() => validateConfig(input), modules.join(','));
    else assert.throws(() => validateConfig(input), undefined, modules.join(','));
  }
});

test('payment mode cannot expose disabled payment features', () => {
  const input = applyPreset(config(), 'catalog'); input.payment.mode = 'online';
  assert.throws(() => validateConfig(input), /payment.mode must be cashier/);
  const other = applyPreset(config(), 'order-and-pay'); other.payment.mode = 'cashier';
  assert.throws(() => validateConfig(other), /online or both/);
});

test('unknown settings, duplicate modules, unsupported currencies, and malformed colors fail', () => {
  for (const mutate of [
    value => { value.brandColour = '#000000'; },
    value => { value.modules.push('catalog'); },
    value => { value.modules.push('cashier-plus'); },
    value => { value.currency = 'USD'; },
    value => { value.brand.primaryColor = 'red'; },
    value => { value.brand.name = 'name\nforged'; },
    value => { value.venue.tenantSlug = '../client'; },
    value => { value.timezone = 'not/a-zone'; },
  ]) { const input = config(); mutate(input); assert.throws(() => validateConfig(input)); }
});

test('unsafe logo URLs fail and HTTPS or local image paths pass', () => {
  for (const logo of ['javascript:alert(1)', 'http://example.com/logo.png', '//example.com/logo.png', '/../secret', 'https://user:password@example.com/logo.png']) {
    const input = config(); input.brand.logo = logo; assert.throws(() => validateConfig(input), /brand.logo must/);
  }
  for (const logo of ['', '/brand/logo.svg', 'https://example.com/logo.png']) {
    const input = config(); input.brand.logo = logo; assert.doesNotThrow(() => validateConfig(input));
  }
});

test('brand foreground is readable for light, dark, and default brand colors', () => {
  assert.equal(foregroundForColor('#FFFFFF'), '#000000');
  assert.equal(foregroundForColor('#000000'), '#FFFFFF');
  assert.equal(foregroundForColor('#A84A30'), '#FFFFFF');
  assert.throws(() => foregroundForColor('red'));
});

test('light brand colors get readable text ink without changing brand identity', () => {
  const luminance = hex => {
    const values = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
  };
  for (const brand of ['#FFFF00', '#FFFFFF', '#000000', '#A84A30']) {
    const input = config(); input.brand.primaryColor = brand;
    const valid = validateConfig(input);
    const ink = readableAccent(valid.brand.primaryColor);
    assert.match(ink, /^#[0-9A-F]{6}$/);
    for (const surface of ['#FFFFFF', '#FBF8F3', '#F4EEE6', '#F7F5F1']) {
      const pair = [luminance(ink), luminance(surface)].sort((a, b) => a - b);
      assert.ok((pair[1] + 0.05) / (pair[0] + 0.05) >= 4.5, `${brand} → ${ink} must be readable on ${surface}`);
    }
    assert.equal(valid.brand.primaryColor, brand);
  }
  assert.equal(readableAccent('#A84A30'), '#A84A30');
  assert.equal(readableAccent('#000000'), '#000000');
  assert.notEqual(readableAccent('#FFFF00'), '#FFFF00');
  assert.notEqual(readableAccent('#FFFFFF'), '#FFFFFF');
  assert.throws(() => readableAccent('yellow'));
});


function cli(args, cwd = fixture) {
  return spawnSync(process.execPath, [join(fixture, 'scripts', 'cafe.mjs'), ...args], { cwd, encoding: 'utf8', timeout: 20000 });
}

test('init creates a reusable client with selected modules and no old secrets or data', async () => {
  const destination = join(scratch, 'kopi-senja');
  const result = cli(['init', destination, '--name', 'Kopi Senja', '--modules', 'catalog', '--theme', 'editorial', '--color', '#204C38', '--yes', '--json']);
  assert.equal(result.status, 0, result.stderr);
  const saved = JSON.parse(await readFile(join(destination, 'config/cafe.json'), 'utf8'));
  assert.deepEqual(saved.modules, ['catalog']); assert.equal(saved.brand.name, 'Kopi Senja'); assert.equal(saved.venue.tenantSlug, 'kopi-senja'); assert.equal(saved.theme, 'editorial');
  assert.equal(JSON.parse(await readFile(join(destination, 'package.json'), 'utf8')).name, 'kopi-senja');
  assert.equal(JSON.parse(await readFile(join(destination, 'package-lock.json'), 'utf8')).packages[''].name, 'kopi-senja');
  assert.equal(await exists(join(destination, 'app/page.tsx')), true);
  assert.equal(await exists(join(destination, 'public/images/menu.svg')), true);
  assert.equal(await readFile(join(destination, 'content/menu.json'), 'utf8'), await readFile(join(fixture, 'content/menu.json'), 'utf8'));
  assert.equal(await readFile(join(destination, 'content/tables.json'), 'utf8'), await readFile(join(fixture, 'content/tables.json'), 'utf8'));
  assert.equal(await readFile(join(destination, '.github/workflows/ci.yml'), 'utf8'), await readFile(join(fixture, '.github/workflows/ci.yml'), 'utf8'));
  for (const path of ['.env.production', '.local', '.git', '.github/workflows/deploy.yml', '.github/workflows/nested', '.github/private', '.github/deployment.json', 'node_modules', 'public/benchmarks', 'src/nested/.env.local', 'src/nested/service-account.json', 'src/nested/linked-secret.txt', 'demos', 'src/demo-runtime', 'tests/browser-runtime.integration.mjs', 'tests/browser-runtime-crypto.test.mjs', 'tests/browser-runtime-harness', 'tests/demos-browser.mjs', 'tests/attendance-fixture', 'scripts/generate-demo-schema.ts']) assert.equal(await exists(join(destination, path)), false, path);
  assert.equal(await exists(join(destination, 'tests/preset-integration.mjs')), true);
  assert.match(await readFile(join(destination, '.github/workflows/ci.yml'), 'utf8'), /npm run demos:build --if-present/);
  const env = await readFile(join(destination, '.env.local'), 'utf8');
  assert.match(env, /CAFE_DEMO_DB=0/); assert.doesNotMatch(env, /SECRET_PAYMENT_KEY/);
});

test('client package and npm lock omit showcase tooling while retaining shared, nested, optional and peer dependencies', async () => {
  const destination = join(scratch, 'independent-client');
  const result = cli(['init', destination, '--name', 'Independent Client', '--preset', 'full', '--yes']);
  assert.equal(result.status, 0, result.stderr);
  const pkg = JSON.parse(await readFile(join(destination, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(destination, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.scripts.build, 'next build');
  assert.equal(pkg.scripts.demo, 'node scripts/run-demo.mjs');
  assert.equal(pkg.scripts.test, 'npm run test:config');
  assert.equal(pkg.scripts['test:browser-runtime'], undefined);
  assert.equal(pkg.scripts['test:demo-browser'], undefined);
  assert.equal(pkg.scripts['test:attendance:browser'], undefined);
  assert.equal(Object.keys(pkg.scripts).some(name => name.startsWith('demos:')), false);
  assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies);
  assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies);
  for (const name of showcasePackages) {
    assert.equal(pkg.devDependencies[name], undefined, name);
    assert.equal(lock.packages[`node_modules/${name}`], undefined, name);
  }
  for (const name of fonts) {
    assert.equal(pkg.devDependencies[name], '1.0.0');
    assert.deepEqual(lock.packages[`node_modules/${name}`], fixtureLock.packages[`node_modules/${name}`]);
  }
  assert.equal(lock.packages['node_modules/showcase-private'], undefined);
  for (const path of ['node_modules/next', 'node_modules/react', 'node_modules/typescript', 'node_modules/shared', 'node_modules/nested-parent', 'node_modules/nested-parent/node_modules/shared', 'node_modules/optional-native', 'node_modules/peer-helper']) {
    assert.deepEqual(lock.packages[path], fixtureLock.packages[path], path);
  }
  assert.equal(lock.name, 'independent-client');
  assert.equal(lock.packages[''].name, 'independent-client');
});

test('init never overwrites an existing directory', async () => {
  const destination = join(scratch, 'occupied'); await mkdir(destination); await writeFile(join(destination, 'keep.txt'), 'original');
  const result = cli(['init', destination, '--yes']); assert.equal(result.status, 1); assert.match(result.stderr, /already exists/);
  assert.equal(await readFile(join(destination, 'keep.txt'), 'utf8'), 'original');
});

test('invalid flags and module combinations leave no destination or parent behind', async () => {
  for (const [id, extra] of [
    ['unknown', ['--typo', 'x']], ['dependency', ['--modules', 'kitchen']], ['color', ['--color', 'green']],
    ['ambiguous', ['--preset', 'catalog', '--modules', 'cashier']], ['empty', ['--modules', '']],
    ['slug', ['--slug', '../../oops']], ['logo', ['--logo-file', '/definitely/missing.svg']],
  ]) {
    const parent = join(scratch, `invalid-${id}`); const destination = join(parent, 'project');
    const result = cli(['init', destination, '--yes', ...extra]); assert.equal(result.status, 1, id);
    assert.equal(await exists(parent), false, id);
  }
});

test('dry-run validates and reports changes without creating directories', async () => {
  const parent = join(scratch, 'dry-run-parent');
  const result = cli(['init', join(parent, 'client'), '--name', 'Dry Run', '--preset', 'cashier', '--dry-run', '--json']);
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).dryRun, true); assert.equal(await exists(parent), false);
});

test('init rejects a destination inside the template, including a symlink to it', async () => {
  assert.equal(cli(['init', join(fixture, 'client'), '--yes']).status, 1);
  const link = join(scratch, 'template-link'); await symlink(fixture, link);
  const result = cli(['init', join(link, 'client'), '--yes']); assert.equal(result.status, 1); assert.match(result.stderr, /outside the template/);
});

test('configure changes only config, supports aliases, and keeps invalid edits atomic', async () => {
  const original = await readFile(join(fixture, 'config/cafe.json'), 'utf8');
  const invalid = cli(['configure', '--modules', 'payments', '--yes']); assert.equal(invalid.status, 1);
  assert.equal(await readFile(join(fixture, 'config/cafe.json'), 'utf8'), original);
  const valid = cli(['configure', '--preset', 'cashier-kitchen', '--theme', 'boxie', '--yes', '--json']); assert.equal(valid.status, 0, valid.stderr);
  const saved = JSON.parse(await readFile(join(fixture, 'config/cafe.json'), 'utf8')); assert.deepEqual(saved.modules, ['cashier', 'kitchen']); assert.equal(saved.theme, 'boxy');
  assert.equal(await readFile(join(fixture, '.env.local'), 'utf8'), 'SECRET_PAYMENT_KEY=must-not-copy');
});

test('local logo copying works and doctor catches a missing local logo', async () => {
  const source = join(scratch, 'new-logo.svg'); await writeFile(source, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>');
  const destination = join(scratch, 'logo-client');
  const result = cli(['init', destination, '--preset', 'catalog', '--logo-file', source, '--yes']); assert.equal(result.status, 0, result.stderr);
  const saved = JSON.parse(await readFile(join(destination, 'config/cafe.json'), 'utf8'));
  assert.match(saved.brand.logo, /^\/brand\/logo-[a-f0-9]{12}\.svg$/);
  assert.equal(await readFile(join(destination, 'public', saved.brand.logo.slice(1)), 'utf8'), await readFile(source, 'utf8'));
  const healthy = cli(['doctor', '--dir', destination, '--json']); assert.equal(healthy.status, 0, healthy.stderr); assert.equal(JSON.parse(healthy.stdout).ok, true);
  await rm(join(destination, 'public', saved.brand.logo.slice(1)));
  const missing = cli(['doctor', '--dir', destination, '--json']); assert.equal(missing.status, 1); assert.equal(JSON.parse(missing.stdout).ok, false);
});

test('package listing is machine-readable and preserves exact service selections', () => {
  const result = cli(['presets', '--json']); assert.equal(result.status, 0, result.stderr);
  const data = JSON.parse(result.stdout); assert.deepEqual(data['order-at-cashier'].modules, ['catalog', 'ordering']); assert.deepEqual(data.cashier.modules, ['cashier']);
});

test('catalog preset generates the waiter inbox with empty client transactions', async () => {
 const destination=join(scratch,'waiter-menu');
 const result=cli(['init',destination,'--name','Waiter Menu','--preset','catalog','--yes']);
 assert.equal(result.status,0,result.stderr);
 const saved=JSON.parse(await readFile(join(destination,'config/cafe.json'),'utf8'));
 assert.deepEqual(saved.modules,['catalog','ordering']);
 assert.equal(saved.payment.mode,'cashier');
 const env=await readFile(join(destination,'.env.local'),'utf8');
 assert.match(env,/CAFE_DEMO_DB=1/);assert.match(env,/CAFE_DEMO_EMPTY=1/);
 assert.equal(await exists(join(destination,'.local')),false);
});

test('the real generated client retains notification code and an installable runtime dependency graph', async () => {
  const destination = join(scratch, 'notification-client');
  const generated = spawnSync(process.execPath, [join(root, 'scripts', 'cafe.mjs'), 'init', destination, '--preset', 'full', '--yes'], { cwd: root, encoding: 'utf8', timeout: 20000 });
  assert.equal(generated.status, 0, generated.stderr);
  const pkg = JSON.parse(await readFile(join(destination, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(destination, 'package-lock.json'), 'utf8'));
  assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies);
  for (const name of Object.keys(pkg.dependencies)) assert.ok(lock.packages[`node_modules/${name}`], `Missing standalone npm lock entry: ${name}`);
  assert.equal(pkg.dependencies.sonner, '2.0.7');
  assert.equal(pkg.dependencies.sharp, '0.35.5');
  assert.equal(await exists(join(destination, 'src', 'plugins', 'attendance', 'storage', 'index.mjs')), true);
  assert.equal(await exists(join(destination, 'src', 'plugins', 'attendance', 'migrations', '0001_attendance.sql')), true);
  for (const file of ['app/api/attendance/route.ts', 'src/plugins/attendance/server-config.ts', 'src/plugins/attendance/accessor.ts', 'src/plugins/attendance/route-handler.ts', 'src/plugins/attendance/migrations/0002_evidence.sql', 'src/plugins/attendance/migrations/0003_retention_schedule.sql', 'src/plugins/attendance/migrations/0004_canceled.sql']) assert.equal(await exists(join(destination, file)), true, file);
  assert.equal(await exists(join(destination, 'lib', 'order-notification-tracker.ts')), true);
  assert.equal(await exists(join(destination, 'src', 'demo-runtime')), false);
  const component = await readFile(join(destination, 'components', 'cafe', 'order-notifications.tsx'), 'utf8');
  assert.match(component, /@\/lib\/order-notification-tracker/);
  assert.doesNotMatch(component, /src\/demo-runtime/);
});
