#!/usr/bin/env node
import { constants as fsConstants } from 'node:fs';
import { cp, copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, extname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import {
  MODULES, THEMES, PRESETS, ConfigError,
  applyPreset, brandInitials, slugify, validateConfig,
} from '../src/config/catalog.mjs';

const TEMPLATE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '1.0.0';
const HELP = `Cafe template CLI ${VERSION}

Usage:
  cafe init <directory> [options]     Create a separate client project
  cafe configure [options]           Update this project's public settings
  cafe doctor [--dir <path>] [--json] Check settings and local assets
  cafe presets [--json]              List service packages
  cafe themes [--json]               List visual themes
  cafe modules [--json]              List individual modules

Client options:
  --name <name>             Full brand name
  --short-name <text>       Logo fallback, such as DP
  --slug <slug>             Tenant + outlet slug; lowercase letters/hyphens
  --tenant <slug>           Override tenant slug
  --outlet <slug>           Override outlet slug
  --outlet-name <name>      Branch name
  --description <text>      Short brand description
  --address <text>          Outlet address
  --phone <text>            Public contact phone
  --preset <id>             Choose a service package
  --modules <list>          Exact comma-separated modules instead of a preset
  --payment <mode>          cashier, online, or both (validated against modules)
  --theme <id>              boxy, rounded, editorial, playful, airy
  --color <#RRGGBB>         Brand color; foreground contrast is automatic
  --logo <path-or-url>      /brand/logo.svg or an HTTPS image URL
  --logo-file <path>        Copy your local SVG/PNG/JPG/WebP/AVIF into public/brand
  --timezone <zone>         IANA timezone; default Asia/Jakarta
  --dir <path>              Existing project for configure / doctor
  --yes                    Use defaults without interactive questions
  --dry-run                Show validated changes without writing files
  --json                   Machine-readable result
  --help                   Show this help

Examples:
  npm run cafe -- init ../kopi-senja --name "Kopi Senja" --preset catalog --theme editorial --yes
  npm run cafe -- configure --preset cashier-kitchen --theme boxy --color '#173E35' --yes
  npm run cafe -- init ../ruang --name "Ruang" --modules catalog,ordering,cashier,kitchen --yes

Use --modules catalog for a read-only menu without a database. The catalog
preset includes guest lists and the waiter inbox with offline payment. Ordering
projects start with demo data; real payments and staff authentication need
production adapters before a client starts taking live orders.
`;

const BOOLEAN_OPTIONS = new Set(['yes', 'dry-run', 'json', 'help']);
const CLIENT_OPTIONS = new Set(['name', 'short-name', 'slug', 'tenant', 'outlet', 'outlet-name', 'description', 'address', 'phone', 'preset', 'modules', 'payment', 'theme', 'color', 'logo', 'logo-file', 'timezone']);
const ALL_OPTIONS = new Set([...BOOLEAN_OPTIONS, ...CLIENT_OPTIONS, 'dir']);

function parseArguments(argv) {
  const options = {};
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h') { options.help = true; continue; }
    if (!arg.startsWith('--')) {
      if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}. Use --help.`);
      positional.push(arg);
      continue;
    }
    const equals = arg.indexOf('=');
    const key = arg.slice(2, equals === -1 ? undefined : equals);
    if (!ALL_OPTIONS.has(key)) throw new Error(`Unknown option --${key}. Use --help.`);
    if (Object.hasOwn(options, key)) throw new Error(`Option --${key} was supplied more than once.`);
    if (BOOLEAN_OPTIONS.has(key)) {
      if (equals !== -1) throw new Error(`Option --${key} does not take a value.`);
      options[key] = true;
      continue;
    }
    const value = equals === -1 ? argv[++index] : arg.slice(equals + 1);
    if (value === undefined || value.startsWith('--')) throw new Error(`Option --${key} needs a value.`);
    options[key] = value;
  }
  const command = positional.shift() || 'help';
  if (!['init', 'configure', 'doctor', 'presets', 'themes', 'modules', 'help'].includes(command)) throw new Error(`Unknown command ${command}. Use --help.`);
  if (positional.length > (command === 'init' ? 1 : 0)) throw new Error(`Unexpected argument ${positional[command === 'init' ? 1 : 0]}.`);
  const allowed = command === 'init'
    ? new Set([...BOOLEAN_OPTIONS, ...CLIENT_OPTIONS])
    : command === 'configure'
      ? new Set([...BOOLEAN_OPTIONS, ...CLIENT_OPTIONS, 'dir'])
      : command === 'doctor' ? new Set(['json', 'help', 'dir']) : new Set(['json', 'help']);
  for (const key of Object.keys(options)) if (!allowed.has(key)) throw new Error(`Option --${key} does not apply to ${command}.`);
  if (options.preset !== undefined && options.modules !== undefined) throw new Error('Use --preset or --modules, not both.');
  if (options.logo !== undefined && options['logo-file'] !== undefined) throw new Error('Use --logo or --logo-file, not both.');
  return { command, options, target: positional[0] };
}

async function readConfig(directory) {
  const path = join(directory, 'config', 'cafe.json');
  try { return validateConfig(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error(`No config/cafe.json in ${directory}. Run this inside a cafe project or pass --dir.`);
    if (error instanceof SyntaxError) throw new Error(`config/cafe.json is not valid JSON: ${error.message}`);
    throw error;
  }
}

function applyOptions(base, options, isNew) {
  let config = structuredClone(base);
  if (options.preset !== undefined) config = applyPreset(config, options.preset);
  if (options.modules !== undefined) {
    config.modules = options.modules.split(',').map(value => value.trim());
    config.payment.mode = config.modules.includes('payments') ? (config.modules.includes('cashier') ? 'both' : 'online') : 'cashier';
  }
  if (options.name !== undefined) {
    config.brand.name = options.name;
    config.brand.shortName = brandInitials(options.name);
    if (isNew || config.venue.name === base.brand.name) config.venue.name = options.name;
    if (isNew && options.slug === undefined) {
      config.venue.tenantSlug = slugify(options.name);
      config.venue.outletSlug = slugify(options.name);
    }
  }
  if (options.slug !== undefined) config.venue.tenantSlug = config.venue.outletSlug = options.slug;
  const mappings = [
    ['short-name', config.brand, 'shortName'], ['description', config.brand, 'description'],
    ['color', config.brand, 'primaryColor'], ['logo', config.brand, 'logo'],
    ['tenant', config.venue, 'tenantSlug'], ['outlet', config.venue, 'outletSlug'],
    ['outlet-name', config.venue, 'name'], ['address', config.venue, 'address'], ['phone', config.venue, 'phone'],
    ['theme', config, 'theme'], ['timezone', config, 'timezone'], ['payment', config.payment, 'mode'],
  ];
  for (const [key, object, field] of mappings) if (options[key] !== undefined) object[field] = options[key];
  return config;
}

async function promptOptions(options, defaults, isNew) {
  if (options.yes || options.json || !stdin.isTTY || !stdout.isTTY) return options;
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const ask = async (label, fallback) => (await prompt.question(`${label} [${fallback}]: `)).trim() || fallback;
    const result = { ...options };
    if (result.name === undefined && isNew) result.name = await ask('Brand name', defaults.brand.name);
    if (result.preset === undefined && result.modules === undefined) {
      stdout.write(`\nService packages:\n${Object.entries(PRESETS).map(([id, preset]) => `  ${id.padEnd(21)} ${preset.label}`).join('\n')}\n\n`);
      if (isNew) result.preset = await ask('Package', 'catalog');
      else {
        const selected = await ask('Package (keep = current modules)', 'keep');
        if (selected !== 'keep') result.preset = selected;
      }
    }
    if (result.theme === undefined) result.theme = await ask(`Theme (${Object.keys(THEMES).join(', ')})`, defaults.theme);
    if (result.color === undefined) result.color = await ask('Brand color', defaults.brand.primaryColor);
    return result;
  } finally { prompt.close(); }
}

async function prepareLogo(options, config) {
  if (options['logo-file'] === undefined) return null;
  const source = resolve(options['logo-file']);
  const extension = extname(source).toLowerCase();
  if (!['.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif'].includes(extension)) throw new Error('--logo-file must be SVG, PNG, JPG, WebP, or AVIF.');
  let stat;
  try { stat = await lstat(source); } catch { throw new Error(`Logo file does not exist: ${source}`); }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0 || stat.size > 5 * 1024 * 1024) throw new Error('Logo must be a non-empty regular file, at most 5 MB.');
  const digest = createHash('sha256').update(await readFile(source)).digest('hex').slice(0, 12);
  const filename = `logo-${digest}${extension === '.jpeg' ? '.jpg' : extension}`;
  config.brand.logo = `/brand/${filename}`;
  return { source, relativePath: join('public', 'brand', filename) };
}

async function exists(path) {
  try { await lstat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function canonicalDestination(path) {
  let current = resolve(path);
  const missing = [];
  while (!(await exists(current))) { missing.unshift(basename(current)); current = dirname(current); }
  return join(await realpath(current), ...missing);
}

const ROOT_DIRECTORIES = new Set(['app', 'components', 'config', 'content', 'hooks', 'lib', 'public', 'scripts', 'src', 'docs', 'tests', '.github']);
const ROOT_FILES = new Set(['package.json', 'package-lock.json', 'bun.lock', 'pnpm-lock.yaml', 'yarn.lock', 'next-env.d.ts', 'next.config.ts', 'next.config.mjs', 'tsconfig.json', 'eslint.config.mjs', 'postcss.config.mjs', '.gitignore', '.env.example', 'README.md', 'LICENSE']);
const EXCLUDED_DIRECTORIES = new Set(['node_modules', '.git', '.next', '.local', '.aistudio', '.agents', '.codex', 'coverage', 'dist', 'build', 'test-results', 'playwright-report', '__pycache__']);
// Traverse only the two ancestors of the reviewed CI file; no other GitHub
// settings, deployment workflows, credentials, or hidden files are inherited.
const CI_PATHS = new Set(['.github', join('.github', 'workflows'), join('.github', 'workflows', 'ci.yml')]);
const SHOWCASE_PACKAGES = new Set(['@tampiloka/ui-core', '@noble/hashes', '@vitejs/plugin-react', 'vite', 'wrangler']);
const DEPENDENCY_GROUPS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

function clientPackage(source, name) {
  const pkg = structuredClone(source);
  pkg.name = name;
  pkg.private = true;
  const excludedScripts = new Set();
  for (const [id, command] of Object.entries(pkg.scripts || {})) {
    if (id === 'test:attendance:browser' || id.startsWith('demos:') || id.startsWith('test:demo-') || /(?:^|[\s"'])demos\//.test(command) || /(?:src\/demo-runtime\/|tests\/(?:browser-runtime|demos[.-])|scripts\/generate-demo-schema)/.test(command)) {
      excludedScripts.add(id);
      delete pkg.scripts[id];
    }
  }
  // Keep a core test pipeline usable if the template also chains optional
  // showcase tests. Only remove an exact npm script invocation, not shell text.
  for (const [id, command] of Object.entries(pkg.scripts || {})) {
    const parts = command.split(/\s*&&\s*/).filter(part => {
      const invocation = part.match(/^npm\s+run\s+([^\s]+)$/);
      return !invocation || !excludedScripts.has(invocation[1]);
    });
    if (parts.length) pkg.scripts[id] = parts.join(' && ');
    else delete pkg.scripts[id];
  }
  for (const group of DEPENDENCY_GROUPS) {
    for (const dependency of SHOWCASE_PACKAGES) {
      if (pkg[group]) delete pkg[group][dependency];
      if (group === 'peerDependencies' && pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta[dependency];
    }
  }
  return pkg;
}

function clientLockfile(source, pkg) {
  const lock = structuredClone(source);
  if (!lock.packages?.['']) throw new Error('Client generation needs an npm v2/v3 package-lock.json. Run npm install in the template first.');
  lock.name = pkg.name;
  lock.version = pkg.version ?? lock.version;
  const root = { ...lock.packages[''], name: pkg.name };
  for (const group of DEPENDENCY_GROUPS) {
    if (pkg[group]) root[group] = structuredClone(pkg[group]);
    else delete root[group];
  }
  if (pkg.peerDependenciesMeta) root.peerDependenciesMeta = structuredClone(pkg.peerDependenciesMeta);
  else delete root.peerDependenciesMeta;
  lock.packages[''] = root;

  const resolveDependency = (from, name) => {
    let parent = from;
    while (true) {
      const candidate = posix.join(parent, 'node_modules', name);
      if (Object.hasOwn(lock.packages, candidate)) return candidate;
      if (!parent) return null;
      parent = posix.dirname(parent);
      if (parent === '.') parent = '';
    }
  };
  const retained = new Set(['']);
  const pending = [''];
  while (pending.length) {
    const path = pending.pop();
    const entry = lock.packages[path];
    if (entry.link) {
      if (!entry.resolved?.startsWith('packages/')) throw new Error('Unexpected linked npm dependency in Cafe lockfile.');
      if (!retained.has(entry.resolved)) { retained.add(entry.resolved); pending.push(entry.resolved); }
      continue;
    }
    const dependencies = new Set([
      ...Object.keys(entry.dependencies || {}),
      ...Object.keys(entry.optionalDependencies || {}),
      ...Object.keys(entry.peerDependencies || {}),
      ...(path === '' ? Object.keys(entry.devDependencies || {}) : []),
    ]);
    for (const dependency of dependencies) {
      const resolved = resolveDependency(path, dependency);
      if (resolved && !retained.has(resolved)) {
        retained.add(resolved);
        pending.push(resolved);
      }
    }
  }
  // npm ci installs orphaned entries from a copied lock, even after root
  // devDependencies change. Keep only the normal/optional/peer graph reachable
  // from this client, with its existing versions, integrity hashes and paths.
  lock.packages = Object.fromEntries(Object.entries(lock.packages).filter(([path]) => retained.has(path)));
  lock.lockfileVersion = 3;
  delete lock.dependencies; // Redundant v2 metadata must not retain showcase nodes.
  return lock;
}

function includeFile(path) {
  const parts = path.split(sep);
  const name = parts[parts.length - 1];
  if (parts[0] === '.github') return CI_PATHS.has(path);
  if (parts[0] === 'src' && parts[1] === 'demo-runtime') return false;
  if (parts[0] === 'tests' && (parts[1] === 'attendance-fixture' || /^(?:browser-runtime|demos)(?:[.-]|$)/.test(parts[1] || ''))) return false;
  if (parts[0] === 'scripts' && /^(?:demos[.-]|(?:build|deploy)-demos[.-]|generate-demo-schema[.-])/.test(name)) return false;
  if (parts.some(part => EXCLUDED_DIRECTORIES.has(part))) return false;
  if (parts.some(part => part.startsWith('.') && !['.gitignore', '.env.example'].includes(part))) return false;
  if (/^(?:credentials|service[-_]account)/i.test(name) || /\.(?:pem|key|p12|pfx|db|sqlite|sqlite3|log)$/i.test(name)) return false;
  if (parts[0] === 'public' && ['benchmarks', 'screenshots', 'ui-tests'].includes(parts[1])) return false;
  if (name.endsWith('.tsbuildinfo')) return false;
  return true;
}

async function sourceFiles() {
  const files = [];
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = prefix ? join(prefix, entry.name) : entry.name;
      if (entry.isSymbolicLink() || !includeFile(path)) continue;
      if (!prefix && !(entry.isDirectory() ? ROOT_DIRECTORIES.has(entry.name) : ROOT_FILES.has(entry.name))) continue;
      if (entry.isDirectory()) await walk(join(directory, entry.name), path);
      else if (entry.isFile() && path !== join('config', 'cafe.json') && path !== 'package.json' && path !== 'package-lock.json') files.push(path);
    }
  }
  await walk(TEMPLATE_ROOT);
  return files.sort();
}

function summary(config) {
  return { name: config.brand.name, theme: config.theme, color: config.brand.primaryColor, modules: config.modules, paymentMode: config.payment.mode, tenant: config.venue.tenantSlug, outlet: config.venue.outletSlug };
}

function output(options, result, message) {
  stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` : `${message}\n`);
}

