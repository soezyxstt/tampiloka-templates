import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { eq } from 'drizzle-orm';
import { createD1StateDatabase, materializeCafeState, encodeCafeState, D1_STATE_SCHEMA } from './d1-state.ts';
import { outlets, stockPools } from './schema.ts';

// Frozen names from the version-1 schema before attendance was introduced.
const legacyNames = `users tenants outlets staff_outlet_roles staff_session_assurances customer_memberships wifi_networks payment_accounts rooms layout_versions tables visits table_assignments seating_groups guest_sessions visit_participants presence_checks join_codes waitlist_entries stations menu_categories stock_pools menu_items menu_variants modifier_groups modifier_options stock_movements quotes order_requests orders order_lines order_item_units bills bill_unit_allocations payment_attempts payment_receipts financial_adjustments refunds reconciliation_cases promotion_rules reward_entitlements loyalty_qualifications service_requests feedback_entries cash_shifts cash_movements import_batches audit_events idempotency_records outbox_events`.split(' ');

test('version-1 business snapshot migrates on write without losing records or CAS protection', async () => {
  const local = await materializeCafeState();
  await local.db.insert(outlets).values({ id: 'o', tenantId: 't', slug: 's', name: 'Original', address: 'A' });
  await local.db.insert(stockPools).values({ id: 'p', tenantId: 't', outletId: 'o', code: 'beans', name: 'Beans', onHand: 10 });
  const current = local.exportState();
  const legacy = JSON.parse(JSON.stringify(Object.fromEntries(legacyNames.map(name => [name, current[name]]))));
  local.sql.close();
  const remote = new DatabaseSync(':memory:');
  remote.exec(D1_STATE_SCHEMA);
  const original = encodeCafeState(legacy);
  remote.prepare('INSERT INTO cafe_state VALUES (?, 1, 4, ?)').run('o', original);
  let conflict = true;
  const d1 = { prepare(query) { return { bind(...args) { return {
    async first() { return remote.prepare(query).get(...args); },
    async run() {
      if (conflict) { conflict = false; remote.prepare('UPDATE cafe_state SET revision = revision + 1').run(); }
      return { meta: { changes: Number(remote.prepare(query).run(...args).changes) } };
    },
  }; } }; } };
  const db = createD1StateDatabase(async () => d1, 'o');
  assert.equal((await db.select().from(outlets))[0].name, 'Original');
  assert.equal(remote.prepare('SELECT state_json FROM cafe_state').get().state_json, original);
  let attempts = 0;
  await db.transaction(async tx => { attempts++; await tx.update(stockPools).set({ onHand: 8 }).where(eq(stockPools.id, 'p')); });
  assert.equal(attempts, 2);
  const saved = JSON.parse(remote.prepare('SELECT state_json FROM cafe_state').get().state_json);
  assert.deepEqual(saved.outlets, legacy.outlets);
  assert.equal(saved.stock_pools[0].on_hand, 8);
  for (const name of legacyNames.filter(name => name !== 'stock_pools')) assert.deepEqual(saved[name], legacy[name]);
  assert.deepEqual(saved.attendance_events, []);
  assert.equal((await db.select().from(stockPools))[0].onHand, 8);
  const roundtrip = await materializeCafeState(saved);
  assert.deepEqual(JSON.parse(encodeCafeState(roundtrip.exportState())), saved);
  roundtrip.sql.close();
  remote.close();
});

test('version-1 migration rejects unknown, missing and malformed table sets', async () => {
  const local = await materializeCafeState();
  local.sql.prepare(`INSERT INTO attendance_events (id, tenant_id, outlet_id, staff_id, kind, occurred_at, sequence, business_date, shift_id, latitude, longitude, accuracy_meters, evidence_key, idempotency_key, request_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('e', 't', 'o', 's', 'IN', '2026-11-11T00:00:00Z', 1, '2026-11-11', 'shift', 0, 0, 10, 'private', 'key', 'hash');
  const current = local.exportState();
  local.sql.close();
  const legacy = JSON.parse(JSON.stringify(Object.fromEntries(legacyNames.map(name => [name, current[name]]))));
  const missing = { ...legacy }; delete missing.orders;
  const partial = { ...legacy, attendance_events: [] };
  const unknown = { ...legacy, surprise: [] };
  const malformed = { ...legacy, orders: {} };
  const currentMissing = { ...current }; delete currentMissing.orders;
  for (const state of [null, [], missing, partial, unknown, malformed, currentMissing]) {
    await assert.rejects(materializeCafeState(state), /Invalid Cafe D1 state tables/);
  }
  const unchanged = await materializeCafeState(current);
  assert.deepEqual(JSON.parse(encodeCafeState(unchanged.exportState())), JSON.parse(encodeCafeState(current)));
  unchanged.sql.close();
});
