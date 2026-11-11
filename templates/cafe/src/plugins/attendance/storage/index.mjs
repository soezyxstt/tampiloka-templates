import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const require = createRequire(import.meta.url);
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 16_000_000;
const types = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const sha = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();
const encode = (value) => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
function keyFor(scope, ref) {
  if (!scope || ![scope.tenantId, scope.outletId, scope.employeeId].every(validId) || !ref || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(ref.id)) throw new Error('Invalid evidence reference');
  return `attendance/${scope.tenantId}/${scope.outletId}/${scope.employeeId}/${ref.id}`;
}
function validateRef(ref, checkExpiry) {
  if (!Object.values(types).includes(ref?.contentType) || !Number.isSafeInteger(ref.size) || ref.size < 1 || ref.size > MAX_BYTES || !Number.isFinite(Date.parse(ref.createdAt)) || !Number.isFinite(Date.parse(ref.expiresAt)) || Date.parse(ref.expiresAt) <= Date.parse(ref.createdAt)) throw new Error('Invalid evidence reference');
  if (checkExpiry && Date.now() >= Date.parse(ref.expiresAt)) throw new Error('Evidence expired');
}
async function normalize(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > MAX_BYTES) throw new Error('Invalid evidence size');
  let sharp;
  try { sharp = require('sharp'); } catch { throw new Error('Evidence image decoder unavailable'); }
  try {
    const input = Buffer.from(bytes);
    const image = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'warning', animated: false });
    const metadata = await image.metadata();
    if (!types[metadata.format] || !metadata.width || !metadata.height || metadata.pages > 1) throw new Error();
    // Full decode/re-encode validates compressed pixels and strips EXIF and other metadata.
    const output = await image.rotate().toFormat(metadata.format).toBuffer();
    if (!output.length || output.length > MAX_BYTES) throw new Error();
    return { bytes: output, contentType: types[metadata.format] };
  } catch { throw new Error('Invalid evidence image'); }
}
function createStore(adapter, retentionSeconds) {
  if (!Number.isSafeInteger(retentionSeconds) || retentionSeconds < 1 || retentionSeconds > 10 * 365 * 86400) throw new Error('Invalid evidence retention');
  return {
    async put(scope, bytes, reservedId) {
      const id = reservedId || randomUUID();
      const key = keyFor(scope, { id });
      const image = await normalize(bytes);
      const now = Date.now();
      const ref = { id, contentType: image.contentType, size: image.bytes.length, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + retentionSeconds * 1000).toISOString() };
      await adapter.put(key, image.bytes, image.contentType);
      return ref;
    },
    async read(scope, ref) {
      const key = keyFor(scope, ref); validateRef(ref, true);
      const bytes = await adapter.read(key);
      if (bytes.length !== ref.size || bytes.length > MAX_BYTES) throw new Error('Evidence integrity error');
      return { bytes, contentType: ref.contentType };
    },
    async delete(scope, ref) { const key = keyFor(scope, ref); validateRef(ref, false); await adapter.delete(key); }
  };
}
export function createLocalEvidenceStore({ directory, retentionSeconds }) {
  if (typeof directory !== 'string' || !directory || !directory.startsWith('/') || /(^|\/)public(\/|$)/i.test(directory)) throw new Error('A private absolute evidence directory is required');
  const root = resolve(directory);
  const path = key => join(root, ...key.split('/'));
  return createStore({
    async put(key, bytes) { const file = path(key); await mkdir(resolve(file, '..'), { recursive: true, mode: 0o700 }); await writeFile(file, bytes, { flag: 'wx', mode: 0o600 }); },
    async read(key) { return readFile(path(key)); },
    async delete(key) { try { await unlink(path(key)); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  }, retentionSeconds);
}

export function createS3EvidenceStore({ endpoint, region, bucket, accessKeyId, secretAccessKey, sessionToken, retentionSeconds, fetch: request = globalThis.fetch, clock = () => new Date() }) {
  const base = new URL(endpoint);
  if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))) || base.username || base.password || base.search || base.hash || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || !/^[a-zA-Z0-9-]{1,64}$/.test(region) || !accessKeyId || !secretAccessKey || typeof request !== 'function') throw new Error('Invalid evidence storage configuration');
  async function send(method, key, body, contentType) {
    const url = new URL(base.href);
    url.pathname = `${base.pathname.replace(/\/$/, '')}/${encode(bucket)}/${key.split('/').map(encode).join('/')}`;
    const date = clock().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const day = date.slice(0, 8); const payload = body || Buffer.alloc(0); const hash = sha(payload);
    const headers = { host: url.host, 'x-amz-content-sha256': hash, 'x-amz-date': date };
    if (sessionToken) headers['x-amz-security-token'] = sessionToken;
    if (contentType) headers['content-type'] = contentType;
    const names = Object.keys(headers).sort();
    const canonical = `${method}\n${url.pathname}\n\n${names.map(n => `${n}:${headers[n].trim()}\n`).join('')}\n${names.join(';')}\n${hash}`;
    const credentialScope = `${day}/${region}/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${credentialScope}\n${sha(canonical)}`;
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, day), region), 's3'), 'aws4_request');
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${names.join(';')}, Signature=${hmac(signingKey, stringToSign).toString('hex')}`;
    let response;
    try { response = await request(url, { method, headers, ...(body ? { body } : {}), redirect: 'error' }); } catch { throw new Error('Evidence storage request failed'); }
    if (!response.ok && !(method === 'DELETE' && response.status === 404)) throw new Error(`Evidence storage request failed (${response.status})`);
    if (method !== 'GET') return;
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Evidence size exceeded');
    if (!response.body) throw new Error('Evidence storage response missing body');
    const reader = response.body.getReader(); const chunks = []; let total = 0;
    try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > MAX_BYTES) { await reader.cancel(); throw new Error('Evidence size exceeded'); } chunks.push(value); } } finally { reader.releaseLock(); }
    return Buffer.concat(chunks, total);
  }
  return createStore({ put: (key, bytes, type) => send('PUT', key, bytes, type), read: key => send('GET', key), delete: key => send('DELETE', key) }, retentionSeconds);
}
