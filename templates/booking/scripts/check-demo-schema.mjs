import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// The production migration ledger was read through Cloudflare on 2026-11-01.
// Update this record only after provisioning and verifying the remote schema.
const expected = new Map([['0001_booking.sql', '878ad343ea2cc9aa95b2203037abbef20dc07349e8336ea81b3d2257c502e884']]);
const dir = new URL('../migrations/', import.meta.url);
const files = (await readdir(dir)).filter(file => file.endsWith('.sql')).sort();
assert.deepEqual(files, [...expected.keys()], 'Provision and verify Booking demo migrations before release.');
for (const file of files) {
  const content = (await readFile(new URL(file, dir), 'utf8')).replace(/\r\n/g, '\n');
  const hash = createHash('sha256').update(content).digest('hex');
  assert.equal(hash, expected.get(file), `${file} changed; verify the remote schema before release.`);
}
console.log('Booking migration release record matches. Hosted flows must still verify the actual database.');
