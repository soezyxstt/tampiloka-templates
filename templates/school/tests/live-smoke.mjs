import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const origin = new URL(process.env.SCHOOL_URL || process.argv[2] || 'http://127.0.0.1:5176').origin;
const checks = [];
const expect = (value, message) => { assert.ok(value, message); checks.push(message); };
function client(preset = 'exam-prep', level = 'full') {
  let cookie = '', demoVerified = false;
  async function request(path, { role = 'visitor', data, raw, type = 'application/json', extra = {} } = {}) {
    if (data !== undefined || raw !== undefined) assert.equal(demoVerified, true, 'Mutations require an explicitly verified demo');
    const u = new URL(path, origin); u.searchParams.set('preset', preset); if (!u.searchParams.has('level')) u.searchParams.set('level', level);
    const r = await fetch(u, { method: data !== undefined || raw !== undefined ? 'POST' : 'GET', headers: { Cookie: cookie, Origin: origin, 'X-School-Request': '1', 'X-Demo-Role': role, 'Content-Type': type, ...extra }, body: raw ?? (data === undefined ? undefined : JSON.stringify(data)), signal: AbortSignal.timeout(20000) });
    const c = r.headers.getSetCookie().find(c => c.startsWith('school_demo=')); if (c) cookie = c.split(';')[0];
    const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = text; }
    if (path.startsWith('/api/bootstrap') && r.ok) { assert.equal(body.demo, true, 'Target is not a demo; no writes allowed'); demoVerified = true; }
    return { status: r.status, body, headers: r.headers };
  }
  async function state(role = 'student', suffix = '') { const r = await request('/api/bootstrap' + suffix, { role }); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; }
  async function command(action, payload, role = 'student', key = crypto.randomUUID()) {
    const r = await request('/api/command', { role, data: { action, payload, key } }); assert.equal(r.status, 200, `${action}: ${JSON.stringify(r.body)}`); return r.body;
  }
  return { request, state, command };
}
function answers(s) { return Object.fromEntries(s.registrationFields.filter(f => f.required).map(f => [f.name, f.type === 'checkbox' ? true : f.type === 'select' ? f.options[0] : f.type === 'number' ? 1 : f.type === 'email' ? 'fictional@example.test' : 'Fictional learning goal'])); }
for (const preset of ['exam-prep', 'language', 'skills', 'institution']) {
  const c = client(preset); let s = await c.state();
  expect(s.programs.length >= 2 && s.cohorts.length >= 2, `${preset}: real program and intake configuration`);
  const key = crypto.randomUUID(); const payload = { studentId: 'student-sinta', cohortId: s.cohorts[0].id, answers: answers(s) };
  const application = await c.command('application.submit', payload, 'student', key); const id = application.result;
  expect((await c.command('application.submit', payload, 'student', key)).result === id, `${preset}: registration retry is idempotent`);
  s = await c.state('admin'); let e = s.enrollments.find(e => e.id === id);
  await c.command('application.review', { id, version: e.version, status: 'accepted' }, 'admin');
  s = await c.state(); const invoice = s.invoices.find(i => i.enrollmentId === id);
  expect(s.enrollments.find(e => e.id === id).status === 'awaiting_payment' && invoice.status === 'unpaid' && Number.isSafeInteger(invoice.totalIdr), `${preset}: approval creates a separate integer invoice`);
  const paymentKey = crypto.randomUUID(); await c.command('payment.simulate', { id: invoice.id }, 'student', paymentKey); await c.command('payment.simulate', { id: invoice.id }, 'student', paymentKey);
  s = await c.state(); expect(s.enrollments.find(e => e.id === id).status === 'active' && s.invoices.find(i => i.id === invoice.id).status === 'paid', `${preset}: simulated payment activates enrollment`);
  expect((await c.state('guardian')).enrollments.some(e => e.id === id && e.status === 'active'), `${preset}: linked guardian sees the same record`);
  expect(!(await c.state('other')).enrollments.some(e => e.id === id), `${preset}: another student cannot read the application`);
  expect(!(await client(preset).state()).enrollments.some(e => e.id === id), `${preset}: visitor sessions remain isolated`);
  const material = s.materials[0]; expect((await c.request(`/api/materials/${material.id}`, { role: 'student' })).status === 200, `${preset}: active student can download a material`);
  if (preset === 'exam-prep') {
    const raw = 'Fictional deployment-check resource. No personal data.';
    const upload = await c.request('/api/media', { role: 'admin', raw, type: 'text/plain', extra: { 'X-File-Name': 'demo-check.txt' } });
    assert.equal(upload.status, 201, JSON.stringify(upload.body));
    await c.command('material.save', { id: 'deployed-private-resource', cohortId: payload.cohortId, title: { id: 'Materi contoh', en: 'Sample resource' }, description: { id: 'Uji penyimpanan privat', en: 'Private storage check' }, assetId: upload.body.id }, 'admin');
    const download = await c.request('/api/materials/deployed-private-resource', { role: 'student' });
    expect(download.status === 200 && download.body === raw && download.headers.get('cache-control') === 'no-store', 'R2: private material download matches uploaded bytes');
    expect((await c.request(`/api/media/${upload.body.id}`, { role: 'visitor' })).status === 404, 'R2: private media has no public route');
  }
  await c.command('application.cancel', { id });
  s = await c.state(); expect(s.enrollments.find(e => e.id === id).status === 'cancelled' && !s.materials.length, `${preset}: cancellation revokes academic access`);
  expect((await c.request(`/api/materials/${material.id}`, { role: 'student' })).status === 403, `${preset}: direct material URL is denied after cancellation`);
  await c.request('/api/demo/reset', { role: 'admin', data: {} });
}
const c = client(); let s = await c.state('admin');
const cohort = { ...s.cohorts[0], capacity: 3 }; await c.command('cohort.save', cohort, 'admin');
const ids = []; for (let i = 0; i < 6; i++) ids.push((await c.command('student.create', { name: `Fictional concurrency learner ${i + 1}` }, 'admin')).result);
await Promise.all(ids.map(studentId => c.command('application.submit', { studentId, cohortId: cohort.id, answers: answers(s) }, 'admin')));
s = await c.state('admin');
const relevant = s.enrollments.filter(e => e.cohortId === cohort.id); const reserved = new Set(['submitted', 'under_review', 'accepted', 'awaiting_payment', 'active']);
expect(relevant.filter(e => reserved.has(e.status)).length === 3 && relevant.filter(e => e.status === 'waitlisted').length === 4, 'D1: concurrent registrations cannot oversubscribe three seats');
for (const level of ['profile', 'whatsapp']) {
  const blocked = await c.request(`/api/command?level=${level}`, { role: 'admin', data: { action: 'application.submit', payload: {}, key: crypto.randomUUID() } });
  expect(blocked.status === 403, `${level}: server rejects enrollment even for demo staff`);
}
expect((await c.request('/api/payments/start', { role: 'student', data: { id: 'never-charge' } })).status === 403, 'Demo cannot initiate a real provider payment');
await c.request('/api/demo/reset', { role: 'admin', data: {} });
const directory = resolve('test-results/live-smoke'); await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'results.json'), JSON.stringify({ origin, checkedAt: new Date().toISOString(), passed: checks.length, checks }, null, 2));
console.log(`PASS ${checks.length} deployed API checks on ${origin}`);
