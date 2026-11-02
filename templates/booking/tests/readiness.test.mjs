import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './harness.mjs';

test('demo seeds presets on first use and retains edits when switching back', async (t) => {
  const { env, c } = fixture(t);
  assert.equal((await c.get('/api/bootstrap')).status, 200);
  const count = () => env.DB.db.prepare('SELECT count(*) AS n FROM settings').get().n;
  assert.equal(count(), 1);
  assert.equal((await c.post('/api/demo/config', { preset: 'aesthetic' })).status, 200);
  assert.equal(count(), 2);
  const original = env.DB.db.prepare("SELECT config_json FROM settings WHERE preset='aesthetic'").get().config_json;
  const edited = JSON.parse(original);
  edited.brand.name = 'Preserved example';
  env.DB.db.prepare("UPDATE settings SET config_json=? WHERE preset='aesthetic'").run(JSON.stringify(edited));
  assert.equal((await c.post('/api/demo/config', { preset: 'medical' })).status, 200);
  const again = await c.post('/api/demo/config', { preset: 'aesthetic' });
  assert.equal(again.status, 200);
  assert.equal(again.data.config.brand.name, 'Preserved example');
  assert.equal(count(), 2);
});

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
