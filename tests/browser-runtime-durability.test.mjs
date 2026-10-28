import test from 'node:test';
import assert from 'node:assert/strict';
import { createDurableOperationBatch } from '../src/demo-runtime/durable-batch.ts';

test('a browser command is not acknowledged until its single strict storage flush finishes', async () => {
  let release;
  let calls = 0;
  const storage = { async syncToFs(relaxed) { calls += 1; assert.equal(relaxed, false); await new Promise(resolve => { release = resolve; }); } };
  const run = createDurableOperationBatch(storage);
  let acknowledged = false;
  const operation = run(async () => { await storage.syncToFs(); await storage.syncToFs(); await storage.syncToFs(); assert.equal(calls, 0); return 'saved'; }).then(value => { acknowledged = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1); assert.equal(acknowledged, false);
  release(); assert.equal(await operation, 'saved'); assert.equal(acknowledged, true);
});

test('domain errors still flush completed work and storage failures never report success', async () => {
  let calls = 0;
  const storage = { async syncToFs() { calls += 1; } };
  const run = createDurableOperationBatch(storage);
  await assert.rejects(run(async () => { await storage.syncToFs(); throw new Error('invalid order'); }), /invalid order/);
  assert.equal(calls, 1);
  const unavailable = { async syncToFs() { throw new Error('storage full'); } };
  const failing = createDurableOperationBatch(unavailable);
  await assert.rejects(failing(async () => { await unavailable.syncToFs(); return 'not acknowledged'; }), /storage full/);
});
