import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { parseSQLiteMigration } from '../scripts/sqlite-migrations.mjs';

test('the Turso migration parser executes every checked-in SQLite migration including both trigger forms', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    const root = new URL('../migrations/', import.meta.url);
    for (const file of (await readdir(root)).filter(name => name.endsWith('.sql')).sort()) {
      for (const statement of parseSQLiteMigration(await readFile(new URL(file, root), 'utf8'), file)) db.exec(statement);
    }
    const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name").all().map(row => row.name);
    assert.deepEqual(triggers, ['booking_state_guard', 'release_booking_slots']);
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='media_objects'").get());
    assert.throws(() => parseSQLiteMigration('CREATE TABLE incomplete (id TEXT)', 'broken.sql'), /broken.sql/);
  } finally { db.close(); }
});
