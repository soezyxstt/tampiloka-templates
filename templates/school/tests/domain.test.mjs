import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../config/school.json' with { type: 'json' };
import { seed } from '../content/seed.ts';
import { command, snapshot, applyPayment, freeSeats, canDownload } from '../src/domain/service.ts';
import { validateFields, registerExtension, cms } from '../src/cms/registry.ts';
import { Store } from '../worker/store.ts';
import { database } from '../scripts/sqlite.mjs';
const state = (preset = 'exam-prep') => seed(preset, config, true);
const ctx = (s, role = 'student', level = 'full') => ({ actor: s.users.find(x => x.id === role), level, demo: true, now: new Date().toISOString(), id: crypto.randomUUID() });
const answers = s => Object.fromEntries(s.registrationFields.filter(f => f.required).map(f => [f.name, f.type === 'checkbox' ? true : f.type === 'select' ? f.options[0] : 'Sample']));
const cmd = (s, c, action, payload, key = crypto.randomUUID()) => command(s, c, { action, payload, key }, 'exam-prep');
const submit = (s, c = ctx(s)) => cmd(s, c, 'application.submit', { studentId: c.actor.studentIds[0], cohortId: s.cohorts[0].id, answers: answers(s) });
function accept(s, id, level = 'full') { const e = s.enrollments.find(x => x.id === id); cmd(s, ctx(s, 'admin', level), 'application.review', { id, version: e.version, status: 'accepted' }); return e; }
for (const level of ['profile', 'whatsapp'])
    test(`${level} enforces registration, finance and academic boundaries`, () => {
        const s = state(), c = ctx(s, 'admin', level);
        for (const action of ['application.submit', 'application.review', 'payment.record', 'payment.simulate', 'attendance.save', 'progress.save', 'material.save', 'student.create'])
            assert.throws(() => cmd(s, c, action, {}), e => e.status === 403 && e.code === 'feature_disabled');
        const view = snapshot(s, c, 'exam-prep');
        assert.equal(view.enrollments.length, 0);
        assert.equal(view.invoices.length, 0);
        assert.equal(view.materials.length, 0);
        assert.equal(view.students.length, 0);
    });
for (const preset of ['exam-prep', 'language', 'skills', 'institution'])
    test(`${preset} has distinct required fields and an executable enrollment flow`, () => {
        const s = state(preset), c = ctx(s, 'student', 'enrollment');
        assert.ok(s.programs.every(p => p.type === preset));
        assert.ok(s.registrationFields.length > 0);
        assert.throws(() => cmd(s, c, 'application.submit', { studentId: 'student-sinta', cohortId: s.cohorts[0].id, answers: {} }), /required/);
        const id = submit(s, c);
        const e = accept(s, id, 'enrollment');
        assert.equal(e.status, 'active');
        assert.equal(s.invoices.length, 0);
    });
