import assert from 'node:assert/strict';
import { verifyHostedRelease } from './demo-release.mjs';

export async function readReleaseEvidence(family, release, origin, { request, download, fingerprint, hosted = verifyHostedRelease }) {
  const runs = await request('/actions/workflows/release-demos.yml/runs?branch=main&per_page=50');
  for (const run of runs.workflow_runs ?? []) {
    if (run.head_branch !== 'main' || !['push', 'workflow_dispatch'].includes(run.event) || run.status !== 'completed') continue;
    if (!/^[a-f0-9]{40}$/.test(run.head_sha)) continue;
    if (fingerprint(family, run.head_sha) !== release) continue;
    const jobs = await request(`/actions/runs/${run.id}/jobs?per_page=100`);
    if (!jobs.jobs?.some(job => job.name === `release (${family})` && job.conclusion === 'success')) continue;
    try {
      const evidence = await download(run.id, family);
      assert.equal(evidence.family, family);
      assert.equal(evidence.release, release);
      assert.equal(evidence.commit, run.head_sha);
      assert.equal(evidence.runId, String(run.id));
      assert.match(evidence.assets, /^[a-f0-9]{64}$/);
      const { runId, ...marker } = evidence;
      await hosted(marker, origin);
      return true;
    } catch {
      // Expired artifacts and a newer/overwritten deployment cannot certify this release.
    }
  }
  return false;
}
