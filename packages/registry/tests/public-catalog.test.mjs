import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPublicCatalog, validatePublicCatalog } from '../src/public-catalog.mjs';
import { createCatalogWorker } from '../src/catalog-worker.mjs';

const registry = JSON.parse(await readFile(new URL('../templates.json', import.meta.url), 'utf8'));
const source = JSON.parse(await readFile(new URL('../public-demos.json', import.meta.url), 'utf8'));
const updatedAt = '2026-10-30T00:00:00.000Z';
const build = (data = source, registered = registry) => buildPublicCatalog(registered, data, { updatedAt });
const copy = value => structuredClone(value);
const expectedCount = source.families.filter(family => family.visibility === 'public' && family.ready === true && registry.templates.some(template => template.id === family.template && template.status === 'available')).reduce((count, family) => count + family.entries.filter(entry => entry.visibility === 'public' && entry.ready === true).length, 0);

test('public catalog has every ready demo and complete independent commerce mode URLs', () => {
  const catalog = build();
  assert.equal(catalog.entries.length, expectedCount);
  assert.ok(catalog.families.some(item => item.id === 'commerce'));
  assert.ok(catalog.families.some(item => item.id === 'cafe'));
  assert.ok(catalog.entries.some(item => item.id === 'commerce-editorial' && item.featured));
  assert.ok(catalog.entries.some(item => item.id === 'cafe-full' && item.featured));
  const market = catalog.entries.find(item => item.id === 'commerce-market');
  for (const [mode, href] of Object.entries(market.modeUrls)) {
    const url = new URL(href);
    assert.equal(url.searchParams.get('preset'), 'market');
    assert.equal(url.searchParams.get('level'), mode);
  }
  assert.equal(catalog.entries.find(item => item.id === 'cafe-full').url, 'https://cafe-full.tampiloka.site/');
});

test('private, unlisted, prospect, unfinished and planned entries cannot enter the public feed', () => {
  for (const visibility of ['private', 'unlisted', 'prospect', undefined]) {
    const data = copy(source);
    data.families[0].entries[0].visibility = visibility;
    data.families[0].entries[0].internalNotes = 'secret project';
    assert.equal(build(data).entries.length, expectedCount - 1);
    assert.ok(!JSON.stringify(build(data)).includes('secret project'));
  }
  const data = copy(source);
  data.families[0].entries[0].ready = false;
  data.families[1].visibility = 'private';
  assert.equal(build(data).entries.length, expectedCount - source.families[1].entries.length - 1);
  const registered = copy(registry);
  registered.templates[0].status = 'planned';
  assert.equal(build(source, registered).entries.length, expectedCount - source.families[0].entries.length);
});

test('unknown presets, modes, duplicate IDs and invalid bilingual metadata fail publication', () => {
  const mutations = [
    data => { data.families[0].entries[0].preset = 'missing'; },
    data => { data.families[0].modes[0].id = 'enterprise'; },
    data => { data.families[0].entries[1].id = data.families[0].entries[0].id; },
    data => { data.families[0].entries[0].name.en = ''; },
    data => { data.families[0].entries[0].imageUrl = 'javascript:alert(1)'; },
    data => { data.families[0].entries[0].imageUrl = 'https://user:password@example.com/image.webp'; },
  ];
  for (const mutate of mutations) {
    const data = copy(source);
    mutate(data);
    assert.throws(() => build(data), /Public catalog:/);
  }
  const catalog = build();
  catalog.entries[0].visibility = 'private';
  assert.throws(() => validatePublicCatalog(catalog), /non-public/);
});

test('a new available family is generated through metadata without changing producer code', () => {
  const data = copy(source);
  const registered = copy(registry);
  registered.templates.push({ id: 'new-family', status: 'available', presets: { studio: { url: 'https://booking.example.com/?keep=1#schedule' } } });
  data.families.push({
    id: 'new-family', template: 'new-family', visibility: 'public', ready: true,
    name: { id: 'Jadwal', en: 'Booking' }, route: { base: 'preset' }, entries: [{
      id: 'new-family-studio', preset: 'studio', visibility: 'public', ready: true,
      name: { id: 'Studio', en: 'Studio' }, description: { id: 'Pilih jadwal studio.', en: 'Choose a studio time.' },
      imageUrl: 'https://booking.example.com/preview.webp',
    }],
  });
  const catalog = build(data, registered);
  assert.equal(catalog.entries.length, expectedCount + 1);
  assert.equal(catalog.families.at(-1).id, 'new-family');
  assert.equal(catalog.entries.at(-1).url, 'https://booking.example.com/?keep=1#schedule');
});

test('published Worker serves JSON, conditional requests, CORS and method boundaries', async () => {
  const body = JSON.stringify(build());
  const worker = createCatalogWorker(body, '"revision-a"');
  const response = await worker.fetch(new Request('https://catalog.example.com/catalog.v1.json'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).entries.length, expectedCount);
  assert.match(response.headers.get('cache-control'), /max-age=60/);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  const unchanged = await worker.fetch(new Request('https://catalog.example.com/catalog.v1.json', { headers: { 'If-None-Match': '"old", W/"revision-a"' } }));
  assert.equal(unchanged.status, 304);
  assert.equal(await unchanged.text(), '');
  const head = await worker.fetch(new Request('https://catalog.example.com/catalog.v1.json', { method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal((await worker.fetch(new Request('https://catalog.example.com/catalog.v1.json', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await worker.fetch(new Request('https://catalog.example.com/catalog.v1.json', { method: 'POST' }))).status, 405);
  assert.equal((await worker.fetch(new Request('https://catalog.example.com/missing'))).status, 404);
});
