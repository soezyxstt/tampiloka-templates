import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { eq } from 'drizzle-orm';
import { createSqliteDatabase, sqliteSchema } from './sqlite.ts';
import { outlets, staffOutletRoles, stockPools, users } from './schema.ts';

function setup() {
  const sql = new DatabaseSync(':memory:');
  for (const statement of sqliteSchema()) sql.exec(statement);
  const execute = async ({ sql: query, args }) => {
    const stmt = sql.prepare(query);
    const columns = stmt.columns().map(c => c.name);
    stmt.setReturnArrays(true);
    const rows = stmt.all(...args);
    return { columns, rows };
  };
  const client = { execute, transaction: async () => {
    sql.exec('BEGIN IMMEDIATE');
    return { execute, commit: async () => { sql.exec('COMMIT'); }, rollback: async () => { sql.exec('ROLLBACK'); }, close() {} };
  } };
  return { db: createSqliteDatabase(client), sql };
}
test('SQLite defaults, boolean, dates, JSON and rollback', async () => {
  const { db, sql } = setup();
  await db.insert(outlets).values({ id: 'o', tenantId: 't', slug: 'slug', name: 'Cafe', address: 'Street' });
  const [outlet] = await db.select().from(outlets).where(eq(outlets.id, 'o'));
  assert.equal(outlet.acceptingOrders, true);
  assert.ok(outlet.createdAt instanceof Date);
  await db.transaction(async (tx) => {
    await tx.select().from(outlets).where(eq(outlets.id, 'o')).for('update');
    await tx.insert(staffOutletRoles).values({ id: 's', tenantId: 't', outletId: 'o', userId: 'u', userEmail: 'x', userName: 'X', role: 'STAFF', permissionsJson: ['orders'] });
  });
  const [staff] = await db.select().from(staffOutletRoles);
  assert.deepEqual(staff.permissionsJson, ['orders']);
  assert.equal(staff.active, true);
  assert.deepEqual(await db.select({ outletId: outlets.id, staffId: staffOutletRoles.id }).from(outlets)
    .innerJoin(staffOutletRoles, eq(outlets.id, staffOutletRoles.outletId)), [{ outletId: 'o', staffId: 's' }]);
  await assert.rejects(db.transaction(async (tx) => { await tx.update(outlets).set({ name: 'Changed' }); throw new Error('abort'); }), /abort/);
  assert.equal((await db.select().from(outlets))[0].name, 'Cafe');
  await db.insert(stockPools).values({ id: 'pool', tenantId: 't', outletId: 'o', code: 'stock', name: 'Stock', onHand: 10 });
  await assert.rejects(db.transaction(async tx => {
    await tx.update(stockPools).set({ onHand: 8 }).where(eq(stockPools.id, 'pool'));
    await tx.insert(outlets).values({ id: 'o', tenantId: 't', slug: 'duplicate', name: 'Duplicate', address: 'A' });
  }));
  assert.equal((await db.select().from(stockPools).where(eq(stockPools.id, 'pool')))[0].onHand, 10);
  sql.close();
});

test('multi-row inserts use defaults and D1 rejects writes before execution', async () => {
  const { db, sql } = setup();
  await db.insert(outlets).values([
    { id: 'a', tenantId: 't', slug: 'a', name: 'A', address: 'A' },
    { id: 'b', tenantId: 't', slug: 'b', name: 'B', address: 'B' },
  ]);
  assert.equal((await db.select().from(outlets)).length, 2);
  let calls = 0;
  const readOnly = createSqliteDatabase({ execute: async () => { calls++; return { columns: [], rows: [] }; }, transaction: async () => { throw new Error('must not start'); } }, true);
  await assert.rejects(readOnly.insert(outlets).values({ id: 'x', tenantId: 't', slug: 'x', name: 'X', address: 'X' }), error => /reads only/.test(error.cause?.message));
  await assert.rejects(readOnly.transaction(async () => {}), /no mutation was attempted/);
  assert.equal(calls, 0);
  sql.close();
});

test('SQLite upsert preserves the conflict target and updates the existing user', async () => {
  const { db, sql } = setup();
  try {
    const upsert = (email) => db.insert(users).values({ uid: 'same-user', email, name: 'Test' })
      .onConflictDoUpdate({ target: users.uid, set: { email, updatedAt: new Date('2026-11-11T12:00:00Z') } }).returning();
    await upsert('first@example.test');
    const [user] = await upsert('second@example.test');
    assert.equal(user.email, 'second@example.test');
    assert.equal((await db.select().from(users)).length, 1);
  } finally { sql.close(); }
});

