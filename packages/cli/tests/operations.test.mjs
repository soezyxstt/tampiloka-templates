import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject } from '../src/index.mjs';
import * as registry from '../../registry/src/index.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
test('Operations generation applies stock-only default and explicit POS levels independently of preset/theme', async t => {
  const out = await mkdtemp(join(tmpdir(), 'operations-levels-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  // Exercise the generator without changing production availability.
  const fixture = { ...registry, getTemplate: id => ({ ...registry.getTemplate(id), status: 'available' }) };
  for (const [level, pos, commercial] of [[undefined, false, false], ['inventory', false, false], ['retail', true, false], ['full', true, true]]) {
    const name = `operations-${level || 'default'}`;
    await createProject(name, { template: 'operations', preset: 'supplies', theme: 'forest', level, out, yes: true, json: true }, root, fixture);
    const config = JSON.parse(await readFile(join(out, name, 'config/operations.json'), 'utf8'));
    assert.equal(config.mode, level || 'inventory');
    assert.deepEqual(config.modules, { pos, commercial });
    assert.equal(config.preset, 'supplies');
    assert.equal(config.theme, 'forest');
    assert.deepEqual(config.demo, { openingStock: [], prices: [] });
    assert.equal(JSON.parse(await readFile(join(out, name, 'tampiloka.project.json'), 'utf8')).level, level || 'inventory');
  }
  await assert.rejects(createProject('not-released', { template: 'operations', level: 'retail', out, yes: true }, root, registry), /belum bisa dibuat/);
});
