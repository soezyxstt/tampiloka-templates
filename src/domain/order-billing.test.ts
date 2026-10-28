import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeOrderBilling, type OrderBill } from './order-billing.ts';

const bill = (id: string, orderIds: string[], overrides: Partial<OrderBill> = {}): OrderBill => ({
  id, lifecycle: 'OPEN', paymentState: 'UNPAID', balanceIdr: 20000,
  allocatedUnits: orderIds.map((orderId, index) => ({ id: `${id}-unit-${index}`, orderId })),
  ...overrides,
});

test('a settled first order does not pay the add-on order at the same visit', () => {
  const bills = [bill('paid', ['first'], { paymentState: 'SETTLED', balanceIdr: 0 }), bill('new', ['add-on'])];
  assert.equal(summarizeOrderBilling('first', bills).paymentState, 'SETTLED');
  assert.equal(summarizeOrderBilling('add-on', bills).paymentState, 'UNPAID');
  assert.deepEqual(summarizeOrderBilling('add-on', bills).relatedBills.map(value => value.id), ['new']);
});

test('all split bills must settle before an order is shown as paid', () => {
  const bills = [bill('part-a', ['order'], { paymentState: 'SETTLED', balanceIdr: 0 }), bill('part-b', ['order'])];
  assert.equal(summarizeOrderBilling('order', bills).paymentState, 'PARTIALLY_PAID');
  assert.equal(summarizeOrderBilling('order', bills).outstandingBalanceIdr, 20000);
  bills[1] = { ...bills[1], paymentState: 'SETTLED', balanceIdr: 0 };
  assert.equal(summarizeOrderBilling('order', bills).paymentState, 'SETTLED');
});

test('merged bills use surviving allocations and exclude void sources', () => {
  const summary = summarizeOrderBilling('second', [
    bill('old', ['second'], { lifecycle: 'VOID', paymentState: 'SETTLED', balanceIdr: 0 }),
    bill('combined', ['first', 'second'], { hasActiveExternalAttempt: true }),
  ]);
  assert.deepEqual(summary.relatedBills.map(value => value.id), ['combined']);
  assert.equal(summary.paymentState, 'UNPAID');
  assert.equal(summary.hasMergedBill, true);
  assert.equal(summary.hasPendingPayment, true);
});

test('refunds and missing allocations are never presented as settled', () => {
  const summary = summarizeOrderBilling('order', [bill('refund', ['order'], { paymentState: 'REFUND_DUE', balanceIdr: -12000 })]);
  assert.equal(summary.paymentState, 'REFUND_DUE');
  assert.equal(summary.refundDueIdr, 12000);
  assert.equal(summarizeOrderBilling('unrelated', [bill('other', ['order'])]).paymentState, 'NO_BILL');
});
