import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copyTree } from '../src/index.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../..', import.meta.url));

test('commerce template copy includes shadcn configuration and components', async t => {
  const destination = await mkdtemp(join(tmpdir(), 'tampiloka-copy-'));
  t.after(() => rm(destination, { recursive: true, force: true }));
  await copyTree(resolve(root, 'templates/commerce'), destination, { template: true });
  const config = JSON.parse(await readFile(join(destination, 'components.json'), 'utf8'));
  assert.equal(config.aliases.ui, '@/components/shadcn');
  assert.match(await readFile(join(destination, 'src/components/shadcn/sheet.tsx'), 'utf8'), /data-slot="sheet-content"/);
});

test('cafe template copy includes language support without the demo portal', async t => {
  const parent = await mkdtemp(join(tmpdir(), 'tampiloka-copy-cafe-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const destination = join(parent, 'client');
  const result = spawnSync(process.execPath, [resolve(root, 'templates/cafe/scripts/cafe.mjs'), 'init', destination, '--name', 'Client', '--slug', 'client', '--preset', 'catalog', '--yes', '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(join(destination, 'lib/language.tsx'), 'utf8'), /tampiloka-language-choice/);
  assert.match(await readFile(join(destination, 'components/cafe/customer-app.tsx'), 'utf8'), /@\/lib\/language/);
  await assert.rejects(readFile(join(destination, 'demos/main.tsx')), { code: 'ENOENT' });
});
