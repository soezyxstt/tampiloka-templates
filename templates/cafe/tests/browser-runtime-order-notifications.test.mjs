import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderNotificationTracker } from '../lib/order-notification-tracker.ts';

const order = (id, tableLabel = 'M02') => ({ id, customerName: `Guest ${id}`, tableLabel });
const snapshot = (ids, epoch, notificationBaselineIds = []) => ({ orderRequests: ids.map(id => order(id)), runtime: { notificationEpoch: epoch, notificationBaselineIds } });

test('the first snapshot is silent, subsequent new orders alert only once across events and polling', () => {
  const tracker = createOrderNotificationTracker();
  assert.deepEqual(tracker.observeSnapshot(snapshot(['seed'], undefined)), []);
  assert.deepEqual(tracker.observeSnapshot(snapshot(['seed', 'one'], undefined)).map(item => item.id), ['one']);
  assert.equal(tracker.observeEvent(order('one')), false);
  assert.equal(tracker.observeEvent(order('two')), true);
  assert.deepEqual(tracker.observeSnapshot(snapshot(['seed', 'one', 'two'], undefined)), []);
  assert.deepEqual(tracker.observeSnapshot(snapshot(['seed', 'one', 'two'], undefined)), []);
});

test('fixture resets suppress only fixture IDs and handover recovers missed real orders', () => {
  const tracker = createOrderNotificationTracker();
  tracker.observeSnapshot(snapshot(['seed'], 'owner-1'));
  assert.deepEqual(tracker.observeSnapshot(snapshot(['scenario-new-id', 'real-order'], 'reset-2', ['scenario-new-id'])).map(item => item.id), ['real-order']);
  assert.deepEqual(tracker.observeSnapshot(snapshot(['scenario-new-id', 'real-order', 'missed-event'], 'owner-3')).map(item => item.id), ['missed-event']);
  assert.equal(tracker.observeEvent(order('missed-event')), false);
  tracker.deactivate();
  assert.deepEqual(tracker.observeSnapshot(snapshot(['scenario-new-id', 'unseen-while-away'], 'owner-3')), []);
});

test('missing snapshots do not initialize the tracker and events still deduplicate', () => {
  const tracker = createOrderNotificationTracker();
  assert.deepEqual(tracker.observeSnapshot({}), []);
  assert.equal(tracker.observeEvent(order('live')), true);
  assert.deepEqual(tracker.observeSnapshot(snapshot(['seed', 'live'], 'owner')), []);
  assert.equal(tracker.observeEvent(order('live')), false);
});


test('staff-created POS requests do not alert the cashier who is entering them', () => {
  const tracker = createOrderNotificationTracker();
  tracker.observeSnapshot(snapshot(['seed'], 'owner'));
  const pos = { ...order('pos'), principalId: 'staff_staff_cashier' };
  const guest = { ...order('guest'), principalId: 'guest_customer' };
  assert.deepEqual(tracker.observeSnapshot({ orderRequests: [order('seed'), pos, guest], runtime: { notificationEpoch: 'owner' } }), [guest]);
  assert.equal(tracker.observeEvent(pos), false);
});
