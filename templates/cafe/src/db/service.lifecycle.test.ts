import test from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { createLifecycleFixture } from './lifecycle-fixtures.ts';

const errorCode = (code: string) => (error: any) => error.code === code;

test('full cafe lifecycle: isolated customer, cashier, kitchen, floor and exception scenarios', async t => {
  const fixture = await createLifecycleFixture();
  const { service, schema, db, seat, request, sale, serve, units, pay, depart, tea, pastry } = fixture;
  const state = () => service.getFullApplicationSnapshot();
  const clean = (tableId = 'tbl_m06') => service.moveOrUpdateTableAndVisit({ action: 'MARK_CLEAN', tableId, actorName: 'Cleaner' });
  const cancel = (unitId: string, issueRefundNow = true) => service.cancelUnitAndRefundOrCredit({ unitId, reason: 'Dibatalkan untuk skenario uji', restockChoice: 'RESTOCK', issueRefundNow, actorName: 'Manager Uji', approverName: 'Manager Uji' });
  async function scenario(name: string, run: () => Promise<void>) {
    await t.test(name, async () => { await fixture.reset(); await run(); });
  }
  try {
    await scenario('PREPAY: seat → customer request → pay → kitchen → serve → depart → clean', async () => {
      const visit = await seat();
      assert.equal((await state()).tables.find(table => table.id === 'tbl_m06')?.physicalState, 'OCCUPIED');
      const order = await sale({ principalId: 'rani' });
      assert.equal(order.visitId, visit.visitId);
      assert.ok((await units(order.orderId)).every(unit => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT'));
      await assert.rejects(service.transitionOrderUnits({ unitIds: (await units(order.orderId)).map(unit => unit.id), targetStatus: 'PREPARING', actorName: 'Kitchen', actorRole: 'KITCHEN' }));
      await assert.rejects(depart(order.visitId), errorCode('VISIT_NOT_READY_TO_CLOSE'));
      await pay(order.billId);
      assert.ok((await units(order.orderId)).every(unit => unit.fulfillmentStatus === 'QUEUED'));
      await assert.rejects(depart(order.visitId), errorCode('VISIT_NOT_READY_TO_CLOSE'));
      await serve(order.orderId);
      await depart(order.visitId);
      assert.equal((await state()).tables.find(table => table.id === 'tbl_m06')?.physicalState, 'NEEDS_CLEANING');
      await assert.rejects(seat(), errorCode('TABLE_NOT_AVAILABLE'));
      await clean();
      assert.equal((await state()).tables.find(table => table.id === 'tbl_m06')?.physicalState, 'AVAILABLE');
      const snapshot = await state();
      assert.equal(snapshot.participants.filter(participant => participant.visitId === order.visitId).every(participant => participant.status === 'DEPARTED'), true);
      assert.equal(service.getSurfaceSnapshot(snapshot, 'customer', 'tbl_m06', 'new_guest').orders.length, 0);
      assert.equal(service.getSurfaceSnapshot(snapshot, 'customer', 'tbl_m06', 'rani').orders.length, 1);
    });

    await scenario('QR submission retry remains idempotent after departure and a dirty table', async () => {
      await seat();
      const table = (await state()).tables.find(table => table.id === 'tbl_m06')!;
      const quote = await service.createQuoteForCart({ principalId: 'qr_retry', mode: 'DINE_IN', tableId: table.id, items: [tea] });
      const payload = { quoteId: quote.quoteId, principalId: 'qr_retry', customerName: 'QR Retry', mode: 'DINE_IN' as const, tableId: table.id, tableQrToken: table.qrToken, presenceVerified: false, idempotencyKey: 'qr-retry-after-departure' };
      const submitted = await service.submitCustomerOrderRequest(payload) as { orderRequestId: string };
      const accepted = await service.acceptOrderRequestByStaff({ orderRequestId: submitted.orderRequestId, actorName: 'Cashier', actorRole: 'CASHIER' });
      await pay(accepted.billId!); await serve(accepted.orderId!); await depart(accepted.visitId!);
      const retry = await service.submitCustomerOrderRequest(payload) as { orderRequestId: string };
      assert.equal(retry.orderRequestId, submitted.orderRequestId);
      assert.equal((await state()).orders.length, 1);
    });

    await scenario('PAY_LATER + add-on: independent bills, one visit, retry maps to its own bill', async () => {
      await seat();
      const first = await sale({ principalId: 'same_guest', policy: 'PAY_LATER' });
      await serve(first.orderId); await pay(first.billId);
      const second = await sale({ principalId: 'same_guest', policy: 'PAY_LATER', items: [pastry] });
      assert.equal(second.visitId, first.visitId);
      assert.notEqual(second.billId, first.billId);
      const retry = await service.acceptOrderRequestByStaff({ orderRequestId: second.requestId, actorName: 'Cashier', actorRole: 'CASHIER' });
      assert.equal(retry.billId, second.billId);
      const snapshot = await state();
      assert.equal(snapshot.participants.filter(participant => participant.visitId === first.visitId).length, 1);
      assert.equal(snapshot.visits.find(visit => visit.id === first.visitId)?.lifecycleSummary.outstandingBalanceIdr, second.quote.totalIdr);
      await assert.rejects(depart(first.visitId), errorCode('VISIT_NOT_READY_TO_CLOSE'));
      await serve(second.orderId); await pay(second.billId); await depart(first.visitId);
    });

    await scenario('pending requests and assistance block departure; accepted requests cannot be rejected', async () => {
      const visit = await seat();
      const pending = await request();
      const help = await service.createOrUpdateServiceRequest({ action: 'CREATE', visitId: visit.visitId, tableLabel: 'M06', type: 'CALL_WAITER', customerName: 'Rani' });
      const serviceId = (help as any).serviceRequest.id;
      await assert.rejects(depart(visit.visitId!), errorCode('VISIT_NOT_READY_TO_CLOSE'));
      await service.rejectOrderRequestByStaff({ orderRequestId: pending.requestId, reason: 'Tamu batal memesan', actorName: 'Cashier' });
      await assert.rejects(depart(visit.visitId!), errorCode('VISIT_NOT_READY_TO_CLOSE'));
      await service.createOrUpdateServiceRequest({ action: 'RESOLVE', requestId: serviceId, actorName: 'Waiter' });
      await depart(visit.visitId!);
      await clean(); await seat();
      const accepted = await sale({ policy: 'PAY_LATER' });
      await assert.rejects(service.rejectOrderRequestByStaff({ orderRequestId: accepted.requestId, reason: 'Invalid late rejection', actorName: 'Cashier' }), errorCode('REQUEST_NOT_PENDING'));
      assert.equal((await state()).orderRequests.find(row => row.id === accepted.requestId)?.state, 'ACCEPTED');
    });

    await scenario('cash partial retry is idempotent; pending QR blocks other tender, refund and departure', async () => {
      await seat(); const order = await sale({ policy: 'PAY_LATER' }); await serve(order.orderId);
      const [first, retry] = await Promise.all([pay(order.billId, 5000, 'same-tender'), pay(order.billId, 5000, 'same-tender')]);
      assert.equal(first.receiptId, retry.receiptId);
      await assert.rejects(pay(order.billId, 6000, 'same-tender'), errorCode('IDEMPOTENCY_CONFLICT'));
      const remainder = order.quote.totalIdr - 5000;
      const attempt = await service.recordBillPayment({ billId: order.billId, method: 'QRIS', amountIdr: remainder, createExternalAttemptOnly: true, actorName: 'Cashier', idempotencyKey: 'qr-create' });
      await assert.rejects(pay(order.billId));
      await assert.rejects(cancel((await units(order.orderId))[0].id), errorCode('PAYMENT_ATTEMPT_ACTIVE'));
      await assert.rejects(depart(order.visitId), errorCode('VISIT_NOT_READY_TO_CLOSE'));
      await service.settleOrCancelExternalPaymentAttempt({ attemptId: attempt.attemptId, action: 'SETTLE', actorName: 'Demo' });
      await service.settleOrCancelExternalPaymentAttempt({ attemptId: attempt.attemptId, action: 'SETTLE', actorName: 'Demo' });
      const bill = (await state()).bills.find(bill => bill.id === order.billId)!;
      assert.equal(bill.receipts.length, 2); assert.equal(bill.verifiedReceiptsIdr, order.quote.totalIdr);
      await depart(order.visitId);
    });

    await scenario('canceled payment attempt cannot settle; cancelled QR permits a new tender', async () => {
      const order = await sale({ mode: 'TAKEAWAY' });
      const attempt = await service.recordBillPayment({ billId: order.billId, method: 'QRIS', amountIdr: order.quote.totalIdr, createExternalAttemptOnly: true, actorName: 'Demo' });
      await service.settleOrCancelExternalPaymentAttempt({ attemptId: attempt.attemptId, action: 'CANCEL', actorName: 'Cashier' });
      await assert.rejects(service.settleOrCancelExternalPaymentAttempt({ attemptId: attempt.attemptId, action: 'SETTLE', actorName: 'Demo' }));
      await pay(order.billId); await serve(order.orderId, 'TAKEAWAY'); await depart(order.visitId);
      assert.equal((await state()).bills.find(bill => bill.id === order.billId)?.receipts.length, 1);
    });

    await scenario('manager exception preserves liabilities, rejects pending orders and prevents stale acceptance', async () => {
      const visit = await seat(); const order = await sale({ policy: 'PAY_LATER' }); const pending = await request();
      const base = { action: 'DEPART_VISIT_EXCEPTION' as const, visitId: visit.visitId, actorName: 'Manager', reason: 'Tamu meninggalkan kafe tanpa membayar.' };
      await assert.rejects(service.moveOrUpdateTableAndVisit({ ...base, actorRole: 'CASHIER' }), errorCode('MANAGER_REQUIRED'));
      await assert.rejects(service.moveOrUpdateTableAndVisit({ ...base, actorRole: 'MANAGER', reason: 'oops' }), errorCode('EXCEPTION_REASON_REQUIRED'));
      await service.moveOrUpdateTableAndVisit({ ...base, actorRole: 'MANAGER' });
      await assert.rejects(service.acceptOrderRequestByStaff({ orderRequestId: pending.requestId, actorName: 'Cashier', actorRole: 'CASHIER' }));
      const snapshot = await state();
      assert.equal(snapshot.bills.find(bill => bill.id === order.billId)?.balanceIdr, order.quote.totalIdr);
      assert.equal(snapshot.visits.find(row => row.id === visit.visitId)?.lifecycleSummary.canDepart, false);
      assert.ok(snapshot.auditEvents.some(event => event.action === 'VISIT_DEPARTED_WITH_EXCEPTION' && event.entityId === visit.visitId));
      await clean(); await seat('tbl_m06', 'Tamu Baru');
      assert.equal(service.getSurfaceSnapshot(await state(), 'customer', 'tbl_m06', 'new_guest').orders.length, 0);
      await cancel((await units(order.orderId))[0].id, false);
      assert.equal((await state()).visits.find(row => row.id === visit.visitId)?.lifecycleSummary.canDepart, true);
    });

    await scenario('stale quote cannot cross table generations; closed visit rejects forged pending request', async () => {
      const visit = await seat();
      const quote = await service.createQuoteForCart({ principalId: 'late_guest', mode: 'DINE_IN', tableId: 'tbl_m06', items: [tea] });
      await depart(visit.visitId!); await clean(); await seat('tbl_m06', 'Next Party');
      await assert.rejects(service.submitCustomerOrderRequest({ quoteId: quote.quoteId, principalId: 'late_guest', customerName: 'Late Guest', mode: 'DINE_IN', tableId: 'tbl_m06', presenceVerified: true, idempotencyKey: 'late-submit' }), errorCode('TABLE_CONTEXT_CHANGED'));
      const pending = await request();
      await db.update(schema.orderRequests).set({ visitId: visit.visitId }).where(eq(schema.orderRequests.id, pending.requestId));
      await assert.rejects(service.acceptOrderRequestByStaff({ orderRequestId: pending.requestId, actorName: 'Cashier', actorRole: 'CASHIER' }), errorCode('VISIT_CLOSED'));
      assert.equal((await state()).orders.length, 0);
    });

    await scenario('concurrent seating and acceptance create exactly one visit and one stock effect', async () => {
      const [first, retry] = await Promise.all([seat('tbl_m06', 'Same Party', 2, 'seat-retry'), seat('tbl_m06', 'Same Party', 2, 'seat-retry')]);
      assert.equal(first.visitId, retry.visitId);
      await assert.rejects(seat('tbl_m06', 'Different Party', 2, 'seat-retry'), errorCode('IDEMPOTENCY_CONFLICT'));
      await assert.rejects(seat('tbl_m06', 'Another Party', 2, 'new-seat'), errorCode('TABLE_NOT_AVAILABLE'));
      await depart(first.visitId!); await clean();
      const left = await request({ items: [pastry] }); const right = await request({ items: [pastry] });
      const [acceptedLeft, acceptedRight] = await Promise.all([left, right].map(request => service.acceptOrderRequestByStaff({ orderRequestId: request.requestId, actorName: 'Cashier', actorRole: 'CASHIER', paymentPolicyOverride: 'PREPAY' })));
      assert.equal(acceptedLeft.visitId, acceptedRight.visitId);
      const snapshot = await state();
      assert.equal(snapshot.visits.filter(visit => visit.status === 'OPEN').length, 1);
      assert.equal((await db.select().from(schema.stockPools).where(eq(schema.stockPools.id, 'pool_croissant')))[0].reserved, 2);
    });

    await scenario('accept/depart race cannot close a visit with newly accepted obligations', async () => {
      const visit = await seat(); const pending = await request();
      const results = await Promise.allSettled([service.acceptOrderRequestByStaff({ orderRequestId: pending.requestId, actorName: 'Cashier', actorRole: 'CASHIER' }), depart(visit.visitId!)]);
      assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].status, 'rejected');
      assert.equal((await state()).visits.find(row => row.id === visit.visitId)?.status, 'OPEN');
    });

    await scenario('dirty, disabled, occupied and undersized tables cannot bypass seating guards', async () => {
      await assert.rejects(seat('tbl_m06', 'Too Many', 50), errorCode('TABLE_CAPACITY_EXCEEDED'));
      await assert.rejects(seat('tbl_m06', 'Bad Size', 1.5), errorCode('INVALID_PARTY_SIZE'));
      const visit = await seat();
      for (const action of ['MARK_CLEAN', 'ENABLE_TABLE', 'DISABLE_TABLE'] as const) await assert.rejects(service.moveOrUpdateTableAndVisit({ action, tableId: 'tbl_m06', actorName: 'Staff' }), errorCode('TABLE_OCCUPIED'));
      await depart(visit.visitId!);
      await assert.rejects(request(), errorCode('TABLE_NOT_AVAILABLE'));
      await service.moveOrUpdateTableAndVisit({ action: 'DISABLE_TABLE', tableId: 'tbl_m06', actorName: 'Staff' });
      await assert.rejects(clean(), errorCode('TABLE_NOT_CLEANABLE'));
      const enabled = await service.moveOrUpdateTableAndVisit({ action: 'ENABLE_TABLE', tableId: 'tbl_m06', actorName: 'Staff' });
      assert.ok('physicalState' in enabled); assert.equal(enabled.physicalState, 'NEEDS_CLEANING');
      await clean(); await seat();
    });

    await scenario('waitlist reserves table exclusively, validates size/expiry and terminal transitions', async () => {
      const first = await service.manageWaitlistEntry({ action: 'CREATE', customerName: 'Antrean Satu', partySize: 2, actorName: 'Host' });
      const second = await service.manageWaitlistEntry({ action: 'CREATE', customerName: 'Antrean Dua', partySize: 2, actorName: 'Host' });
      await service.manageWaitlistEntry({ action: 'CALL', waitlistId: first.id, tableId: 'tbl_m06', actorName: 'Host' });
      await assert.rejects(seat(), errorCode('TABLE_HELD'));
      await assert.rejects(service.manageWaitlistEntry({ action: 'CALL', waitlistId: second.id, tableId: 'tbl_m06', actorName: 'Host' }), errorCode('TABLE_HELD'));
      await assert.rejects(service.manageWaitlistEntry({ action: 'EXPIRE_HOLD', waitlistId: first.id, actorName: 'Host' }), errorCode('HOLD_NOT_EXPIRED'));
      await db.update(schema.waitlistEntries).set({ holdExpiresAt: new Date(0) }).where(eq(schema.waitlistEntries.id, first.id));
      await assert.rejects(service.manageWaitlistEntry({ action: 'SEAT', waitlistId: first.id, actorName: 'Host' }), errorCode('HOLD_EXPIRED'));
      await service.manageWaitlistEntry({ action: 'EXPIRE_HOLD', waitlistId: first.id, actorName: 'Host' });
      const seated = await service.manageWaitlistEntry({ action: 'SEAT', waitlistId: first.id, tableId: 'tbl_m06', actorName: 'Host' });
      const retry = await service.manageWaitlistEntry({ action: 'SEAT', waitlistId: first.id, tableId: 'tbl_m06', actorName: 'Host' });
      assert.ok('visitId' in seated && 'visitId' in retry); assert.equal(seated.visitId, retry.visitId);
      await assert.rejects(service.manageWaitlistEntry({ action: 'CALL', waitlistId: first.id, tableId: 'tbl_m02', actorName: 'Host' }), errorCode('WAITLIST_TERMINAL'));
      await assert.rejects(service.manageWaitlistEntry({ action: 'SKIP', waitlistId: second.id, actorName: 'Host' }), errorCode('WAITLIST_NOT_CALLED'));
      const large = await service.manageWaitlistEntry({ action: 'CREATE', customerName: 'Rombongan Besar', partySize: 50, actorName: 'Host' });
      await assert.rejects(service.manageWaitlistEntry({ action: 'CALL', waitlistId: large.id, tableId: 'tbl_m02', actorName: 'Host' }), errorCode('TABLE_CAPACITY_EXCEEDED'));
    });

    await scenario('waitlist private status reveals only the owning party through call, seating and completion', async () => {
      const first = await service.manageWaitlistEntry({ action: 'CREATE', customerName: 'Rani Private', partySize: 2, contactPhone: '081234567890', notes: 'Private note', actorName: 'Guest' });
      await service.manageWaitlistEntry({ action: 'CREATE', customerName: 'Other Party', partySize: 2, actorName: 'Guest' });
      const privateToken = 'privateToken' in first ? first.privateToken : undefined;
      assert.ok(privateToken);
      const waiting = await service.manageWaitlistEntry({ action: 'GET_STATUS', privateToken, actorName: 'Guest' });
      assert.equal(waiting.status, 'WAITING'); assert.equal('contactPhone' in waiting, false); assert.equal('notes' in waiting, false); assert.equal('privateToken' in waiting, false);
      await assert.rejects(service.manageWaitlistEntry({ action: 'GET_STATUS', privateToken: 'forged-token', actorName: 'Guest' }), errorCode('WAITLIST_NOT_FOUND'));
      await service.manageWaitlistEntry({ action: 'CALL', waitlistId: first.id, tableId: 'tbl_m06', actorName: 'Host' });
      const called = await service.manageWaitlistEntry({ action: 'GET_STATUS', privateToken, actorName: 'Guest' });
      assert.equal(called.status, 'CALLED'); assert.equal('heldTableLabel' in called ? called.heldTableLabel : null, 'M06');
      const seated = await service.manageWaitlistEntry({ action: 'SEAT', waitlistId: first.id, tableId: 'tbl_m06', actorName: 'Host' });
      const check = await service.manageWaitlistEntry({ action: 'GET_STATUS', privateToken, actorName: 'Guest' });
      assert.equal(check.status, 'SEATED'); assert.equal('tableId' in check ? check.tableId : null, 'tbl_m06');
      await depart('visitId' in seated ? seated.visitId! : 'missing');
      assert.equal((await service.manageWaitlistEntry({ action: 'GET_STATUS', privateToken, actorName: 'Guest' })).status, 'COMPLETED');
    });

    await scenario('moving a party preserves pending requests and bill/fulfillment context', async () => {
      const visit = await seat(); const order = await sale({ policy: 'PAY_LATER' }); const pending = await request();
      await assert.rejects(service.moveOrUpdateTableAndVisit({ action: 'MOVE_TABLE', visitId: visit.visitId, fromTableId: 'tbl_m01', toTableId: 'tbl_m02', actorName: 'Host' }), errorCode('STALE_TABLE'));
      await service.moveOrUpdateTableAndVisit({ action: 'MOVE_TABLE', visitId: visit.visitId, toTableId: 'tbl_m02', actorName: 'Host' });
      const accepted = await service.acceptOrderRequestByStaff({ orderRequestId: pending.requestId, actorName: 'Cashier', actorRole: 'CASHIER' });
      assert.equal(accepted.visitId, visit.visitId);
      assert.equal((await state()).bills.find(bill => bill.id === order.billId)?.tableLabel, 'M02');
      assert.equal((await units(order.orderId))[0].tableLabelSnapshot, 'M02');
      await clean('tbl_m06');
      await assert.rejects(clean('tbl_m02'), errorCode('TABLE_OCCUPIED'));
    });

    await scenario('cancel unpaid PREPAY restores reserved stock once and closes a zero-liability visit', async () => {
      await seat(); const order = await sale({ items: [pastry] }); const unit = (await units(order.orderId))[0];
      const before = (await db.select().from(schema.stockPools).where(eq(schema.stockPools.id, 'pool_croissant')))[0];
      assert.equal(before.reserved, 1);
      await cancel(unit.id, false); await cancel(unit.id, false);
      const after = (await db.select().from(schema.stockPools).where(eq(schema.stockPools.id, 'pool_croissant')))[0];
      assert.equal(after.reserved, 0); assert.equal(after.onHand, before.onHand);
      assert.equal((await state()).bills.find(bill => bill.id === order.billId)?.balanceIdr, 0);
      await depart(order.visitId);
    });

    await scenario('paid prepared item refunds across multiple receipts without restocking cooked food', async () => {
      await seat(); const order = await sale({ items: [pastry] });
      await pay(order.billId, 10000); await pay(order.billId);
      await service.transitionOrderUnits({ unitIds: (await units(order.orderId)).map(unit => unit.id), targetStatus: 'PREPARING', actorName: 'Kitchen', actorRole: 'KITCHEN' });
      const before = (await db.select().from(schema.stockPools).where(eq(schema.stockPools.id, 'pool_croissant')))[0];
      const result = await cancel((await units(order.orderId))[0].id);
      assert.equal(result.refundIds.length, 2); assert.equal(result.balanceIdr, 0);
      const snapshot = await state(); const bill = snapshot.bills.find(bill => bill.id === order.billId)!;
      assert.equal(bill.refunds.reduce((sum, refund) => sum + refund.amountIdr, 0), order.quote.totalIdr);
      assert.equal(bill.receipts.every(receipt => receipt.refundedFromReceiptIdr === receipt.amountIdr), true);
      assert.equal(snapshot.cashShifts[0].expectedCashIdr, 0);
      const after = (await db.select().from(schema.stockPools).where(eq(schema.stockPools.id, 'pool_croissant')))[0];
      assert.equal(after.onHand, before.onHand); assert.equal((await units(order.orderId))[0].wasteRecorded, true);
      await cancel((await units(order.orderId))[0].id); assert.equal((await state()).bills.find(bill => bill.id === order.billId)?.refunds.length, 2);
      await depart(order.visitId);
    });

    await scenario('deferred refund remains payable and can be completed after cancellation', async () => {
      await seat(); const order = await sale(); await pay(order.billId);
      const unit = (await units(order.orderId))[0]; await cancel(unit.id, false);
      assert.equal((await state()).bills.find(bill => bill.id === order.billId)?.paymentState, 'REFUND_DUE');
      await assert.rejects(depart(order.visitId), errorCode('VISIT_NOT_READY_TO_CLOSE'));
      await cancel(unit.id, true); await depart(order.visitId);
      assert.equal((await state()).bills.find(bill => bill.id === order.billId)?.refundedIdr, order.quote.totalIdr);
    });

    await scenario('cash refund without open drawer rolls back atomically', async () => {
      const order = await sale({ mode: 'TAKEAWAY' }); await pay(order.billId);
      const shift = (await state()).cashShifts[0];
      await service.manageCashShift({ action: 'CLOSE_SHIFT', shiftId: shift.id, countedCashIdr: shift.expectedCashIdr, actorName: 'Cashier' });
      await assert.rejects(cancel((await units(order.orderId))[0].id), errorCode('CASH_SHIFT_REQUIRED'));
      assert.equal((await units(order.orderId))[0].fulfillmentStatus, 'QUEUED');
      assert.equal((await state()).bills.find(bill => bill.id === order.billId)?.creditAdjustmentsIdr, 0);
    });

    await scenario('partial PREPAY + cancellation releases remaining funded units', async () => {
      const order = await sale({ mode: 'TAKEAWAY', items: [{ ...pastry, quantity: 2 }] });
      const orderUnits = await units(order.orderId); await pay(order.billId, orderUnits[0].netIdr);
      await cancel(orderUnits[1].id, false);
      assert.equal((await units(order.orderId)).find(unit => unit.id === orderUnits[0].id)?.fulfillmentStatus, 'QUEUED');
      await serve(order.orderId, 'TAKEAWAY'); await depart(order.visitId);
    });

    await scenario('TAKEAWAY uses pickup terminal status, not dine-in delivered', async () => {
      const order = await sale({ mode: 'TAKEAWAY', policy: 'PAY_LATER' }); await pay(order.billId);
      const unitIds = (await units(order.orderId)).map(unit => unit.id);
      await service.transitionOrderUnits({ unitIds, targetStatus: 'PREPARING', actorName: 'Kitchen', actorRole: 'KITCHEN' });
      await service.transitionOrderUnits({ unitIds, targetStatus: 'READY', actorName: 'Kitchen', actorRole: 'KITCHEN' });
      await assert.rejects(service.transitionOrderUnits({ unitIds, targetStatus: 'DELIVERED', actorName: 'Waiter', actorRole: 'WAITER' }), errorCode('FULFILLMENT_MODE_MISMATCH'));
      await service.transitionOrderUnits({ unitIds, targetStatus: 'PICKED_UP', actorName: 'Cashier', actorRole: 'CASHIER' });
      await depart(order.visitId);
      assert.equal((await state()).tables.every(table => table.physicalState === 'AVAILABLE'), true);
    });

    await scenario('expired requests do not block departure but cannot be accepted or reused', async () => {
      const visit = await seat(); const pending = await request();
      await db.update(schema.orderRequests).set({ expiresAt: new Date(0) }).where(eq(schema.orderRequests.id, pending.requestId));
      await depart(visit.visitId!);
      await assert.rejects(service.acceptOrderRequestByStaff({ orderRequestId: pending.requestId, actorName: 'Cashier', actorRole: 'CASHIER' }));
      assert.equal((await state()).orderRequests.find(row => row.id === pending.requestId)?.state, 'EXPIRED');
    });

    await scenario('closed visit invalidates issued join codes', async () => {
      const visit = await seat();
      const code = await service.moveOrUpdateTableAndVisit({ action: 'ISSUE_JOIN_CODE', visitId: visit.visitId, actorName: 'Host' });
      await depart(visit.visitId!);
      const check = await service.verifyCustomerPresence({ principalId: 'late_guest', joinCode: 'code' in code ? code.code : undefined });
      assert.equal(check.eligible, false);
      await assert.rejects(service.moveOrUpdateTableAndVisit({ action: 'ISSUE_JOIN_CODE', visitId: visit.visitId, actorName: 'Host' }), errorCode('VISIT_CLOSED'));
    });

    await scenario('split PREPAY bills release kitchen only after all related balances are settled', async () => {
      const order = await sale({ mode: 'TAKEAWAY', items: [{ ...tea, quantity: 2 }] }); const orderUnits = await units(order.orderId);
      const split = await service.splitBillByUnits({ sourceBillId: order.billId, unitIdsToMove: [orderUnits[0].id], newOwnerLabel: 'Dimas', actorName: 'Cashier' });
      await pay(order.billId);
      assert.ok((await units(order.orderId)).every(unit => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT'));
      const snapshot = await state(); const second = snapshot.bills.find(bill => bill.id !== order.billId && bill.visitId === order.visitId && bill.lifecycle !== 'VOID')!;
      assert.ok(split); await pay(second.id);
      assert.ok((await units(order.orderId)).every(unit => unit.fulfillmentStatus === 'QUEUED'));
      await serve(order.orderId, 'TAKEAWAY'); await depart(order.visitId);
    });

    await scenario('stocked modifiers are quoted, reserved, consumed and restored with their base item', async () => {
      const coffee = { menuItemId: 'item_kopi_aren', variantId: 'var_kopi_aren_reg', modifierOptionIds: ['modopt_gula_normal', 'modopt_es_normal', 'modopt_addon_oat', 'modopt_addon_shot'], note: '', quantity: 1 };
      await db.update(schema.stockPools).set({ onHand: 0 }).where(eq(schema.stockPools.id, 'pool_oat_milk'));
      await assert.rejects(request({ mode: 'TAKEAWAY', items: [coffee] }), errorCode('MODIFIER_OUT_OF_STOCK'));
      await db.update(schema.stockPools).set({ onHand: 1 }).where(eq(schema.stockPools.id, 'pool_oat_milk'));
      const first = await request({ mode: 'TAKEAWAY', items: [coffee] });
      const second = await request({ mode: 'TAKEAWAY', items: [coffee] });
      const accepted = await service.acceptOrderRequestByStaff({ orderRequestId: first.requestId, actorName: 'Cashier', actorRole: 'CASHIER' });
      await assert.rejects(service.acceptOrderRequestByStaff({ orderRequestId: second.requestId, actorName: 'Cashier', actorRole: 'CASHIER' }));
      const pools = () => db.select().from(schema.stockPools);
      assert.equal((await pools()).find(pool => pool.id === 'pool_espresso')?.reserved, 2);
      assert.equal((await pools()).find(pool => pool.id === 'pool_oat_milk')?.reserved, 1);
      await pay(accepted.billId!);
      assert.equal((await pools()).find(pool => pool.id === 'pool_oat_milk')?.onHand, 0);
      assert.equal((await pools()).find(pool => pool.id === 'pool_espresso')?.onHand, 40);
      await cancel((await units(accepted.orderId!))[0].id);
      assert.equal((await pools()).find(pool => pool.id === 'pool_oat_milk')?.onHand, 1);
      assert.equal((await pools()).find(pool => pool.id === 'pool_espresso')?.onHand, 42);
      assert.equal((await pools()).every(pool => pool.reserved >= 0 && pool.reserved <= pool.onHand), true);
    });

    await scenario('split then merge retains original funding dependencies; unrelated parties cannot merge debts', async () => {
      await seat();
      const first = await sale({ items: [{ ...tea, quantity: 2 }] }); const second = await sale({ items: [pastry] });
      const firstUnits = await units(first.orderId);
      const split = await service.splitBillByUnits({ sourceBillId: first.billId, unitIdsToMove: [firstUnits[0].id], newOwnerLabel: 'Dimas', actorName: 'Cashier' });
      await service.mergeOpenBills({ sourceBillId: split.newBillId, targetBillId: second.billId, actorName: 'Cashier' });
      await pay(second.billId);
      assert.ok((await units(first.orderId)).every(unit => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT'));
      assert.equal((await units(second.orderId))[0].fulfillmentStatus, 'QUEUED');
      await pay(first.billId);
      assert.ok((await units(first.orderId)).every(unit => unit.fulfillmentStatus === 'QUEUED'));
      const otherParty = await sale({ mode: 'TAKEAWAY', policy: 'PAY_LATER' });
      const sameParty = await sale({ policy: 'PAY_LATER' });
      await assert.rejects(service.mergeOpenBills({ sourceBillId: sameParty.billId, targetBillId: otherParty.billId, actorName: 'Cashier' }), errorCode('BILL_VISIT_MISMATCH'));
      const differentPolicy = await sale({ policy: 'PREPAY' });
      await assert.rejects(service.mergeOpenBills({ sourceBillId: sameParty.billId, targetBillId: differentPolicy.billId, actorName: 'Cashier' }), errorCode('BILL_POLICY_MISMATCH'));
    });

    await scenario('automatic add-on acceptance requires an unexpired participant admission', async () => {
      await service.updateOutletSettingsOrPromoOrFeedback({ action: 'UPDATE_OUTLET_POLICY', autoAcceptParticipant: true });
      await seat();
      const first = await sale({ principalId: 'admitted_guest', policy: 'PAY_LATER' });
      const automatic = await request({ principalId: 'admitted_guest' });
      assert.equal((await state()).orderRequests.find(row => row.id === automatic.requestId)?.state, 'ACCEPTED');
      await db.update(schema.visitParticipants).set({ expiresAt: new Date(0) }).where(eq(schema.visitParticipants.visitId, first.visitId));
      const expired = await request({ principalId: 'admitted_guest' });
      assert.equal((await state()).orderRequests.find(row => row.id === expired.requestId)?.state, 'REQUESTED');
      await service.acceptOrderRequestByStaff({ orderRequestId: expired.requestId, actorName: 'Cashier', actorRole: 'CASHIER' });
      assert.ok((await db.select().from(schema.visitParticipants).where(eq(schema.visitParticipants.visitId, first.visitId)))[0].expiresAt.getTime() > Date.now());
    });

    await scenario('draft floor plan cannot mutate live geometry or publish over occupied tables', async () => {
      const snapshot = await state(); const room = snapshot.rooms.find(room => room.id === 'room_indoor')!;
      const proposed = snapshot.tables.filter(table => table.roomId === room.id).map(table => ({ id: table.id, label: table.label, capacity: table.capacity, shape: table.shape as 'RECTANGLE', xMm: table.xMm, yMm: table.yMm, widthMm: table.widthMm, heightMm: table.heightMm, rotationDeg: table.rotationDeg }));
      const payload = { roomId: room.id, shapePreset: 'L_SHAPE' as const, polygon: room.polygonJson as Array<{ x: number; y: number }>, tables: proposed, warningsAcknowledged: true, actorName: 'Manager' };
      const visit = await seat();
      await service.updateFloorPlanLayout({ ...payload, action: 'SAVE_DRAFT' });
      assert.deepEqual((await state()).rooms.find(row => row.id === room.id)?.polygonJson, room.polygonJson);
      assert.equal((await state()).tables.find(table => table.id === 'tbl_m06')?.physicalState, 'OCCUPIED');
      await assert.rejects(service.updateFloorPlanLayout({ ...payload, action: 'PUBLISH_DRAFT' }), errorCode('ROOM_OCCUPIED'));
      await depart(visit.visitId!); await clean();
      await service.updateFloorPlanLayout({ ...payload, action: 'PUBLISH_DRAFT' });
      assert.equal((await state()).layoutVersions[0].status, 'PUBLISHED');
    });

    await scenario('invalid payment policies and fractional or excessive cash movements fail before mutation', async () => {
      await assert.rejects(service.updateOutletSettingsOrPromoOrFeedback({ action: 'UPDATE_OUTLET_POLICY', paymentPolicy: 'FREE' as any }), errorCode('INVALID_PAYMENT_POLICY'));
      await assert.rejects(service.updateOutletSettingsOrPromoOrFeedback({ action: 'UPDATE_OUTLET_POLICY', taxBps: Number.NaN }), errorCode('INVALID_RATE'));
      const before = (await state()).cashShifts[0];
      await assert.rejects(service.manageCashShift({ action: 'CASH_IN', amountIdr: 0.5, reason: 'bad amount', actorName: 'Cashier' }));
      await assert.rejects(service.manageCashShift({ action: 'CASH_OUT', amountIdr: 1000, reason: 'empty drawer', actorName: 'Cashier' }), errorCode('INSUFFICIENT_CASH'));
      assert.equal((await state()).cashShifts[0].expectedCashIdr, before.expectedCashIdr);
    });

    await t.test('ordering-only QR can complete two visits using referenced external cashier receipts', async () => {
      await fixture.reset(['catalog', 'ordering']);
      for (let index = 0; index < 2; index++) {
        const order = await sale({ principalId: `counter_guest_${index}`, policy: 'PAY_LATER' });
        await assert.rejects(service.recordBillPayment({ billId: order.billId, method: 'EXTERNAL_COUNTER', amountIdr: order.quote.totalIdr, actorName: 'Counter' }), errorCode('EXTERNAL_REFERENCE_REQUIRED'));
        await service.recordBillPayment({ billId: order.billId, method: 'EXTERNAL_COUNTER', amountIdr: order.quote.totalIdr, referenceCode: `OUTSIDE-${index}`, actorName: 'Counter', idempotencyKey: `counter-${index}` });
        await service.transitionOrderUnits({ unitIds: (await units(order.orderId)).map(unit => unit.id), targetStatus: 'DELIVERED', actorName: 'Counter', actorRole: 'CASHIER' });
        await depart(order.visitId);
        assert.equal((await state()).tables.find(table => table.id === 'tbl_m06')?.physicalState, 'AVAILABLE');
      }
      const snapshot = await state();
      assert.equal(snapshot.cashShifts.length, 0); assert.equal(snapshot.visits.filter(visit => visit.status === 'CLOSED').length, 2);
      assert.equal(snapshot.bills.every(bill => bill.receipts[0].method === 'EXTERNAL_COUNTER'), true);
    });

    await scenario('full cashier package rejects external-register shortcut', async () => {
      const order = await sale({ mode: 'TAKEAWAY' });
      await assert.rejects(service.recordBillPayment({ billId: order.billId, method: 'EXTERNAL_COUNTER', amountIdr: order.quote.totalIdr, referenceCode: 'EXTERNAL-1', actorName: 'Cashier' }), errorCode('EXTERNAL_COUNTER_UNAVAILABLE'));
    });
  } finally { await fixture.close(); }
});
