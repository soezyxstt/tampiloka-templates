import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.ts';
import { database } from '../scripts/sqlite.mjs';

test('explicit database provider does not silently use the native D1 binding', async () => {
  const db = await database();
  const old = console.error;
  console.error = () => {};
  try {
    for (const provider of [undefined, 'turso', 'postgresql', 'invalid']) {
      const response = await worker.fetch(new Request('https://school.test/api/bootstrap'), { DB: db, DATABASE_PROVIDER: provider }, { waitUntil() {} });
      assert.equal(response.status, 503, provider ?? 'default');
    }
    const response = await worker.fetch(new Request('https://school.test/api/bootstrap'), { DB: db, DATABASE_PROVIDER: 'd1', DEMO_MODE: 'true' }, { waitUntil() {} });
    assert.equal(response.status, 200);
  } finally { console.error = old; db.raw.close(); }
});
