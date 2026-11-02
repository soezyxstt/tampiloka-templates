import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './harness.mjs';

test('readiness detects missing session schema and fresh visitors can configure the demo', async (t) => {
  const { env, c } = fixture(t);
  assert.equal((await c.get('/api/health')).status, 200);
  assert.equal((await c.get('/api/bootstrap')).status, 200);
  const config = await c.post('/api/demo/config', { preset: 'medical', level: 'full' });
  assert.equal(config.status, 200);
  assert.equal(config.data.config.preset, 'medical');
  env.DB.db.exec('DROP TABLE rate_limits');
  assert.notEqual((await c.get('/api/health')).status, 200);
});

test('sample scenario cancels a slot beyond the cancellation deadline', async (t) => {
  const { c, setNow } = fixture(t);
  setNow('2026-11-01T16:00:00Z');
  assert.equal((await c.post('/api/demo/config', { preset: 'consulting', level: 'full' })).status, 200);
  assert.equal((await c.post('/api/demo/role', { role: 'owner' })).status, 200);
  const result = await c.post('/api/demo/scenario', {});
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.created, 3);
  const bookings = await c.get('/api/staff/bookings');
  assert.ok(bookings.data.bookings.some(booking => booking.status === 'cancelled'));
});