test('isolated SQLite runs the real demo seed and service lifecycle', async () => {
  const { registerHooks } = await import('node:module');
  const { createD1StateDatabase, materializeCafeState, encodeCafeState, D1_STATE_SCHEMA } = await import('./d1-state.ts');
  const sql = new DatabaseSync(':memory:');
  sql.exec(D1_STATE_SCHEMA);
  const initial = await materializeCafeState();
  const indexes = initial.sql.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all();
  sql.prepare('INSERT INTO cafe_state VALUES (?, 1, 0, ?)').run('test', encodeCafeState(initial.exportState()));
  initial.sql.close();
  let rejectNextWrite = false, rejectedWrites = 0;
  const remote = { prepare(query) { return { bind(...args) { return {
    async first() { return sql.prepare(query).get(...args); },
    async run() {
      if (rejectNextWrite && query.startsWith('UPDATE')) {
        rejectNextWrite = false; rejectedWrites++;
        sql.prepare('UPDATE cafe_state SET revision = revision + 1 WHERE outlet_id = ?').run('test');
      }
      return { meta: { changes: Number(sql.prepare(query).run(...args).changes) } };
    },
  }; } }; } };
  const db = createD1StateDatabase(async () => remote, 'test');
  globalThis.__cafeSqliteTestDb = db;
  const hook = registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === './index.ts' && /\/src\/db\/(seed|service)\.ts$/.test(context.parentURL || '')) {
      return { url: 'data:text/javascript,export const db = globalThis.__cafeSqliteTestDb;', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  } });
  const oldDemo = process.env.CAFE_DEMO_DB, oldEmpty = process.env.CAFE_DEMO_EMPTY;
  process.env.CAFE_DEMO_DB = '1';
  process.env.CAFE_DEMO_EMPTY = '1';
  const { cafeConfig, MODULES } = await import('../config/cafe.ts');
  const modules = cafeConfig.modules;
  cafeConfig.modules = Object.keys(MODULES);
  try {
    const service = await import('./service.ts');
    const seed = await import('./seed.ts');
    await seed.ensureSeeded();
    await seed.ensureSeeded();
    assert.ok(indexes.some(i => i.name === 'order_requests_outlet_idempotency_unique'));
    assert.ok(indexes.some(i => i.name === 'order_requests_outlet_quote_unique'));
    const visit = await service.moveOrUpdateTableAndVisit({ action: 'START_VISIT', tableId: 'tbl_m06', customerName: 'Test', partySize: 2, idempotencyKey: 'seat-test', actorName: 'Tester', actorRole: 'CASHIER' });
    const quote = await service.createQuoteForCart({ principalId: 'guest-test', mode: 'DINE_IN', tableId: 'tbl_m06', items: [{ menuItemId: 'item_teh_melati', variantId: 'var_teh_std', modifierOptionIds: [], note: '', quantity: 1 }] });
    const request = await service.submitCustomerOrderRequest({ quoteId: quote.quoteId, principalId: 'guest-test', customerName: 'Test', mode: 'DINE_IN', tableId: 'tbl_m06', presenceVerified: true, idempotencyKey: 'request-test' });
    const order = await service.acceptOrderRequestByStaff({ orderRequestId: request.orderRequestId, actorName: 'Tester', actorRole: 'CASHIER', paymentPolicyOverride: 'PREPAY' });
    assert.equal(order.visitId, visit.visitId);
    rejectNextWrite = true;
    await service.recordBillPayment({ billId: order.billId, method: 'CASH', amountIdr: quote.totalIdr, tenderedIdr: quote.totalIdr, actorName: 'Tester', idempotencyKey: 'payment-test' });
    assert.equal(rejectedWrites, 1);
    await service.recordBillPayment({ billId: order.billId, method: 'CASH', amountIdr: quote.totalIdr, tenderedIdr: quote.totalIdr, actorName: 'Tester', idempotencyKey: 'payment-test' });
    let snapshot = await service.getFullApplicationSnapshot();
    assert.equal(snapshot.bills.find(b => b.id === order.billId).paymentState, 'SETTLED');
    const { paymentReceipts } = await import('./schema.ts');
    assert.equal((await db.select().from(paymentReceipts).where(eq(paymentReceipts.billId, order.billId))).length, 1);
    const unitIds = snapshot.orderUnits.filter(u => u.orderId === order.orderId).map(u => u.id);
    for (const targetStatus of ['PREPARING', 'READY', 'DELIVERED']) await service.transitionOrderUnits({ unitIds, targetStatus, actorName: 'Tester', actorRole: 'KITCHEN' });
    await service.moveOrUpdateTableAndVisit({ action: 'DEPART_VISIT', visitId: visit.visitId, actorName: 'Tester', actorRole: 'CASHIER' });
    snapshot = await service.getFullApplicationSnapshot();
    assert.equal(snapshot.tables.find(t => t.id === 'tbl_m06').physicalState, 'NEEDS_CLEANING');
    await seed.resetDemoData({ empty: true });
    assert.equal((await service.getFullApplicationSnapshot()).orders.length, 0);
    process.env.CAFE_DEMO_DB = '0';
    await assert.rejects(seed.ensureSeeded(), error => error.code === 'LIVE_ADAPTER_REQUIRED');
    await assert.rejects(seed.resetDemoData(), error => error.code === 'LIVE_ADAPTER_REQUIRED');
  } finally {
    cafeConfig.modules = modules;
    if (oldDemo === undefined) delete process.env.CAFE_DEMO_DB; else process.env.CAFE_DEMO_DB = oldDemo;
    if (oldEmpty === undefined) delete process.env.CAFE_DEMO_EMPTY; else process.env.CAFE_DEMO_EMPTY = oldEmpty;
    delete globalThis.__cafeSqliteTestDb;
    hook.deregister();
    sql.close();
  }
});

