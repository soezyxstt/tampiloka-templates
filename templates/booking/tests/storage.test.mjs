import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, owner } from './harness.mjs';

test('media requires staff and demo sessions cannot upload', async t => {
  const { c } = fixture(t);
  await c.get('/api/bootstrap');
  const data = { contentType: 'image/png', data: 'eA==' };
  assert.equal((await c.post('/api/staff/media', data)).status, 401);
  await owner(c);
  assert.equal((await c.post('/api/staff/media', data)).status, 403);
});

test('postgresql selection requires credentials instead of using D1', async t => {
  const { c } = fixture(t, { DATABASE_PROVIDER: 'postgresql' });
  const result = await c.get('/api/health');
  assert.equal(result.status, 500);
  assert.equal(result.data.error.code, 'INTERNAL_ERROR');
});
