import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../config/school.json' with { type: 'json' };
import { handle } from '../worker/api.ts';
import { database } from '../scripts/sqlite.mjs';
import { Store } from '../worker/store.ts';
import { seed } from '../content/seed.ts';
import { digest, passwordHash } from '../worker/auth.ts';
async function setup(demo = true, level = 'full') {
    const db = await database(), env = { DB: db, DEMO_MODE: String(demo), CONFIG: { ...config, level }, AUTH_SECRET: 'test-only-auth-secret-32-characters-minimum', BOOTSTRAP_ADMIN_EMAIL: 'admin@example.test', BOOTSTRAP_ADMIN_PASSWORD: 'test-admin-password-long' };
    function client() { let cookies = ''; return { async call(path, data, role = 'visitor', headers = {}) { const request = new Request(`https://school.test${path}`, { method: data === undefined ? 'GET' : 'POST', headers: { Cookie: cookies, 'X-School-Request': '1', 'X-Demo-Role': role, 'Content-Type': 'application/json', Origin: 'https://school.test', ...headers }, body: data === undefined ? undefined : JSON.stringify(data) }); const r = await handle(request, env); const c = r.headers.get('set-cookie'); if (c)
            cookies = c.split(';')[0]; return { status: r.status, headers: r.headers, data: await r.json() }; }, get cookie() { return cookies; } }; }
    return { db, env, client };
}
const answers = s => Object.fromEntries(s.registrationFields.filter(f => f.required).map(f => [f.name, f.type === 'checkbox' ? true : f.type === 'select' ? f.options[0] : 'Sample']));
async function command(c, action, payload, role = 'student', level = 'full', key = crypto.randomUUID()) { return c.call(`/api/command?level=${level}`, { action, payload, key }, role); }
test('demo roles share a server namespace; unrelated visitors remain isolated', async () => {
    const { db, client } = await setup();
    const a = client(), b = client();
    const s = (await a.call('/api/bootstrap', undefined, 'student')).data;
    const applied = await command(a, 'application.submit', { studentId: 'student-sinta', cohortId: s.cohorts[0].id, answers: answers(s) });
    assert.equal(applied.status, 200);
    const id = applied.data.result;
    const staff = (await a.call('/api/bootstrap', undefined, 'admin')).data;
    const e = staff.enrollments.find(e => e.id === id);
    assert.ok(e);
    assert.equal((await command(a, 'application.review', { id, version: e.version, status: 'accepted' }, 'admin')).status, 200);
    const student = (await a.call('/api/bootstrap', undefined, 'student')).data;
    assert.equal(student.enrollments[0].status, 'awaiting_payment');
    assert.equal(student.invoices.length, 1);
    assert.equal((await b.call('/api/bootstrap', undefined, 'student')).data.enrollments.length, 0);
    assert.equal((await a.call('/api/demo/reset', {}, 'student')).status, 200);
    assert.equal((await a.call('/api/bootstrap', undefined, 'student')).data.enrollments.length, 0);
    db.raw.close();
});
test('HTTP profile and WhatsApp cannot register or access portals despite role header', async () => {
    const { db, client } = await setup();
    const c = client();
    await c.call('/api/bootstrap');
    for (const level of ['profile', 'whatsapp']) {
        const result = await command(c, 'application.submit', {}, 'admin', level);
        assert.equal(result.status, 403);
        const s = (await c.call(`/api/bootstrap?level=${level}`, undefined, 'admin')).data;
        assert.equal(s.enrollments.length, 0);
        assert.equal(s.materials.length, 0);
    }
    db.raw.close();
});
test('mutations reject cross-origin and missing CSRF header', async () => {
    const { db, client } = await setup();
    const c = client();
    assert.equal((await c.call('/api/demo/reset', {}, 'admin', { Origin: 'https://evil.test' })).status, 403);
    assert.equal((await c.call('/api/demo/reset', {}, 'admin', { 'X-School-Request': '' })).status, 403);
    db.raw.close();
});
test('production ignores feature/preset/role URL forgery and demo payment/reset', async () => {
    const { db, client } = await setup(false, 'profile');
    const c = client();
    const forgedPreset = config.preset === 'skills' ? 'language' : 'skills';
    const s = (await c.call(`/api/bootstrap?level=full&preset=${forgedPreset}`, undefined, 'admin')).data;
    assert.equal(s.level, 'profile');
    assert.equal(s.preset, config.preset);
    assert.notEqual(s.preset, forgedPreset);
    assert.equal(s.actor, null);
    assert.equal(s.demo, false);
    assert.equal((await c.call('/api/auth/register', { name: 'Name', email: 'test@example.test', password: 'test-password-long', role: 'student' })).status, 403);
    assert.equal((await c.call('/api/demo/reset', {}, 'admin')).status, 403);
    assert.equal((await command(c, 'settings.save', { name: 'Bad' }, 'admin')).status, 401);
    db.raw.close();
});
test('production admin login, student registration and protected sessions are real', async () => {
    const { db, env, client } = await setup(false);
    const admin = client(), student = client(), other = client();
    assert.equal((await admin.call('/api/auth/login', { email: 'admin@example.test', password: env.BOOTSTRAP_ADMIN_PASSWORD })).status, 200);
    assert.match(admin.cookie, /school_session=/);
    const registered = await student.call('/api/auth/register', { name: 'Adult demo learner', email: 'student@example.test', password: 'learner-password-long', role: 'student' });
    assert.equal(registered.status, 201);
    assert.match(registered.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    const s = (await student.call('/api/bootstrap', undefined, 'admin')).data;
    assert.equal(s.actor.role, 'student');
    assert.ok(!JSON.stringify(s).includes('passwordHash'));
    const app = await command(student, 'application.submit', { studentId: s.actor.studentIds[0], cohortId: s.cohorts[0].id, answers: answers(s) });
    assert.equal(app.status, 200);
    assert.equal((await other.call('/api/bootstrap', undefined, 'admin')).data.enrollments.length, 0);
    assert.equal((await command(other, 'application.cancel', { id: app.data.result }, 'admin')).status, 401);
    const a = (await admin.call('/api/bootstrap')).data;
    assert.equal(a.enrollments.length, 1);
    assert.equal(a.actor.role, 'admin');
    assert.equal((await student.call('/api/auth/logout', {})).status, 200);
    assert.equal((await student.call('/api/bootstrap')).data.actor, null);
    db.raw.close();
});
test('guardian registration cannot link an existing student by request input', async () => {
    const { db, client } = await setup(false);
    const c = client();
    const res = await c.call('/api/auth/register', { name: 'Guardian test', studentName: 'Fictional learner', email: 'guardian@example.test', password: 'guardian-password-long', role: 'guardian', studentIds: ['another-student'] });
    assert.equal(res.status, 201);
    const s = (await c.call('/api/bootstrap')).data;
    assert.equal(s.actor.studentIds.length, 1);
    assert.notEqual(s.actor.studentIds[0], 'another-student');
    assert.equal((await command(c, 'guardian.link', { studentId: 'another-student', userId: s.actor.id })).status, 403);
    db.raw.close();
});
test('upload sniffing rejects executable input and private materials require active access', async () => {
    const { db, env, client } = await setup();
    const c = client();
    await c.call('/api/bootstrap', undefined, 'admin');
    const files = new Map();
    env.MEDIA = { async put(k, v) { files.set(k, v); }, async get(k) { return files.has(k) ? { async arrayBuffer() { return files.get(k); } } : null; } };
    const upload = (data, type = 'image/png', role = 'admin', publicFile = false) => handle(new Request(`https://school.test/api/media?public=${publicFile}`, { method: 'POST', headers: { Cookie: c.cookie, 'Content-Type': type, 'X-School-Request': '1', 'X-Demo-Role': role, Origin: 'https://school.test' }, body: data }), env);
    assert.equal((await upload('<script>bad</script>')).status, 400);
    assert.equal((await upload('text', 'text/plain', 'student')).status, 403);
    assert.equal((await upload('text', 'text/plain', 'admin', true)).status, 403);
    assert.equal((await upload('private sample', 'text/plain')).status, 201);
    assert.equal(files.size, 1);
    const s = (await c.call('/api/bootstrap', undefined, 'admin')).data;
    const id = s.media[0].id;
    assert.equal((await c.call(`/api/media/${id}`, undefined, 'student')).status, 404);
    const denied = await handle(new Request(`https://school.test/api/materials/${s.materials[0].id}`, { headers: { Cookie: c.cookie, 'X-Demo-Role': 'student' } }), env);
    assert.equal(denied.status, 403);
    db.raw.close();
});
test('payment callbacks reject forged signatures before contacting a provider', async () => {
    const { db, env } = await setup(false);
    env.CONFIG.payment = { provider: 'midtrans' };
    env.MIDTRANS_SERVER_KEY = 'test-key';
    const r = await handle(new Request('https://school.test/api/payments/callback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: 'fake', gross_amount: '100.00', status_code: '200', signature_key: '0'.repeat(128) }) }), env);
    assert.equal(r.status, 401);
    assert.equal((await r.json()).error, 'invalid_signature');
    db.raw.close();
});
test('verified provider callback checks canonical amount, retries idempotently, ignores stale pending', async () => {
    const { db, env } = await setup(false);
    env.CONFIG.payment = { provider: 'midtrans' };
    env.MIDTRANS_SERVER_KEY = 'test-key';
    const s = seed('exam-prep', config, true);
    s.enrollments.push({ id: 'enr-real', studentId: 'student-sinta', cohortId: s.cohorts[0].id, status: 'awaiting_payment', answers: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 });
    s.invoices.push({ id: 'invoice-real', enrollmentId: 'enr-real', studentId: 'student-sinta', totalIdr: 1000, lines: [{ label: 'Fee', amountIdr: 1000 }], status: 'unpaid', issuedAt: new Date().toISOString() });
    s.payments.push({ id: 'payment-real', invoiceId: 'invoice-real', provider: 'midtrans', reference: 'order-real', amountIdr: 1000, status: 'pending', at: new Date().toISOString() });
    const store = new Store(db, 'production', () => s);
    await store.load();
    await db.prepare('INSERT INTO school_payment_routes(order_id,namespace) VALUES(?,?)').bind('order-real', 'production').run();
    const original = globalThis.fetch;
    let amount = '999.00', status = 'settlement';
    globalThis.fetch = async () => new Response(JSON.stringify({ order_id: 'order-real', gross_amount: amount, transaction_status: status }), { status: 200 });
    const p = { order_id: 'order-real', status_code: '200', gross_amount: '1000.00' };
    p.signature_key = await digest(p.order_id + p.status_code + p.gross_amount + env.MIDTRANS_SERVER_KEY, 'SHA-512');
    const invoke = () => handle(new Request('https://school.test/api/payments/callback', { method: 'POST', body: JSON.stringify(p) }), env);
    try {
        assert.equal((await invoke()).status, 409);
        assert.equal((await store.load()).state.invoices[0].status, 'unpaid');
        amount = '1000.00';
        assert.equal((await invoke()).status, 200);
        assert.equal((await invoke()).status, 200);
        status = 'pending';
        assert.equal((await invoke()).status, 200);
        const saved = (await store.load()).state;
        assert.equal(saved.payments.length, 1);
        assert.equal(saved.payments[0].status, 'paid');
        assert.equal(saved.enrollments.find(x => x.id === 'enr-real').status, 'active');
    }
    finally {
        globalThis.fetch = original;
        db.raw.close();
    }
});
test('notifications are honest when provider missing; disabled module blocks dispatch', async () => {
    const { db, env, client } = await setup(false);
    const c = client();
    await c.call('/api/auth/login', { email: 'admin@example.test', password: env.BOOTSTRAP_ADMIN_PASSWORD });
    assert.equal((await c.call('/api/notifications/send', {})).status, 403);
    await command(c, 'module.toggle', { id: 'notifications', enabled: true }, 'admin');
    assert.equal((await c.call('/api/notifications/send', {})).status, 503);
    db.raw.close();
});
test('bootstrap email cannot be claimed; password change revokes all sessions', async () => {
    const { db, env, client } = await setup(false);
    const a = client(), b = client();
    assert.equal((await a.call('/api/auth/register', { name: 'Impersonation', email: env.BOOTSTRAP_ADMIN_EMAIL, password: 'test-long-password', role: 'student' })).status, 409);
    for (const c of [a, b])
        assert.equal((await c.call('/api/auth/login', { email: env.BOOTSTRAP_ADMIN_EMAIL, password: env.BOOTSTRAP_ADMIN_PASSWORD })).status, 200);
    assert.equal((await a.call('/api/auth/password', { currentPassword: 'incorrect-long', password: 'new-password-long' })).status, 401);
    assert.equal((await a.call('/api/auth/password', { currentPassword: env.BOOTSTRAP_ADMIN_PASSWORD, password: 'new-password-long' })).status, 200);
    assert.equal((await b.call('/api/bootstrap')).data.actor, null);
    assert.equal((await b.call('/api/auth/login', { email: env.BOOTSTRAP_ADMIN_EMAIL, password: 'new-password-long' })).status, 200);
    db.raw.close();
});
test('admin can provision a student with a real protected learner link', async () => { const { db, env, client } = await setup(false); const a = client(), student = client(); await a.call('/api/auth/login', { email: env.BOOTSTRAP_ADMIN_EMAIL, password: env.BOOTSTRAP_ADMIN_PASSWORD }); assert.equal((await a.call('/api/auth/invite', { name: 'Fictional adult', email: 'new@example.test', role: 'student', password: 'private-long-password' })).status, 200); await student.call('/api/auth/login', { email: 'new@example.test', password: 'private-long-password' }); const s = (await student.call('/api/bootstrap')).data; assert.equal(s.actor.studentIds.length, 1); assert.equal(s.students[0].id, s.actor.studentIds[0]); db.raw.close(); });
test('configured notification provider receives signed idempotent outbox delivery after commit', async () => { const { db, env, client } = await setup(false); const a = client(), c = client(); await a.call('/api/auth/login', { email: env.BOOTSTRAP_ADMIN_EMAIL, password: env.BOOTSTRAP_ADMIN_PASSWORD }); await command(a, 'module.toggle', { id: 'notifications', enabled: true }, 'admin'); await c.call('/api/auth/register', { name: 'Adult test', email: 'adult@example.test', password: 'private-long-password', role: 'student' }); const s = (await c.call('/api/bootstrap')).data; env.NOTIFICATION_URL = 'https://notify.example.test'; env.NOTIFICATION_SECRET = 'testing-only'; const original = globalThis.fetch; let calls = []; globalThis.fetch = async (u, init) => { calls.push({ url: String(u), ...init }); return new Response('{}', { status: 200 }); }; try {
    const r = await command(c, 'application.submit', { studentId: s.actor.studentIds[0], cohortId: s.cohorts[0].id, answers: answers(s) });
    assert.equal(r.status, 200);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].headers['X-School-Signature']);
    assert.ok(calls[0].headers['Idempotency-Key']);
    assert.equal((await a.call('/api/bootstrap')).data.outbox[0].status, 'sent');
}
finally {
    globalThis.fetch = original;
    db.raw.close();
} });

test('checkout reconciles ambiguous creation, retries terminal attempts and deduplicates callbacks', async () => {
    const { db, env, client } = await setup(false);
    env.CONFIG = { ...env.CONFIG, payment: { provider: 'midtrans' } }; env.MIDTRANS_SERVER_KEY = 'test-key';
    const c = client(); await c.call('/api/auth/login', { email: env.BOOTSTRAP_ADMIN_EMAIL, password: env.BOOTSTRAP_ADMIN_PASSWORD });
    const store = new Store(db, 'production', () => seed('exam-prep', config, false));
    await store.mutate(s => {
        s.enrollments.push({ id: 'enr-checkout', studentId: 'student-sinta', cohortId: s.cohorts[0].id, status: 'awaiting_payment', answers: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 });
        s.invoices.push({ id: 'inv-checkout', enrollmentId: 'enr-checkout', studentId: 'student-sinta', totalIdr: 1000, lines: [], status: 'unpaid', issuedAt: new Date().toISOString() });
    });
    const original = globalThis.fetch; let attempts = [], status = 'missing', fail = true;
    let release, signal; const gate = new Promise(r => { release = r; }), entered = new Promise(r => { signal = r; });
    globalThis.fetch = async (url, init = {}) => {
        if (init.method === 'POST') { const order = JSON.parse(init.body).transaction_details.order_id; attempts.push(order); if (fail) { fail = false; return new Response('{}', { status: 503 }); } if (attempts.length === 2) { signal(); await gate; } return Response.json({ redirect_url: `https://app.sandbox.midtrans.com/snap/${order}` }); }
        if (status === 'missing') return new Response('{}', { status: 404 });
        return Response.json({ order_id: decodeURIComponent(String(url).split('/').at(-2)), gross_amount: '1000.00', transaction_status: status });
    };
    const start = () => c.call('/api/payments/start', { id: 'inv-checkout' });
    const callback = async order => { const p = { order_id: order, status_code: '200', gross_amount: '1000.00' }; p.signature_key = await digest(order + p.status_code + p.gross_amount + env.MIDTRANS_SERVER_KEY, 'SHA-512'); return handle(new Request('https://school.test/api/payments/callback', { method: 'POST', body: JSON.stringify(p) }), env); };
    try {
        assert.equal((await start()).status, 502);
        await store.mutate(s => { s.payments.find(p => p.reference === attempts[0]).startingUntil = Date.now() - 1; });
        const retry = start(); await entered; assert.equal((await start()).status, 409); release();
        assert.equal((await retry).status, 200);
        assert.equal(attempts[0], attempts[1]);
        status = 'pending';
        assert.equal((await start()).status, 200); assert.equal(attempts.length, 2);
        status = 'deny'; assert.equal((await callback(attempts[0])).status, 200); assert.equal((await start()).status, 200); assert.equal(attempts.length, 2);
        status = 'failure'; assert.equal((await callback(attempts[0])).status, 200);
        assert.equal((await start()).status, 200); assert.notEqual(attempts[2], attempts[0]);
        status = 'expire'; assert.equal((await callback(attempts[2])).status, 200); assert.equal((await callback(attempts[2])).status, 200);
        assert.equal((await start()).status, 200); assert.notEqual(attempts[3], attempts[2]);
        status = 'settlement'; assert.equal((await callback(attempts[3])).status, 200); assert.equal((await callback(attempts[3])).status, 200);
        assert.equal((await callback(attempts[0])).status, 200);
        const state = (await store.load()).state;
        assert.equal(state.invoices.find(x => x.id === 'inv-checkout').status, 'paid');
        assert.equal(state.events.filter(x => x.enrollmentId === 'enr-checkout' && x.status === 'active').length, 1);
        assert.equal(state.invoices.find(x => x.id === 'inv-checkout').needsReview, true);
    } finally { globalThis.fetch = original; db.raw.close(); }
});

test('saved checkout URLs reconcile terminal notifications and preserve active unselected Snap pages', async () => {
    for (const terminal of ['expire', 'cancel', 'failure']) {
        const { db, env, client } = await setup(false);
        env.CONFIG = { ...env.CONFIG, payment: { provider: 'midtrans' } }; env.MIDTRANS_SERVER_KEY = 'test-key';
        const c = client(); await c.call('/api/auth/login', { email: env.BOOTSTRAP_ADMIN_EMAIL, password: env.BOOTSTRAP_ADMIN_PASSWORD });
        const store = new Store(db, 'production', () => seed('exam-prep', config, false));
        await store.mutate(s => {
            s.enrollments.push({ id: 'enr-retry', studentId: 'student-sinta', cohortId: s.cohorts[0].id, status: 'awaiting_payment', answers: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 });
            s.invoices.push({ id: 'inv-retry', enrollmentId: 'enr-retry', studentId: 'student-sinta', totalIdr: 1000, lines: [], status: 'unpaid', issuedAt: new Date().toISOString() });
        });
        const original = globalThis.fetch, attempts = [];
        let status = 'pending';
        globalThis.fetch = async (url, init = {}) => {
            if (init.method === 'POST') { const payload = JSON.parse(init.body); assert.deepEqual(payload.page_expiry, { duration: 24, unit: 'hours' }); const order = payload.transaction_details.order_id; attempts.push(order); return Response.json({ redirect_url: `https://app.sandbox.midtrans.com/snap/${order}/${attempts.length}` }); }
            if (status === 'missing') return new Response('{}', { status: 404 });
            if (status === 'unavailable') return new Response('{}', { status: 503 });
            return Response.json({ order_id: decodeURIComponent(String(url).split('/').at(-2)), gross_amount: '1000.00', transaction_status: status });
        };
        const start = () => c.call('/api/payments/start', { id: 'inv-retry' });
        try {
            const first = await start(); assert.equal(first.status, 200);
            assert.equal((await start()).data.url, first.data.url); assert.equal(attempts.length, 1);
            status = terminal;
            const next = await start(); assert.equal(next.status, 200); assert.notEqual(next.data.url, first.data.url); assert.notEqual(attempts[0], attempts[1]);
            status = 'missing';
            const reused = await start(); assert.equal(reused.status, 200); assert.equal(reused.data.url, next.data.url); assert.equal(attempts.length, 2);
            const expiry = (await store.load()).state.payments.find(p => p.reference === attempts[1]).checkoutExpiresAt;
            assert.ok(expiry > Date.now());
            await store.mutate(s => { delete s.payments.find(p => p.reference === attempts[1]).checkoutExpiresAt; });
            assert.equal((await start()).status, 409); assert.equal(attempts.length, 2);
            await store.mutate(s => { s.payments.find(p => p.reference === attempts[1]).checkoutExpiresAt = Date.now() - 1; });
            const refreshed = await start(); assert.equal(refreshed.status, 200); assert.notEqual(refreshed.data.url, next.data.url); assert.equal(attempts[1], attempts[2]);
            status = 'unavailable';
            assert.equal((await start()).status, 502); assert.equal(attempts.length, 3);
            status = 'settlement';
            assert.equal((await start()).status, 409); assert.equal(attempts.length, 3);
            const state = (await store.load()).state;
            assert.equal(state.invoices.find(x => x.id === 'inv-retry').status, 'paid');
            assert.equal(state.events.filter(x => x.enrollmentId === 'enr-retry' && x.status === 'active').length, 1);
        } finally { globalThis.fetch = original; db.raw.close(); }
    }
});

test('D1 account capacity failures return a retryable error without logging answers', async () => {
    const { db, env, client } = await setup();
    const c = client();
    const s = (await c.call('/api/bootstrap', undefined, 'student')).data;
    const before = (await c.call('/api/bootstrap', undefined, 'admin')).data.enrollments.length;
    const prepare = db.prepare.bind(db), messages = [], original = console.error;
    db.prepare = sql => {
        if (sql.startsWith('INSERT INTO school_limits')) throw Error("D1_ERROR: Your account has exceeded D1's free tier daily row write limit.");
        return prepare(sql);
    };
    console.error = (...args) => messages.push(args);
    try {
        const result = await command(c, 'application.submit', { studentId: 'student-sinta', cohortId: s.cohorts[0].id, answers: { targetExam: 'UTBK', studyGoal: 'PRIVATE-ANSWER' } });
        assert.equal(result.status, 503);
        assert.equal(result.data.error, 'storage_capacity_exceeded');
        assert.ok(Number(result.headers.get('retry-after')) > 0);
        assert.doesNotMatch(JSON.stringify(messages), /PRIVATE-ANSWER|Cookie|Authorization/);
        assert.equal((await c.call('/api/bootstrap', undefined, 'admin')).data.enrollments.length, before);
    } finally { console.error = original; db.raw.close(); }
});
