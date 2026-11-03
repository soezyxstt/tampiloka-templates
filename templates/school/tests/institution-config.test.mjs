import { test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../config/school.json' with { type: 'json' };
import { sanitizeInstitutionBrand, safeInstitutionAsset } from '../content/institution-brand.ts';
import { seed } from '../content/seed.ts';

test('institution brand accepts safe assets and rejects executable or malformed inputs', () => {
    assert.equal(safeInstitutionAsset('/images/school/logo.svg'), '/images/school/logo.svg');
    assert.equal(safeInstitutionAsset('/api/media/abc-123'), '/api/media/abc-123');
    assert.equal(safeInstitutionAsset('https://example.org/photo.webp'), 'https://example.org/photo.webp');
    for (const value of ['javascript:alert(1)', '//example.org/a', '/images/../secret', '/images/%2e%2e/secret', 'http://example.org/a', 'https://user:pass@example.org/a']) assert.equal(safeInstitutionAsset(value), '');
    const invalid = sanitizeInstitutionBrand({ name: 'Name\nInjected', email: 'bad@', logo: 'javascript:1', images: { activities: '/images/../x' } });
    assert.equal(invalid.name, '');
    assert.equal(invalid.email, '');
    assert.equal(invalid.logo, '');
    assert.equal(invalid.images.activities, '');
});

test('school brand overrides demo identity, contact and content assets without changing other presets', () => {
    const brand = sanitizeInstitutionBrand({ name: 'SMP Bintang Baru', address: 'Jalan Contoh 4', email: 'halo@sekolah.example', heroImage: '/images/school/hero.webp', images: { activities: '/images/school/activities.webp' } });
    const state = seed('institution', config, true, new Date('2026-11-03T00:00:00Z'), brand);
    assert.equal(state.institution.name, 'SMP Bintang Baru');
    assert.equal(state.institution.address, 'Jalan Contoh 4');
    assert.equal(state.branches[0].address, state.institution.address);
    assert.equal(state.institution.email, 'halo@sekolah.example');
    assert.equal(state.content.find(item => item.id === 'home').published.image, '/images/school/hero.webp');
    assert.equal(state.content.find(item => item.id === 'school-activities').published.image, '/images/school/activities.webp');
    assert.match(state.content.find(item => item.id === 'school-profile').published.blocks[0].body.id, /SMP Bintang Baru/);
    assert.equal(seed('language', config, true, new Date(), brand).institution.name, seed('language', config, true, new Date(), sanitizeInstitutionBrand({})).institution.name);
});

test('production institution has editable starter pages without fictional demo records', () => {
    const brand = sanitizeInstitutionBrand({ name: 'SMP Bintang Baru', address: 'Jalan Contoh 4', email: 'halo@sekolah.example' });
    const state = seed('institution', config, false, new Date(), brand);
    assert.equal(state.institution.name, 'SMP Bintang Baru');
    assert.equal(state.institution.email, 'halo@sekolah.example');
    assert.ok(state.institution.navigation.some(item => item.page === 'school-admissions'));
    assert.ok(state.content.some(item => item.id === 'school-profile' && item.published));
    assert.equal(state.tutors.length, 0);
    assert.equal(state.programs.length, 0);
    assert.equal(state.content.filter(item => item.collection === 'announcements').length, 0);
    assert.equal(state.content.find(item => item.id === 'home').published.title.id, 'SMP Bintang Baru');
    assert.deepEqual(state.content.find(item => item.id === 'home').published.blocks.map(block => block.id), ['welcome', 'journey', 'information', 'news', 'achievement', 'immersion', 'activities', 'invitation']);
    assert.equal(state.institution.description.id, '');
});
