import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

function secret(env) {
  const value = env.CAFE_MEDIA_SECRET;
  if (typeof value !== 'string' || Buffer.byteLength(value) < 32) throw new Error('CAFE_MEDIA_SECRET must contain at least 32 bytes');
  return value;
}
export function authorized(header, env) {
  const configured = secret(env);
  const presented = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  return timingSafeEqual(createHash('sha256').update(presented).digest(), createHash('sha256').update(configured).digest());
}
function signature(payload, env) { return createHmac('sha256', secret(env)).update(payload).digest('base64url'); }
export function encodeKey(key, env) {
  const payload = Buffer.from(JSON.stringify({ key, provider: env.OBJECT_STORAGE_PROVIDER })).toString('base64url');
  return `${payload}.${signature(payload, env)}`;
}
export function decodeKey(token, env) {
  if (typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = Buffer.from(signature(parts[0], env));
  const actual = Buffer.from(parts[1]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    return data.provider === env.OBJECT_STORAGE_PROVIDER && typeof data.key === 'string' && data.key.length > 0 && data.key.length <= 1024 ? data.key : null;
  } catch { return null; }
}
export function imageType(bytes) {
  const b = Buffer.from(bytes);
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
export async function readLimited(stream) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_MEDIA_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}
export async function upload(storage, bytes, env) {
  const type = imageType(bytes);
  if (!type || bytes.byteLength > MAX_MEDIA_BYTES) return null;
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
  const result = await storage.put(`cafe/${randomUUID()}.${extension}`, bytes, { contentType: type });
  return encodeKey(result.key, env);
}
