import test from 'node:test';
import assert from 'node:assert/strict';
import { attachOperationServer, createOperationClient } from '../src/demo-runtime/operation-protocol.ts';
import { createDurableOperationBatch } from '../src/demo-runtime/durable-batch.ts';

function channels() {
  const peers = new Set();
  return () => {
    const listeners = new Set();
    const channel = {
      postMessage(data) { for (const peer of peers) if (peer !== channel) queueMicrotask(() => peer.deliver(data)); },
      addEventListener(_type, listener) { listeners.add(listener); },
      removeEventListener(_type, listener) { listeners.delete(listener); },
      deliver(data) { for (const listener of listeners) listener({ data }); },
      close() { peers.delete(channel); listeners.clear(); },
    };
    peers.add(channel);
    return channel;
  };
}

function client(channel, extra = {}) {
  let next = 0;
  return createOperationClient(channel, { id: () => `request-${Math.random()}-${next++}`, probeIntervalMs: 2, readyTimeoutMs: 500, operationTimeoutMs: 500, ...extra });
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('the elected worker serializes whole operations from different tabs and acknowledges only after durable flush', async () => {
  const channel = channels();
  const a = client(channel());
  const b = client(channel());
  const worker = channel();
  const data = [];
  let release;
  const flushing = deferred();
  let flushes = 0;
  const storage = { async syncToFs(strict) {
    assert.equal(strict, false);
    flushes++;
    if (flushes === 1) await new Promise(resolve => { release = resolve; flushing.resolve(); });
  } };
  const durable = createDurableOperationBatch(storage);
  const detach = attachOperationServer(worker, async value => durable(async () => {
    data.push(value);
    await storage.syncToFs();
    return [...data];
  }));
  const first = a.request('first');
  const second = b.request('second');
  await flushing.promise;
  assert.deepEqual(data, ['first']);
  let acknowledged = false;
  void first.then(() => { acknowledged = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(acknowledged, false);
  release();
  assert.deepEqual(await first, ['first']);
  assert.deepEqual(await second, ['first', 'second']);
  assert.equal(flushes, 2);
  detach(); a.close(); b.close(); worker.close();
});

test('handover waits for the new worker and never replays an uncertain write', async () => {
  const channel = channels();
  const tab = client(channel());
  const oldWorker = channel();
  let release;
  let executions = 0;
  const started = deferred();
  const detachOld = attachOperationServer(oldWorker, async () => {
    executions++;
    await new Promise(resolve => { release = resolve; started.resolve(); });
    return 'possibly committed';
  });
  const write = tab.request('write');
  await started.promise;
  tab.leaderChanged();
  await assert.rejects(write, error => error.code === 'DEMO_LEADER_CHANGED');
  detachOld(); oldWorker.close();
  const read = tab.request('read'); // probes until a new leader installs its listener
  const newWorker = channel();
  const detachNew = attachOperationServer(newWorker, async operation => { executions++; return operation; });
  assert.equal(await read, 'read');
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(executions, 2, 'the uncertain write was not sent to the new leader');
  detachNew(); tab.close(); newWorker.close();
});

test('a timed-out caller does not allow the next operation to overtake its write', async () => {
  const channel = channels();
  const tab = client(channel(), { operationTimeoutMs: 20 });
  const other = client(channel());
  const worker = channel();
  const order = [];
  let release;
  const started = deferred();
  const detach = attachOperationServer(worker, async operation => {
    order.push(`start ${operation}`);
    if (operation === 'write') await new Promise(resolve => { release = resolve; started.resolve(); });
    order.push(`end ${operation}`);
    return operation;
  });
  const first = tab.request('write');
  await started.promise;
  await assert.rejects(first, error => error.code === 'DEMO_OPERATION_TIMEOUT');
  const next = other.request('read');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(order, ['start write']);
  release();
  assert.equal(await next, 'read');
  assert.deepEqual(order, ['start write', 'end write', 'start read', 'end read']);
  detach(); tab.close(); other.close(); worker.close();
});

test('aborting while waiting for an owner never dispatches a command', async () => {
  const channel = channels();
  const tab = client(channel());
  const aborter = new AbortController();
  const request = tab.request('write', aborter.signal);
  aborter.abort();
  await assert.rejects(request, error => error.name === 'AbortError');
  let executions = 0;
  const worker = channel();
  const detach = attachOperationServer(worker, async () => { executions++; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(executions, 0);
  detach(); tab.close(); worker.close();
});
