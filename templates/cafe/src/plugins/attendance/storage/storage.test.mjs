import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash, createHmac } from 'node:crypto';
import { createLocalEvidenceStore, createS3EvidenceStore } from './index.mjs';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const scope = { tenantId: 'tenant', outletId: 'outlet', employeeId: 'employee' };
const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
test('private local lifecycle, scoped references and expiration', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'attendance-'));
  try {
    const store = createLocalEvidenceStore({ directory: dir, retentionSeconds: 60 });
    const ref = await store.put(scope, image);
    assert.equal(ref.contentType, 'image/png');
    assert.deepEqual((await store.read(scope, ref)).bytes.length, ref.size);
    const file = join(dir, 'attendance/tenant/outlet/employee', ref.id);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    await assert.rejects(store.read({ ...scope, employeeId: 'other' }, ref));
    await assert.rejects(store.read(scope, { ...ref, id: '../bad' }));
    await assert.rejects(store.read(scope, { ...ref, createdAt: '2000-01-01T00:00:00Z', expiresAt: '2000-01-02T00:00:00Z' }), /expired/);
    await store.delete(scope, ref); await store.delete(scope, ref);
    await assert.rejects(store.read(scope, ref));
    await assert.rejects(store.put(scope, Buffer.alloc(5 * 1024 * 1024 + 1)), /size/);
    await assert.rejects(store.put(scope, Buffer.from('not an image')), /image/);
    await assert.rejects(store.put(scope, image.subarray(0, 20)), /image/);
    for (const format of ['jpeg', 'webp']) {
      const bytes = await sharp(image).toFormat(format).toBuffer();
      const item = await store.put(scope, bytes);
      assert.equal(item.contentType, `image/${format}`);
      await store.delete(scope, item);
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('S3 signs private path-style requests and enforces failures', async () => {
  const calls = []; let saved;
  const store = createS3EvidenceStore({ endpoint: 'https://objects.example/base', region: 'auto', bucket: 'private-bucket', accessKeyId: 'ACCESS', secretAccessKey: 'SECRET', retentionSeconds: 60, clock: () => new Date('2026-01-02T03:04:05Z'), fetch: async (url, init) => {
    calls.push({ url: String(url), ...init });
    if (init.method === 'PUT') { saved = init.body; return new Response(null, { status: 200 }); }
    if (init.method === 'GET') return new Response(saved);
    return new Response(null, { status: 204 });
  } });
  const ref = await store.put(scope, image);
  assert.match(calls[0].url, new RegExp(`/base/private-bucket/attendance/tenant/outlet/employee/${ref.id}$`));
  assert.match(calls[0].headers.authorization, /^AWS4-HMAC-SHA256 Credential=ACCESS\/20260102\/auto\/s3\/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/);
  assert.equal(calls[0].headers['x-amz-date'], '20260102T030405Z');
  // Independently construct the SigV4 canonical request and key chain.
  const hash = data => createHash('sha256').update(data).digest('hex');
  const mac = (key, data) => createHmac('sha256', key).update(data).digest();
  const call = calls[0];
  const payloadHash = hash(call.body);
  assert.equal(call.headers['x-amz-content-sha256'], payloadHash);
  const canonical = `PUT\n${new URL(call.url).pathname}\n\ncontent-type:image/png\nhost:objects.example\nx-amz-content-sha256:${payloadHash}\nx-amz-date:20260102T030405Z\n\ncontent-type;host;x-amz-content-sha256;x-amz-date\n${payloadHash}`;
  const signing = mac(mac(mac(mac('AWS4SECRET', '20260102'), 'auto'), 's3'), 'aws4_request');
  const signature = mac(signing, `AWS4-HMAC-SHA256\n20260102T030405Z\n20260102/auto/s3/aws4_request\n${hash(canonical)}`).toString('hex');
  assert.ok(call.headers.authorization.endsWith(`Signature=${signature}`));
  assert.equal(calls[0].redirect, 'error');
  assert.deepEqual((await store.read(scope, ref)).bytes, saved);
  await store.delete(scope, ref);
  const failed = createS3EvidenceStore({ endpoint: 'https://objects.example', region: 'auto', bucket: 'private-bucket', accessKeyId: 'a', secretAccessKey: 'b', retentionSeconds: 60, fetch: async () => new Response('sensitive provider details', { status: 403 }) });
  await assert.rejects(failed.put(scope, image), e => e.message === 'Evidence storage request failed (403)');
  assert.throws(() => createS3EvidenceStore({ endpoint: 'http://example.com', region: 'auto', bucket: 'private-bucket', accessKeyId: 'a', secretAccessKey: 'b', retentionSeconds: 60 }), /configuration/);
});
