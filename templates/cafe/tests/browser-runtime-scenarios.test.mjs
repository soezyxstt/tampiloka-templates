import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEMO_SCENARIOS, availableDemoScenarios } from '../src/demo-runtime/scenario-catalog.ts';
import { BROWSER_SCHEMA_SQL } from '../src/demo-runtime/schema.generated.ts';
import { PRESETS } from '../src/config/catalog.mjs';

test('fixture choices respect the modules of every preset', () => {
  assert.equal(new Set(DEMO_SCENARIOS.map(scenario => scenario.id)).size, DEMO_SCENARIOS.length);
  for (const preset of Object.values(PRESETS)) {
    const available = availableDemoScenarios(preset.modules);
    assert.equal(available[0].id, 'empty');
    for (const scenario of available) assert.ok(scenario.requires.every(module => preset.modules.includes(module)));
  }
  assert.equal(availableDemoScenarios(PRESETS.full.modules).length, 14);
  assert.equal(availableDemoScenarios(PRESETS['order-at-cashier'].modules).length, 1);
});

test('every mock scenario creates its documented independent operational and financial state', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'cafe-scenario-tests-'));
  const dataDir = join(directory, 'database');
  await mkdir(dataDir);
  process.env.CAFE_DEMO_DB = '1';
  process.env.CAFE_DEMO_EMPTY = '1';
  process.env.CAFE_DEMO_DATA_DIR = dataDir;
  const { PGlite } = await import('@electric-sql/pglite');
  const setup = new PGlite(dataDir);
  await setup.exec(BROWSER_SCHEMA_SQL);
  await setup.close();
  const { loadDemoScenario } = await import('../src/demo-runtime/scenarios.ts');
  const { executeBrowserCommand, getBrowserSnapshot } = await import('../src/demo-runtime/worker-service.ts');
  const { getFullApplicationSnapshot } = await import('../src/db/service.ts');
  try {
    for (const scenario of DEMO_SCENARIOS) await t.test(scenario.id, async () => {
      const result = await loadDemoScenario(scenario.id);
      const state = await getFullApplicationSnapshot();
      assert.equal(result.scenarioId, scenario.id);
      assert.equal(state.cashShifts.filter(shift => shift.state === 'OPEN').length, 1);
      const visit = state.visits.find(visit => visit.id === result.visitId);
      const bills = state.bills.filter(bill => result.billIds.includes(bill.id));
      const units = state.orderUnits.filter(unit => result.unitIds.includes(unit.id));
      assert.equal(state.orders.length, result.orderIds.length, 'Old scenario orders must not survive a reload.');
      assert.equal(state.bills.length, bills.length, 'Old scenario bills must not survive a reload.');
      if (scenario.id === 'empty') {
        assert.equal(state.visits.length, 0);
        assert.ok(state.tables.every(table => table.physicalState === 'AVAILABLE'));
      } else if (scenario.id === 'waitlist') {
        assert.equal(state.waitlistEntries.length, 2);
        assert.equal(state.waitlistEntries.filter(entry => entry.status === 'CALLED' && entry.heldTableId === 'tbl_m06').length, 1);
        assert.equal(state.visits.length, 0);
      } else {
        assert.ok(visit);
        assert.equal(visit.status, scenario.id === 'dirty-table' ? 'CLOSED' : 'OPEN');
        assert.equal(visit.mode, scenario.id === 'takeaway-ready' ? 'TAKEAWAY' : 'DINE_IN');
        assert.equal(visit.lifecycleSummary.canDepart, ['walk-in', 'rejected-request', 'ready-to-depart', 'dirty-table'].includes(scenario.id));
      }
      if (scenario.id === 'pending-request') assert.equal(visit.lifecycleSummary.pendingRequestCount, 1);
      if (scenario.id === 'rejected-request') assert.equal(state.orderRequests[0].state, 'REJECTED');
      if (scenario.id === 'partial-payment') {
        assert.equal(bills[0].balanceIdr, 31580);
        assert.equal(bills[0].paymentState, 'PARTIALLY_PAID');
        assert.equal(bills[0].receipts.length, 1);
      }
      if (scenario.id === 'payment-pending') {
        assert.equal(visit.lifecycleSummary.pendingPaymentCount, 1);
        assert.equal(bills[0].receipts.length, 0);
        assert.equal(bills[0].balanceIdr, 41580);
      }
      if (['prepay-unpaid', 'partial-payment', 'payment-pending'].includes(scenario.id)) assert.ok(units.every(unit => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT'));
      if (scenario.id === 'kitchen-pending') {
        assert.equal(bills[0].balanceIdr, 0);
        assert.ok(units.every(unit => unit.fulfillmentStatus === 'PREPARING'));
      }
      if (scenario.id === 'paylater-served') {
        assert.equal(bills[0].balanceIdr, 41580);
        assert.ok(units.every(unit => unit.fulfillmentStatus === 'DELIVERED'));
      }
      if (scenario.id === 'addon-unpaid') {
        assert.equal(state.visits.length, 1);
        assert.equal(bills.length, 2);
        assert.equal(bills.find(bill => bill.id === result.billIds[0]).balanceIdr, 0);
        assert.equal(bills.find(bill => bill.id === result.billIds[1]).balanceIdr, 20790);
        assert.equal(visit.lifecycleSummary.outstandingBalanceIdr, 20790);
      }
      if (scenario.id === 'dirty-table') assert.equal(state.tables.find(table => table.id === result.tableId).physicalState, 'NEEDS_CLEANING');
      if (scenario.id === 'takeaway-ready') {
        assert.equal(bills[0].balanceIdr, 0);
        assert.ok(units.every(unit => unit.fulfillmentStatus === 'READY'));
      }
    });
    await t.test('an invalid scenario preserves the current session', async () => {
      const before = await getFullApplicationSnapshot();
      await assert.rejects(loadDemoScenario('misspelled-scenario'), error => error.code === 'SCENARIO_UNAVAILABLE');
      const after = await getFullApplicationSnapshot();
      assert.deepEqual(after.waitlistEntries.map(entry => entry.id), before.waitlistEntries.map(entry => entry.id));
    });
    await t.test('browser reset switches between full, cafe-only, and blank data', async () => {
      const reset = (level, surface = 'staff') => executeBrowserCommand({ command: 'RESET_DEMO_TO_LEVEL', payload: { level }, surface });
      const full = (await reset('full')).snapshot;
      assert.ok(full.members.length && full.visits.length && full.orders.length && full.bills.length);
      assert.ok(full.bills.some(bill => bill.receipts.length));
      assert.deepEqual(full.runtime.notificationBaselineIds, full.orderRequests.map(request => request.id));
      await assert.rejects(reset('invalid'), error => error.code === 'INVALID_DEMO_SEED_LEVEL');
      await assert.rejects(reset('blank', 'customer'));
      assert.equal((await getBrowserSnapshot({ surface: 'staff' })).orders.length, full.orders.length);

      const cafe = (await reset('cafe')).snapshot;
      for (const field of ['catalog', 'stockPools', 'rooms', 'tables', 'layoutVersions']) {
        assert.ok(cafe[field].length, field);
      }
      for (const field of ['members', 'rewardEntitlements', 'visits', 'waitlistEntries', 'orders', 'orderRequests', 'bills', 'feedbackEntries', 'cashMovements']) {
        assert.deepEqual(cafe[field], [], field);
      }
      assert.ok(cafe.tables.every(table => table.physicalState === 'AVAILABLE'));
      assert.ok(cafe.stockPools.every(pool => pool.reserved === 0));
      assert.ok(cafe.promotionRules.every(rule => rule.quotaUsed === 0 && rule.quotaReserved === 0));
      assert.deepEqual(cafe.runtime.notificationBaselineIds, []);

      await reset('blank');
      const blank = await getBrowserSnapshot({ surface: 'staff' });
      for (const field of ['catalog', 'categories', 'stockPools', 'rooms', 'tables', 'layoutVersions', 'promotionRules', 'wifiNetworks', 'cashShifts', 'members', 'visits', 'orders', 'bills']) {
        assert.deepEqual(blank[field], [], field);
      }
      assert.equal(blank.paymentAccount, null);
      assert.ok(blank.staffRoles.length);
      const customer = await getBrowserSnapshot({ surface: 'customer' });
      assert.deepEqual(customer.catalog, []);
      assert.deepEqual(customer.tables, []);

      const menuCommand = payload => executeBrowserCommand({
        command: 'MENU_STOCK_ACTION', payload: { ...payload, actorName: 'Tester', actorRole: 'OWNER' }, surface: 'staff',
      });
      const { result: category } = await menuCommand({ action: 'CREATE_CATEGORY', newCategoryName: 'Minuman' });
      await menuCommand({ action: 'CREATE_MENU_ITEM', newMenuItem: {
        name: 'Teh', externalCode: 'TEH', categoryId: category.categoryId, stationCode: 'BAR', priceIdr: 18000,
      } });
      const [item] = (await getBrowserSnapshot({ surface: 'customer' })).catalog;
      assert.equal(item.categoryId, category.categoryId);
      assert.equal(item.variants[0].stockPoolId, null, 'A blank demo has no sample stock pool to attach.');
      const restored = (await reset('full')).snapshot;
      assert.deepEqual(restored.orders.map(order => order.id), full.orders.map(order => order.id));
      assert.ok(!restored.catalog.some(entry => entry.id === item.id));
    });
  } finally {
    await global._cafeDemoDatabase?.close();
    global._cafeDemoDatabase = undefined;
    await rm(directory, { recursive: true, force: true });
  }
});