async function init(target, options) {
  if (!target) throw new Error('Choose a new directory: cafe init ../client-name --name "Client Name" --preset catalog --yes');
  const destination = await canonicalDestination(target);
  const source = await realpath(TEMPLATE_ROOT);
  if (destination === source || destination.startsWith(`${source}${sep}`)) throw new Error('Create clients outside the template directory, for example ../client-name.');
  if (await exists(destination)) throw new Error(`Destination already exists: ${destination}. Choose a new directory; existing files are never overwritten.`);
  const base = await readConfig(TEMPLATE_ROOT);
  options = await promptOptions(options, base, true);
  // A new client keeps the template's selected package unless the user picks one.
  const draft = applyOptions(base, options, true);
  const logo = await prepareLogo(options, draft);
  const config = validateConfig(draft);
  const staticCatalog = config.modules.length === 1 && config.modules[0] === 'catalog';
  const files = (await sourceFiles()).filter(path => path !== logo?.relativePath);
  const pkg = clientPackage(JSON.parse(await readFile(join(TEMPLATE_ROOT, 'package.json'), 'utf8')), config.venue.tenantSlug);
  const shared = [];
  for (const group of DEPENDENCY_GROUPS) for (const name of Object.keys(pkg[group] || {})) {
    if (name.startsWith('@tampiloka/')) {
      const id = name.slice('@tampiloka/'.length);
      if (id !== 'storage') throw new Error(`Missing standalone shared package: ${id}`);
      if (!shared.includes(id)) shared.push(id);
      pkg[group][name] = `file:./packages/${id}`;
    }
  }
  const lock = await exists(join(TEMPLATE_ROOT, 'package-lock.json'))
    ? clientLockfile(JSON.parse(await readFile(join(TEMPLATE_ROOT, 'package-lock.json'), 'utf8')), pkg)
    : null;
  const result = { command: 'init', dryRun: Boolean(options['dry-run']), directory: destination, config: summary(config), copiedFiles: files.length + 3 + (lock ? 1 : 0) + (logo ? 1 : 0) };
  if (options['dry-run']) {
    output(options, result, `Dry run: create ${destination}\n${JSON.stringify(summary(config), null, 2)}\nNo files written.`);
    return;
  }
  await mkdir(dirname(destination), { recursive: true });
  await mkdir(destination); // Atomic refusal when another process has created it.
  try {
    for (const id of shared) {
      const local = join(TEMPLATE_ROOT, 'packages', id);
      const sourcePackage = await exists(local) ? local : resolve(TEMPLATE_ROOT, '../../packages', id);
      await cp(sourcePackage, join(destination, 'packages', id), { recursive: true, filter: path => !['node_modules', '.git', 'dist'].includes(basename(path)) });
    }
    for (const path of files) {
      const targetPath = join(destination, path);
      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(join(TEMPLATE_ROOT, path), targetPath, fsConstants.COPYFILE_EXCL);
    }
    await mkdir(join(destination, 'config'), { recursive: true });
    await writeFile(join(destination, 'config', 'cafe.json'), `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
    await writeFile(join(destination, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`, { flag: 'wx' });
    if (lock) {
      await writeFile(join(destination, 'package-lock.json'), `${JSON.stringify(lock, null, 2)}\n`, { flag: 'wx' });
    }
    await writeFile(join(destination, '.env.local'), staticCatalog
      ? '# Read-only static catalog. Edit content/menu.json and content/tables.json.\nCAFE_DEMO_DB=0\n'
      : '# Local demo only. Keep real provider and staff credentials out of public config.\nCAFE_DEMO_DB=1\nCAFE_DEMO_EMPTY=1\nCAFE_DEMO_DATA_DIR=.local/cafe-db\n', { flag: 'wx' });
    if (logo) {
      await mkdir(dirname(join(destination, logo.relativePath)), { recursive: true });
      await copyFile(logo.source, join(destination, logo.relativePath), fsConstants.COPYFILE_EXCL);
    }
  } catch (error) {
    await rm(destination, { recursive: true, force: true });
    throw error;
  }
  output(options, result, `Created ${config.brand.name} in ${destination}\nTheme: ${config.theme}\nModules: ${config.modules.join(', ')}\n\nNext:\n  cd ${JSON.stringify(relative(process.cwd(), destination) || destination)}\n  npm ci\n  npm run cafe -- doctor\n  npm run ${staticCatalog ? 'dev' : 'demo'}\n\n${staticCatalog ? 'Edit content/menu.json and content/tables.json before publishing. The included menu is sample content.' : 'Use a separate database and deployment for each client. The new project contains demo data only.'}`);
}

