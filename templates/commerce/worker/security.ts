import type { CommerceLevel, Capabilities, StaffRole, StoreConfig, CommerceFeature } from '../src/shared/contracts.ts';
import type { Env, Session } from './types.ts';

export class HttpError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export function fail(status: number, code: string, message: string): never { throw new HttpError(status, code, message); }
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID().replaceAll('-', '');
export async function digest(value: string, algorithm = 'SHA-256') { return [...new Uint8Array(await crypto.subtle.digest(algorithm, new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export function safeEqual(a: string, b: string) { if (a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }
export const isDemo = (env: Env) => env.DEMO_MODE === 'true';
export const featureKeys: CommerceFeature[] = ['promotions','taxes','serviceFees','customerAccounts','loyaltyPoints','membershipTiers'];
export function capabilities(input: CommerceLevel | StoreConfig): Capabilities {
  const level = typeof input === 'string' ? input : input.level;
  const modules = typeof input === 'string' ? undefined : input.modules;
  const checkout = level === 'store' || level === 'advanced'; const advanced = level === 'advanced';
  // Existing deployments without a module manifest retain their original coupon gate.
  const enabled = (name: CommerceFeature, fallback = false) => checkout && (modules?.[name] ?? fallback);
  const customerAccounts = enabled('customerAccounts');
  const loyaltyPoints = customerAccounts && enabled('loyaltyPoints');
  return { catalog: true, cart: level !== 'catalog', whatsapp: level === 'whatsapp', checkout, orders: checkout, inventory: checkout,
    coupons: enabled('promotions',advanced), gateway: advanced, returns: advanced, reviews: advanced, wishlist: level !== 'catalog', reports: checkout,
    taxes: enabled('taxes'), serviceFees: enabled('serviceFees'), customerAccounts, loyaltyPoints,
    membershipTiers: loyaltyPoints && enabled('membershipTiers') };
}
export function validateModules(config: StoreConfig): void {
  const modules = config.modules || {};
  for (const key of Object.keys(modules)) if (!featureKeys.includes(key as CommerceFeature) || typeof modules[key as CommerceFeature] !== 'boolean') fail(503,'INVALID_MODULES','Konfigurasi modul toko tidak valid.');
  const cap = capabilities(config);
  if (modules.loyaltyPoints && !cap.customerAccounts) fail(503,'INVALID_MODULES','Poin membutuhkan akun pelanggan dan checkout.');
  if (modules.membershipTiers && !cap.loyaltyPoints) fail(503,'INVALID_MODULES','Tingkat member membutuhkan modul poin.');
  if (Object.values(modules).some(Boolean) && !cap.checkout) fail(503,'INVALID_MODULES','Modul tambahan membutuhkan level toko dengan checkout.');
  const { taxBps = 0, serviceFeeBps = 0, taxIncluded = false } = config.pricing || {};
  if (![taxBps, serviceFeeBps].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 10000) || typeof taxIncluded !== 'boolean') fail(503,'INVALID_PRICING','Tarif pajak atau layanan tidak valid.');
  const loyalty = config.loyalty;
  if (loyalty && !Object.values(loyalty).every(n => Number.isSafeInteger(n) && n >= 0 && n <= 100000000)) fail(503,'INVALID_LOYALTY','Aturan poin tidak valid.');
}
export function requireFeature(cap: Capabilities, key: keyof Capabilities) { if (!cap[key]) fail(403, 'FEATURE_DISABLED', 'Fitur ini tidak tersedia pada tingkat toko yang dipilih.'); }
export function staff(session: Session, write = false, owner = false): StaffRole {
  if (session.role === 'customer') fail(401, 'STAFF_REQUIRED', 'Masuk ke akun staf untuk melanjutkan.');
  if ((write && session.role === 'viewer') || (owner && session.role !== 'owner')) fail(403, 'ROLE_FORBIDDEN', 'Akun ini tidak memiliki izin untuk tindakan tersebut.');
  return session.role as StaffRole;
}
export function text(value: unknown, field: string, max = 500, required = false): string {
  if (value === undefined || value === null) { if (required) fail(422, 'INVALID_INPUT', `${field} wajib diisi.`); return ''; }
  if (typeof value !== 'string') fail(422, 'INVALID_INPUT', `${field} harus berupa teks.`);
  const cleaned = value.trim(); if (cleaned.length > max || (required && !cleaned)) fail(422, 'INVALID_INPUT', `${field} tidak valid.`);
  return cleaned;
}
export function integer(value: unknown, field: string, min = 0, max = 1_000_000_000): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail(422, 'INVALID_INPUT', `${field} tidak valid.`);
  return value;
}
export async function body(request: Request): Promise<Record<string, any>> {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 65_536) fail(413, 'BODY_TOO_LARGE', 'Data permintaan terlalu besar.');
  const raw = await request.text(); if (raw.length > 65_536) fail(413, 'BODY_TOO_LARGE', 'Data permintaan terlalu besar.');
  let value; try { value = JSON.parse(raw || '{}'); } catch { fail(400, 'INVALID_JSON', 'Format data tidak valid.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'INVALID_JSON', 'Data permintaan harus berupa objek.'); return value;
}
export function sameOrigin(request: Request, env: Env) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin && origin !== env.ALLOWED_ORIGIN) fail(403, 'ORIGIN_FORBIDDEN', 'Permintaan dari situs ini tidak diizinkan.');
  if (request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'ORIGIN_FORBIDDEN', 'Permintaan dari situs ini tidak diizinkan.');
}
export async function rateLimit(env: Env, key: string, limit: number, seconds = 900) {
  const stamp = now(); const expires = new Date(Date.now() + seconds * 1000).toISOString();
  await env.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END').bind(key, expires, stamp, stamp).run();
  const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE key=?').bind(key).first<{ count: number }>();
  if (row && row.count > limit) fail(429, 'RATE_LIMIT', 'Terlalu banyak percobaan. Coba lagi beberapa saat nanti.');
}
