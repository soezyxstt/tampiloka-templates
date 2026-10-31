import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPublicCatalog } from '../src/public-catalog.mjs';
const registry = JSON.parse(await readFile(new URL('../templates.json', import.meta.url), 'utf8'));
const source = JSON.parse(await readFile(new URL('../public-demos.json', import.meta.url), 'utf8'));
const presets = JSON.parse(await readFile(new URL('../../../templates/school/content/presets.json', import.meta.url), 'utf8'));
const build = (s = source) => buildPublicCatalog(registry, s);
const expected = [
  ['academic-editorial', 'exam-prep', 'cobalt', 'editorial'],
  ['course-discovery', 'language', 'forest', 'modern'],
  ['contemporary-learning', 'skills', 'neutral', 'editorial'],
  ['institutional', 'institution', 'burgundy', 'modern'],
];
test('school catalog names, appearance, preview files and every mode URL match the verified demos', () => {
  const catalog = build();
  const family = catalog.families.find(f => f.id === 'school');
  assert.equal(family.defaultMode, 'full');
  assert.deepEqual(family.modes.map(m => m.id), ['profile', 'whatsapp', 'enrollment', 'full']);
  assert.equal(catalog.entries.filter(e => e.family === 'school').length, 4);
  for (const [layout, preset, theme, typography] of expected) {
    const e = catalog.entries.find(e => e.id === `school-${layout}`);
    assert.equal(e.name.id, presets[preset].name);
    assert.equal(e.name.en, presets[preset].name);
    assert.equal(e.imageUrl, `https://school.tampiloka.site/previews/${layout}-preview.jpg`);
    for (const [level, href] of Object.entries({ full: e.url, ...e.modeUrls })) {
      const u = new URL(href);
      assert.equal(u.origin, 'https://school.tampiloka.site');
      for (const [key, value] of Object.entries({ layout, preset, theme, typography, level, view: 'visitor', lang: 'en' }))
        assert.equal(u.searchParams.get(key), value, `${e.id}/${level}/${key}`);
    }
  }
});
test('school readiness and visibility gates still exclude unpublished family or entries', () => {
  for (const patch of [{ visibility: 'private' }, { visibility: 'unlisted' }, { ready: false }]) {
    const copy = structuredClone(source);
    Object.assign(copy.families.find(f => f.id === 'school'), patch);
    assert.equal(build(copy).entries.some(e => e.family === 'school'), false);
    assert.equal(build(copy).families.some(e => e.id === 'school'), false);
  }
  for (const patch of [{ visibility: 'private' }, { ready: false }]) {
    const copy = structuredClone(source);
    Object.assign(copy.families.find(f => f.id === 'school').entries[0], patch);
    assert.equal(build(copy).entries.filter(e => e.family === 'school').length, 3);
  }
});
