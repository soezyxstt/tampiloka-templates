import test from 'node:test';
import assert from 'node:assert/strict';
import configuredMenu from '../../content/menu.json' with { type: 'json' };
import configuredTables from '../../content/tables.json' with { type: 'json' };
import { validateCatalogContent, type StaticMenu, type StaticTables } from './schema.ts';
import { buildStaticCatalogSnapshot, isStaticCatalogMode } from './static-catalog.ts';
import { publicCatalogFromSnapshot } from './export.ts';

const menu: StaticMenu = {
  schemaVersion: 1, sample: true,
  info: { openHoursText: '09.00–17.00', facilitiesText: 'Teras', availabilityNote: 'Tanya staf.', serviceChargeBps: 0, taxBps: 0, taxInclusiveDisplay: true, serviceInTaxBase: true },
  categories: [{ id: 'drinks', name: 'Minuman', sortOrder: 0, active: true }],
  items: [
    { id: 'coffee', categoryId: 'drinks', name: 'Kopi', description: 'Kopi contoh.', photos: ['/images/menu/es-kopi-susu-aren.svg'], allergens: ['Susu'], tags: [], active: true, available: true, sortOrder: 0,
      variants: [{ id: 'coffee_regular', name: 'Regular', priceIdr: 20000, isDefault: true, available: true }, { id: 'coffee_large', name: 'Large', priceIdr: 25000, isDefault: false, available: true }],
      modifierGroups: [{ id: 'sugar', name: 'Gula', required: true, minSelect: 1, maxSelect: 1, options: [{ id: 'sugar_normal', name: 'Normal', priceIdr: 0 }, { id: 'sugar_none', name: 'Tanpa gula', priceIdr: 0 }] }] },
    { id: 'tea', categoryId: 'drinks', name: 'Teh', description: 'Teh contoh.', photos: [], allergens: [], tags: [], active: true, available: true, sortOrder: 1,
      variants: [{ id: 'tea_regular', name: 'Regular', priceIdr: 10000, isDefault: true, available: true }], modifierGroups: [] },
  ],
};
const tables: StaticTables = { schemaVersion: 1, tables: [
  { id: 'table_1', label: '01', areaName: 'Teras', qrToken: 'table-one', capacity: 4, active: true },
  { id: 'table_2', label: '02', areaName: 'Teras', qrToken: 'table-two', capacity: 2, active: true },
] };

const copy = <T>(value: T): T => structuredClone(value);

test('public sample content validates and builds a read-only customer snapshot', () => {
  const snapshot = buildStaticCatalogSnapshot(menu, tables);
  assert.equal(snapshot.runtime.demo, false);
  assert.equal(snapshot.runtime.sampleMenu, true);
  assert.equal(snapshot.runtime.mode, 'catalog');
  assert.equal(snapshot.outlet.acceptingOrders, false);
  assert.equal(snapshot.paymentAccount, null);
  assert.equal(snapshot.catalog.length, menu.items.filter((item) => item.active).length);
  assert.deepEqual(snapshot.orders, []);
  assert.deepEqual(snapshot.bills, []);
  assert.equal('staffRoles' in snapshot, false);
  assert.equal('auditEvents' in snapshot, false);
  assert.equal('cashShifts' in snapshot, false);
  assert.ok(snapshot.tables.every((table) => table.physicalState === 'STATIC'));
});

test('only exact catalog-only config can enter the public static runtime', () => {
  assert.equal(isStaticCatalogMode({ modules: ['catalog'] }, ''), true);
  assert.equal(isStaticCatalogMode({ modules: ['catalog'] }, '1'), false);
  assert.equal(isStaticCatalogMode({ modules: ['catalog', 'ordering'] }, ''), false);
  assert.equal(isStaticCatalogMode({ modules: ['catalog', 'cashier'] }, ''), false);
  assert.equal(isStaticCatalogMode({ modules: ['cashier'] }, ''), false);
  assert.equal(isStaticCatalogMode({ modules: [] }, ''), false);
});

