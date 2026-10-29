/** Deterministic isolated fixtures for the real service and PostgreSQL-compatible engine. */
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function createLifecycleFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'cafe-lifecycle-'));
  const dataDirectory = join(directory, 'db');
  await mkdir(dataDirectory);
  process.env.CAFE_DEMO_DB = '1';
  process.env.CAFE_DEMO_EMPTY = '1';
  process.env.CAFE_DEMO_DATA_DIR = dataDirectory;
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { pushSchema } = await import('drizzle-kit/api');
  const schema = await import('./schema.ts');
  const setup = new PGlite(dataDirectory);
  await (await pushSchema(schema, drizzle(setup))).apply();
  await setup.close();
  const service = await import('./service.ts');
  const { db } = await import('./index.ts');
  const seed = await import('./seed.ts');
  const { cafeConfig, MODULES } = await import('../config/cafe.ts');
  const initialModules = [...cafeConfig.modules];
  const fullModules = Object.keys(MODULES) as typeof cafeConfig.modules;
  let sequence = 0;
  const next = (prefix: string) => `${prefix}_${++sequence}`;
  async function reset(modules = fullModules) {
    cafeConfig.modules = [...modules];
    await seed.resetDemoData({ empty: true });
    await service.updateOutletSettingsOrPromoOrFeedback({ action: 'UPDATE_OUTLET_POLICY', autoAcceptParticipant: false });
  }
  async function seat(tableId = 'tbl_m06', customerName = 'Rani dan Dimas', partySize = 2, idempotencyKey = next('seat')) {
    return service.moveOrUpdateTableAndVisit({ action: 'START_VISIT', tableId, customerName, partySize, idempotencyKey, actorName: 'Fixture Staff', actorRole: 'CASHIER' });
  }
  const tea = { menuItemId: 'item_teh_melati', variantId: 'var_teh_std', modifierOptionIds: [] as string[], note: '', quantity: 1 };
  const pastry = { menuItemId: 'item_croissant', variantId: 'var_croissant_std', modifierOptionIds: [] as string[], note: '', quantity: 1 };
  async function request(options: { tableId?: string; principalId?: string; customerName?: string; mode?: 'DINE_IN' | 'TAKEAWAY'; items?: typeof tea[]; discount?: number } = {}) {
    const mode = options.mode || 'DINE_IN';
    const principalId = options.principalId || next('guest');
    const tableId = mode === 'DINE_IN' ? options.tableId || 'tbl_m06' : undefined;
    const quote = await service.createQuoteForCart({ principalId, mode, tableId, source: options.discount ? 'staff' : 'customer', manualDiscountIdr: options.discount, items: options.items || [tea] });
    const payload = { quoteId: quote.quoteId, principalId, customerName: options.customerName || 'Tamu Uji', mode, tableId, presenceVerified: mode === 'DINE_IN', idempotencyKey: next('request') };
    const submitted = await service.submitCustomerOrderRequest(payload) as { orderRequestId: string };
    return { quote, payload, requestId: submitted.orderRequestId };
  }
  async function sale(options: Parameters<typeof request>[0] & { policy?: 'PREPAY' | 'PAY_LATER' } = {}) {
    const submitted = await request(options);
    const accepted = await service.acceptOrderRequestByStaff({ orderRequestId: submitted.requestId, actorName: 'Fixture Staff', actorRole: 'CASHIER', paymentPolicyOverride: options.policy || 'PREPAY' });
    return { ...submitted, ...accepted, billId: accepted.billId!, visitId: accepted.visitId!, orderId: accepted.orderId! };
  }
  async function units(orderId: string) {
    const state = await service.getFullApplicationSnapshot();
    return state.orderUnits.filter(unit => unit.orderId === orderId);
  }
  async function serve(orderId: string, mode: 'DINE_IN' | 'TAKEAWAY' = 'DINE_IN') {
    const unitIds = (await units(orderId)).filter(unit => unit.fulfillmentStatus !== 'CANCELLED').map(unit => unit.id);
    if (!unitIds.length) return;
    for (const targetStatus of ['PREPARING', 'READY', mode === 'DINE_IN' ? 'DELIVERED' : 'PICKED_UP'] as const) await service.transitionOrderUnits({ unitIds, targetStatus, actorName: 'Fixture Kitchen', actorRole: 'KITCHEN' });
  }
  async function pay(billId: string, amountIdr?: number, idempotencyKey = next('payment')) {
    const state = await service.getFullApplicationSnapshot();
    const amount = amountIdr ?? state.bills.find(bill => bill.id === billId)!.balanceIdr;
    return service.recordBillPayment({ billId, method: 'CASH', amountIdr: amount, tenderedIdr: amount, actorName: 'Fixture Cashier', idempotencyKey });
  }
  async function depart(visitId: string) {
    return service.moveOrUpdateTableAndVisit({ action: 'DEPART_VISIT', visitId, actorName: 'Fixture Staff', actorRole: 'CASHIER' });
  }
  return { directory, service, schema, db, cafeConfig, initialModules, reset, seat, request, sale, units, serve, pay, depart, tea, pastry, next,
    async close() { cafeConfig.modules = initialModules; await global._cafeDemoDatabase?.close(); global._cafeDemoDatabase = undefined; await rm(directory, { recursive: true, force: true }); },
  };
}
