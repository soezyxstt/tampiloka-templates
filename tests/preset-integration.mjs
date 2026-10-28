#!/usr/bin/env node
/** Real HTTP checks in fresh CLI-generated clients. No shared database/config mutation. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS } from '../src/config/catalog.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index === -1 ? undefined : args[index + 1]; };
const selected = args.includes('--static-only') ? [] : (option('--presets') || Object.keys(PRESETS).join(',')).split(',');
for (const preset of selected) assert.ok(Object.hasOwn(PRESETS, preset), `Unknown preset ${preset}`);
const basePort = option('--port') ? Number(option('--port')) : null;
if (basePort !== null) assert.ok(Number.isInteger(basePort) && basePort > 1024 && basePort < 65500, 'Choose an unprivileged port.');
const work = await mkdtemp(join(tmpdir(), 'cafe-preset-integration-'));
const results = [];
const activeProcesses = new Set();

function run(command, arguments_, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, arguments_, { cwd: root, env: process.env, ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolveRun(output) : reject(new Error(`Command failed (${code}): ${output.slice(-5000)}`)));
  });
}

async function freePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen); });
  const port = server.address().port;
  await new Promise(resolveClose => server.close(resolveClose));
  return port;
}

function startServer(directory, port, staticCatalog = false) {
  const env = { ...process.env, CAFE_DEMO_DB: '1', CAFE_DEMO_EMPTY: '1', CAFE_DEMO_DATA_DIR: join(directory, '.local', 'integration-db'), NEXT_TELEMETRY_DISABLED: '1' };
  if (staticCatalog) {
    for (const name of ['CAFE_DEMO_DB', 'CAFE_DEMO_EMPTY', 'CAFE_DEMO_DATA_DIR', 'SQL_HOST', 'SQL_USER', 'SQL_PASSWORD', 'SQL_DB_NAME', 'DATABASE_URL']) delete env[name];
  }
  const commandArgs = staticCatalog ? [join(directory, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(port)] : [join(directory, 'scripts/run-demo.mjs'), '--port', String(port)];
  const child = spawn(process.execPath, commandArgs, {
    cwd: directory,
    env,
    stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32',
  });
  activeProcesses.add(child);
  let logs = '';
  child.stdout.on('data', chunk => { logs = (logs + chunk.toString()).slice(-12000); });
  child.stderr.on('data', chunk => { logs = (logs + chunk.toString()).slice(-12000); });
  child.once('error', error => { logs += `\n${error.message}`; });
  const exited = new Promise(resolveExit => child.once('close', code => { activeProcesses.delete(child); resolveExit(code); }));
  return { child, exited, logs: () => logs };
}

async function stopServer(server) {
  if (server.child.exitCode !== null) return;
  try {
    if (process.platform !== 'win32') process.kill(-server.child.pid, 'SIGTERM');
    else server.child.kill('SIGTERM');
  } catch { /* The process may have already exited. */ }
  const timeout = setTimeout(() => {
    try {
      if (process.platform !== 'win32') process.kill(-server.child.pid, 'SIGKILL');
      else server.child.kill('SIGKILL');
    } catch { /* Already stopped. */ }
  }, 7000);
  await server.exited;
  clearTimeout(timeout);
}

async function waitReady(base, surface, server) {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) throw new Error(`Demo server exited early.\n${server.logs()}`);
    try {
      const response = await fetch(`${base}/api/v1/snapshot?surface=${surface}`, { signal: AbortSignal.timeout(10000) });
      if (response.status === 200) return;
      if (response.status === 503) throw new Error(`Demo runtime refused request: ${await response.text()}`);
    } catch (error) {
      if (error.message.startsWith('Demo runtime')) throw error;
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 500));
  }
  throw new Error(`Demo did not become ready.\n${server.logs()}`);
}

function api(base) {
  return async (command, payload, { surface = 'staff', status = 200, principalId } = {}) => {
    const response = await fetch(`${base}/api/v1/snapshot`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, payload, surface, principalId: principalId || payload.principalId }), signal: AbortSignal.timeout(20000),
    });
    const body = await response.json();
    assert.equal(response.status, status, `${command}: ${JSON.stringify(body.error || body)}`);
    return body;
  };
}

async function snapshot(base, surface = 'staff') {
  const response = await fetch(`${base}/api/v1/snapshot?surface=${surface}`, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, await response.clone().text());
  return (await response.json()).data;
}

