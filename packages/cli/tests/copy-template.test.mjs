import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { copyTree } from '../src/index.mjs';

test('commerce template copy includes shadcn configuration and components', async t => {
  const destination = await mkdtemp(join(tmpdir(), 'tampiloka-copy-'));
  t.after(() => rm(destination, { recursive: true, force: true }));
  await copyTree(resolve('templates/commerce'), destination, { template: true });
  const config = JSON.parse(await readFile(join(destination, 'components.json'), 'utf8'));
  assert.equal(config.aliases.ui, '@/components/shadcn');
  assert.match(await readFile(join(destination, 'src/components/shadcn/sheet.tsx'), 'utf8'), /data-slot="sheet-content"/);
});
