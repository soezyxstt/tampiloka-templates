import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from '../src/db/schema.ts';
import { BROWSER_SCHEMA_REVISION, BROWSER_SCHEMA_SQL } from '../src/demo-runtime/schema.generated.ts';

test('generated browser DDL exactly matches the current domain schema and applies without loss', async () => {
  const client = new PGlite();
  try {
    const migration = await pushSchema(schema, drizzle(client));
    assert.equal(migration.hasDataLoss, false);
    const current = migration.statementsToExecute.join('\n');
    assert.equal(BROWSER_SCHEMA_SQL, current, 'Run node --experimental-strip-types src/demo-runtime/generate-schema.mts after changing the domain schema.');
    assert.equal(BROWSER_SCHEMA_REVISION, createHash('sha256').update(current).digest('hex').slice(0, 16));
    await client.exec(BROWSER_SCHEMA_SQL);
    const tables = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map(row => row.table_name);
    for (const table of ['orders', 'bills', 'cash_shifts', 'payment_attempts', 'payment_receipts', 'idempotency_records']) assert.ok(tables.includes(table), table);
  } finally { await client.close(); }
});
