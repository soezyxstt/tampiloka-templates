import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { localEnv as bookingEnv, migrationProvider } from '../scripts/env.mjs';

test('local storage configuration reads .dev.vars with process overrides', async () => {
  const path = await mkdtemp(join(tmpdir(), 'tampiloka-storage-env-'));
  try {
    const root = pathToFileURL(path + '/');
    await writeFile(join(path, '.dev.vars'), 'DATABASE_PROVIDER="postgresql"\nDATABASE_URL=local\nOBJECT_STORAGE_PROVIDER=s3\n');
    for (const load of [bookingEnv]) {
      assert.deepEqual(await load(root, {}), { DATABASE_PROVIDER: 'postgresql', DATABASE_URL: 'local', OBJECT_STORAGE_PROVIDER: 's3' });
      assert.equal((await load(root, { DATABASE_PROVIDER: 'turso' })).DATABASE_PROVIDER, 'turso');
    }
  } finally { await rm(path, { recursive: true, force: true }); }
});

test('migrations require explicit demo credentials and honor the selected client provider', () => {
  assert.throws(() => migrationProvider({ DATABASE_PROVIDER: 'd1' }, { database: 'postgresql' }, true), /demo TURSO_DATABASE_URL/);
  assert.equal(migrationProvider({ DATABASE_PROVIDER: 'turso' }, { database: 'postgresql' }, false), 'turso');
  assert.equal(migrationProvider({ DATABASE_PROVIDER: 'd1' }, { database: 'postgresql' }, false), 'd1');
  assert.equal(migrationProvider({}, { database: 'postgresql' }, false), 'postgresql');
  assert.equal(migrationProvider({}, {}, false), 'turso');
});
