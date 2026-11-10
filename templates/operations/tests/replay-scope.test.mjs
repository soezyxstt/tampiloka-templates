import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, pid, outlet, approval } from './domain-support.mjs';

test('warehouse user can recover their shipment without gaining destination authority', () => {
  const f = fixture();
  const payload = { fromId: 'warehouse', toId: outlet, lines: [{ productId: pid, quantity: 200 }] };
  const draft = f.run('transfer.draft', payload, 'inventory', 'warehouse-draft');
  assert.deepEqual(f.run('transfer.draft', payload, 'inventory', 'warehouse-draft'), draft);
  const sendPayload = { transferId: draft.documentId };
  const sent = f.run('transfer.send', sendPayload, 'inventory', 'warehouse-send');
  assert.deepEqual(f.run('transfer.send', sendPayload, 'inventory', 'warehouse-send'), sent);
  assert.equal(f.balance('warehouse'), 800);
  assert.throws(() => f.run('transfer.receive', { ...sendPayload, lines: [{ productId: pid, quantity: 200 }] }, 'inventory'), { code: 'FORBIDDEN' });
  const user = { ...f.state.users.find(user => user.id === 'inventory'), assignments: [{ role: 'auditor', locationIds: ['warehouse'] }] };
  f.run('access.save', { user, ...approval });
  assert.throws(() => f.run('transfer.send', sendPayload, 'inventory', 'warehouse-send'), { code: 'FORBIDDEN' });
});