async function configure(options) {
  const directory = await realpath(resolve(options.dir || process.cwd()));
  const base = await readConfig(directory);
  options = await promptOptions(options, base, false);
  const draft = applyOptions(base, options, false);
  const logo = await prepareLogo(options, draft);
  const config = validateConfig(draft);
  const logoExists = Boolean(logo && await exists(join(directory, logo.relativePath)));
  if (logoExists && (await lstat(join(directory, logo.relativePath))).isSymbolicLink()) throw new Error('The selected logo target must not be a symlink.');
  const result = { command: 'configure', dryRun: Boolean(options['dry-run']), directory, config: summary(config) };
  if (options['dry-run']) { output(options, result, `Dry run: update ${directory}/config/cafe.json\n${JSON.stringify(summary(config), null, 2)}\nNo files written.`); return; }
  const path = join(directory, 'config', 'cafe.json');
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  let copiedLogo = false;
  try {
    if (logo && !logoExists) {
      const brandDirectory = join(directory, 'public', 'brand');
      if (await exists(brandDirectory) && (await lstat(brandDirectory)).isSymbolicLink()) throw new Error('public/brand must be a real directory, not a symlink.');
      await mkdir(brandDirectory, { recursive: true });
      await copyFile(logo.source, join(directory, logo.relativePath), fsConstants.COPYFILE_EXCL);
      copiedLogo = true;
    }
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    if (copiedLogo) await rm(join(directory, logo.relativePath), { force: true });
    throw error;
  }
  output(options, result, `Updated config/cafe.json\nTheme: ${config.theme}\nModules: ${config.modules.join(', ')}\nRestart the dev server or rebuild to apply configuration changes.\nChanging a slug does not migrate existing client data.`);
}

