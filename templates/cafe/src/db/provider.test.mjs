import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postgresConnectionConfig } from './provider.mjs';

test('uses DATABASE_URL for PostgreSQL and retains legacy connection settings', () => {
  assert.deepEqual(postgresConnectionConfig({ DATABASE_PROVIDER: 'postgresql', DATABASE_URL: 'postgres://example/db', SQL_HOST: 'ignored' }), { connectionString: 'postgres://example/db' });
  assert.equal(postgresConnectionConfig({ SQL_HOST: 'localhost' }).host, 'localhost');
});
test('rejects SQLite and unknown providers rather than connecting to PostgreSQL', () => {
  for (const provider of ['d1', 'turso', 'other']) {
    assert.throws(() => postgresConnectionConfig({ DATABASE_PROVIDER: provider }), /not implemented/);
  }
});
