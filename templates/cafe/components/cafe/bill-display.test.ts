import test from 'node:test';
import assert from 'node:assert/strict';
import { groupBillUnits, billOwnerName, billLocation } from './bill-display.ts';
import { printBillReceipt } from './receipt-print.ts';

test('menu prices group without changing allocated totals or distinct notes', () => {
  const units = [
    { id: 'a', menuItemId: 'tea', grossIdr: 18000, netIdr: 20789, fulfillmentStatus: 'QUEUED' },
    { id: 'b', menuItemId: 'tea', grossIdr: 18000, netIdr: 20790, fulfillmentStatus: 'READY' },
    { id: 'c', menuItemId: 'tea', grossIdr: 18000, note: 'no ice' },
    { id: 'd', menuItemId: 'tea', grossIdr: 18000, fulfillmentStatus: 'CANCELLED' },
  ];
  const groups = groupBillUnits(units);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].quantity, 2);
  assert.equal(groups[0].grossIdr, 36000);
  assert.deepEqual(groups[0].units.map(unit => unit.netIdr), [20789, 20790]);
  assert.equal(units.length, 4);
});

test('table context appears once and takeaway never receives a table prefix', () => {
  assert.equal(billOwnerName({ ownerLabel: 'Bagas (Meja M04)', tableLabel: 'M04' }), 'Bagas');
  assert.equal(billOwnerName({ ownerLabel: 'Rani (M06)', tableLabel: 'M06' }), 'Rani');
  assert.equal(billOwnerName({ ownerLabel: 'Split #2', tableLabel: 'M06' }), 'Split #2');
  assert.equal(billLocation({ visitId: 'v', tableLabel: 'TW-01' }, [{ id: 'v', mode: 'TAKEAWAY', pickupNumber: 'TW-01' }], id => id), 'Bawa pulang · TW-01');
});

test('partial receipts print text safely with modifiers, outlet time and the remaining balance', (t) => {
  class Element {
    textContent = '';
    children: Element[] = [];
    style = { setProperty() {} };
    onclick?: () => void;
    append(...children: Element[]) { this.children.push(...children); }
    set innerHTML(_value: string) { throw new Error('Receipt text must not be parsed as HTML'); }
  }
  const doc = { title: '', documentElement: new Element(), head: new Element(), body: new Element(), createElement: () => new Element() };
  let printed = 0;
  const popup = { document: doc, opener: {}, focus() {}, print() { printed++; } };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { open: () => popup, getComputedStyle: () => ({ getPropertyValue: () => '' }) } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  t.after(() => {
    for (const [name, descriptor] of [['window', previousWindow], ['document', previousDocument]] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });
  printBillReceipt({ id: 'bill_a', ownerLabel: '<img onerror=alert(1)>', subtotalIdr: 36000, discountIdr: 0, serviceIdr: 1800, taxIdr: 3780, totalIdr: 41580, verifiedReceiptsIdr: 10000, balanceIdr: 31580, allocatedUnits: [{ id: 'u', itemName: 'Tea', variantName: 'Large', modifiersSummary: 'Less sugar', note: 'No ice', grossIdr: 36000 }], receipts: [{ method: 'CASH', receivedAt: '2026-11-21T00:00:00Z' }] }, { outlet: { name: 'Cafe' }, runtime: { demo: true } }, 'en', 'Asia/Jakarta');
  const content = (el: Element): string => [el.textContent, ...el.children.map(content)].join(' ');
  const text = content(doc.body);
  assert.match(text, /<img onerror=alert\(1\)>/);
  assert.match(text, /Large · Less sugar · No ice/);
  assert.match(text, /Payments received -Rp\s*10\.000/);
  assert.match(text, /Balance due Rp\s*31\.580/);
  assert.match(text, /Cash · .*07:00:00/);
  assert.match(text, /Demo receipt/);
  assert.doesNotMatch(text, /Invalid Date|undefined|NaN|-Rp\s*0\b|CASH|·\s*$/);
  assert.equal(popup.opener, null);
  assert.equal(printed, 1);
});
