import type { Database } from './store.ts';
import { check } from '../src/domain/capabilities.ts';
const encoder = new TextEncoder();
export const hex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
export const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value: string, algorithm = 'SHA-256') { return hex(await crypto.subtle.digest(algorithm, encoder.encode(value))); }
export async function passwordHash(password: string, pepper: string, salt = random()) {
    check(password.length >= 12 && password.length <= 128, 'password_length');
    check(pepper.length >= 32, 'credentials_missing', 503);
    const key = await crypto.subtle.importKey('raw', encoder.encode(password + pepper), 'PBKDF2', false, ['deriveBits']);
    return `${salt}:${hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256))}`;
}
export async function passwordMatches(password: string, stored: string, pepper: string) {
    if (password.length < 12 || password.length > 128)
        return false;
    const actual = await passwordHash(password, pepper, stored.split(':')[0]);
    return constantEqual(actual, stored);
}
export function constantEqual(a: string, b: string) { if (a.length !== b.length)
    return false; let n = 0; for (let i = 0; i < a.length; i++)
    n |= a.charCodeAt(i) ^ b.charCodeAt(i); return n === 0; }
export function cookie(request: Request, name: string) { return (request.headers.get('Cookie') ?? '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length + 1); }
export function setCookie(request: Request, name: string, value: string, seconds: number) { return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`; }
export async function rateLimit(db: Database, request: Request, kind: string, limit = 30) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
    const window = Math.floor(Date.now() / 60000);
    const key = await digest(`${kind}:${ip}:${window}`);
    const row = await db.prepare('INSERT INTO school_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, Date.now() + 120000).first<{
        count: number;
    }>();
    check(row && row.count <= limit, 'rate_limited', 429);
}
export async function hmac(secret: string, message: string) { const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(message))); }
