import test from 'node:test';
import assert from 'node:assert/strict';
import { readReleaseEvidence } from '../../../scripts/read-release-evidence.mjs';
import { releaseFingerprint, stampRelease, verifyHostedRelease, demoFamilies } from '../../../scripts/demo-release.mjs';
import { buildPublicCatalog } from '../src/public-catalog.mjs';
import { reconcileCatalogPromotion } from '../../../scripts/check-catalog-promotion.mjs';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
const registry = JSON.parse(await readFile(new URL('../templates.json', import.meta.url)));
const source = JSON.parse(await readFile(new URL('../public-demos.json', import.meta.url)));
const sha = 'a'.repeat(40), release = 'b'.repeat(40);
function dependencies(family, changes = {}) {
  return {
    request: async path => path.includes('/jobs?') ? { jobs: [{ name: `release (${family})`, conclusion: 'success' }] } : { workflow_runs: [{ id: 5, head_sha: sha, head_branch: 'main', event: 'push', status: 'completed' }] },
    download: async () => ({ family, commit: sha, release, runId: '5', assets: 'c'.repeat(64) }),
    fingerprint: () => release,
    hosted: async () => {},
    ...changes,
  };
}
test('all families require a successful hosted job and artifact bound to the deployed build', async () => {
  for (const family of demoFamilies) {
    assert.equal(await readReleaseEvidence(family, release, 'https://example.com', dependencies(family)), true);
    for (const changes of [
      { fingerprint: () => 'd'.repeat(40) },
      { download: async () => ({ family, commit: 'forged', release, runId: '5', assets: 'c'.repeat(64) }) },
      { hosted: async () => { throw Error('old hosted bytes'); } },
      { request: async path => path.includes('/jobs?') ? { jobs: [{ name: `release (${family})`, conclusion: 'failure' }] } : { workflow_runs: [{ id: 5, head_sha: sha, head_branch: 'main', event: 'push', status: 'completed' }] } },
    ]) assert.equal(await readReleaseEvidence(family, release, 'https://example.com', dependencies(family, changes)), false);
  }
});
test('unchanged URLs with a changed source identity stay on the previous catalog until hosted success', async () => {
  const previous = buildPublicCatalog(registry, source);
  for (const family of previous.families) family.release = sha;
  const next = structuredClone(previous);
  next.families.find(f => f.id === 'booking').release = release;
  next.entries.find(e => e.family === 'commerce').name.en = 'Independent copy edit';
  const failed = await reconcileCatalogPromotion(previous, next, async () => false);
  assert.equal(failed.catalog.families.find(f => f.id === 'booking').release, sha);
  assert.equal(failed.catalog.entries.find(e => e.family === 'commerce').name.en, 'Independent copy edit');
  const verified = await reconcileCatalogPromotion(previous, next, async () => true);
  assert.equal(verified.catalog.families.find(f => f.id === 'booking').release, release);
  assert.equal(verified.blocked.length, 0);
});
test('hosted identity must match the exact stamped artifact, not just an image URL', async () => {
  const marker = { family: 'school', release, commit: sha, assets: 'c'.repeat(64) };
  await verifyHostedRelease(marker, 'https://example.com', async () => Response.json(marker));
  await assert.rejects(verifyHostedRelease(marker, 'https://example.com', async () => Response.json({ ...marker, assets: 'd'.repeat(64) })));
});
test('fingerprints are stable source identities for every supported family', () => {
  const fingerprints = demoFamilies.map(family => releaseFingerprint(family));
  for (const value of fingerprints) assert.match(value, /^[a-f0-9]{40}$/);
  assert.equal(new Set(fingerprints).size, 4);
  assert.equal(releaseFingerprint('school'), releaseFingerprint('school'));
  assert.throws(() => releaseFingerprint('../private'));
});
test('stamped asset bytes change the hosted identity even when filenames stay the same', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'release-stamp-'));
  try {
    await writeFile(join(directory, 'index.html'), 'first build');
    const first = await stampRelease('school', directory);
    await writeFile(join(directory, 'index.html'), 'second build');
    const second = await stampRelease('school', directory);
    assert.equal(first.release, second.release);
    assert.notEqual(first.assets, second.assets);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'demo-release.json'), 'utf8')), second);
    await assert.rejects(verifyHostedRelease(first, 'https://example.com', async () => Response.json(second)));
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  }
});