test('full approval creates integer invoice then payment activates exactly once', () => {
    const s = state(), id = submit(s);
    const e = accept(s, id);
    assert.equal(e.status, 'awaiting_payment');
    const invoice = s.invoices[0];
    assert.equal(invoice.totalIdr, 2550000);
    assert.equal(invoice.totalIdr, invoice.lines.reduce((n, l) => n + l.amountIdr, 0));
    assert.throws(() => applyPayment(s, ctx(s), invoice.id, 'bad', 1, 'demo'), /amount_mismatch/);
    assert.equal(e.status, 'awaiting_payment');
    const key = crypto.randomUUID();
    const c = ctx(s);
    cmd(s, c, 'payment.simulate', { id: invoice.id }, key);
    cmd(s, c, 'payment.simulate', { id: invoice.id }, key);
    assert.equal(e.status, 'active');
    assert.equal(invoice.status, 'paid');
    assert.equal(s.payments.length, 1);
    applyPayment(s, c, invoice.id, `demo-${invoice.id}`, invoice.totalIdr, 'demo', 'pending');
    assert.equal(s.payments[0].status, 'paid');
});
test('successful pending checkout after a manual payment requires review', () => {
    const s = state(), id = submit(s);
    accept(s, id);
    const invoice = s.invoices[0], c = ctx(s);
    applyPayment(s, c, invoice.id, 'provider-order', invoice.totalIdr, 'midtrans', 'pending');
    applyPayment(s, c, invoice.id, 'manual-receipt', invoice.totalIdr, 'manual');
    applyPayment(s, c, invoice.id, 'provider-order', invoice.totalIdr, 'midtrans', 'paid');
    assert.equal(invoice.needsReview, true);
});
test('approval and payment remain separate, no enrollment activation on unapproved payment', () => {
    const s = state(), id = submit(s), e = s.enrollments.find(x => x.id === id);
    s.invoices.push({ id: 'test', enrollmentId: id, studentId: e.studentId, totalIdr: 10, lines: [{ label: 'test', amountIdr: 10 }], status: 'unpaid', issuedAt: new Date().toISOString() });
    applyPayment(s, ctx(s), 'test', 'test-ref', 10, 'manual');
    assert.equal(e.status, 'submitted');
});
test('cancellation releases seat and late payment does not reactivate', () => {
    const s = state(), id = submit(s);
    accept(s, id);
    const invoice = s.invoices[0], before = freeSeats(s, s.cohorts[0].id);
    cmd(s, ctx(s), 'application.cancel', { id });
    assert.equal(freeSeats(s, s.cohorts[0].id), before + 1);
    assert.equal(invoice.status, 'void');
    applyPayment(s, ctx(s), invoice.id, 'late-ref', invoice.totalIdr, 'midtrans');
    assert.equal(s.enrollments.find(x => x.id === id).status, 'cancelled');
    assert.equal(invoice.needsReview, true);
});
test('review, reject, waitlist and stale version checks', () => {
    const s = state(), id = submit(s), e = s.enrollments.find(x => x.id === id);
    cmd(s, ctx(s, 'admin'), 'application.review', { id, version: e.version, status: 'under_review' });
    assert.throws(() => cmd(s, ctx(s, 'admin'), 'application.review', { id, version: 1, status: 'accepted' }), /stale_record/);
    cmd(s, ctx(s, 'staff'), 'application.review', { id, version: e.version, status: 'waitlisted' });
    assert.equal(e.status, 'waitlisted');
    cmd(s, ctx(s, 'staff'), 'application.review', { id, version: e.version, status: 'rejected' });
    assert.throws(() => cmd(s, ctx(s, 'admin'), 'application.review', { id, version: e.version, status: 'active' }), /invalid_transition/);
});
test('capacity and windows enforced on server; occupied cohort cannot shrink or move', () => {
    const s = state();
    s.cohorts[0].capacity = 1;
    const id = submit(s);
    assert.equal(s.enrollments.find(x => x.id === id).status, 'waitlisted');
    assert.throws(() => accept(s, id), /capacity_full/);
    s.cohorts[0].closesAt = new Date(Date.now() - 1).toISOString();
    assert.throws(() => submit(s), /window_closed/);
});
test('idempotent registration rejects changed payload and duplicate enrollment', () => {
    const s = state(), c = ctx(s), key = crypto.randomUUID(), payload = { studentId: 'student-sinta', cohortId: s.cohorts[0].id, answers: answers(s) };
    const id = cmd(s, c, 'application.submit', payload, key);
    assert.equal(cmd(s, c, 'application.submit', payload, key), id);
    assert.throws(() => cmd(s, c, 'application.submit', { ...payload, cohortId: 'other' }, key), /idempotency_conflict/);
    assert.throws(() => cmd(s, c, 'application.submit', payload), /already_applied/);
});
test('draft is persisted and submission consumes one seat only', () => {
    const s = state(), c = ctx(s);
    const id = cmd(s, c, 'application.save', { studentId: 'student-sinta', cohortId: s.cohorts[0].id, answers: {} });
    assert.equal(s.enrollments.find(x => x.id === id).status, 'draft');
    const before = freeSeats(s, s.cohorts[0].id);
    assert.equal(submit(s, c), id);
    assert.equal(freeSeats(s, s.cohorts[0].id), before - 1);
});
test('30 concurrent registrations never oversubscribe, persistence survives store recreation', async () => {
    const db = await database();
    const s = state();
    s.cohorts[0].capacity = 3;
    for (let i = 0; i < 30; i++) {
        s.students.push({ id: `s-${i}`, name: 'Fictional', email: `${i}@example.test` });
        s.users.push({ id: `u-${i}`, name: 'Fictional', email: `${i}@example.test`, role: 'student', studentIds: [`s-${i}`] });
    }
    const store = new Store(db, 'test-concurrent', () => s);
    await store.load();
    await Promise.all(Array.from({ length: 30 }, (_, i) => { const c = ctx(s, `u-${i}`); return store.mutate(s => submit(s, c)); }));
    const saved = (await new Store(db, 'test-concurrent', () => { throw Error('Must not reseed'); }).load()).state;
    assert.equal(saved.enrollments.filter(e => e.status === 'submitted').length, 3);
    assert.equal(saved.enrollments.filter(e => e.status === 'waitlisted').length, 28);
    assert.equal(freeSeats(saved, saved.cohorts[0].id), 0);
    db.raw.close();
});
test('failed mutation leaves database untouched', async () => {
    const db = await database(), store = new Store(db, 'rollback', state);
    await store.load();
    await assert.rejects(() => store.mutate(s => { s.students = []; throw Error('abort'); }), /abort/);
    assert.equal((await store.load()).state.students.length, 2);
    db.raw.close();
});
test('student and guardian read only linked records; tutors cannot see finance or application answers', () => {
    const s = state(), id = submit(s);
    accept(s, id);
    assert.equal(snapshot(s, ctx(s), 'exam-prep').enrollments.length, 1);
    assert.equal(snapshot(s, ctx(s, 'guardian'), 'exam-prep').enrollments[0].id, id);
    assert.throws(() => cmd(s, ctx(s), 'application.cancel', { id: 'application-sample' }), /forbidden/);
    for (const role of ['student', 'guardian', 'tutor', 'editor'])
        assert.throws(() => cmd(s, ctx(s, role), 'application.review', { id, version: 2, status: 'accepted' }), /forbidden/);
    const tutor = snapshot(s, ctx(s, 'tutor'), 'exam-prep');
    assert.equal(tutor.invoices.length, 0);
    assert.ok(tutor.enrollments.every(e => Object.keys(e.answers).length === 0));
    assert.ok(tutor.students.every(e => e.email === ''));
    const visitor = snapshot(s, { ...ctx(s), actor: null }, 'exam-prep');
    assert.equal(visitor.enrollments.length, 0);
    assert.equal(visitor.users.length, 0);
    assert.equal(visitor.invoices.length, 0);
});
test('private materials are restricted to active enrollment, linked guardian, or assigned tutor', () => {
    const s = state();
    const m = s.materials[0];
    assert.throws(() => canDownload(s, ctx(s), m.id), /forbidden/);
    const id = submit(s);
    accept(s, id);
    cmd(s, ctx(s), 'payment.simulate', { id: s.invoices[0].id });
    assert.equal(canDownload(s, ctx(s), m.id).id, m.id);
    assert.equal(canDownload(s, ctx(s, 'guardian'), m.id).id, m.id);
    assert.throws(() => canDownload(s, ctx(s, 'tutor'), s.materials[1].id), /forbidden/);
});
test('attendance and progress authorize tutors against their own sessions and students', () => {
    const s = state();
    const id = submit(s);
    accept(s, id);
    cmd(s, ctx(s), 'payment.simulate', { id: s.invoices[0].id });
    const session = s.sessions[0];
    cmd(s, ctx(s, 'tutor'), 'attendance.save', { sessionId: session.id, studentId: 'student-sinta', status: 'present' });
    cmd(s, ctx(s, 'tutor'), 'progress.save', { cohortId: session.cohortId, studentId: 'student-sinta', topic: 'Algebra', note: 'Practice linear equations', percent: 30 });
    assert.equal(s.attendance.length, 1);
    assert.equal(snapshot(s, ctx(s), 'exam-prep').progress.length, 1);
    assert.throws(() => cmd(s, ctx(s, 'tutor'), 'attendance.save', { sessionId: s.sessions[3].id, studentId: 'student-sinta', status: 'present' }), /forbidden/);
});
test('drafts, revisions, publication, and unpublish have no public draft leakage', () => {
    const s = state(), c = ctx(s, 'editor', 'profile'), home = s.content[0], data = structuredClone(home.draft);
    data.title.en = 'Changed draft';
    cmd(s, c, 'content.save', { id: 'home', version: home.version, data });
    assert.notEqual(snapshot(s, { ...c, actor: null }, 'exam-prep').content[0].draft.title.en, 'Changed draft');
    assert.equal(home.revisions.length, 1);
    cmd(s, c, 'content.publish', { id: 'home', version: home.version, data });
    assert.equal(snapshot(s, { ...c, actor: null }, 'exam-prep').content[0].published.title.en, 'Changed draft');
    cmd(s, c, 'content.restore', { id: 'home', version: home.version, revision: 1 });
    assert.notEqual(home.draft.title.en, 'Changed draft');
    cmd(s, c, 'content.unpublish', { id: 'home', version: home.version });
    assert.ok(!snapshot(s, { ...c, actor: null }, 'exam-prep').content.some(x => x.id === 'home'));
});
test('legacy demo publication survives draft save and restore', () => {
    const s = state(), c = ctx(s, 'editor', 'profile'), home = s.content[0];
    home.draft.image = home.published.image = '/images/classroom.jpg';
    home.draft.blocks[0].image = home.published.blocks[0].image = '/images/workshop.jpg';
    home.draft.blocks[1].image = home.published.blocks[1].image = '/images/library.jpg';
    const publicHome = () => snapshot(s, { ...c, actor: null }, 'exam-prep').content.find(x => x.id === 'home').published;
    const before = structuredClone(publicHome());
    assert.notEqual(before.image, '/images/classroom.jpg');
    const edited = structuredClone(home.draft);
    edited.title.en = 'Unpublished edit';
    cmd(s, c, 'content.save', { id: 'home', version: home.version, data: edited });
    assert.deepEqual(publicHome(), before);
    cmd(s, c, 'content.restore', { id: 'home', version: home.version, revision: 1 });
    assert.deepEqual(publicHome(), before);
    cmd(s, c, 'content.publish', { id: 'home', version: home.version, data: edited });
    assert.equal(publicHome().title.en, 'Unpublished edit');
});
test('conditional validation ignores hidden values, rejects prototype keys and wrong types', () => {
    const fields = [{ name: 'consent', type: 'checkbox', label: { id: 'Ya', en: 'Yes' } }, { name: 'reason', type: 'text', required: true, label: { id: 'Alasan', en: 'Reason' }, when: { field: 'consent', equals: true } }];
    assert.deepEqual(validateFields(fields, { consent: false, reason: 'hidden' }), { consent: false });
    assert.throws(() => validateFields(fields, { consent: true }), /required:reason/);
    assert.throws(() => validateFields([{ name: '__proto__', type: 'text' }], {}), /invalid_field/);
});
test('modules stay independent and unavailable modules cannot be enabled', () => {
    const s = state();
    assert.throws(() => cmd(s, ctx(s, 'admin'), 'module.toggle', { id: 'quizzes', enabled: true }), /module_not_installed/);
    assert.throws(() => cmd(s, ctx(s, 'staff'), 'module.toggle', { id: 'progress-reports', enabled: true }), /forbidden/);
    assert.throws(() => cmd(s, ctx(s, 'admin', 'profile'), 'module.toggle', { id: 'progress-reports', enabled: true }), /feature_disabled/);
    cmd(s, ctx(s, 'admin'), 'module.toggle', { id: 'additional-branches', enabled: true });
    cmd(s, ctx(s, 'admin'), 'branch.save', { id: 'second', name: 'Second', address: 'Fictional' });
    assert.equal(s.branches.length, 2);
    cmd(s, ctx(s, 'admin'), 'module.toggle', { id: 'additional-branches', enabled: false });
    assert.throws(() => cmd(s, ctx(s, 'admin'), 'branch.save', { id: 'third' }), /module_disabled/);
});
test('registered extension commands and collections work without modifying business logic', () => {
    registerExtension({ collections: [{ id: 'events', label: { id: 'Acara', en: 'Events' }, fields: [] }], blocks: [{ id: 'custom-block', label: { id: 'Khusus', en: 'Custom' }, validate: b => assert.equal(b.type, 'custom-block') }], modules: [{ id: 'example-extension', label: { id: 'Contoh', en: 'Example' }, minimum: 'full', command: (s, c, p) => 'extension-result' }] });
    const s = state();
    cmd(s, ctx(s, 'admin'), 'module.toggle', { id: 'example-extension', enabled: true });
    assert.equal(cmd(s, ctx(s, 'admin'), 'example-extension', {}), 'extension-result');
    assert.throws(() => registerExtension({ collections: [cms.collections.get('events')] }), /duplicate_collection/);
});
test('published custom CMS pages can be linked, unknown or draft pages cannot', () => { const s = state(), c = ctx(s, 'admin'); const base = s.content.find(x => x.id === 'home').draft; cmd(s, c, 'content.save', { id: 'admissions-guide', collection: 'pages', data: { ...structuredClone(base), title: { id: 'Panduan', en: 'Guide' } } }); const settings = { ...s.institution, navigation: [{ page: 'admissions-guide', label: { id: 'Panduan', en: 'Guide' } }] }; assert.throws(() => cmd(s, c, 'settings.save', settings), /invalid_page/); const d = s.content.find(x => x.id === 'admissions-guide'); cmd(s, c, 'content.publish', { id: d.id, version: d.version, data: d.draft }); cmd(s, c, 'settings.save', settings); assert.equal(s.institution.navigation[0].page, d.id); });

