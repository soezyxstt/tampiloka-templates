import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('isolated database: quote, discounted POS, duplicate submission, cash receipt, kitchen and demo settlement', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cafe-integration-'));
  const dataDir = join(dir, 'db');
  await mkdir(dataDir);
  process.env.CAFE_DEMO_DB = '1';
  process.env.CAFE_DEMO_EMPTY = '1';
  process.env.CAFE_DEMO_DATA_DIR = dataDir;
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { pushSchema } = await import('drizzle-kit/api');
  const schema = await import('./schema.ts');
  const setup = new PGlite(dataDir);
  const migration = await pushSchema(schema, drizzle(setup));
  await migration.apply();
  await setup.close();

  const { cafeConfig, MODULES } = await import('../config/cafe.ts');
  const originalModules = [...cafeConfig.modules];
  // Domain fixtures exercise all commands regardless of the generated client's chosen preset.
  cafeConfig.modules = Object.keys(MODULES) as typeof cafeConfig.modules;
  const service = await import('./service.ts');
  const { db } = await import('./index.ts');
  const { eq } = await import('drizzle-orm');
  try {
    const snapshot = await service.getFullApplicationSnapshot();
    assert.equal(snapshot.runtime.demo, true);
    assert.equal(snapshot.orders.length, 0);
    const guestSnapshot = service.getSurfaceSnapshot(snapshot, 'customer');
    assert.equal('staffRoles' in guestSnapshot, false);
    assert.equal('cashShifts' in guestSnapshot, false);
    assert.equal('auditEvents' in guestSnapshot, false);
    await assert.rejects(service.createQuoteForCart({
      principalId: 'guest_stock', mode: 'TAKEAWAY',
      items: [
        { menuItemId: 'item_v60_garut', variantId: 'var_v60_hot', modifierOptionIds: [], note: '', quantity: 1 },
        { menuItemId: 'item_v60_garut', variantId: 'var_v60_ice', modifierOptionIds: [], note: '', quantity: 1 },
      ],
    }));

    const quote = await service.createQuoteForCart({
      principalId: 'staff_integration', mode: 'TAKEAWAY', manualDiscountIdr: 5000,
      items: [{ menuItemId: 'item_teh_melati', variantId: 'var_teh_std', modifierOptionIds: [], note: 'Test', quantity: 2 }],
    });
    assert.equal(quote.subtotalIdr, 36000);
    assert.equal(quote.discountIdr, 5000);
    assert.equal(quote.totalIdr, 35805);

    const payload = { quoteId: quote.quoteId, principalId: 'staff_integration', customerName: 'Uji Kasir', mode: 'TAKEAWAY' as const, presenceVerified: false, idempotencyKey: 'integration-order-1' };
    const [first, duplicate] = await Promise.all([
      service.submitCustomerOrderRequest(payload),
      service.submitCustomerOrderRequest(payload),
    ]);
    assert.equal((first as any).orderRequestId, (duplicate as any).orderRequestId);
    await assert.rejects(service.submitCustomerOrderRequest({ ...payload, idempotencyKey: 'another-key' }), (error: any) => error.code === 'IDEMPOTENCY_CONFLICT');
    const requests = await db.select().from(schema.orderRequests).where(eq(schema.orderRequests.quoteId, quote.quoteId));
    assert.equal(requests.length, 1);

    const accepted = await service.acceptOrderRequestByStaff({ orderRequestId: requests[0].id, actorName: 'Tester', actorRole: 'CASHIER', paymentPolicyOverride: 'PAY_LATER' });
    const acceptedAgain = await service.acceptOrderRequestByStaff({ orderRequestId: requests[0].id, actorName: 'Tester', actorRole: 'CASHIER' });
    assert.equal(accepted.orderId, acceptedAgain.orderId);
    const billId = accepted.billId!;
    const shifts = await db.select().from(schema.cashShifts);
    if (shifts.length === 0) await service.manageCashShift({ action: 'OPEN_SHIFT', amountIdr: 0, actorName: 'Tester' });
    await assert.rejects(service.recordBillPayment({ billId, method: 'CASH', amountIdr: quote.totalIdr, tenderedIdr: quote.totalIdr - 1, actorName: 'Tester' }));
    await assert.rejects(service.recordBillPayment({ billId, method: 'CASH', amountIdr: 0, tenderedIdr: 0, actorName: 'Tester' }));
    const receipt = await service.recordBillPayment({ billId, method: 'CASH', amountIdr: 10000, tenderedIdr: 20000, actorName: 'Tester' });
    assert.equal((receipt as any).balanceIdr, 25805);
    assert.equal((receipt as any).changeIdr, 10000);
    assert.equal((receipt as any).paymentState, 'PARTIALLY_PAID');

    const attempt = await service.recordBillPayment({ billId, method: 'QRIS', amountIdr: 25805, actorName: 'Tester', createExternalAttemptOnly: true });
    assert.equal((attempt as any).isDemo, true);
    await assert.rejects(service.recordBillPayment({ billId, method: 'CASH', amountIdr: 25805, actorName: 'Tester' }));
    await service.settleOrCancelExternalPaymentAttempt({ attemptId: (attempt as any).attemptId, action: 'SETTLE', actorName: 'Tester' });
    await service.settleOrCancelExternalPaymentAttempt({ attemptId: (attempt as any).attemptId, action: 'SETTLE', actorName: 'Tester' });
    const receipts = await db.select().from(schema.paymentReceipts).where(eq(schema.paymentReceipts.billId, billId));
    assert.equal(receipts.length, 2);
    assert.equal(receipts.reduce((total, row) => total + row.amountIdr, 0), 35805);

    const units = await db.select().from(schema.orderItemUnits).where(eq(schema.orderItemUnits.orderId, accepted.orderId!));
    const unitIds = units.map((unit) => unit.id);
    for (const targetStatus of ['PREPARING', 'READY', 'PICKED_UP'] as const) {
      await service.transitionOrderUnits({ unitIds, targetStatus, actorName: 'Tester', actorRole: 'KITCHEN' });
    }
    await assert.rejects(service.transitionOrderUnits({ unitIds, targetStatus: 'PREPARING', actorName: 'Tester', actorRole: 'KITCHEN' }));

    const beforeInclusive = await service.createQuoteForCart({ principalId: 'guest_a', mode: 'TAKEAWAY', items: [{ menuItemId: 'item_teh_melati', variantId: 'var_teh_std', quantity: 1, modifierOptionIds: [], note: '' }] });
    await service.updateOutletSettingsOrPromoOrFeedback({ action: 'UPDATE_OUTLET_POLICY', taxInclusiveDisplay: true });
    await assert.rejects(service.submitCustomerOrderRequest({ ...payload, principalId: 'guest_a', quoteId: beforeInclusive.quoteId, idempotencyKey: 'changed-policy' }), (error: any) => error.code === 'QUOTE_CHANGED');
    const inclusive = await service.createQuoteForCart({ principalId: 'guest_a', mode: 'TAKEAWAY', items: [{ menuItemId: 'item_teh_melati', variantId: 'var_teh_std', quantity: 1, modifierOptionIds: [], note: '' }] });
    assert.equal(inclusive.totalIdr, 18000);
    assert.equal(inclusive.serviceIdr, 0);
    assert.equal(inclusive.taxIdr, 0);

    const { resetDemoData } = await import('./seed.ts');
    await resetDemoData();
    assert.equal((await db.select().from(schema.orders)).length, 0);
    assert.equal((await db.select().from(schema.paymentReceipts)).length, 0);
    assert.equal((await db.select().from(schema.idempotencyRecords)).length, 0);
  } finally {
    cafeConfig.modules = originalModules;
    await global._cafeDemoDatabase?.close();
    global._cafeDemoDatabase = undefined;
    await rm(dir, { recursive: true, force: true });
  }
});
