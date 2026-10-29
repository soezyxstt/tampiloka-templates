import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCommandAllowed, filterSnapshotByModules } from './capabilities.ts';

const run = (command: string, modules: string[], surface: 'customer' | 'staff' = 'customer', payload: Record<string, unknown> = {}) =>
  assertCommandAllowed(command, payload, { modules, surface, demo: true });

test('catalog-only API cannot quote or place an order', () => {
  for (const command of ['CREATE_QUOTE', 'SUBMIT_ORDER_REQUEST', 'RECORD_PAYMENT', 'ACCEPT_ORDER_REQUEST']) {
    assert.throws(() => run(command, ['catalog'], 'staff', { method: 'CASH' }));
  }
});

test('cashier-only can create a staff order and take cash without public ordering', () => {
  assert.doesNotThrow(() => run('CREATE_QUOTE', ['cashier'], 'staff', { manualDiscountIdr: 5000 }));
  assert.doesNotThrow(() => run('SUBMIT_ORDER_REQUEST', ['cashier'], 'staff'));
  assert.doesNotThrow(() => run('RECORD_PAYMENT', ['cashier'], 'staff', { method: 'CASH' }));
  assert.throws(() => run('CREATE_QUOTE', ['cashier']));
  assert.throws(() => run('RECORD_PAYMENT', ['cashier'], 'staff', { method: 'QRIS' }));
});

test('ordering package has an inbox and fulfillment without enabling cashier', () => {
  const modules = ['catalog', 'ordering'];
  assert.doesNotThrow(() => run('CREATE_QUOTE', modules));
  assert.doesNotThrow(() => run('ACCEPT_ORDER_REQUEST', modules, 'staff'));
  assert.throws(() => run('ACCEPT_ORDER_REQUEST', modules));
  assert.throws(() => run('RECORD_PAYMENT', modules, 'staff', { method: 'CASH' }));
  assert.doesNotThrow(() => run('TRANSITION_UNITS', modules, 'staff'));
  assert.doesNotThrow(() => run('RECORD_PAYMENT', modules, 'staff', { method: 'EXTERNAL_COUNTER' }));
  assert.throws(() => run('RECORD_PAYMENT', modules, 'customer', { method: 'EXTERNAL_COUNTER' }));
});

test('visit completion is available to small packages without exposing table management', () => {
  for (const modules of [['cashier'], ['catalog', 'ordering'], ['catalog', 'ordering', 'payments']]) {
    assert.doesNotThrow(() => run('TABLE_OR_VISIT_ACTION', modules, 'staff', { action: 'DEPART_VISIT' }));
    assert.throws(() => run('TABLE_OR_VISIT_ACTION', modules, 'customer', { action: 'DEPART_VISIT' }));
    for (const action of ['START_VISIT', 'MARK_CLEAN', 'ENABLE_TABLE', 'MOVE_TABLE']) {
      assert.throws(() => run('TABLE_OR_VISIT_ACTION', modules, 'staff', { action }));
    }
  }
  for (const modules of [['catalog'], ['catalog', 'ordering', 'payments'], ['cashier']]) {
    assert.throws(() => run('RECORD_PAYMENT', modules, 'staff', { method: 'EXTERNAL_COUNTER' }));
  }
});

test('customer cannot set a manual discount or directly mark a payment paid', () => {
  const modules = ['catalog', 'ordering', 'cashier', 'payments'];
  assert.throws(() => run('CREATE_QUOTE', modules, 'customer', { manualDiscountIdr: 5000 }));
  assert.throws(() => run('RECORD_PAYMENT', modules, 'customer', { method: 'QRIS' }));
  assert.doesNotThrow(() => run('RECORD_PAYMENT', modules, 'customer', { method: 'QRIS', createExternalAttemptOnly: true }));
});

test('disabled loyalty, promotion and floor plan actions reject direct requests', () => {
  const modules = ['catalog', 'ordering'];
  assert.throws(() => run('CREATE_QUOTE', modules, 'customer', { promoCode: 'HEMAT10' }));
  assert.throws(() => run('CREATE_QUOTE', modules, 'customer', { memberId: 'mem_any' }));
  assert.throws(() => run('FLOOR_PLAN_ACTION', modules, 'staff'));
  assert.throws(() => run('SETTINGS_PROMO_FEEDBACK_ACTION', modules, 'staff', { action: 'CREATE_PROMO' }));
});

test('a guest can check their own waitlist token without gaining staff table actions', () => {
  const modules = ['catalog', 'ordering', 'tables'];
  assert.doesNotThrow(() => run('WAITLIST_ACTION', modules, 'customer', { action: 'GET_STATUS', privateToken: 'own-token' }));
  for (const action of ['CALL', 'SEAT', 'SKIP', 'CANCEL', 'EXPIRE_HOLD']) assert.throws(() => run('WAITLIST_ACTION', modules, 'customer', { action }));
  assert.throws(() => run('SERVICE_REQUEST_ACTION', modules, 'customer', { action: 'GET_STATUS' }));
  assert.throws(() => run('WAITLIST_ACTION', ['catalog'], 'customer', { action: 'GET_STATUS' }));
});

test('demo settlement and reset are unavailable outside explicit demo mode', () => {
  for (const command of ['SETTLE_OR_CANCEL_ATTEMPT', 'RESET_DEMO_DATA']) {
    assert.throws(() => assertCommandAllowed(command, {}, { modules: ['payments'], surface: 'staff', demo: false }));
  }
});

test('snapshot filters preserve cashier catalog and QR context while hiding disabled modules', () => {
  const initial = { catalog: [1], categories: [1], tables: [1], orders: [1], bills: [1], paymentAccount: { isDemo: true }, members: [1], cashShifts: [1] };
  const menu = filterSnapshotByModules(initial, ['catalog']);
  assert.deepEqual(menu.catalog, [1]);
  assert.deepEqual(menu.tables, [1]);
  assert.deepEqual(menu.orders, []);
  assert.deepEqual(menu.members, []);
  assert.equal(menu.paymentAccount, null);
  const cashier = filterSnapshotByModules(initial, ['cashier']);
  assert.deepEqual(cashier.catalog, [1]);
  assert.deepEqual(cashier.bills, [1]);
  assert.deepEqual(cashier.cashShifts, [1]);
  assert.deepEqual(initial.orders, [1]);
});
