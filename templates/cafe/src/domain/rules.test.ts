import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateProportionalIdr,
  summarizeVisitLifecycle,
  createDemoPaymentInstructions,
  isValidOrderQuantity,
  computePricingBreakdown,
  computeAvailableStock,
  validateStockPoolInvariant,
  computeBillFinancialState,
  validateSplitMergeEligibility,
  canReleasePromoGroupToKitchen,
  validateRefundAndCreditLimits,
  evaluatePresenceCheck,
  validateRoomPolygon,
  validateTablePlacements,
  evaluateLoyaltyDelta,
  computeExpectedCashShift,
  hasFormulaInjectionPrefix,
  sanitizeSpreadsheetExportCell,
} from './rules.ts';

test('A24: Largest-remainder allocation splits Rp10.000 across 3 x Rp25.000 units into 3334, 3333, 3333', () => {
  const alloc = allocateProportionalIdr(10000, [
    { unitId: 'unit-1', weightIdr: 25000 },
    { unitId: 'unit-2', weightIdr: 25000 },
    { unitId: 'unit-3', weightIdr: 25000 },
  ]);
  assert.equal(alloc['unit-1'], 3334);
  assert.equal(alloc['unit-2'], 3333);
  assert.equal(alloc['unit-3'], 3333);
  assert.equal(alloc['unit-1'] + alloc['unit-2'] + alloc['unit-3'], 10000);
});

test('Pricing breakdown allocates service charge and PB1 tax accurately across units', () => {
  const quote = computePricingBreakdown({
    units: [
      {
        unitId: 'u1',
        menuItemId: 'm1',
        variantId: 'v1',
        itemName: 'Es Kopi Susu Aren',
        variantName: 'Regular',
        modifiersSummary: 'Gula Normal',
        note: '',
        stationCode: 'BAR',
        grossIdr: 28000,
      },
      {
        unitId: 'u2',
        menuItemId: 'm2',
        variantId: 'v2',
        itemName: 'Croissant Mentega',
        variantName: 'Standar',
        modifiersSummary: '',
        note: '',
        stationCode: 'PASTRY',
        grossIdr: 22000,
      },
    ],
    promoDiscountIdr: 5000,
    serviceChargeBps: 500, // 5%
    taxBps: 1000, // 10%
    serviceInTaxBase: true,
  });

  assert.equal(quote.subtotalIdr, 50000);
  assert.equal(quote.discountIdr, 5000);
  assert.equal(quote.netSubtotalIdr, 45000);
  assert.equal(quote.serviceIdr, 2250);
  assert.equal(quote.taxIdr, 4725);
  assert.equal(quote.totalIdr, 51975);

  const sumUnitsNet = quote.units.reduce((acc, u) => acc + u.netIdr, 0);
  assert.equal(sumUnitsNet, quote.totalIdr);
});

test('A10 & F04: Stock pool availability and invariant prevents negative or over-reserved stock', () => {
  assert.equal(computeAvailableStock({ mode: 'FINITE', onHand: 5, reserved: 4 }), 1);
  assert.equal(validateStockPoolInvariant({ onHand: 5, reserved: 5 }).valid, true);
  assert.equal(validateStockPoolInvariant({ onHand: 5, reserved: 6 }).valid, false);
  assert.equal(validateStockPoolInvariant({ onHand: -1, reserved: 0 }).valid, false);
});

test('A22 & A29: Bill ledger formula computes PARTIALLY_PAID, SETTLED, and REFUND_DUE accurately', () => {
  // Partial cash Rp30.000 on Rp100.000 bill
  const partial = computeBillFinancialState({
    originalTotalIdr: 100000,
    debitAdjustmentsIdr: 0,
    creditAdjustmentsIdr: 0,
    verifiedReceiptsIdr: 30000,
    refundedIdr: 0,
    lifecycle: 'FINALIZED',
  });
  assert.equal(partial.balanceIdr, 70000);
  assert.equal(partial.paymentState, 'PARTIALLY_PAID');

  // A22: PREPAY partial cash Rp30.000 then all units expire (credit Rp100.000) -> REFUND_DUE -30.000
  const expiredWithPartialCash = computeBillFinancialState({
    originalTotalIdr: 100000,
    debitAdjustmentsIdr: 0,
    creditAdjustmentsIdr: 100000,
    verifiedReceiptsIdr: 30000,
    refundedIdr: 0,
    lifecycle: 'FINALIZED',
  });
  assert.equal(expiredWithPartialCash.liabilityIdr, 0);
  assert.equal(expiredWithPartialCash.balanceIdr, -30000);
  assert.equal(expiredWithPartialCash.paymentState, 'REFUND_DUE');

  // A29: Settled Rp100.000 bill, cancel 1 item (credit Rp20.000) + refund Rp20.000 -> balance 0 SETTLED
  const afterRefund = computeBillFinancialState({
    originalTotalIdr: 100000,
    debitAdjustmentsIdr: 0,
    creditAdjustmentsIdr: 20000,
    verifiedReceiptsIdr: 100000,
    refundedIdr: 20000,
    lifecycle: 'FINALIZED',
  });
  assert.equal(afterRefund.liabilityIdr, 80000);
  assert.equal(afterRefund.netCollectedIdr, 80000);
  assert.equal(afterRefund.balanceIdr, 0);
  assert.equal(afterRefund.paymentState, 'SETTLED');
});

