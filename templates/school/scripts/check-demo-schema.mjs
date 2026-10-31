import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// This exact migration was applied and read back through the authenticated
// Cloudflare connection on 2026-10-31. The repository token can deploy Workers
// but cannot query D1. Never silently deploy a new, unapplied migration.
const expected = new Map([['0001_school.sql', '42d6a604b69360a306a6a0b9865403cff42f0c5f480de83ba970d5cd86eddbbc']]);
const directory = new URL('../migrations/', import.meta.url);
const files = (await readdir(directory)).filter(file => file.endsWith('.sql')).sort();
assert.deepEqual(files, [...expected.keys()], 'Apply new demo migrations with a D1-authorized connection before updating this release record.');
for (const file of files) {
  const digest = createHash('sha256').update(await readFile(new URL(file, directory))).digest('hex');
  assert.equal(digest, expected.get(file), `${file} differs from the provisioned demo schema`);
}
console.log('Verified exact pre-applied demo migration. Remote API checks will validate the actual database.');