function orderLine(state) {
  const item = state.catalog.find(candidate => candidate.isAvailable && candidate.variants.some(variant => variant.availableToSell > 3));
  assert.ok(item, 'Sample menu must contain an available item.');
  const variant = item.variants.find(candidate => candidate.isDefault && candidate.availableToSell > 3) || item.variants.find(candidate => candidate.availableToSell > 3);
  const modifierOptionIds = (item.modifierGroups || []).flatMap(group => group.options.slice(0, group.required ? Math.max(1, group.minSelect) : group.minSelect || 0).map(choice => choice.id));
  return { menuItemId: item.id, variantId: variant.id, modifierOptionIds, quantity: 1, note: 'Verifikasi paket' };
}

async function createSale(base, surface, discount = 0) {
  const command = api(base);
  const state = await snapshot(base, surface);
  const principalId = `${surface === 'staff' ? 'staff' : 'guest'}_integration_${Date.now()}`;
  const payload = { principalId, mode: 'TAKEAWAY', items: [orderLine(state)], ...(discount ? { manualDiscountIdr: discount } : {}) };
  const quote = (await command('CREATE_QUOTE', payload, { surface })).data.result;
  assert.ok(quote.totalIdr > 0);
  assert.equal(quote.discountIdr, discount);
  const submission = { quoteId: quote.quoteId, principalId, customerName: 'Demo integration', mode: 'TAKEAWAY', presenceVerified: false, idempotencyKey: `integration_${quote.quoteId}` };
  const first = (await command('SUBMIT_ORDER_REQUEST', submission, { surface })).data.result;
  const repeated = (await command('SUBMIT_ORDER_REQUEST', submission, { surface })).data.result;
  assert.equal(repeated.orderRequestId, first.orderRequestId, 'Retry must reuse the original order request.');
  const accepted = (await command('ACCEPT_ORDER_REQUEST', { orderRequestId: first.orderRequestId, actorName: 'Integration', actorRole: 'OWNER' })).data.result;
  assert.ok(accepted.billId, 'Accepting an order must return a payable bill.');
  return { quote, accepted, principalId };
}

