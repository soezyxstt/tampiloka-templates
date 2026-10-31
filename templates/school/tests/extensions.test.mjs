import test from 'node:test';
import assert from 'node:assert/strict';
import { registerExtension, cms } from '../src/cms/registry.ts';
import { handle } from '../worker/api.ts';
import { database } from '../scripts/sqlite.mjs';

test('extension fields are visible to learners and staff and cannot collide with institution fields', async () => {
    const field = { name: 'experience', label: { id: 'Pengalaman', en: 'Experience' }, type: 'text', required: true };
    registerExtension({ registrationFields: [field] });
    const db = await database();
    const env = { DB: db, DEMO_MODE: 'true' };
    let cookie = '';
    async function call(path, data, role = 'student') {
        const r = await handle(new Request(`https://school.test${path}`, { method: data ? 'POST' : 'GET', headers: { Cookie: cookie, 'X-School-Request': '1', 'X-Demo-Role': role, 'Content-Type': 'application/json' }, body: data && JSON.stringify(data) }), env);
        const set = r.headers.get('set-cookie'); if (set) cookie = set.split(';')[0];
        return { status: r.status, data: await r.json() };
    }
    try {
        const s = (await call('/api/bootstrap?preset=exam-prep&level=full')).data;
        assert.deepEqual(s.extensionRegistrationFields, ['experience']);
        assert.equal(s.registrationFields.find(f => f.name === 'experience').label.en, 'Experience');
        const answers = Object.fromEntries(s.registrationFields.filter(f => f.required).map(f => [f.name, f.type === 'checkbox' ? true : f.type === 'select' ? f.options[0] : 'Sample']));
        const key = crypto.randomUUID(), payload = { studentId: 'student-sinta', cohortId: s.cohorts[0].id, answers };
        const submit = await call('/api/command?preset=exam-prep&level=full', { action: 'application.submit', payload, key });
        assert.equal(submit.status, 200);
        assert.equal((await call('/api/command?preset=exam-prep&level=full', { action: 'application.submit', payload, key })).data.result, submit.data.result);
        const staff = (await call('/api/bootstrap?preset=exam-prep&level=full', undefined, 'admin')).data;
        assert.equal(staff.enrollments.find(e => e.id === submit.data.result).answers.experience, 'Sample');
        assert.equal(staff.registrationFields.find(f => f.name === 'experience').label.en, 'Experience');
        const conflict = await call('/api/command?preset=exam-prep&level=full', { action: 'fields.save', key: crypto.randomUUID(), payload: { fields: [field] } }, 'admin');
        assert.equal(conflict.status, 400);
        assert.throws(() => registerExtension({ registrationFields: [field] }));
    } finally { cms.registrationFields.length = 0; db.raw.close(); }
});
