import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMOS, demoNavigationPath, demoNavigationUrl, resolveDemo } from '../demos/manifest.ts';

test('an explicit mode path wins over a legacy preset host', () => {
  assert.equal(resolveDemo('cafe-order.tampiloka.site', '/p/cashier/staff')?.id, 'cashier');
  assert.equal(resolveDemo('cafe-full.tampiloka.site', '/p/catalog/')?.id, 'catalog');
  assert.equal(resolveDemo('cafe-order.tampiloka.site', '/staff')?.id, 'order-at-cashier');
});

test('mode and role links keep the active origin and legacy routes', () => {
  const full = DEMOS.find(demo => demo.id === 'full');
  const cashier = DEMOS.find(demo => demo.id === 'cashier');
  assert.equal(demoNavigationPath(full, 'pelanggan', 'cafe-full.tampiloka.site'), '/');
  assert.equal(demoNavigationPath(full, 'staf', 'cafe-full.tampiloka.site'), '/staff');
  assert.equal(demoNavigationPath(cashier, 'staf', 'cafe-full.tampiloka.site'), '/p/cashier/staff');
  assert.equal(demoNavigationPath(full, 'pelanggan', 'cafe.tampiloka.site'), '/p/full/');
  assert.equal(demoNavigationPath(full, 'staf', 'preview.pages.dev'), '/p/full/staff');
});

test('table and bill routes still select their outlet preset', () => {
  assert.equal(resolveDemo('cafe.tampiloka.site', '/t/dapur-pagi/cafe-pay/m/table-1')?.id, 'order-and-pay');
  assert.equal(resolveDemo('preview.pages.dev', '/staff/dapur-pagi/cafe-kitchen')?.id, 'cashier-kitchen');
});

test('same-mode navigation preserves a table, bill, unrelated query and hash through staff', () => {
  const full = DEMOS.find(demo => demo.id === 'full');
  const original = 'https://cafe.tampiloka.site/t/dapur-pagi/cafe-full/m/table-06?bill=share-123&filter=a&filter=b#receipt';
  const options = { currentUrl: original, currentDemoId: 'full', theme: 'airy', language: 'en' };
  const customer = new URL(demoNavigationUrl(full, 'pelanggan', options), original);
  assert.equal(customer.pathname, '/t/dapur-pagi/cafe-full/m/table-06');
  assert.equal(customer.searchParams.get('bill'), 'share-123');
  assert.equal(customer.hash, '#receipt');
  const staff = new URL(demoNavigationUrl(full, 'staf', options), original);
  assert.equal(staff.pathname, '/p/full/staff');
  assert.equal(staff.searchParams.get('bill'), 'share-123');
  assert.equal(staff.hash, '#receipt');
  const restored = new URL(demoNavigationUrl(full, 'pelanggan', { ...options, currentUrl: staff.href, customerRoute: original }), original);
  assert.equal(restored.pathname, customer.pathname);
  assert.equal(restored.searchParams.get('bill'), 'share-123');
  assert.deepEqual(restored.searchParams.getAll('filter'), ['a', 'b']);
  assert.equal(restored.hash, '#receipt');
  const shortRoute = '/m/table-06?bill=share-123#receipt';
  const shortRestored = new URL(demoNavigationUrl(full, 'pelanggan', { ...options, currentUrl: staff.href, customerRoute: shortRoute }), original);
  assert.equal(shortRestored.pathname, '/m/table-06', 'Short QR routes on the hub use the full-service default.');
  assert.equal(shortRestored.searchParams.get('bill'), 'share-123');
});

test('new modes clear mode-bound context and reject foreign return routes', () => {
  const full = DEMOS.find(demo => demo.id === 'full');
  const cashier = DEMOS.find(demo => demo.id === 'cashier');
  const options = { currentUrl: 'https://cafe.tampiloka.site/p/full/staff?bill=secret&table=one&principal=guest&utm_source=gallery#receipt', currentDemoId: 'full', theme: 'airy', language: 'id' };
  const next = new URL(demoNavigationUrl(cashier, 'staf', options), options.currentUrl);
  assert.equal(next.pathname, '/p/cashier/staff');
  assert.equal(next.searchParams.has('bill'), false);
  assert.equal(next.searchParams.has('table'), false);
  assert.equal(next.searchParams.has('principal'), false);
  assert.equal(next.searchParams.get('utm_source'), 'gallery');
  assert.equal(next.hash, '');
  const fallback = new URL(demoNavigationUrl(full, 'pelanggan', { ...options, customerRoute: 'https://example.com/p/full/' }), options.currentUrl);
  assert.equal(fallback.pathname, '/p/full/');
  assert.equal(fallback.origin, 'https://cafe.tampiloka.site');
});
