/** Resolve a customer's payment label from the current unit allocations.
 * A visit can contain several orders and split or merged bills; visitId alone
 * never establishes that an individual order has been paid.
 */
export type OrderBill = {
  id: string;
  lifecycle?: string;
  paymentState?: string;
  balanceIdr: number;
  verifiedReceiptsIdr?: number;
  allocatedUnits?: { id: string; orderId: string }[];
  hasActiveExternalAttempt?: boolean;
};

export function summarizeOrderBilling<T extends OrderBill>(orderId: string, bills: T[]) {
  const relatedBills = bills.filter(bill => bill.lifecycle !== 'VOID' &&
    bill.allocatedUnits?.some(unit => unit.orderId === orderId));
  const outstandingBalanceIdr = relatedBills.reduce((total, bill) => total + Math.max(0, bill.balanceIdr), 0);
  const refundDueIdr = relatedBills.reduce((total, bill) => total + Math.max(0, -bill.balanceIdr), 0);
  const paymentState = relatedBills.length === 0 ? 'NO_BILL'
    : relatedBills.some(bill => bill.paymentState === 'REFUND_DUE' || bill.balanceIdr < 0) ? 'REFUND_DUE'
    : relatedBills.every(bill => bill.paymentState === 'SETTLED' && bill.balanceIdr === 0) ? 'SETTLED'
    : relatedBills.some(bill => bill.paymentState === 'SETTLED' || bill.paymentState === 'PARTIALLY_PAID' || (bill.verifiedReceiptsIdr || 0) > 0) ? 'PARTIALLY_PAID'
    : 'UNPAID';
  return {
    relatedBills, paymentState, outstandingBalanceIdr, refundDueIdr,
    hasPendingPayment: relatedBills.some(bill => bill.hasActiveExternalAttempt),
    hasMergedBill: relatedBills.some(bill => bill.allocatedUnits?.some(unit => unit.orderId !== orderId)),
  };
}
