import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { localEnv as schoolEnv, localObjectStorageProvider } from '../scripts/env.mjs';

test('local storage configuration reads .dev.vars with process overrides', async () => {
  const path = await mkdtemp(join(tmpdir(), 'tampiloka-storage-env-'));
  try {
    const root = pathToFileURL(path + '/');
    await writeFile(join(path, '.dev.vars'), 'DATABASE_PROVIDER="postgresql"\nDATABASE_URL=local\nOBJECT_STORAGE_PROVIDER=s3\n');
    for (const load of [schoolEnv]) {
      assert.deepEqual(await load(root, {}), { DATABASE_PROVIDER: 'postgresql', DATABASE_URL: 'local', OBJECT_STORAGE_PROVIDER: 's3' });
      assert.equal((await load(root, { DATABASE_PROVIDER: 'turso' })).DATABASE_PROVIDER, 'turso');
    }
  } finally { await rm(path, { recursive: true, force: true }); }
});

test('local media falls back to local files and honors client selection outside demo mode', async () => {
  const path = await mkdtemp(join(tmpdir(), 'tampiloka-school-media-'));
  try {
    const root = pathToFileURL(path + '/');
    assert.equal(await localObjectStorageProvider(root, {}, false), undefined);
    await mkdir(join(path, 'config'));
    await writeFile(join(path, 'config/storage.json'), JSON.stringify({ objectStorage: 'uploadthing' }));
    assert.equal(await localObjectStorageProvider(root, {}, false), 'uploadthing');
    assert.equal(await localObjectStorageProvider(root, { OBJECT_STORAGE_PROVIDER: 's3' }, false), 's3');
    assert.equal(await localObjectStorageProvider(root, { OBJECT_STORAGE_PROVIDER: 's3' }, true), undefined);
  } finally { await rm(path, { recursive: true, force: true }); }
});