test('each preset ships a distinct lead and a responsive photograph for every program', async () => {
    const { readFile } = await import('node:fs/promises');
    const leads = new Set();
    for (const preset of ['exam-prep', 'language', 'skills', 'institution']) {
        const { content } = state(preset);
        const lead = content.find(entry => entry.id === 'home').published.image;
        const images = content.filter(entry => entry.collection === 'programs').map(entry => entry.published.image);
        assert.equal(new Set([lead, ...images]).size, 1 + images.length, preset);
        leads.add(lead);
        for (const image of [lead, ...images]) {
            assert.match(image, /^\/images\/[a-z-]+\.webp$/);
            for (const path of [image, image.replace('.webp', '-480.webp')]) {
                const bytes = await readFile(new URL(`../public${path}`, import.meta.url));
                assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', path);
            }
        }
    }
    assert.equal(leads.size, 4);
});

test('returning demo visitors see new imagery only on untouched built-in records', () => {
    const s = state('skills');
    const home = s.content.find(c => c.id === 'home');
    const photo = s.content.find(c => c.id === 'photo-workshop');
    const edited = s.content.find(c => c.id === 'design-practice');
    for (const field of ['draft', 'published']) {
        home[field].image = '/images/classroom.jpg';
        home[field].blocks.find(b => b.id === 'facilities').image = '/images/library.jpg';
        photo[field].image = '/images/workshop.jpg';
        edited[field].image = '/images/classroom.jpg';
    }
    edited.version = 2;
    const before = structuredClone(s);
    const view = snapshot(s, ctx(s, 'admin'), 'skills');
    const visible = id => view.content.find(c => c.id === id).published;
    assert.equal(visible('home').image, '/images/team-board.webp');
    assert.equal(visible('home').blocks.find(b => b.id === 'facilities').image, '/images/discussion.webp');
    assert.equal(visible('photo-workshop').image, '/images/photo-studio.webp');
    assert.equal(visible('design-practice').image, '/images/classroom.jpg');
    assert.deepEqual(s, before);
    const client = snapshot(s, { ...ctx(s, 'admin'), demo: false }, 'skills');
    assert.equal(client.content.find(c => c.id === 'home').published.image, '/images/classroom.jpg');
});
