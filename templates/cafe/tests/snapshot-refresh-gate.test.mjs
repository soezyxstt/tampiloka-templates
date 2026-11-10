import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshotRefreshGate } from '../lib/snapshot-refresh-gate.ts';

test('a mounted listener catches a commit between initial snapshot and subscription', () => {
  const events = new EventTarget();
  let stored = 'initial';
  let visible = stored;
  stored = 'new customer order';
  events.dispatchEvent(new Event('change')); // No subscriber yet.
  const gate = createSnapshotRefreshGate(() => false, () => { visible = stored; });
  events.addEventListener('change', gate.changed);
  gate.changed(); // The workspace revalidates immediately after subscribing.
  assert.equal(visible, 'new customer order');
  stored = 'accepted';
  events.dispatchEvent(new Event('change'));
  assert.equal(visible, 'accepted');
});

test('peer changes during a command refresh after its response, including a failed command', () => {
  let pending = false;
  let database = 'initial';
  let visible = database;
  let refreshes = 0;
  const gate = createSnapshotRefreshGate(() => pending, () => { visible = database; refreshes++; });
  pending = true;
  database = 'peer order';
  gate.changed();
  gate.changed();
  gate.flush();
  assert.equal(refreshes, 0);
  visible = 'older command response';
  pending = false;
  gate.flush();
  assert.equal(visible, 'peer order');
  assert.equal(refreshes, 1, 'coalesce changes while a command is in flight');
  gate.flush();
  assert.equal(refreshes, 1);
  pending = true;
  database = 'another order';
  gate.changed();
  pending = false; // The caller clears pending in finally even after rejection.
  gate.flush();
  assert.equal(visible, 'another order');
  gate.changed();
  assert.equal(refreshes, 3, 'an idle listener refreshes immediately');
});
