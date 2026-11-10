import test from 'node:test';
import assert from 'node:assert/strict';
import { filterReportBills, isInReportRange, reportBillTotals, reportDailyTotals, reportRangeForPeriod } from './reporting.ts';

test('resolves inclusive business-date periods across weeks, months and years', () => {
  assert.deepEqual(reportRangeForPeriod('day', '2026-12-31', '', ''), { start: '2026-12-31', end: '2026-12-31' });
  assert.deepEqual(reportRangeForPeriod('week', '2027-01-01', '', ''), { start: '2026-12-28', end: '2027-01-03' });
  assert.deepEqual(reportRangeForPeriod('week', '2026-03-08', '', ''), { start: '2026-03-02', end: '2026-03-08' });
  assert.deepEqual(reportRangeForPeriod('month', '2024-02-15', '', ''), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(reportRangeForPeriod('month', '2025-02-15', '', ''), { start: '2025-02-01', end: '2025-02-28' });
  assert.deepEqual(reportRangeForPeriod('custom', '', '2026-11-01', '2026-11-30'), { start: '2026-11-01', end: '2026-11-30' });
  assert.equal(reportRangeForPeriod('custom', '', '2026-11-30', '2026-11-01'), null);
  assert.equal(reportRangeForPeriod('custom', '', '', '2026-11-01'), null);
  assert.equal(reportRangeForPeriod('day', '2025-02-29', '', ''), null);
});

test('filters both endpoints and excludes void bills before totaling or grouping', () => {
  const range = { start: '2026-11-01', end: '2026-11-02' };
  const bills = [
    { businessDate: '2026-10-31', originalTotalIdr: 900 },
    { businessDate: '2026-11-01', lifecycle: 'OPEN', originalTotalIdr: 100, debitAdjustmentsIdr: 20, creditAdjustmentsIdr: 10, verifiedReceiptsIdr: 80, refundedIdr: 5, balanceIdr: 35 },
    { businessDate: '2026-11-02', lifecycle: 'CLOSED', originalTotalIdr: 200, verifiedReceiptsIdr: 200, refundedIdr: 20, balanceIdr: 0 },
    { businessDate: '2026-11-02', lifecycle: 'VOID', originalTotalIdr: 500, verifiedReceiptsIdr: 500 },
    { businessDate: '2026-11-03', originalTotalIdr: 900 },
  ];
  const selected = filterReportBills(bills, range);
  assert.equal(selected.length, 2);
  assert.equal(isInReportRange('2026-11-01', range), true);
  assert.equal(isInReportRange('2026-11-02', range), true);
  assert.equal(isInReportRange('2026-11-03', range), false);
  assert.equal(filterReportBills(bills, null).length, 0);
  const totals = reportBillTotals(selected);
  assert.deepEqual([totals.billed, totals.received, totals.refunded, totals.outstanding], [310, 280, 25, 35]);
  assert.equal(reportBillTotals([{ businessDate: '2026-11-01', balanceIdr: -100 }]).outstanding, 0);
  assert.deepEqual(reportDailyTotals(selected).map(day => [day.date, day.count, day.billed, day.received - day.refunded]), [
    ['2026-11-01', 1, 110, 75], ['2026-11-02', 1, 200, 180],
  ]);
});
