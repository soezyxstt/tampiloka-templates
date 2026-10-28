import menuContent from '../../content/menu.json' with { type: 'json' };
import tableContent from '../../content/tables.json' with { type: 'json' };
import { cafeConfig, type CafeConfig } from '../config/cafe.ts';
import { validateCatalogContent } from './schema.ts';

/** Only the public, read-only catalog is available without transactional adapters. */
export function isStaticCatalogMode(
  config: Pick<CafeConfig, 'modules'> = cafeConfig,
  demoFlag: string | undefined = process.env.CAFE_DEMO_DB,
): boolean {
  return demoFlag !== '1' && config.modules.length === 1 && config.modules[0] === 'catalog';
}

/** This allowlist has no database, authentication, payment or staff dependencies. */
export function buildStaticCatalogSnapshot(menuInput: unknown, tableInput: unknown, config = cafeConfig) {
  const { menu, tables } = validateCatalogContent(menuInput, tableInput);
  const categories = menu.categories.filter((category) => category.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const catalog = menu.items.filter((item) => item.active).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => {
    const variants = item.variants.map((variant) => ({
      id: variant.id, menuItemId: item.id, name: variant.name, priceIdr: variant.priceIdr,
      isDefault: variant.isDefault, active: true,
      // The legacy detail control uses zero to disable an option. This is not a stock count.
      availableToSell: item.available && variant.available ? 999 : 0,
    }));
    const availableVariants = variants.filter((variant) => variant.availableToSell > 0);
    return {
      id: item.id, categoryId: item.categoryId, name: item.name, description: item.description,
      active: true, manualSoldOut: !item.available, sortOrder: item.sortOrder,
      photos: item.photos, photoUrl: item.photos[0] || null,
      allergensJson: item.allergens, tagsJson: item.tags,
      variants, isAvailable: availableVariants.length > 0,
      minPriceIdr: Math.min(...(availableVariants.length ? availableVariants : variants).map((variant) => variant.priceIdr)),
      modifierGroups: item.modifierGroups.map((group) => ({
        id: group.id, menuItemId: item.id, name: group.name, required: group.required,
        minSelect: group.minSelect, maxSelect: group.maxSelect, active: true,
        options: group.options.map((option) => ({ ...option, groupId: group.id, active: true })),
      })),
    };
  });
  return {
    runtime: { demo: false as const, sampleMenu: menu.sample, mode: 'catalog' as const },
    outlet: {
      id: 'outlet_static', slug: config.venue.outletSlug, tenantSlug: config.venue.tenantSlug,
      name: config.venue.name, address: config.venue.address, phone: config.venue.phone,
      timezone: config.timezone, acceptingOrders: false, ...menu.info,
    },
    categories, catalog,
    tables: tables.tables.filter((table) => table.active).map((table) => ({ ...table, physicalState: 'STATIC' })),
    paymentAccount: null,
    visits: [], participants: [], quotes: [], orderRequests: [], orders: [], orderUnits: [], bills: [],
    promotionRules: [], members: [], rewardEntitlements: [], wifiNetworks: [],
    serviceRequests: [], waitlistEntries: [], feedbackEntries: [],
    serverTime: new Date().toISOString(),
  };
}

export function getStaticCatalogSnapshot() {
  if (!isStaticCatalogMode()) throw new Error('Static catalog requires the catalog-only package without demo mode.');
  return buildStaticCatalogSnapshot(menuContent, tableContent);
}
