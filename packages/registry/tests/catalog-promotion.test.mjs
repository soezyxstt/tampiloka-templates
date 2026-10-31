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
