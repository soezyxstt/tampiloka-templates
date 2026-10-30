import test from 'node:test';
import assert from 'node:assert/strict';
import { localizeSampleMenu, localizeSampleName } from './sample-menu.ts';

test('translates only unchanged sample menu fields and keeps the original snapshot', () => {
  const item = { id: 'item_kopi_aren', name: 'Es Kopi Susu Gula Aren', description: 'Custom description', variants: [], modifierGroups: [] };
  const custom = { id: 'custom_item', name: 'Es Kopi Susu Gula Aren', variants: [], modifierGroups: [] };
  const snapshot = { runtime: { demo: true }, categories: [], catalog: [item, custom] };
  const translated = localizeSampleMenu(snapshot, 'en');
  assert.equal(translated.catalog[0].name, 'Iced Palm Sugar Milk Coffee');
  assert.equal(translated.catalog[0].description, 'Custom description');
  assert.equal(translated.catalog[1].name, custom.name);
  assert.equal(item.name, 'Es Kopi Susu Gula Aren');
  assert.equal(localizeSampleMenu(snapshot, 'id'), snapshot);
  assert.equal(localizeSampleMenu({ ...snapshot, runtime: { demo: false } }, 'en').catalog[0].name, item.name);
});

test('sample names in saved carts and orders follow the language without changing custom content', () => {
  assert.equal(localizeSampleName('item_kopi_aren', 'Es Kopi Susu Gula Aren', 'en', true), 'Iced Palm Sugar Milk Coffee');
  assert.equal(localizeSampleName('item_kopi_aren', 'Iced Palm Sugar Milk Coffee', 'id', true), 'Es Kopi Susu Gula Aren');
  assert.equal(localizeSampleName('item_kopi_aren', 'Custom coffee', 'en', true), 'Custom coffee');
  assert.equal(localizeSampleName('item_kopi_aren', 'Es Kopi Susu Gula Aren', 'en', false), 'Es Kopi Susu Gula Aren');
});
