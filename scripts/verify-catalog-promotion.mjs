import { readFile } from 'node:fs/promises';
import { checkCatalogPromotion, verifyGithubRelease } from './check-catalog-promotion.mjs';

const url = new URL('https://catalog.tampiloka.site/catalog.v1.json');
url.searchParams.set('check', `${Date.now()}-${process.env.GITHUB_RUN_ID ?? 'local'}`);
const response = await fetch(url, {
  cache: 'no-store', redirect: 'error', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000),
});
if (!response.ok) throw new Error(`Cannot read previous verified catalog: HTTP ${response.status}`);
const previous = await response.json();
const next = JSON.parse(await readFile('packages/registry/dist/catalog.v1.json', 'utf8'));
const request = async path => {
  const result = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(15000),
  });
  if (!result.ok) throw new Error(`GitHub release evidence unavailable: HTTP ${result.status}`);
  return result.json();
};
await checkCatalogPromotion(previous, next, (family, release, workflow) => verifyGithubRelease(family, release, workflow, request));
console.log('Catalog promotion evidence verified.');
