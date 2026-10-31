import configJson from '../config/school.json' with { type: 'json' };
import { seed } from '../content/seed.ts';
import type { Command, Context, Level, Preset, SchoolConfig, User, Json, SchoolState } from '../src/domain/types.ts';
import { check, DomainError, levels, presets, need, isStaff, canEdit, text, integer } from '../src/domain/capabilities.ts';
import { command, snapshot, canDownload, owns, applyPayment } from '../src/domain/service.ts';
import { Store, type Database } from './store.ts';
import { cookie, setCookie, random, digest, passwordHash, passwordMatches, rateLimit, constantEqual, hmac } from './auth.ts';
export interface Bucket {
    put(key: string, value: ArrayBuffer): Promise<unknown>;
    get(key: string): Promise<{
        arrayBuffer(): Promise<ArrayBuffer>;
    } | null>;
}
export interface Env {
    DB: Database;
    MEDIA?: Bucket;
    ASSETS?: {
        fetch(r: Request): Promise<Response>;
    };
    DEMO_MODE?: string;
    AUTH_SECRET?: string;
    BOOTSTRAP_ADMIN_EMAIL?: string;
    BOOTSTRAP_ADMIN_PASSWORD?: string;
    MIDTRANS_SERVER_KEY?: string;
    MIDTRANS_ENVIRONMENT?: string;
    NOTIFICATION_URL?: string;
    NOTIFICATION_SECRET?: string;
    CONFIG?: SchoolConfig;
}
const response = (data: unknown, status = 200, cookies: string[] = []) => { const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); for (const c of cookies)
    headers.append('Set-Cookie', c); return new Response(JSON.stringify(data), { status, headers }); };