test('A25 & A55: Promo funding dependency gate blocks PREPAY release until all bills in group settle', () => {
  assert.equal(
    canReleasePromoGroupToKitchen({
      paymentPolicy: 'PREPAY',
      groupBills: [
        { billId: 'b-qualifying', paymentState: 'UNPAID', lifecycle: 'OPEN' },
        { billId: 'b-free-gift', paymentState: 'SETTLED', lifecycle: 'FINALIZED' },
      ],
    }),
    false
  );

  assert.equal(
    canReleasePromoGroupToKitchen({
      paymentPolicy: 'PREPAY',
      groupBills: [
        { billId: 'b-qualifying', paymentState: 'SETTLED', lifecycle: 'FINALIZED' },
        { billId: 'b-free-gift', paymentState: 'SETTLED', lifecycle: 'FINALIZED' },
      ],
    }),
    true
  );
});

test('A27, A30, A57: Split/merge and refund guards reject locked bills or over-refunds', () => {
  const splitLocked = validateSplitMergeEligibility({
    lifecycle: 'OPEN',
    verifiedReceiptsIdr: 0,
    debitAdjustmentsIdr: 0,
    creditAdjustmentsIdr: 0,
    hasActiveExternalAttempt: true,
  });
  assert.equal(splitLocked.allowed, false);

  const overCreditUnit = validateRefundAndCreditLimits({
    unitNetIdr: 25000,
    unitExistingCreditIdr: 20000,
    requestedCreditIdr: 10000,
    receiptAmountIdr: 100000,
    receiptExistingRefundedIdr: 0,
    requestedRefundIdr: 10000,
  });
  assert.equal(overCreditUnit.valid, false);
  assert.equal(overCreditUnit.code, 'UNIT_CREDIT_EXCEEDED');
});

test('A06 & B07: Presence check enforces strict radius without padding by GPS accuracy', () => {
  // Outlet at Bandung (-6.9175, 107.6191), radius 75m, maxAccuracy 50m
  const inside = evaluatePresenceCheck({
    outletLat: -6.9175,
    outletLng: 107.6191,
    radiusMeters: 75,
    maxAccuracyMeters: 50,
    clientLat: -6.9176,
    clientLng: 107.6192,
    clientAccuracyMeters: 18,
    nonceValid: true,
  });
  assert.equal(inside.eligible, true);
  assert.equal(inside.result, 'GEO_ELIGIBLE');

  const blurryGps = evaluatePresenceCheck({
    outletLat: -6.9175,
    outletLng: 107.6191,
    radiusMeters: 75,
    maxAccuracyMeters: 50,
    clientLat: -6.9175,
    clientLng: 107.6191,
    clientAccuracyMeters: 120,
    nonceValid: true,
  });
  assert.equal(blurryGps.eligible, false);
  assert.equal(blurryGps.result, 'LOW_ACCURACY');
});

test('A38 & B04: Floor plan polygon and rotated table collision validation', () => {
  // L-shaped room polygon in mm
  const lShapePolygon = [
    { x: 0, y: 0 },
    { x: 8000, y: 0 },
    { x: 8000, y: 4000 },
    { x: 4000, y: 4000 },
    { x: 4000, y: 8000 },
    { x: 0, y: 8000 },
  ];
  assert.equal(validateRoomPolygon(lShapePolygon).valid, true);

  const validPlacement = validateTablePlacements({
    roomPolygon: lShapePolygon,
    tables: [
      { id: 't1', label: 'M01', xMm: 800, yMm: 800, widthMm: 1200, heightMm: 800, rotationDeg: 0 },
      { id: 't2', label: 'M02', xMm: 2800, yMm: 800, widthMm: 1200, heightMm: 800, rotationDeg: 15 },
    ],
  });
  assert.equal(validPlacement.valid, true);

  // Table outside the cut-out corner of the L-shape (x=6000, y=6000)
  const outOfBounds = validateTablePlacements({
    roomPolygon: lShapePolygon,
    tables: [
      { id: 't3', label: 'M03', xMm: 5500, yMm: 5500, widthMm: 1200, heightMm: 800, rotationDeg: 0 },
    ],
  });
  assert.equal(outOfBounds.valid, false);
});

