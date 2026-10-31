import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { buildPublicCatalog } from '../packages/registry/src/public-catalog.mjs';
const [family, directory] = process.argv.slice(2);
const registry = JSON.parse(await readFile('packages/registry/templates.json', 'utf8'));
const source = JSON.parse(await readFile('packages/registry/public-demos.json', 'utf8'));
const catalog = buildPublicCatalog(registry, source);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const entry of catalog.entries.filter(entry => entry.family === family)) {
  const url = new URL(entry.imageUrl);
  const expected = await readFile(join(directory, decodeURIComponent(url.pathname)));
  url.searchParams.set('verify', process.env.GITHUB_SHA ?? Date.now());
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^image\//);
  assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(expected), `Stale preview: ${entry.id}`);
}
