// Lightweight SQLite contract tests. This adapter is NOT the Workers runtime;
// run the Cloudflare runtime suite separately on a machine with sufficient resources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';

const stub = 'data:text/javascript,' + encodeURIComponent('export class DurableObject { constructor(ctx,env) {this.ctx=ctx;this.env=env;} }');
const hooks = registerHooks({ resolve(specifier, context, next) {
  return specifier === 'cloudflare:workers' ? { url: stub, shortCircuit: true } : next(specifier, context);
} });
const { OperationsStore } = await import('../worker/store.ts');
hooks.deregister();

function fixture() {
  const db = new DatabaseSync(':memory:');
  const ctx = { storage: {
    sql: { exec(sql, ...bindings) {
      let rows;
      if (sql.startsWith('CREATE TABLE')) { db.exec(sql); rows = []; }
      else rows = db.prepare(sql).all(...bindings);
      return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
    } },
    transactionSync(callback) {
      db.exec('BEGIN');
      try { const value = callback(); db.exec('COMMIT'); return value; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  } };
  let store = new OperationsStore(ctx, { DEMO_MODE: 'true' });
  const call = (action, input = {}, extra = {}) => store.call({ action, input, demo: true, tokenHash: 'owner-token', csrf: 'owner-csrf', ...extra });
  const login = call('login', { persona: 'owner' }, { newTokenHash: 'owner-token', newCsrf: 'owner-csrf' });
  assert.equal(login.user.id, 'owner');
  return { call, db, reload: () => { store = new OperationsStore(ctx, { DEMO_MODE: 'true' }); }, close: () => db.close() };
}

test('persisted transfer commits once, survives a new object instance, and rejects changed retries', () => {
  const f = fixture();
  try {
    const initial = f.call('state');
    const from = initial.locations.find(l => l.kind === 'warehouse').id;
    const to = initial.locations.find(l => l.kind === 'outlet').id;
    const productId = initial.products[0].id;
    const draft = f.call('command', { id: 'draft-storage', type: 'transfer.draft', payload: { fromId: from, toId: to, lines: [{ productId, quantity: 200 }] } });
    assert.ok(draft.result, JSON.stringify(draft));
    const send = { id: 'send-storage', type: 'transfer.send', payload: { transferId: draft.result.documentId } };
    const sent = f.call('command', send);
    assert.ok(sent.result, JSON.stringify(sent));
    f.reload();
    const replay = f.call('command', send);
    assert.deepEqual(replay.result, sent.result);
    assert.equal(replay.state.balances.find(b => b.locationId === from && b.productId === productId).sellable, 800);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM commands WHERE id=?').get(send.id).n, 1);
    const changed = f.call('command', { ...send, payload: { ...send.payload, reason: 'Changed request' } });
    assert.equal(changed.__domainError.code, 'IDEMPOTENCY_MISMATCH');
    assert.equal(f.call('state').revision, sent.state.revision);
  } finally { f.close(); }
});

test('failed posting leaves no journal, ledger or document fragments', () => {
  const f = fixture();
  try {
    const initial = f.call('state');
    const before = ['commands', 'immutable_documents', 'immutable_mutations', 'immutable_audit'].map(table => f.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
    const failed = f.call('command', { id: 'invalid-held-disposal', type: 'stock.dispose', payload: {
      locationId: initial.locations[0].id, productId: initial.products[0].id, quantity: 500, reason: 'Cannot dispose unavailable held stock',
    } });
    assert.ok(failed.__domainError);
    assert.deepEqual(f.call('state'), initial);
    assert.deepEqual(['commands', 'immutable_documents', 'immutable_mutations', 'immutable_audit'].map(table => f.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n), before);
  } finally { f.close(); }
});

test('uncertain-result lookup returns the same API response shape as command posting', () => {
  const f = fixture();
  try {
    const state = f.call('state');
    const cmd = { id: 'recover-shift', type: 'shift.open', payload: { locationId: state.locations.find(l => l.kind === 'outlet').id, openingCash: 100000 } };
    const original = f.call('command', cmd);
    assert.ok(original.result, JSON.stringify(original));
    const recovered = f.call('result', { id: cmd.id });
    assert.deepEqual(recovered.result, original.result);
    assert.ok(recovered.state?.shifts.some(shift => shift.id === original.result.documentId));
  } finally { f.close(); }
});
