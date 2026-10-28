import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash as nodeHash } from 'node:crypto';
import { createHash, randomBytes, randomUUID } from '../src/demo-runtime/crypto.ts';

test('browser idempotency hash matches Node for empty, Unicode and incremental payloads', () => {
  for (const value of ['', 'abc', JSON.stringify({ name: 'Kopi pagi ☕', amount: 35805 })]) {
    assert.equal(createHash('sha256').update(value).digest('hex'), nodeHash('sha256').update(value).digest('hex'));
  }
  assert.equal(createHash('sha256').update('ab').update(new Uint8Array([99])).digest('hex'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const finished = createHash('sha256'); finished.digest('hex');
  assert.throws(() => finished.update('later'), /finalized/);
  assert.throws(() => finished.digest('hex'), /finalized/);
  assert.throws(() => createHash('md5'), /SHA-256/);
});

test('browser IDs use Web Crypto bytes and preserve the service hexadecimal contract', () => {
  const first = randomBytes(16);
  const second = randomBytes(16);
  assert.equal(first.byteLength, 16);
  assert.match(first.toString('hex'), /^[a-f0-9]{32}$/);
  assert.notEqual(first.toString('hex'), second.toString('hex'));
  assert.equal(randomBytes(0).toString('hex'), '');
  assert.match(randomUUID(), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.throws(() => randomBytes(-1), RangeError);
  assert.throws(() => randomBytes(1.5), RangeError);
  assert.throws(() => randomBytes(65537), RangeError);
  assert.throws(() => first.toString('base64'));
});