const email = (v: unknown) => { const e = text(v, 200).toLowerCase(); check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e), 'invalid_email'); return e; };
async function body(request: Request) { check(Number(request.headers.get('content-length') ?? 0) <= 512000, 'body_too_large', 413); const raw = await request.text(); check(raw.length <= 512000, 'body_too_large', 413); try {
    return JSON.parse(raw) as Record<string, unknown>;
}
catch {
    throw new DomainError('invalid_json');
} }
function csrf(request: Request) { const origin = request.headers.get('origin'); check(!origin || origin === new URL(request.url).origin, 'invalid_origin', 403); check(request.headers.get('X-School-Request') === '1', 'invalid_origin', 403); }
function configuration(env: Env) { const config = env.CONFIG ?? configJson as SchoolConfig; check(levels.includes(config.level) && presets.includes(config.preset), 'invalid_config', 503); return config; }
async function context(request: Request, env: Env) {
    const config = configuration(env);
    const demo = env.DEMO_MODE === 'true';
    const u = new URL(request.url);
    const cookies: string[] = [];
    const preset = demo && presets.includes(u.searchParams.get('preset') as Preset) ? u.searchParams.get('preset') as Preset : config.preset;
    const level = demo && levels.includes(u.searchParams.get('level') as Level) ? u.searchParams.get('level') as Level : config.level;
    let namespace = 'production';
    let actor: User | null = null;
    if (demo) {
        let token = cookie(request, 'school_demo');
        let hash = token && /^[a-f0-9]{64}$/.test(token) ? await digest(token) : '';
        const row = hash ? await env.DB.prepare('SELECT token_hash FROM school_visitors WHERE token_hash=? AND expires_at>?').bind(hash, Date.now()).first() : null;
        if (!row) {
            await rateLimit(env.DB, request, 'demo-session', 60);
            token = random();
            hash = await digest(token);
            await env.DB.prepare('INSERT INTO school_visitors(token_hash,expires_at) VALUES(?,?)').bind(hash, Date.now() + 86400000).run();
            cookies.push(setCookie(request, 'school_demo', token, 86400));
        }
        namespace = `demo:${hash}:${preset}`;
    }
    const store = new Store(env.DB, namespace, () => seed(preset, config, demo), demo ? Date.now() + 86400000 : null);
    const { state } = await store.load();
    if (demo) {
        const role = request.headers.get('X-Demo-Role') ?? 'visitor';
        check(['visitor', 'student', 'guardian', 'tutor', 'staff', 'admin', 'editor', 'other'].includes(role), 'invalid_role');
        actor = state.users.find(x => x.id === role) ?? null;
    }
    else {
        const token = cookie(request, 'school_session');
        if (token && /^[a-f0-9]{64}$/.test(token)) {
            const session = await env.DB.prepare('SELECT user_id FROM school_sessions WHERE token_hash=? AND namespace=? AND expires_at>?').bind(await digest(token), namespace, Date.now()).first<{
                user_id: string;
            }>();
            actor = session ? state.users.find(x => x.id === session.user_id && !x.disabled) ?? null : null;
        }
    }
    return { store, config, preset, cookies, ctx: { actor, level, demo, now: new Date().toISOString(), id: crypto.randomUUID() } satisfies Context };
}
async function session(env: Env, request: Request, id: string) { const token = random(); await env.DB.prepare('INSERT INTO school_sessions(token_hash,namespace,user_id,expires_at) VALUES(?,?,?,?)').bind(await digest(token), 'production', id, Date.now() + 43200000).run(); return setCookie(request, 'school_session', token, 43200); }
const midtransBase = (env: Env) => env.MIDTRANS_ENVIRONMENT === 'production' ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
function midtransStatus(canonical: Record<string, string>) {
    const status = canonical.transaction_status;
    // Snap permits successful payment after a denied attempt on the same order.
    return status === 'settlement' || status === 'capture' && canonical.fraud_status === 'accept' ? 'paid' : status === 'expire' ? 'expired' : ['cancel', 'failure'].includes(status) ? 'failed' : ['refund', 'partial_refund'].includes(status) ? 'refunded' : 'pending';
}
async function callback(request: Request, env: Env) {
    check(env.DEMO_MODE !== 'true', 'demo_only', 403);
    const config = configuration(env);
    need(config.level, 'finance');
    check(config.payment.provider === 'midtrans' && env.MIDTRANS_SERVER_KEY, 'provider_not_configured', 503);
    const p = await body(request);
    const order = text(p.order_id, 100);
    const gross = text(p.gross_amount, 100), code = text(p.status_code, 10), signature = text(p.signature_key, 150);
    check(/^[a-fA-F0-9]{128}$/.test(signature), 'invalid_signature', 401);
    check(constantEqual(signature.toLowerCase(), await digest(order + code + gross + env.MIDTRANS_SERVER_KEY, 'SHA-512')), 'invalid_signature', 401);
    const route = await env.DB.prepare('SELECT namespace FROM school_payment_routes WHERE order_id=?').bind(order).first<{
        namespace: string;
    }>();
    check(route?.namespace === 'production', 'not_found', 404);
    const res = await fetch(`${midtransBase(env)}/v2/${encodeURIComponent(order)}/status`, { headers: { Authorization: `Basic ${btoa(env.MIDTRANS_SERVER_KEY + ':')}` }, signal: AbortSignal.timeout(15000) });
    check(res.ok, 'provider_unavailable', 502);
    const canonical = await res.json() as Record<string, string>;
    check(canonical.order_id === order && /^\d+(\.00)?$/.test(canonical.gross_amount) && (!canonical.currency || canonical.currency === 'IDR'), 'invalid_payment');
    const amount = Number(canonical.gross_amount);
    integer(amount);
    const normalized = midtransStatus(canonical);
    const store = new Store(env.DB, 'production', () => seed(config.preset, config, false));
    await store.mutate(s => { const payment = s.payments.find(x => x.reference === order && x.provider === 'midtrans'); check(payment, 'not_found', 404); applyPayment(s, { actor: null, level: config.level, demo: false, now: new Date().toISOString(), id: order }, payment.invoiceId, order, amount, 'midtrans', normalized); });
    return response({ ok: true });
}
async function sendOutbox(store: Store, env: Env, state: SchoolState): Promise<number> {
    if (env.DEMO_MODE === 'true' || !env.NOTIFICATION_URL?.startsWith('https://') || !env.NOTIFICATION_SECRET || !state.modules.notifications)
        return 0;
    let sent = 0;
    for (const n of state.outbox.filter(x => x.status !== 'sent' && x.attempts < 5).slice(0, 10)) {
        const e = state.enrollments.find(x => x.id === n.enrollmentId)!;
        const users = state.users.filter(x => x.studentIds.includes(e.studentId));
        const payload = JSON.stringify({ id: n.id, event: n.event, enrollmentId: e.id, recipients: users.map(x => x.email) });
        let ok = false;
        try {
            const res = await fetch(env.NOTIFICATION_URL!, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': n.id, 'X-School-Signature': await hmac(env.NOTIFICATION_SECRET, payload) }, body: payload, signal: AbortSignal.timeout(10000) });
            ok = res.ok;
        }
        catch { /* Keep in outbox for retry. */ }
        await store.mutate(s => { const item = s.outbox.find(x => x.id === n.id)!; if (item.status !== 'sent') {
            item.attempts++;
            item.status = ok ? 'sent' : 'failed';
        } });
        if (ok)
            sent++;
    }
    return sent;
}
export async function dispatchNotifications(env: Env) { const config = configuration(env); if (env.DEMO_MODE === 'true' || !['enrollment', 'full'].includes(config.level))
    return; const store = new Store(env.DB, 'production', () => seed(config.preset, config, false)); const state = (await store.load()).state; await sendOutbox(store, env, state); }
export async function handle(request: Request, env: Env, execution?: {
    waitUntil(promise: Promise<unknown>): void;
}): Promise<Response> {
    try {
        const url = new URL(request.url), path = url.pathname;
        if (path === '/api/payments/callback' && request.method === 'POST')
            return await callback(request, env);
        if (!['GET', 'POST'].includes(request.method))
            throw new DomainError('method_not_allowed', 405);
        if (request.method === 'POST')
            csrf(request);
        if (path === '/api/health')
            return response({ ok: true, template: 'school' });
        const { store, config, preset, cookies, ctx } = await context(request, env);
        if (request.method === 'GET' && path === '/api/bootstrap')
            return response({ ...snapshot((await store.load()).state, ctx, preset), paymentProvider: config.payment.provider }, 200, cookies);
        if (path === '/api/auth/logout' && request.method === 'POST') {
            const token = cookie(request, 'school_session');
            if (token)
                await env.DB.prepare('DELETE FROM school_sessions WHERE token_hash=?').bind(await digest(token)).run();
            return response({ ok: true }, 200, [setCookie(request, 'school_session', '', 0)]);
        }
        if (path === '/api/auth/login' && request.method === 'POST') {
            check(!ctx.demo, 'demo_use_roles');
            await rateLimit(env.DB, request, 'login', 10);
            check(env.AUTH_SECRET && env.AUTH_SECRET.length >= 32, 'credentials_missing', 503);
            const p = await body(request);
            const address = email(p.email), pass = text(p.password, 128);
            let s = (await store.load()).state;
            let user = s.users.find(x => x.email === address && !x.disabled);
            if (!s.users.some(x => x.role === 'admin') && address === env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase() && env.BOOTSTRAP_ADMIN_PASSWORD && constantEqual(pass, env.BOOTSTRAP_ADMIN_PASSWORD)) {
                const hash = await passwordHash(pass, env.AUTH_SECRET);
                const id = `admin-${ctx.id}`;
                await store.mutate(state => { check(!state.users.some(x => x.role === 'admin'), 'bootstrap_complete', 409); state.users.push({ id, name: 'Administrator', email: address, role: 'admin', studentIds: [], passwordHash: hash }); });
                user = (await store.load()).state.users.find(x => x.id === id);
            }
            check(user?.passwordHash && await passwordMatches(pass, user.passwordHash, env.AUTH_SECRET), 'invalid_credentials', 401);
            return response({ ok: true }, 200, [await session(env, request, user.id)]);
        }
        if (path === '/api/auth/register' && request.method === 'POST') {
            need(ctx.level, 'enrollment');
            check(!ctx.demo, 'demo_use_roles');
            await rateLimit(env.DB, request, 'register', 6);
            check(env.AUTH_SECRET && env.AUTH_SECRET.length >= 32, 'credentials_missing', 503);
            const p = await body(request);
            const address = email(p.email), name = text(p.name, 100);
            check(address !== env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase(), 'registration_unavailable', 409);
            check(p.role === 'student' || p.role === 'guardian', 'forbidden', 403);
            const hash = await passwordHash(text(p.password, 128), env.AUTH_SECRET);
            const id = `user-${ctx.id}`, studentId = `student-${ctx.id}`;
            await store.mutate(s => { check(!s.users.some(x => x.email === address), 'registration_unavailable', 409); s.users.push({ id, name, email: address, role: p.role as 'student' | 'guardian', studentIds: [studentId], passwordHash: hash }); s.students.push({ id: studentId, name: p.role === 'guardian' ? text(p.studentName, 100) : name, email: p.role === 'student' ? address : '' }); });
            return response({ ok: true }, 201, [await session(env, request, id)]);
        }
        if (path === '/api/auth/password' && request.method === 'POST') {
            check(!ctx.demo && ctx.actor, 'login_required', 401);
            await rateLimit(env.DB, request, 'password', 6);
            check(env.AUTH_SECRET && ctx.actor.passwordHash, 'credentials_missing', 503);
            const p = await body(request);
            check(await passwordMatches(text(p.currentPassword, 128), ctx.actor.passwordHash, env.AUTH_SECRET), 'invalid_credentials', 401);
            const hash = await passwordHash(text(p.password, 128), env.AUTH_SECRET);
            const current = ctx.actor.passwordHash;
            await store.mutate(state => { const user = state.users.find(x => x.id === ctx.actor!.id)!; check(user.passwordHash === current, 'stale_record', 409); user.passwordHash = hash; });
            await env.DB.prepare('DELETE FROM school_sessions WHERE namespace=? AND user_id=?').bind('production', ctx.actor.id).run();
            return response({ ok: true }, 200, [setCookie(request, 'school_session', '', 0)]);
        }
        if (path === '/api/auth/invite' && request.method === 'POST') {
            check(ctx.actor?.role === 'admin', 'forbidden', 403);
            check(!ctx.demo, 'demo_use_roles');
            await rateLimit(env.DB, request, 'invite', 10);
            check(env.AUTH_SECRET, 'credentials_missing', 503);
            const p = await body(request), address = email(p.email), name = text(p.name, 100);
            check(['staff', 'editor', 'tutor', 'guardian', 'student'].includes(String(p.role)), 'invalid_role');
            const hash = await passwordHash(text(p.password, 128), env.AUTH_SECRET);
            const id = `user-${ctx.id}`;
            await store.mutate(s => { check(!s.users.some(x => x.email === address), 'registration_unavailable', 409); if (p.role === 'tutor')
                check(s.tutors.some(t => t.id === p.tutorId), 'invalid_tutor'); s.users.push({ id, name, email: address, role: p.role as User['role'], studentIds: p.role === 'student' ? [`student-${ctx.id}`] : [], tutorId: p.role === 'tutor' ? text(p.tutorId) : undefined, passwordHash: hash }); if (p.role === 'student')
                s.students.push({ id: `student-${ctx.id}`, name, email: address }); });
            return response({ ok: true });
        }
        if (path === '/api/command' && request.method === 'POST') {
            await rateLimit(env.DB, request, 'command', 120);
            const p = await body(request);
            check(p.action !== 'media.add', 'forbidden', 403);
            const result = await store.mutate(s => command(s, { ...ctx, actor: ctx.actor ? s.users.find(x => x.id === ctx.actor!.id) ?? null : null }, p as unknown as Command));
            const updated = (await store.load()).state;
            if (!ctx.demo && updated.modules.notifications && env.NOTIFICATION_URL && env.NOTIFICATION_SECRET) {
                const delivery = sendOutbox(store, env, updated).catch(() => 0);
                if (execution)
                    execution.waitUntil(delivery);
                else
                    await delivery;
            }
            return response({ result, snapshot: { ...snapshot(updated, { ...ctx, actor: updated.users.find(x => x.id === ctx.actor?.id) ?? null }, preset), paymentProvider: config.payment.provider } }, 200, cookies);
        }
        if (path === '/api/demo/reset' && request.method === 'POST') {
            check(ctx.demo, 'demo_only', 403);
            await rateLimit(env.DB, request, 'reset', 10);
            await store.reset();
            return response({ ok: true });
        }
        if (path === '/api/payments/start' && request.method === 'POST') {
            need(ctx.level, 'finance');
            check(!ctx.demo, 'demo_only', 403);
            check(config.payment.provider === 'midtrans' && env.MIDTRANS_SERVER_KEY, 'provider_not_configured', 503);
            check(ctx.actor, 'login_required', 401);
            await rateLimit(env.DB, request, 'payment', 10);
            const p = await body(request);
            const s = (await store.load()).state;
            const invoice = s.invoices.find(x => x.id === p.id);
            check(invoice && invoice.status === 'unpaid', 'invoice_unavailable', 409);
            check(owns(ctx, invoice.studentId) || isStaff(ctx.actor.role), 'forbidden', 403);
            let previous = s.payments.find(x => x.invoiceId === invoice.id && x.provider === 'midtrans' && x.status === 'pending');
            if (previous) {
                check((previous.startingUntil ?? 0) <= Date.now(), 'payment_start_reconcile', 409);
                const status = await fetch(`${midtransBase(env)}/v2/${encodeURIComponent(previous.reference)}/status`, { headers: { Authorization: `Basic ${btoa(env.MIDTRANS_SERVER_KEY + ':')}` }, signal: AbortSignal.timeout(15000) });
                if (status.status === 404 && previous.checkoutUrl) {
                    check(previous.checkoutExpiresAt, 'payment_start_reconcile', 409);
                    if (previous.checkoutExpiresAt > Date.now()) return response({ url: previous.checkoutUrl });
                }
                if (status.status !== 404) {
                    check(status.ok, 'payment_start_reconcile', 502);
                    const canonical = await status.json() as Record<string, string>;
                    check(canonical.order_id === previous.reference && /^\d+(\.00)?$/.test(canonical.gross_amount) && Number(canonical.gross_amount) === invoice.totalIdr && (!canonical.currency || canonical.currency === 'IDR'), 'invalid_payment');
                    const normalized = midtransStatus(canonical);
                    const unpaid = await store.mutate(s => { applyPayment(s, { ...ctx, actor: null }, invoice.id, previous!.reference, invoice.totalIdr, 'midtrans', normalized); return s.invoices.find(x => x.id === invoice.id)?.status === 'unpaid'; });
                    if (normalized === 'pending' && previous.checkoutUrl) { check(unpaid, 'invoice_unavailable', 409); return response({ url: previous.checkoutUrl }); }
                    check(normalized === 'expired' || normalized === 'failed', 'payment_start_reconcile', 409);
                    previous = undefined;
                }
            }
            const order = previous?.reference ?? `school-${crypto.randomUUID()}`;
            const startingUntil = Date.now() + 60000;
            await env.DB.prepare('INSERT OR IGNORE INTO school_payment_routes(order_id,namespace) VALUES(?,?)').bind(order, 'production').run();
            if (!previous) await store.mutate(s => { const current = s.invoices.find(x => x.id === invoice.id); check(current?.status === 'unpaid', 'invoice_unavailable', 409); check(!s.payments.some(x => x.invoiceId === invoice.id && x.provider === 'midtrans' && x.status === 'pending'), 'payment_start_reconcile', 409); s.payments.push({ id: `pay-${order}`, invoiceId: invoice.id, reference: order, provider: 'midtrans', amountIdr: invoice.totalIdr, status: 'pending', at: ctx.now, startingUntil }); });
            else await store.mutate(s => { const pay = s.payments.find(x => x.reference === order); check(s.invoices.find(x => x.id === invoice.id)?.status === 'unpaid', 'invoice_unavailable', 409); check(pay?.status === 'pending' && (pay.startingUntil ?? 0) <= Date.now() && pay.checkoutUrl === previous?.checkoutUrl, 'payment_start_reconcile', 409); pay.startingUntil = startingUntil; });
            const host = env.MIDTRANS_ENVIRONMENT === 'production' ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
            try {
            const res = await fetch(`${host}/snap/v1/transactions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Basic ${btoa(env.MIDTRANS_SERVER_KEY + ':')}` }, body: JSON.stringify({ transaction_details: { order_id: order, gross_amount: invoice.totalIdr }, page_expiry: { duration: 24, unit: 'hours' } }), signal: AbortSignal.timeout(15000) });
            check(res.ok, 'payment_start_reconcile', 502);
            const data = await res.json() as {
                redirect_url: string;
            };
            check(typeof data.redirect_url === 'string' && new URL(data.redirect_url).origin === host, 'invalid_provider_url', 502);
            const checkoutExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
            await store.mutate(s => { const pay = s.payments.find(x => x.reference === order); check(pay?.status === 'pending' && s.invoices.find(x => x.id === invoice.id)?.status === 'unpaid', 'payment_start_reconcile', 409); pay.checkoutUrl = data.redirect_url; pay.checkoutExpiresAt = checkoutExpiresAt; });
            return response({ url: data.redirect_url });
            } finally { await store.mutate(s => { const pay = s.payments.find(x => x.reference === order); if (pay?.startingUntil === startingUntil) delete pay.startingUntil; }); }
        }
        if (path === '/api/media' && request.method === 'POST') {
            check(ctx.actor && (canEdit(ctx.actor.role) || ctx.actor.role === 'tutor'), 'forbidden', 403);
            if (ctx.actor.role === 'tutor')
                need(ctx.level, 'materials');
            check(env.MEDIA, 'storage_not_configured', 503);
            await rateLimit(env.DB, request, 'upload', 20);
            check(Number(request.headers.get('content-length') ?? 0) <= 5000000, 'file_too_large', 413);
            const bytes = await request.arrayBuffer();
            check(bytes.byteLength <= 5000000 && bytes.byteLength > 0, 'file_too_large', 413);
            const a = new Uint8Array(bytes);
            const head = new TextDecoder().decode(a.slice(0, 16));
            const type = request.headers.get('Content-Type') ?? '';
            const valid = type === 'image/jpeg' && a[0] === 255 && a[1] === 216 && a[2] === 255 || type === 'image/png' && a[0] === 137 && head.slice(1, 4) === 'PNG' || type === 'image/webp' && head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP' || type === 'application/pdf' && head.startsWith('%PDF-') || type === 'text/plain' && !/[\x00-\x08]/.test(new TextDecoder().decode(a));
            check(valid, 'file_type_not_allowed');
            const publicAsset = url.searchParams.get('public') === 'true';
            check(!publicAsset || canEdit(ctx.actor.role) && type.startsWith('image/'), 'forbidden', 403);
            const id = crypto.randomUUID(), key = `${store.namespace}/${id}`;
            await env.MEDIA.put(key, bytes);
            await store.mutate(s => command(s, ctx, { action: 'media.add', key: `media_${id}`, payload: { media: { id, key, name: (request.headers.get('X-File-Name') ?? 'resource').replace(/[^\w. -]/g, '').slice(0, 100), type, size: bytes.byteLength, public: publicAsset } } }));
            return response({ id, url: `/api/media/${id}` }, 201);
        }
        if (path.startsWith('/api/media/') && request.method === 'GET') {
            const s = (await store.load()).state;
            const asset = s.media.find(x => x.id === path.split('/').at(-1));
            check(asset && asset.public, 'not_found', 404);
            check(env.MEDIA, 'storage_not_configured', 503);
            const file = await env.MEDIA.get(asset.key);
            check(file, 'not_found', 404);
            return new Response(await file.arrayBuffer(), { headers: { 'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=60' } });
        }
        if (path.startsWith('/api/materials/') && request.method === 'GET') {
            const s = (await store.load()).state;
            const m = canDownload(s, ctx, path.split('/').at(-1)!);
            let data: ArrayBuffer | string = m.sampleText ?? '', type = 'text/plain', name = 'learning-notes.txt';
            if (m.assetId) {
                check(env.MEDIA, 'storage_not_configured', 503);
                const asset = s.media.find(x => x.id === m.assetId);
                check(asset && !asset.public, 'not_found', 404);
                const file = await env.MEDIA.get(asset.key);
                check(file, 'not_found', 404);
                data = await file.arrayBuffer();
                type = asset.type;
                name = asset.name;
            }
            return new Response(data, { headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name.replace(/[^\w. -]/g, '')}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox' } });
        }
        if (path === '/api/notifications/send' && request.method === 'POST') {
            check(isStaff(ctx.actor?.role), 'forbidden', 403);
            need(ctx.level, 'enrollment');
            check(!ctx.demo, 'demo_only', 403);
            const state = (await store.load()).state;
            check(state.modules.notifications, 'module_disabled', 403);
            check(env.NOTIFICATION_URL?.startsWith('https://') && env.NOTIFICATION_SECRET, 'provider_not_configured', 503);
            return response({ sent: await sendOutbox(store, env, state) });
        }
        throw new DomainError('not_found', 404);
    }
    catch (error) {
        const capacity = error instanceof Error && /D1.*exceeded.*(?:daily|limit)|D1.*free tier.*limit/i.test(error.message);
        if (!(error instanceof DomainError)) console.error('school_internal_error', { name: error instanceof Error ? error.name : 'UnknownError', reason: capacity ? 'd1_capacity_exceeded' : 'unexpected', frames: error instanceof Error ? error.stack?.split('\n').slice(1, 4) : [] });
        const e = error instanceof DomainError ? error : new DomainError(capacity ? 'storage_capacity_exceeded' : 'internal_error', capacity ? 503 : 500);
        const result = response({ error: e.code }, e.status);
        if (capacity) result.headers.set('Retry-After', '3600');
        return result;
    }
}
export async function cleanup(env: Env) { for (const table of ['school_sessions', 'school_visitors', 'school_limits', 'school_state'])
    await env.DB.prepare(`DELETE FROM ${table} WHERE expires_at IS NOT NULL AND expires_at<?`).bind(Date.now()).run(); }