async function checkOnlineSale(base) {
  const command = api(base);
  const { quote, accepted, principalId } = await createSale(base, 'customer');
  let state = await snapshot(base);
  let bill = state.bills.find(entry => entry.id === accepted.billId);
  assert.equal(bill.originalTotalIdr, quote.totalIdr);
  assert.ok(state.orderUnits.filter(unit => unit.orderId === accepted.orderId).every(unit => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT'));
  const attempt = (await command('RECORD_PAYMENT', { billId: bill.id, method: 'QRIS', amountIdr: bill.balanceIdr, actorName: 'Demo integration', createExternalAttemptOnly: true }, { surface: 'customer', principalId })).data.result;
  assert.ok(attempt.attemptId);
  await command('SETTLE_OR_CANCEL_ATTEMPT', { attemptId: attempt.attemptId, action: 'SETTLE', actorName: 'Integration' });
  await command('SETTLE_OR_CANCEL_ATTEMPT', { attemptId: attempt.attemptId, action: 'SETTLE', actorName: 'Integration' });
  state = await snapshot(base);
  bill = state.bills.find(entry => entry.id === accepted.billId);
  assert.equal(bill.paymentState, 'SETTLED'); assert.equal(bill.balanceIdr, 0); assert.equal(bill.receipts.length, 1, 'Repeat settlement must not create another receipt.');
  const units = state.orderUnits.filter(unit => unit.orderId === accepted.orderId);
  assert.ok(units.length > 0 && units.every(unit => unit.fulfillmentStatus === 'QUEUED'));
  await command('TRANSITION_UNITS', { unitIds: units.map(unit => unit.id), targetStatus: 'PICKED_UP', actorName: 'Integration', actorRole: 'OWNER' });
  state = await snapshot(base);
  assert.ok(state.orderUnits.filter(unit => unit.orderId === accepted.orderId).every(unit => unit.fulfillmentStatus === 'PICKED_UP'));
  return { quoteId: quote.quoteId, totalIdr: quote.totalIdr, onlineSettlement: true, settlementIdempotent: true, noKitchenFulfillment: true };
}

async function checkCashierSale(base) {
  const command = api(base);
  const { quote, accepted } = await createSale(base, 'staff', 1000);
  let state = await snapshot(base);
  const shift = state.cashShifts.find(entry => entry.state === 'OPEN');
  assert.ok(shift, 'Clean cashier demo must have an open shift.');
  const tenderedIdr = Math.ceil(quote.totalIdr / 50000) * 50000;
  const receipt = (await command('RECORD_PAYMENT', { billId: accepted.billId, method: 'CASH', amountIdr: quote.totalIdr, tenderedIdr, actorName: 'Integration' })).data.result;
  assert.equal(receipt.changeIdr, tenderedIdr - quote.totalIdr);
  await command('CASH_SHIFT_ACTION', { action: 'CASH_IN', shiftId: shift.id, amountIdr: 7000, reason: 'Verification float', actorName: 'Integration' });
  await command('CASH_SHIFT_ACTION', { action: 'CASH_OUT', shiftId: shift.id, amountIdr: 3000, reason: 'Verification expense', actorName: 'Integration' });
  const expectedCash = shift.expectedCashIdr + quote.totalIdr + 4000;
  state = await snapshot(base);
  assert.equal(state.cashShifts.find(entry => entry.id === shift.id).expectedCashIdr, expectedCash);
  await command('CASH_SHIFT_ACTION', { action: 'CLOSE_SHIFT', shiftId: shift.id, countedCashIdr: expectedCash, reason: 'Verification balance', actorName: 'Integration' });
  await command('CASH_SHIFT_ACTION', { action: 'OPEN_SHIFT', amountIdr: 100000, actorName: 'Integration' });
  state = await snapshot(base);
  assert.equal(state.cashShifts.filter(entry => entry.state === 'OPEN').length, 1);
  assert.equal(state.cashShifts.find(entry => entry.state === 'OPEN').openingFloatIdr, 100000);
  assert.equal(state.bills.find(entry => entry.id === accepted.billId).balanceIdr, 0);
  return { totalIdr: quote.totalIdr, manualDiscountIdr: 1000, cashChangeIdr: receipt.changeIdr, closedAndReopenedShift: true };
}

async function checkPreset(preset, index) {
  const directory = join(work, preset);
  const slug = `verify-${preset}`;
  await run(process.execPath, [join(root, 'scripts/cafe.mjs'), 'init', directory, '--name', `Verify ${preset}`, '--slug', slug, '--preset', preset, '--yes', '--json']);
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const copiedPackage = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const copiedLock = JSON.parse(await readFile(join(directory, 'package-lock.json'), 'utf8'));
  assert.equal(copiedPackage.name, slug); assert.equal(copiedLock.name, slug); assert.equal(copiedLock.packages[''].name, slug);
  assert.equal(copiedLock.version, copiedPackage.version, 'Package-lock version must match the scaffold package.');
  const port = basePort === null ? await freePort() : basePort + index;
  const base = `http://127.0.0.1:${port}`;
  const server = startServer(directory, port);
  const modules = PRESETS[preset].modules;
  const hasCustomer = modules.includes('catalog');
  const hasStaff = modules.some(id => ['ordering', 'cashier', 'kitchen', 'dashboard', 'tables', 'marketing'].includes(id));
  try {
    await waitReady(base, hasCustomer ? 'customer' : 'staff', server);
    for (const [surface, enabled] of [['customer', hasCustomer], ['staff', hasStaff]]) {
      const response = await fetch(`${base}/api/v1/snapshot?surface=${surface}`);
      assert.equal(response.status, enabled ? 200 : 404, `${preset} ${surface} API gate`);
      if (enabled && surface === 'customer') {
        const data = (await response.json()).data;
        for (const field of ['staffRoles', 'staffAssurances', 'cashShifts', 'auditEvents']) assert.equal(Object.hasOwn(data, field), false, `Guest response contains ${field}`);
        assert.deepEqual(data.members, []);
        if (!modules.includes('payments')) assert.equal(data.paymentAccount, null);
      }
    }
    const home = await fetch(base); assert.equal(home.status, 200, `${preset} home`); assert.match(await home.text(), /Verify/);
    const staff = await fetch(`${base}/staff/${slug}/${slug}`); assert.equal(staff.status, hasStaff ? 200 : 404, `${preset} staff page`);
    assert.equal((await fetch(`${base}/staff/wrong-tenant/${slug}`)).status, 404);
    assert.equal((await fetch(`${base}/t/${slug}/${slug}/m/invalid-table-token`)).status, 404);
    if (hasCustomer) {
      const data = await snapshot(base, 'customer'); const table = data.tables.find(entry => entry.active);
      assert.ok(table); assert.equal((await fetch(`${base}/t/${slug}/${slug}/m/${table.qrToken}`)).status, 200);
    } else assert.equal((await fetch(`${base}/t/${slug}/${slug}/m/qr_meranti_m01`)).status, 404);
    const command = api(base);
    if (!modules.includes('ordering')) await command('CREATE_QUOTE', { principalId: 'guest_gate', mode: 'TAKEAWAY', items: [] }, { surface: 'customer', status: 403 });
    if (!modules.includes('cashier')) {
      await command('CREATE_QUOTE', { principalId: 'staff_gate', mode: 'TAKEAWAY', items: [] }, { surface: 'staff', status: 403 });
      await command('CASH_SHIFT_ACTION', { action: 'OPEN_SHIFT', amountIdr: 0 }, { status: 403 });
    }
    if (!modules.includes('payments')) await command('RECORD_PAYMENT', { billId: 'not-a-bill', method: 'QRIS', amountIdr: 1000, createExternalAttemptOnly: true }, { status: 403 });
    if (!modules.includes('tables')) await command('FLOOR_PLAN_ACTION', { action: 'not-an-action' }, { status: 403 });
    let flow = {};
    if (preset === 'order-and-pay') flow = await checkOnlineSale(base);
    if (preset === 'cashier') flow = await checkCashierSale(base);
    return { preset, passed: true, customer: hasCustomer, staff: hasStaff, ...flow };
  } catch (error) { throw new Error(`${preset}: ${error.message}\n${server.logs()}`, { cause: error }); }
  finally { await stopServer(server); }
}

async function checkStaticCatalog(index) {
  const directory = join(work, 'static-catalog');
  const slug = 'verify-static-catalog';
  await run(process.execPath, [join(root, 'scripts/cafe.mjs'), 'init', directory, '--name', 'Verify Static Menu', '--slug', slug, '--modules', 'catalog', '--yes', '--json']);
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  // Prove this mode works without either a demo flag or any database credentials.
  await rm(join(directory, '.env.local'));
  const port = basePort === null ? await freePort() : basePort + index;
  const base = `http://127.0.0.1:${port}`;
  const server = startServer(directory, port, true);
  try {
    await waitReady(base, 'customer', server);
    const state = await snapshot(base, 'customer');
    assert.equal(state.runtime.demo, false);
    assert.equal(state.runtime.mode, 'catalog');
    assert.equal(state.runtime.sampleMenu, true);
    assert.equal(state.outlet.name, 'Verify Static Menu');
    assert.ok(state.catalog.length > 0);
    assert.deepEqual(state.orders, []); assert.deepEqual(state.bills, []); assert.equal(state.paymentAccount, null);
    assert.equal(Object.hasOwn(state, 'staffRoles'), false);
    const home = await fetch(base); assert.equal(home.status, 200); assert.match(await home.text(), /Verify Static Menu/);
    const table = state.tables.find(entry => entry.active); assert.ok(table);
    assert.equal((await fetch(`${base}/t/${slug}/${slug}/m/${table.qrToken}`)).status, 200);
    assert.equal((await fetch(`${base}/t/${slug}/${slug}/m/not-a-table`)).status, 404);
    assert.equal((await fetch(`${base}/staff/${slug}/${slug}`)).status, 404);
    assert.equal((await fetch(`${base}/api/v1/snapshot?surface=staff`)).status, 404);
    for (const [command, payload] of [
      ['CREATE_QUOTE', { principalId: 'guest_test', mode: 'TAKEAWAY', items: [] }],
      ['RECORD_PAYMENT', { billId: 'unavailable', method: 'CASH', amountIdr: 1000 }],
      ['RESET_DEMO_DATA', {}],
    ]) {
      const response = await fetch(`${base}/api/v1/snapshot`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command, payload, surface: 'staff' }) });
      assert.ok([403, 503].includes(response.status), `${command} must be disabled in static mode`);
      const body = await response.json(); assert.ok(body.error); assert.equal(body.data, undefined);
    }
    let databaseCreated = true;
    try { await access(join(directory, '.local')); } catch { databaseCreated = false; }
    assert.equal(databaseCreated, false, 'Static catalog must not create a demo database.');
    return { preset: 'catalog-static', passed: true, customer: true, staff: false, databaseRequired: false, sampleMenuExplicit: true };
  } catch (error) { throw new Error(`static catalog: ${error.message}\n${server.logs()}`, { cause: error }); }
  finally { await stopServer(server); }
}

try {
  for (let index = 0; index < selected.length; index += 1) {
    process.stdout.write(`Checking ${selected[index]}…\n`);
    results.push(await checkPreset(selected[index], index));
    process.stdout.write(`PASS ${selected[index]}\n`);
  }
  if (!args.includes('--skip-static')) {
    process.stdout.write('Checking static catalog without a database…\n');
    results.push(await checkStaticCatalog(selected.length));
    process.stdout.write('PASS static catalog without a database\n');
  }
  process.stdout.write(`${JSON.stringify({ passed: results.length, results }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
} finally {
  for (const child of activeProcesses) {
    try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { /* Already gone. */ }
  }
  await rm(work, { recursive: true, force: true });
}
