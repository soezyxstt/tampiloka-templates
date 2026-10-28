#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve, join } from 'node:path';
import { mkdir, lstat, writeFile } from 'node:fs/promises';
import { publicCatalogFromSnapshot } from '../src/catalog/export.ts';

async function main() {
  const { values } = parseArgs({
    strict: true, allowPositionals: false,
    options: {
      url: { type: 'string', default: 'http://127.0.0.1:3000' },
      out: { type: 'string', default: 'content' },
      sample: { type: 'string', default: 'true' },
      overwrite: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Export the public menu from a running local cafe demo.\n\nnode --experimental-strip-types scripts/export-catalog.mjs [--url http://127.0.0.1:3000] [--out content] [--sample true|false] [--dry-run] [--overwrite]\n\nOnly GET requests are sent. Existing files require --overwrite. Set --sample false only after replacing and checking the sample menu.');
    return;
  }
  if (!['true', 'false'].includes(values.sample)) throw new Error('--sample must be true or false.');
  const origin = new URL(values.url);
  if (!['http:', 'https:'].includes(origin.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    throw new Error('--url must be a local server origin, such as http://127.0.0.1:3000, without credentials, path or query.');
  }
  const endpoint = new URL('/api/v1/snapshot?surface=customer', origin);
  const response = await fetch(endpoint, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}). Start the local demo first.`);
  const text = await response.text();
  if (text.length > 10_000_000) throw new Error('Catalog response exceeds the 10 MB limit.');
  const payload = JSON.parse(text);
  const { menu, tables } = publicCatalogFromSnapshot(payload.data, values.sample === 'true');
  const outDir = resolve(values.out);
  const files = [{ name: 'menu.json', content: menu }, { name: 'tables.json', content: tables }];
  for (const file of files) {
    const existing = await lstat(join(outDir, file.name)).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (existing?.isSymbolicLink() || (existing && !existing.isFile())) throw new Error(`Refusing to replace non-file ${file.name}.`);
    if (existing && !values.overwrite && !values['dry-run']) throw new Error(`${join(outDir, file.name)} already exists. Use --overwrite after reviewing --dry-run.`);
  }
  const existingDir = await lstat(outDir).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
  if (existingDir?.isSymbolicLink() || (existingDir && !existingDir.isDirectory())) throw new Error('Output must be a real directory.');
  console.log(`${values['dry-run'] ? 'Would export' : 'Exporting'} ${menu.items.length} menu items and ${tables.tables.length} QR tables. sample=${menu.sample}.`);
  if (values['dry-run']) {
    for (const file of files) console.log(join(outDir, file.name));
    return;
  }
  await mkdir(outDir, { recursive: true });
  for (const file of files) {
    await writeFile(join(outDir, file.name), `${JSON.stringify(file.content, null, 2)}\n`, { flag: values.overwrite ? 'w' : 'wx' });
    console.log(join(outDir, file.name));
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
