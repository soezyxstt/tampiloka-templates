import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localEnv } from '../scripts/local-env.mjs';

test('local Worker configuration uses client defaults and local overrides', () => {
  const dir = mkdtempSync(join(tmpdir(), 'commerce-env-'));
  try {
    const path = join(dir, '.dev.vars');
    const db = {};
    assert.equal(localEnv(db, {}, path).DEMO_MODE, 'false');
    writeFileSync(path, 'STAFF_OWNER_PASSWORD="local password"\nDEMO_MODE=true\nDB=ignored\n');
    const env = localEnv(db, { STAFF_OWNER_PASSWORD: 'shell', RESEND_API_KEY: 'email', UNRELATED: 'private' }, path);
    assert.equal(env.STAFF_OWNER_PASSWORD, 'local password');
    assert.equal(env.RESEND_API_KEY, 'email');
    assert.equal(env.DEMO_MODE, 'true');
    assert.equal(env.DB, db);
    assert.equal(env.UNRELATED, undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
