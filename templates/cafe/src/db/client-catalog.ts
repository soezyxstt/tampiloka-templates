import { validateCatalogContent } from '../catalog/schema.ts';
import type { CafeConfig } from '../config/cafe.ts';

/** Statements for a fresh client database, never the fictional demo fixture. */
export function clientCatalogStatements(menuInput: unknown, tablesInput: unknown, config: CafeConfig) {
  const { menu } = validateCatalogContent(menuInput, tablesInput);
  if (menu.sample) throw new Error('Replace the sample catalog and set sample to false before initializing a client database.');
  const statements: { sql: string; args: (string | number | null)[] }[] = [];
  const add = (table: string, values: Record<string, string | number | null>) => {
    const columns = Object.keys(values);
    statements.push({ sql: `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, args: Object.values(values) });
  };
  const tenant = `tenant_${config.venue.tenantSlug}`, outlet = `outlet_${config.venue.outletSlug}`;
  const scope = { tenant_id: tenant, outlet_id: outlet };
  add('tenants', { id: tenant, slug: config.venue.tenantSlug, name: config.brand.name });
  add('outlets', { id: outlet, tenant_id: tenant, slug: config.venue.outletSlug, name: config.venue.name, address: config.venue.address, timezone: config.timezone, open_hours_text: menu.info.openHoursText, facilities_text: menu.info.facilitiesText, service_charge_bps: menu.info.serviceChargeBps, tax_bps: menu.info.taxBps, service_in_tax_base: +menu.info.serviceInTaxBase, tax_inclusive_display: +menu.info.taxInclusiveDisplay, accepting_orders: 0 });
  add('stations', { id: 'station_catalog', ...scope, code: 'CATALOG', name: 'Catalog', type: 'KITCHEN' });
  for (const category of menu.categories) add('menu_categories', { id: category.id, ...scope, name: category.name, slug: category.id, sort_order: category.sortOrder, active: +category.active });
  for (const item of menu.items) {
    add('menu_items', { id: item.id, ...scope, external_code: item.id, category_id: item.categoryId, station_id: 'station_catalog', station_code: 'CATALOG', name: item.name, slug: item.id, description: item.description, photo_url: item.photos[0] ?? null, allergens_json: JSON.stringify(item.allergens), tags_json: JSON.stringify(item.tags), manual_sold_out: +!item.available, sort_order: item.sortOrder, active: +item.active });
    for (const variant of item.variants) add('menu_variants', { id: variant.id, ...scope, menu_item_id: item.id, code: variant.id, name: variant.name, price_idr: variant.priceIdr, is_default: +variant.isDefault, active: +variant.available });
    for (const group of item.modifierGroups) {
      add('modifier_groups', { id: group.id, ...scope, menu_item_id: item.id, name: group.name, min_select: group.minSelect, max_select: group.maxSelect, required: +group.required });
      for (const option of group.options) add('modifier_options', { id: option.id, ...scope, group_id: group.id, name: option.name, price_idr: option.priceIdr });
    }
  }
  return statements;
}
