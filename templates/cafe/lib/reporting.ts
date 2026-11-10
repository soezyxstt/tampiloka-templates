/** Calendar dates are business-date strings, not timestamps in the browser timezone. */
export type ReportPeriod = 'day' | 'week' | 'month' | 'custom';
export type ReportRange = { start: string; end: string };

function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  if (year < 1) return null;
  // UTC is used only for calendar arithmetic, never to interpret a local instant.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function calendarDateString(date: Date): string | null {
  const year = date.getUTCFullYear();
  if (year < 1 || year > 9999) return null;
  return `${String(year).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** Weeks run Monday through Sunday; both ends of every range are inclusive. */
export function reportRangeForPeriod(period: ReportPeriod, anchor: string, customStart: string, customEnd: string): ReportRange | null {
  if (period === 'custom') {
    return parseCalendarDate(customStart) && parseCalendarDate(customEnd) && customStart <= customEnd
      ? { start: customStart, end: customEnd } : null;
  }
  const date = parseCalendarDate(anchor);
  if (!date) return null;
  if (period === 'day') return { start: anchor, end: anchor };
  const start = new Date(date.getTime());
  const end = new Date(date.getTime());
  if (period === 'week') {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    start.setUTCDate(date.getUTCDate() - daysSinceMonday);
    end.setUTCDate(date.getUTCDate() + 6 - daysSinceMonday);
  } else {
    start.setUTCDate(1);
    end.setUTCFullYear(date.getUTCFullYear(), date.getUTCMonth() + 1, 0);
  }
  const startString = calendarDateString(start), endString = calendarDateString(end);
  return startString && endString ? { start: startString, end: endString } : null;
}

export function isInReportRange(date: string, range: ReportRange | null): boolean {
  return Boolean(range && typeof date === 'string' && date >= range.start && date <= range.end);
}

export type ReportBill = {
  businessDate: string;
  lifecycle?: string;
  subtotalIdr?: number | string | null;
  discountIdr?: number | string | null;
  serviceIdr?: number | string | null;
  taxIdr?: number | string | null;
  debitAdjustmentsIdr?: number | string | null;
  creditAdjustmentsIdr?: number | string | null;
  originalTotalIdr?: number | string | null;
  verifiedReceiptsIdr?: number | string | null;
  refundedIdr?: number | string | null;
  balanceIdr?: number | string | null;
};

export function filterReportBills<T extends ReportBill>(bills: T[], range: ReportRange | null): T[] {
  return bills.filter(bill => bill.lifecycle !== 'VOID' && isInReportRange(bill.businessDate, range));
}

export function reportBilledAmount(bill: ReportBill): number {
  return Math.max(0, Number(bill.originalTotalIdr || 0) + Number(bill.debitAdjustmentsIdr || 0) - Number(bill.creditAdjustmentsIdr || 0));
}

export function reportBillTotals(bills: ReportBill[]) {
  return bills.reduce((totals, bill) => ({
    subtotal: totals.subtotal + Number(bill.subtotalIdr || 0),
    discount: totals.discount + Number(bill.discountIdr || 0),
    service: totals.service + Number(bill.serviceIdr || 0),
    tax: totals.tax + Number(bill.taxIdr || 0),
    corrections: totals.corrections + Number(bill.debitAdjustmentsIdr || 0) - Number(bill.creditAdjustmentsIdr || 0),
    billed: totals.billed + reportBilledAmount(bill),
    received: totals.received + Number(bill.verifiedReceiptsIdr || 0),
    refunded: totals.refunded + Number(bill.refundedIdr || 0),
    outstanding: totals.outstanding + Math.max(0, Number(bill.balanceIdr || 0)),
  }), { subtotal: 0, discount: 0, service: 0, tax: 0, corrections: 0, billed: 0, received: 0, refunded: 0, outstanding: 0 });
}

/** Only dates with bills are included; callers filter out void bills first. */
export function reportDailyTotals(bills: ReportBill[]) {
  const groups = new Map<string, ReportBill[]>();
  for (const bill of bills) {
    const group = groups.get(bill.businessDate) || [];
    group.push(bill);
    groups.set(bill.businessDate, group);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, group]) => ({
    date, count: group.length, ...reportBillTotals(group),
  }));
}
