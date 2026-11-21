import test from 'node:test';
import assert from 'node:assert/strict';
import { createDurableOperationBatch } from '../src/demo-runtime/durable-batch.ts';
import { RecoverableIdbFs } from '../src/demo-runtime/recoverable-idbfs.ts';

function disconnectedStorage(failures) {
  const storage = new RecoverableIdbFs('test');
  let calls = 0;
  let closes = 0;
  const databases = { '/pglite/test': { close() { closes++; } } };
  storage.pg = { closed: false, Module: { FS: {
    filesystems: { IDBFS: { dbs: databases } },
    syncfs(populate, done) { assert.equal(populate, false); done(failures[calls++]); },
  } } };
  return { storage, databases, calls: () => calls, closes: () => closes };
}

test('closed IndexedDB reconnects once without replaying the command', async () => {
  const fixture = disconnectedStorage([new DOMException("The database connection is closing.", 'InvalidStateError')]);
  const run = createDurableOperationBatch(fixture.storage);
  let commands = 0;
  assert.equal(await run(async () => { commands++; await fixture.storage.syncToFs(); return 'saved'; }), 'saved');
  assert.equal(commands, 1);
  assert.equal(fixture.calls(), 2);
  assert.equal(fixture.closes(), 1);
  assert.equal(fixture.databases['/pglite/test'], undefined);
});

test('reconnect failures and other storage errors still fail closed', async () => {
  const closed = new DOMException('The database connection is closing.', 'InvalidStateError');
  for (const failures of [[closed, closed], [new DOMException('Storage full', 'QuotaExceededError')]]) {
    const fixture = disconnectedStorage(failures);
    await assert.rejects(fixture.storage.syncToFs(), error => error === failures.at(-1));
    assert.equal(fixture.calls(), failures.length);
  }
});

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
