import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../worker/api.ts';
import { database } from '../scripts/sqlite.mjs';

test('explicit database provider does not silently use the native D1 binding', async () => {
  const db = await database();
  const old = console.error;
  console.error = () => {};
  try {
    for (const provider of ['turso', 'postgresql', 'invalid']) {
      const response = await handle(new Request('https://school.test/api/bootstrap'), { DB: db, DATABASE_PROVIDER: provider });
      assert.equal(response.status, 500, provider);
    }
    const response = await handle(new Request('https://school.test/api/bootstrap'), { DB: db, DEMO_MODE: 'true' });
    assert.equal(response.status, 200);
  } finally { console.error = old; db.raw.close(); }
});