test('A48, A58 & F10: Loyalty delta, shift cash variance, and CSV formula guard', () => {
  assert.equal(evaluateLoyaltyDelta({ previouslyEligible: false, nowEligible: true }), 1);
  assert.equal(evaluateLoyaltyDelta({ previouslyEligible: true, nowEligible: false }), -1);
  assert.equal(evaluateLoyaltyDelta({ previouslyEligible: true, nowEligible: true }), 0);

  const shift = computeExpectedCashShift({
    openingFloatIdr: 500000,
    cashReceiptsIdr: 420000,
    cashInIdr: 50000,
    cashRefundsIdr: 20000,
    cashOutIdr: 30000,
    countedCashIdr: 915000,
  });
  assert.equal(shift.expectedCashIdr, 920000);
  assert.equal(shift.varianceIdr, -5000);

  assert.equal(hasFormulaInjectionPrefix('=SUM(A1:A2)'), true);
  assert.equal(hasFormulaInjectionPrefix('Es Kopi Susu'), false);
  assert.equal(sanitizeSpreadsheetExportCell('@cmd'), "'@cmd");
});

test('Configurable tax & service charges: 0% tax included, 11% tax only, and 5% service + 11% tax', () => {
  const sampleUnits = [
    {
      unitId: 'u1',
      menuItemId: 'm1',
      variantId: 'v1',
      itemName: 'Es Kopi Susu Aren',
      variantName: 'Regular',
      modifiersSummary: '',
      note: '',
      stationCode: 'BAR',
      grossIdr: 100000,
    },
  ];

  // 1. Tax included (0% service, 0% tax)
  const noTax = computePricingBreakdown({
    units: sampleUnits,
    promoDiscountIdr: 0,
    serviceChargeBps: 0,
    taxBps: 0,
    serviceInTaxBase: false,
  });
  assert.equal(noTax.serviceIdr, 0);
  assert.equal(noTax.taxIdr, 0);
  assert.equal(noTax.totalIdr, 100000);

  // 2. Tax 11% only (0% service, 1100 bps tax)
  const tax11Only = computePricingBreakdown({
    units: sampleUnits,
    promoDiscountIdr: 0,
    serviceChargeBps: 0,
    taxBps: 1100,
    serviceInTaxBase: false,
  });
  assert.equal(tax11Only.serviceIdr, 0);
  assert.equal(tax11Only.taxIdr, 11000);
  assert.equal(tax11Only.totalIdr, 111000);

  // 3. Service 5% + Tax 11% (with service in tax base)
  const srv5Tax11 = computePricingBreakdown({
    units: sampleUnits,
    promoDiscountIdr: 0,
    serviceChargeBps: 500,
    taxBps: 1100,
    serviceInTaxBase: true,
  });
  assert.equal(srv5Tax11.serviceIdr, 5000);
  assert.equal(srv5Tax11.taxIdr, 11550);
  assert.equal(srv5Tax11.totalIdr, 116550);
});



test('Order quantities reject fractional, non-finite and out-of-range portions', () => {
  for (const quantity of [0, -1, 21, 1.5, NaN, Infinity]) {
    assert.equal(isValidOrderQuantity(quantity), false);
  }
  for (const quantity of [1, 10, 20]) assert.equal(isValidOrderQuantity(quantity), true);
});

test('Demo payment instructions cannot be mistaken for payable QRIS or bank account data', () => {
  const qr = createDemoPaymentInstructions({ providerOrderId: 'TEST/123', amountIdr: 30000, method: 'QRIS', merchantName: 'Cafe' });
  assert.equal(qr.isDemo, true);
  assert.equal(qr.mode, 'DEMO');
  assert.equal(qr.qrPayload, 'cafe-demo://payment/TEST%2F123?amount=30000');
  assert.equal(qr.vaNumber, undefined);
  const va = createDemoPaymentInstructions({ providerOrderId: 'TEST123', amountIdr: 30000, method: 'VIRTUAL_ACCOUNT', merchantName: 'Cafe' });
  assert.equal(va.qrPayload, undefined);
  assert.equal(va.vaNumber, 'DEMO-TEST123');
  assert.match(va.notice, /tidak dapat dibayar/);
});