test('client initialization uses configured catalog and rejects demo sample', async () => {
  const { readFile } = await import('node:fs/promises');
  const { clientCatalogStatements } = await import('./client-catalog.ts');
  const { cafeConfig } = await import('../config/cafe.ts');
  const menu = JSON.parse(await readFile(new URL('../../content/menu.json', import.meta.url)));
  const tables = JSON.parse(await readFile(new URL('../../content/tables.json', import.meta.url)));
  assert.throws(() => clientCatalogStatements(menu, tables, cafeConfig), /sample catalog/);
  menu.sample = false;
  const statements = clientCatalogStatements(menu, tables, cafeConfig);
  const { db, sql } = setup();
  sql.exec('BEGIN');
  for (const { sql: query, args } of statements) sql.prepare(query).run(...args);
  sql.exec('COMMIT');
  const [outlet] = await db.select().from(outlets);
  assert.equal(outlet.acceptingOrders, false);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM menu_items').get().n, menu.items.length);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM staff_outlet_roles').get().n, 0);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM payment_accounts').get().n, 0);
  assert.throws(() => sql.prepare(statements[0].sql).run(...statements[0].args));
  sql.close();
});

 test('D1 snapshots retry conflicts, reject failed transactions and enforce capacity and versions', async () => {
  const { createD1StateDatabase, materializeCafeState, encodeCafeState, D1_STATE_SCHEMA } = await import('./d1-state.ts');
  const remote = new DatabaseSync(':memory:');
  remote.exec(D1_STATE_SCHEMA);
  const initial = await materializeCafeState();
  remote.prepare('INSERT INTO cafe_state VALUES (?, 1, 0, ?)').run('test', encodeCafeState(initial.exportState()));
  initial.sql.close();
  let conflict = true;
  const d1 = { prepare(query) { return { bind(...args) { return {
    async first() { return remote.prepare(query).get(...args); },
    async run() {
      if (conflict && query.startsWith('UPDATE')) { conflict = false; remote.prepare('UPDATE cafe_state SET revision = revision + 1').run(); }
      return { meta: { changes: Number(remote.prepare(query).run(...args).changes) } };
    },
  }; } }; } };
  const db = createD1StateDatabase(async () => d1, 'test');
  let attempts = 0;
  await db.transaction(async tx => { attempts++; await tx.insert(outlets).values({ id: 'o', tenantId: 't', slug: 's', name: 'Cafe', address: 'A' }); });
  assert.equal(attempts, 2);
  await db.insert(stockPools).values({ id: 'pool', tenantId: 't', outletId: 'o', code: 'stock', name: 'Stock', onHand: 10 });
  await assert.rejects(db.transaction(async tx => {
    await tx.update(stockPools).set({ onHand: 8 }).where(eq(stockPools.id, 'pool'));
    await tx.insert(outlets).values({ id: 'o', tenantId: 't', slug: 'duplicate', name: 'Duplicate', address: 'A' });
  }));
  assert.equal((await db.select().from(stockPools).where(eq(stockPools.id, 'pool')))[0].onHand, 10);
  await assert.rejects(db.transaction(async tx => { await tx.update(outlets).set({ name: 'bad' }); throw new Error('rollback'); }), /rollback/);
  assert.equal((await db.select().from(outlets))[0].name, 'Cafe');
  await assert.rejects(db.insert(outlets).values({ id: 'o', tenantId: 't', slug: 's2', name: 'duplicate', address: 'A' }));
  assert.throws(() => encodeCafeState({ data: 'x'.repeat(1_500_001) }), /capacity exceeded/);
  remote.exec('UPDATE cafe_state SET schema_version = 2');
  await assert.rejects(db.select().from(outlets), error => /schema version/.test(error.cause?.message || error.message));
  remote.close();
});