test('catalog rejects non-integer/negative money and unknown categories', () => {
  for (const price of [-1, 10.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const invalid = copy(menu); invalid.items[0].variants[0].priceIdr = price;
    assert.throws(() => validateCatalogContent(invalid, tables), /priceIdr/);
  }
  const invalid = copy(menu); invalid.items[0].categoryId = 'missing_category';
  assert.throws(() => validateCatalogContent(invalid, tables), /categoryId/);
});

test('catalog rejects duplicate IDs and missing or ambiguous default variants', () => {
  const duplicate = copy(menu); duplicate.items[1].id = duplicate.items[0].id;
  assert.throws(() => validateCatalogContent(duplicate, tables), /Duplicate item ID/);
  const noDefault = copy(menu); noDefault.items[0].variants.forEach((variant) => { variant.isDefault = false; });
  assert.throws(() => validateCatalogContent(noDefault, tables), /exactly one default/);
  const manyDefaults = copy(menu); manyDefaults.items[0].variants.forEach((variant) => { variant.isDefault = true; });
  assert.throws(() => validateCatalogContent(manyDefaults, tables), /exactly one default/);
});

test('modifier requirements cannot exceed the actual choices', () => {
  const invalid = copy(menu); invalid.items[0].modifierGroups[0].maxSelect = 30;
  assert.throws(() => validateCatalogContent(invalid, tables), /Selection limits/);
  invalid.items[0].modifierGroups[0].maxSelect = 1;
  invalid.items[0].modifierGroups[0].minSelect = 0;
  assert.throws(() => validateCatalogContent(invalid, tables), /Required groups/);
});

test('catalog rejects unsafe image links and private fields', () => {
  for (const url of ['javascript:alert(1)', '//elsewhere.test/pixel', 'http://elsewhere.test/photo.jpg', 'https://name:secret@elsewhere.test/photo.jpg', '/images/../api/private', '/images/evil\\photo']) {
    const invalid = copy(menu); invalid.items[0].photos = [url];
    assert.throws(() => validateCatalogContent(invalid, tables), /HTTPS image/);
  }
  assert.throws(() => validateCatalogContent({ ...menu, staffAccounts: [{ pin: 'secret' }] }, tables), /Unrecognized key/);
  assert.throws(() => validateCatalogContent(menu, { ...tables, customerDirectory: [] }), /Unrecognized key/);
});

test('QR table tokens and labels must be unique', () => {
  const invalid = copy(tables); invalid.tables[1].qrToken = invalid.tables[0].qrToken;
  assert.throws(() => validateCatalogContent(menu, invalid), /Duplicate table qrToken/);
  invalid.tables[1].qrToken = 'another_token'; invalid.tables[1].label = invalid.tables[0].label;
  assert.throws(() => validateCatalogContent(menu, invalid), /Duplicate table label/);
});

test('inactive content stays hidden and sample status is an explicit author choice', () => {
  const clientMenu = copy(menu); clientMenu.sample = false;
  clientMenu.items[0].active = false;
  clientMenu.items[1].available = false;
  const clientTables = copy(tables); clientTables.tables[0].active = false;
  const snapshot = buildStaticCatalogSnapshot(clientMenu, clientTables);
  assert.equal(snapshot.runtime.sampleMenu, false);
  assert.equal(snapshot.catalog.some((item) => item.id === clientMenu.items[0].id), false);
  assert.equal(snapshot.catalog.find((item) => item.id === clientMenu.items[1].id)?.isAvailable, false);
  assert.equal(snapshot.tables.some((table) => table.id === clientTables.tables[0].id), false);
});

test('catalog export never copies staff, payment credentials, guests or Wi-Fi passwords', () => {
  const snapshot = {
    ...buildStaticCatalogSnapshot(menu, tables),
    staffRoles: [{ secret: 'secret_staff' }], bills: [{ secret: 'secret_bill' }],
    paymentAccount: { secret: 'secret_merchant' }, wifiNetworks: [{ password: 'secret_wifi' }],
    members: [{ email: 'secret_member@example.test' }],
  };
  const exported = publicCatalogFromSnapshot(snapshot);
  const text = JSON.stringify(exported);
  assert.equal(text.includes('secret_'), false);
  assert.equal(exported.menu.sample, true);
  assert.equal(exported.menu.items[0].variants[0].priceIdr, menu.items[0].variants[0].priceIdr);
  assert.equal(publicCatalogFromSnapshot(snapshot, false).menu.sample, false);
});

test('the current client content passes the same schema', () => {
  assert.doesNotThrow(() => validateCatalogContent(configuredMenu, configuredTables));
});
