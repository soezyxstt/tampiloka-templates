import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPublicCatalog } from '../src/public-catalog.mjs';
import { checkCatalogPromotion, reconcileCatalogPromotion } from '../../../scripts/check-catalog-promotion.mjs';

const registry = JSON.parse(await readFile(new URL('../templates.json', import.meta.url)));
const source = JSON.parse(await readFile(new URL('../public-demos.json', import.meta.url)));
const previous = buildPublicCatalog(registry, source);
const sha = 'a'.repeat(40);
const promote = () => {
  const next = structuredClone(previous);
  next.families.find(f => f.id === 'school').release = sha;
  next.entries.push({ ...structuredClone(next.entries.find(e => e.family === 'school')), id: 'school-new' });
  return next;
};

test('failed or missing hosted smoke blocks promotion and leaves previous catalog intact', async () => {
  const before = JSON.stringify(previous);
  await assert.rejects(checkCatalogPromotion(previous, promote(), async () => false), /verification failed/);
  const missing = promote();
  delete missing.families.find(f => f.id === 'school').release;
  await assert.rejects(checkCatalogPromotion(previous, missing, async () => true), /No supported hosted release/);
  assert.equal(JSON.stringify(previous), before);
});

test('verified exact release permits promotion; copy and unrelated changes need no release check', async () => {
  const next = promote();
  const calls = [];
  await checkCatalogPromotion(previous, next, async (...args) => { calls.push(args); return true; });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['school', sha, { workflow: 'release-demos.yml', job: 'release (school)' }]);
  const copy = structuredClone(next);
  copy.entries.find(e => e.family === 'school').name.en = 'Updated copy';
  copy.entries.find(e => e.family === 'cafe').description.en = 'Updated copy';
  await checkCatalogPromotion(next, copy, () => { throw Error('unexpected release check'); });
  copy.entries.find(e => e.family === 'cafe').url = 'https://example.com/';
  await assert.rejects(checkCatalogPromotion(next, copy, async () => false), /No supported hosted release|verification failed/);
});

test('source release is retained in the public catalog and invalid revisions are rejected', () => {
  const data = structuredClone(source);
  data.families.find(f => f.id === 'school').release = sha;
  assert.equal(buildPublicCatalog(registry, data).families.find(f => f.id === 'school').release, sha);
  data.families.find(f => f.id === 'school').release = 'main';
  assert.throws(() => buildPublicCatalog(registry, data), /invalid release/);
});


test('failed or unavailable evidence retains only the affected family while unrelated copy publishes', async () => {
  const next = promote();
  next.entries.find(e => e.family === 'cafe').description.en = 'Independent copy';
  for (const verify of [async () => false, async () => { throw Error('API unavailable'); }]) {
    const { catalog, blocked } = await reconcileCatalogPromotion(previous, next, verify);
    assert.deepEqual(catalog.entries.filter(e => e.family === 'school'), previous.entries.filter(e => e.family === 'school'));
    assert.deepEqual(catalog.families.find(f => f.id === 'school'), previous.families.find(f => f.id === 'school'));
    assert.equal(catalog.entries.find(e => e.family === 'cafe').description.en, 'Independent copy');
    assert.equal(blocked[0].family, 'school');
  }
});

test('successful evidence publishes the proposed family without suppressing other changes', async () => {
  const next = promote();
  next.entries.find(e => e.family === 'cafe').description.en = 'Independent copy';
  const { catalog, blocked } = await reconcileCatalogPromotion(previous, next, async () => true);
  assert.deepEqual(blocked, []);
  assert.deepEqual(catalog.families, next.families);
  assert.deepEqual([...catalog.entries].sort((a, b) => a.id.localeCompare(b.id)), [...next.entries].sort((a, b) => a.id.localeCompare(b.id)));
});


test('blocked promotion does not restore entries explicitly removed from publication', async () => {
  const next = promote();
  const removed = next.entries.find(e => e.family === 'school');
  next.entries = next.entries.filter(e => e.id !== removed.id);
  const { catalog } = await reconcileCatalogPromotion(previous, next, async () => false);
  assert.equal(catalog.entries.some(e => e.id === removed.id), false);
});

test('failed release retains verified routes while publishing copy edits in the same family', async () => {
  const next = promote();
  const family = next.families.find(f => f.id === 'school');
  family.name.en = 'Corrected School name';
  family.description.en = 'Corrected family description';
  family.modes[0].name.en = 'Corrected mode label';
  const entry = next.entries.find(e => e.family === 'school');
  const old = previous.entries.find(e => e.id === entry.id);
  entry.name.en = 'Corrected entry name';
  entry.description.en = 'Corrected entry description';
  entry.featured = !old.featured;
  entry.url = 'https://unverified.example.com/';
  entry.imageUrl = 'https://unverified.example.com/image.webp';
  entry.modeUrls = Object.fromEntries(Object.keys(entry.modeUrls).map(id => [id, `https://unverified.example.com/?level=${id}`]));
  const { catalog, blocked } = await reconcileCatalogPromotion(previous, next, async () => false);
  const published = catalog.entries.find(e => e.id === entry.id);
  assert.equal(published.name.en, entry.name.en);
  assert.equal(published.description.en, entry.description.en);
  assert.equal(published.featured, entry.featured);
  assert.equal(published.url, old.url);
  assert.equal(published.imageUrl, old.imageUrl);
  assert.deepEqual(published.modeUrls, old.modeUrls);
  const publishedFamily = catalog.families.find(f => f.id === 'school');
  assert.equal(publishedFamily.name.en, family.name.en);
  assert.equal(publishedFamily.description.en, family.description.en);
  assert.equal(publishedFamily.modes[0].name.en, family.modes[0].name.en);
  assert.equal(publishedFamily.release, previous.families.find(f => f.id === 'school').release);
  assert.equal(catalog.entries.some(e => e.id === 'school-new'), false);
  assert.equal(blocked.length, 1);
});
