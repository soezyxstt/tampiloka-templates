import test from 'node:test';
import assert from 'node:assert/strict';
import { authorized, decodeKey, encodeKey, imageType, MAX_MEDIA_BYTES, readLimited, upload } from './media.mjs';
const env = { CAFE_MEDIA_SECRET: 'a-secret-at-least-32-bytes-long!', OBJECT_STORAGE_PROVIDER: 'uploadthing' };
const png = Uint8Array.from([137,80,78,71,13,10,26,10]);
test('staff authorization fails closed and requires the configured bearer secret', () => {
  assert.equal(authorized(`Bearer ${env.CAFE_MEDIA_SECRET}`, env), true);
  assert.equal(authorized('Bearer wrong', env), false);
  assert.throws(() => authorized('', {}));
});
test('provider-issued key is retained and tokens cannot be forged or cross providers', async () => {
  let passed;
  const token = await upload({ put: async (key, bytes, options) => { passed = { key, bytes, options }; return { key: 'provider-generated-key' }; } }, png, env);
  assert.match(passed.key, /^cafe\//);
  assert.equal(passed.options.contentType, 'image/png');
  assert.equal(decodeKey(token, env), 'provider-generated-key');
  assert.equal(decodeKey(token + 'x', env), null);
  assert.equal(decodeKey(token, { ...env, OBJECT_STORAGE_PROVIDER: 's3' }), null);
});
test('accepts image signatures only and caps streamed requests', async () => {
  assert.equal(imageType(png), 'image/png');
  assert.equal(imageType(Buffer.from('<svg>')), null);
  assert.equal(await upload({ put() { throw Error('unexpected'); } }, Buffer.from('text'), env), null);
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(MAX_MEDIA_BYTES + 1)); c.close(); } });
  assert.equal(await readLimited(stream), null);
});
