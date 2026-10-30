/** Run against a full-service browser demo or the isolated Vite harness. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.CAFE_BROWSER_RUNTIME_URL || 'http://127.0.0.1:3013';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const checks = [];
const errors = [];
const networkCommands = [];
const timing = { coldReadyMs: 0, snapshotsMs: [], commandsMs: [] };
const check = (name, detail = {}) => { checks.push({ name, ...detail }); console.log(`PASS ${name}`); };

async function open(context) {
  const started = Date.now();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(async () => {
    try {
      const result = await (await fetch('/api/v1/snapshot?surface=staff')).json();
      return result.data?.runtime?.mode === 'browser-demo';
    } catch { return false; }
  }, undefined, { timeout: 120000 });
  if (!timing.coldReadyMs) timing.coldReadyMs = Date.now() - started;
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/v1/') && request.method() !== 'GET') networkCommands.push(request.url()); });
  return page;
}

async function snapshot(page, surface = 'staff', principalId = '') {
  const started = Date.now();
  const state = await page.evaluate(async ({ surface, principalId }) => {
    const query = new URLSearchParams({ surface, principal: principalId });
    const response = await fetch(`/api/v1/snapshot?${query}`);
    const body = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(body));
    return body.data;
  }, { surface, principalId });
  timing.snapshotsMs.push(Date.now() - started);
  return state;
}

async function command(page, name, payload, surface = 'staff', expectedStatus = 200) {
  const started = Date.now();
  const response = await page.evaluate(async ({ name, payload, surface }) => {
    const result = await fetch('/api/v1/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: name, payload, surface, principalId: payload.principalId }) });
    return { status: result.status, body: await result.json() };
  }, { name, payload, surface });
  assert.equal(response.status, expectedStatus, `${name}: ${JSON.stringify(response.body)}`);
  timing.commandsMs.push({ command: name, duration: Date.now() - started });
  return response.body.data;
}

try {
  const context = await browser.newContext({ locale: 'id-ID' });
  const customer = await open(context);
  const initial = (await command(customer, 'RESET_DEMO_DATA', {})).snapshot;
  const staff = await open(context);
  assert.equal(initial.runtime.localOnly, true);
  assert.equal(initial.runtime.crossDeviceSync, false);
  assert.ok(initial.catalog.length && initial.staffRoles.length);
  const guest = await snapshot(customer, 'customer');
  assert.equal('staffRoles' in guest, false);
  assert.equal('cashShifts' in guest, false);
  await command(customer, 'CASH_SHIFT_ACTION', { action: 'OPEN_SHIFT', amountIdr: 0 }, 'customer', 403);
  check('local seeded database and customer/staff capability boundary', { sampleOrders: initial.orders.length });

  const id = `browser-${Date.now()}`;
  const principalId = `guest_${id}`;
  const line = { menuItemId: 'item_teh_melati', variantId: 'var_teh_std', modifierOptionIds: [], note: 'Browser runtime test', quantity: 1 };
  const quote = (await command(customer, 'CREATE_QUOTE', { principalId, mode: 'TAKEAWAY', items: [line] }, 'customer')).result;
  const orderPayload = { quoteId: quote.quoteId, principalId, customerName: `Local ${id}`, mode: 'TAKEAWAY', presenceVerified: false, idempotencyKey: `${id}-online` };
  const [first, retry] = await Promise.all([
    command(customer, 'SUBMIT_ORDER_REQUEST', orderPayload, 'customer'),
    command(staff, 'SUBMIT_ORDER_REQUEST', orderPayload, 'customer'),
  ]);
  assert.equal(first.result.orderRequestId, retry.result.orderRequestId);
  const accepted = (await command(staff, 'ACCEPT_ORDER_REQUEST', { orderRequestId: first.result.orderRequestId, actorName: 'Browser test', actorRole: 'CASHIER' })).result;
  const pending = (await command(customer, 'RECORD_PAYMENT', { billId: accepted.billId, method: 'QRIS', amountIdr: quote.totalIdr, createExternalAttemptOnly: true, principalId }, 'customer')).result;
  assert.equal(pending.isDemo, true);
  const settle = { attemptId: pending.attemptId, action: 'SETTLE', actorName: 'Browser test' };
  await Promise.all([command(customer, 'SETTLE_OR_CANCEL_ATTEMPT', settle), command(staff, 'SETTLE_OR_CANCEL_ATTEMPT', settle)]);
  let state = await snapshot(staff);
  const bill = state.bills.find(entry => entry.id === accepted.billId);
  assert.equal(bill.balanceIdr, 0);
  assert.equal(bill.receipts.length, 1);
  assert.equal(bill.receipts[0].amountIdr, quote.totalIdr);
  const units = state.orderUnits.filter(unit => unit.orderId === accepted.orderId);
  assert.ok(units.length); assert.ok(units.every(unit => unit.fulfillmentStatus === 'QUEUED'));
  for (const targetStatus of ['PREPARING', 'READY', 'PICKED_UP']) await command(staff, 'TRANSITION_UNITS', { unitIds: units.map(unit => unit.id), targetStatus, actorName: 'Browser test', actorRole: 'KITCHEN' });
  check('customer order, concurrent idempotent retry, simulated payment and kitchen fulfillment across two tabs', { totalIdr: quote.totalIdr, receipts: bill.receipts.length });

  const posPrincipal = `staff_${id}`;
  const posQuote = (await command(staff, 'CREATE_QUOTE', { principalId: posPrincipal, mode: 'TAKEAWAY', manualDiscountIdr: 5000, items: [{ ...line, quantity: 2 }] })).result;
  assert.equal(posQuote.discountIdr, 5000);
  assert.equal(posQuote.totalIdr, 35805);
  const posRequest = (await command(staff, 'SUBMIT_ORDER_REQUEST', { quoteId: posQuote.quoteId, principalId: posPrincipal, customerName: `POS ${id}`, mode: 'TAKEAWAY', presenceVerified: false, idempotencyKey: `${id}-pos` })).result;
  const posOrder = (await command(staff, 'ACCEPT_ORDER_REQUEST', { orderRequestId: posRequest.orderRequestId, actorName: 'Browser test', actorRole: 'CASHIER', paymentPolicyOverride: 'PAY_LATER' })).result;
  const cash = (await command(staff, 'RECORD_PAYMENT', { billId: posOrder.billId, method: 'CASH', amountIdr: posQuote.totalIdr, tenderedIdr: 50000, actorName: 'Browser test' })).result;
  assert.equal(cash.changeIdr, 14195);
  state = await snapshot(staff);
  const shift = state.cashShifts.find(entry => entry.state === 'OPEN'); assert.ok(shift);
  await command(staff, 'CASH_SHIFT_ACTION', { action: 'CASH_IN', shiftId: shift.id, amountIdr: 7000, reason: 'Test cash in', actorName: 'Browser test' });
  await command(staff, 'CASH_SHIFT_ACTION', { action: 'CASH_OUT', shiftId: shift.id, amountIdr: 3000, reason: 'Test cash out', actorName: 'Browser test' });
  state = await snapshot(staff);
  const counted = state.cashShifts.find(entry => entry.id === shift.id).expectedCashIdr;
  assert.equal(counted, shift.expectedCashIdr + 4000);
  await command(staff, 'CASH_SHIFT_ACTION', { action: 'CLOSE_SHIFT', shiftId: shift.id, countedCashIdr: counted, actorName: 'Browser test' });
  await command(staff, 'CASH_SHIFT_ACTION', { action: 'OPEN_SHIFT', amountIdr: 100000, actorName: 'Browser test' });
  check('POS discount, cash change, drawer movements, close and reopen shift', { totalIdr: posQuote.totalIdr, changeIdr: cash.changeIdr });

  await customer.close();
  await staff.reload({ waitUntil: 'domcontentloaded' });
  await staff.waitForFunction(async () => {
    try { return (await (await fetch('/api/v1/snapshot?surface=staff')).json()).data?.runtime?.mode === 'browser-demo'; } catch { return false; }
  }, undefined, { timeout: 120000 });
  state = await snapshot(staff);
  assert.ok(state.orders.some(order => order.id === accepted.orderId));
  assert.equal(state.bills.find(entry => entry.id === posOrder.billId).balanceIdr, 0);
  check('state survives leader tab closure and page reload');

  const otherContext = await browser.newContext({ locale: 'id-ID' });
  const isolated = await open(otherContext);
  const otherState = await snapshot(isolated);
  assert.equal(otherState.orders.some(order => order.id === accepted.orderId), false);
  assert.equal(otherState.bills.some(entry => entry.id === posOrder.billId), false);
  await otherContext.close();
  check('another visitor browser context has independent demo data');

  const reset = (await command(staff, 'RESET_DEMO_DATA', {})).snapshot;
  assert.equal(reset.orders.length, initial.orders.length);
  assert.equal(reset.orders.some(order => order.id === accepted.orderId), false);
  assert.equal(reset.bills.some(entry => entry.id === posOrder.billId), false);
  assert.deepEqual(networkCommands, []);
  assert.deepEqual(errors, []);
  check('reset restores fixtures, no demo mutations reach the network, no browser page errors');
  console.log(JSON.stringify({ status: 'passed', checks, errors, networkCommands, timing }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', checks, errors, networkCommands, timing, error: error.stack || error.message }, null, 2));
  throw error;
} finally { await browser.close(); }
