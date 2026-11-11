import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export const demoFamilies = ['cafe', 'commerce', 'school', 'booking'];
export function releaseFingerprint(family, revision = 'HEAD', cwd = fileURLToPath(new URL('../', import.meta.url))) {
  assert.ok(demoFamilies.includes(family), 'Unknown demo family');
  assert.ok(revision === 'HEAD' || /^[a-f0-9]{40}$/.test(revision), 'Invalid source revision');
  // Include every shared runtime input, but leave registry copy and CLI changes independent.
  const tree = execFileSync('git', ['ls-tree', '-r', revision, '--', `templates/${family}`, 'packages/ui-core', 'packages/theme-engine', 'packages/shared-utils', 'packages/storage', 'packages/config', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json', 'scripts/demo-release.mjs', '.github/workflows/release-demos.yml'], { cwd });
  assert.ok(tree.length, 'Missing release source');
  return createHash('sha1').update(tree).digest('hex');
}
export async function stampRelease(family, directory) {
  const digest = createHash('sha256');
  async function visit(path) {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.name !== 'demo-release.json') digest.update(relative(directory, file)).update(await readFile(file));
    }
  }
  await visit(directory);
  const marker = { family, release: releaseFingerprint(family), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), assets: digest.digest('hex') };
  await writeFile(join(directory, 'demo-release.json'), JSON.stringify(marker));
  return marker;
}
export async function verifyHostedRelease(expected, origin, fetcher = fetch) {
  const response = await fetcher(new URL(`/demo-release.json?release=${expected.release}`, origin), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, 'Hosted release identity is missing');
  assert.deepEqual(await response.json(), expected, 'Hosted build differs from the tested deployment');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, family, directory, origin] = process.argv.slice(2);
  assert.ok(demoFamilies.includes(family), 'Unknown demo family');
  if (mode === 'stamp') await stampRelease(family, directory);
  else if (mode === 'verify') {
    const marker = JSON.parse(await readFile(join(directory, 'demo-release.json'), 'utf8'));
    assert.equal(marker.release, releaseFingerprint(family));
    await verifyHostedRelease(marker, origin);
    await writeFile(`demo-release-${family}.json`, JSON.stringify({ ...marker, runId: process.env.GITHUB_RUN_ID }));
  } else throw Error('Expected stamp or verify');
}
