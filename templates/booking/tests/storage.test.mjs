import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, owner } from './harness.mjs';
import worker from '../worker/index.ts';

test('media requires staff and demo sessions cannot upload', async t => {
  const { c } = fixture(t);
  await c.get('/api/bootstrap');
  const data = { contentType: 'image/png', data: 'eA==' };
  assert.equal((await c.post('/api/staff/media', data)).status, 401);
  await owner(c);
  assert.equal((await c.post('/api/staff/media', data)).status, 403);
});

test('hosted PostgreSQL selection requires credentials instead of using a D1 binding', async t => {
  const { env } = fixture(t);
  for (const provider of [undefined, 'turso', 'postgresql']) {
    const response = await worker.fetch(new Request('https://booking.test/api/health'), { ...env, DATABASE_PROVIDER: provider });
    assert.equal(response.status, 503, provider ?? 'default');
    assert.equal((await response.json()).error.code, 'DATABASE_NOT_CONFIGURED');
  }
  const response = await worker.fetch(new Request('https://booking.test/api/health'), { ...env, DATABASE_PROVIDER: 'd1' });
  assert.equal(response.status, 200);
});