async function doctor(options) {
  const directory = resolve(options.dir || process.cwd());
  const config = await readConfig(directory);
  const checks = [{ name: 'Configuration', status: 'pass', detail: 'Valid settings, modules, payment mode, and theme.' }];
  const [major, minor] = process.versions.node.split('.').map(Number);
  checks.push({ name: 'Node.js', status: major > 22 || (major === 22 && minor >= 12) ? 'pass' : 'fail', detail: `Running ${process.versions.node}; use Node.js 22.12 or newer.` });
  if (config.brand.logo.startsWith('/')) {
    const path = resolve(directory, 'public', `.${config.brand.logo.split(/[?#]/)[0]}`);
    let valid = false;
    try { const stat = await lstat(path); valid = stat.isFile() && stat.size > 0 && !stat.isSymbolicLink(); } catch { /* Report missing asset. */ }
    checks.push({ name: 'Logo', status: valid ? 'pass' : 'fail', detail: valid ? config.brand.logo : `Missing or empty local image: ${config.brand.logo}` });
  } else checks.push({ name: 'Logo', status: config.brand.logo ? 'warn' : 'pass', detail: config.brand.logo ? 'External HTTPS image; availability must be checked in a browser.' : 'Using brand initials until a logo is supplied.' });
  const lock = await exists(join(directory, 'package-lock.json')) || await exists(join(directory, 'bun.lock'));
  checks.push({ name: 'Dependencies', status: lock ? 'pass' : 'warn', detail: lock ? 'Dependency lockfile found.' : 'Run npm install and commit the generated lockfile.' });
  const staticCatalog = config.modules.length === 1 && config.modules[0] === 'catalog';
  try {
    const menu = JSON.parse(await readFile(join(directory, 'content', 'menu.json'), 'utf8'));
    if (menu.sample === true) checks.push({ name: 'Menu content', status: 'warn', detail: 'The menu is marked as sample content. Check items, prices, photos, and availability before marking sample:false.' });
    else if (menu.sample === false) checks.push({ name: 'Menu content', status: 'pass', detail: 'The menu is marked as client content. Check it in a browser before publishing.' });
    else checks.push({ name: 'Menu content', status: staticCatalog ? 'fail' : 'warn', detail: 'content/menu.json must include an explicit sample:true or sample:false flag.' });
  } catch {
    checks.push({ name: 'Menu content', status: staticCatalog ? 'fail' : 'warn', detail: 'content/menu.json is missing or not valid JSON.' });
  }
  checks.push({ name: 'Deployment', status: staticCatalog ? 'pass' : 'warn', detail: staticCatalog ? 'Read-only catalog can use static content without a database. Run npm run dev, or npm run build then npm start, with CAFE_DEMO_DB unset or 0.' : 'Ordering workflows are demos. Live orders require server-side staff authentication; real payment settlement needs a provider adapter.' });
  if (config.modules.includes('payments')) checks.push({ name: 'Online payments', status: 'warn', detail: 'Payment UI is enabled. Demo payment confirmation is not a live provider integration.' });
  const ok = checks.every(check => check.status !== 'fail');
  output(options, { command: 'doctor', ok, directory, config: summary(config), checks }, `${config.brand.name}\n${checks.map(check => `${check.status.toUpperCase().padEnd(4)}  ${check.name}: ${check.detail}`).join('\n')}\n\nModules: ${config.modules.join(', ')}\nTheme: ${config.theme}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const { command, options, target } = parseArguments(process.argv.slice(2));
  if (options.help || command === 'help') { stdout.write(HELP); return; }
  if (['presets', 'themes', 'modules'].includes(command)) {
    const values = command === 'presets' ? PRESETS : command === 'themes' ? THEMES : MODULES;
    output(options, values, Object.entries(values).map(([id, item]) => `${id.padEnd(22)} ${item.label}\n  ${item.description || item.modules.join(', ')}`).join('\n'));
    return;
  }
  if (command === 'init') await init(target, options);
  else if (command === 'configure') await configure(options);
  else await doctor(options);
}

main().catch(error => {
  process.stderr.write(`${error instanceof ConfigError ? error.message : `Cafe CLI: ${error.message}`}\n`);
  process.exitCode = 1;
});

