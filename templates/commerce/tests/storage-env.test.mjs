import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storageEnv } from '../scripts/env.mjs';

test('development and migrations resolve generated provider and private local credentials', async t => {
  const directory = await mkdtemp(join(tmpdir(),'commerce-storage-env-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = pathToFileURL(directory + '/');
  assert.equal((await storageEnv(root, {})).DATABASE_PROVIDER, 'turso');
  await mkdir(new URL('config/', root));
  await writeFile(new URL('config/storage.json', root), JSON.stringify({ database: 'turso' }));
  assert.equal((await storageEnv(root, {})).DATABASE_PROVIDER, 'turso');
  await writeFile(new URL('.dev.vars', root), 'DATABASE_PROVIDER="postgresql"\nDATABASE_URL="local-secret"\n');
  assert.deepEqual(await storageEnv(root, {}), { DATABASE_PROVIDER: 'postgresql', DATABASE_URL: 'local-secret' });
  assert.deepEqual(await storageEnv(root, { DATABASE_PROVIDER: 'turso', DATABASE_URL: 'shell-secret' }), { DATABASE_PROVIDER: 'turso', DATABASE_URL: 'shell-secret' });
});