test('Receipt validation rejects zero, fractional, excessive and insufficient cash payments', async () => {
  const { calculatePaymentAmounts } = await import('./rules.ts');
  for (const amountIdr of [0, -1, 1.5, 60000, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => calculatePaymentAmounts({ balanceIdr: 50000, amountIdr, method: 'CASH' }));
  }
  assert.throws(() => calculatePaymentAmounts({ balanceIdr: 50000, amountIdr: 30000, tenderedIdr: 20000, method: 'CASH' }));
  assert.deepEqual(calculatePaymentAmounts({ balanceIdr: 50000, amountIdr: 30000, tenderedIdr: 50000, method: 'CASH' }), { amountToPay: 30000, tendered: 50000, changeIdr: 20000 });
  assert.deepEqual(calculatePaymentAmounts({ balanceIdr: 50000, amountIdr: 50000, method: 'QRIS' }), { amountToPay: 50000, tendered: 50000, changeIdr: 0 });
});

test('Fulfillment moves forward and standalone packages can finish accepted orders', async () => {
  const { canTransitionUnit } = await import('./rules.ts');
  assert.equal(canTransitionUnit('QUEUED', 'PREPARING'), true);
  assert.equal(canTransitionUnit('PREPARING', 'READY'), true);
  assert.equal(canTransitionUnit('READY', 'DELIVERED'), true);
  assert.equal(canTransitionUnit('DELIVERED', 'PREPARING'), false);
  assert.equal(canTransitionUnit('QUEUED', 'DELIVERED'), false);
  assert.equal(canTransitionUnit('QUEUED', 'DELIVERED', true), true);
  assert.equal(canTransitionUnit('HELD_FOR_PAYMENT', 'DELIVERED', true), false);
  assert.equal(canTransitionUnit('CANCELLED', 'READY'), false);
  assert.equal(canTransitionUnit('READY', 'ARBITRARY'), false);
});


test('Visit departure evaluates every active bill independently, without netting debts against refunds', () => {
  const summary = summarizeVisitLifecycle({ visitId: 'visit', bills: [
    { id: 'paid', visitId: 'visit', lifecycle: 'FINALIZED', balanceIdr: 0 },
    { id: 'debt', visitId: 'visit', lifecycle: 'OPEN', balanceIdr: 10000 },
    { id: 'refund', visitId: 'visit', lifecycle: 'FINALIZED', balanceIdr: -10000 },
    { id: 'void', visitId: 'visit', lifecycle: 'VOID', balanceIdr: 999999 },
    { id: 'other', visitId: 'other', lifecycle: 'OPEN', balanceIdr: 999999 },
  ], orderUnits: [], orderRequests: [] });
  assert.equal(summary.canDepart, false);
  assert.equal(summary.outstandingBalanceIdr, 10000);
  assert.equal(summary.refundDueIdr, 10000);
  assert.deepEqual(summary.blockers.map(blocker => blocker.code), ['UNPAID_BILLS', 'REFUND_DUE']);
});

test('Departure sees pending payments, pending refunds, live requests and unresolved service even with zero balance', () => {
  const summary = summarizeVisitLifecycle({ visitId: 'visit', now: 1000,
    bills: [{ id: 'bill', visitId: 'visit', lifecycle: 'FINALIZED', balanceIdr: 0 }],
    paymentAttempts: [{ billId: 'bill', status: 'UNKNOWN' }], refunds: [{ billId: 'bill', state: 'PENDING' }],
    orderUnits: [{ visitId: 'visit', fulfillmentStatus: 'READY' }],
    orderRequests: [{ visitId: 'visit', state: 'REQUESTED', expiresAt: new Date(1001) }, { visitId: 'visit', state: 'REQUESTED', expiresAt: new Date(1000) }],
    serviceRequests: [{ visitId: 'visit', state: 'ACKNOWLEDGED' }],
  });
  assert.equal(summary.canDepart, false);
  assert.equal(summary.pendingRequestCount, 1);
  assert.deepEqual(summary.blockers.map(blocker => blocker.code), ['REFUND_DUE', 'PENDING_PAYMENT', 'PENDING_REQUESTS', 'UNFINISHED_ITEMS', 'OPEN_SERVICE_REQUESTS']);
});

test('Served/cancelled units and resolved attempts permit departure, independently of eating time', () => {
  const summary = summarizeVisitLifecycle({ visitId: 'visit', bills: [{ id: 'bill', visitId: 'visit', lifecycle: 'FINALIZED', balanceIdr: 0 }],
    orderUnits: ['DELIVERED', 'PICKED_UP', 'CANCELLED'].map(fulfillmentStatus => ({ visitId: 'visit', fulfillmentStatus })),
    orderRequests: [], paymentAttempts: [{ billId: 'bill', status: 'CANCELLED' }], serviceRequests: [{ visitId: 'visit', state: 'RESOLVED' }],
  });
  assert.equal(summary.canDepart, true);
  assert.deepEqual(summary.blockers, []);
});
