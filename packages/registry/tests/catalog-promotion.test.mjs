import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildPublicCatalog } from '../src/public-catalog.mjs';
import { checkCatalogPromotion, verifyGithubRelease } from '../../../scripts/check-catalog-promotion.mjs';

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
  assert.deepEqual(calls[0], ['school', sha, { workflow: 'school.yml', job: 'deploy-demo' }]);
  const copy = structuredClone(next);
  copy.entries.find(e => e.family === 'school').name.en = 'Updated copy';
  copy.entries.find(e => e.family === 'cafe').description.en = 'Updated copy';
  await checkCatalogPromotion(next, copy, () => { throw Error('unexpected release check'); });
  copy.entries.find(e => e.family === 'cafe').url = 'https://example.com/';
  await assert.rejects(checkCatalogPromotion(next, copy, async () => true), /No supported hosted release/);
});

test('GitHub evidence requires the latest main push, exact revision and successful hosted job', async () => {
  const run = { id: 1, head_sha: sha, status: 'completed', conclusion: 'success' };
  const job = { name: 'deploy-demo', status: 'completed', conclusion: 'success' };
  const verify = (r, j) => verifyGithubRelease('school', sha, { workflow: 'school.yml', job: 'deploy-demo' }, async path => path.includes('/jobs?') ? { jobs: [j] } : { workflow_runs: [r] });
  assert.equal(await verify(run, job), true);
  for (const patch of [{ head_sha: 'b'.repeat(40) }, { conclusion: 'failure' }, { status: 'in_progress' }]) assert.equal(await verify({ ...run, ...patch }, job), false);
  assert.equal(await verify(run, { ...job, conclusion: 'failure' }), false);
  assert.equal(await verify(run, { ...job, name: 'school' }), false);
});


test('source release is retained in the public catalog and invalid revisions are rejected', () => {
  const data = structuredClone(source);
  data.families.find(f => f.id === 'school').release = sha;
  assert.equal(buildPublicCatalog(registry, data).families.find(f => f.id === 'school').release, sha);
  data.families.find(f => f.id === 'school').release = 'main';
  assert.throws(() => buildPublicCatalog(registry, data), /invalid release/);
});
