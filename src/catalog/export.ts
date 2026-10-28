import { validateCatalogContent } from './schema.ts';

/** Copy public menu fields only. A staff/finance snapshot can never leak through a spread. */
export function publicCatalogFromSnapshot(snapshot: any, sample = true) {
  if (!snapshot || !Array.isArray(snapshot.catalog) || !Array.isArray(snapshot.categories) || !Array.isArray(snapshot.tables)) {
    throw new Error('The source did not return a public cafe catalog snapshot.');
  }
  const menu = {
    schemaVersion: 1, sample,
    info: {
      openHoursText: snapshot.outlet?.openHoursText || '',
      facilitiesText: snapshot.outlet?.facilitiesText || '',
      availabilityNote: 'Ketersediaan dapat berubah. Konfirmasi pesanan langsung ke staf.',
      serviceChargeBps: snapshot.outlet?.serviceChargeBps ?? 0,
      taxBps: snapshot.outlet?.taxBps ?? 0,
      taxInclusiveDisplay: snapshot.outlet?.taxInclusiveDisplay ?? true,
      serviceInTaxBase: snapshot.outlet?.serviceInTaxBase ?? true,
    },
    categories: snapshot.categories.map((category: any, index: number) => ({
      id: category.id, name: category.name, active: category.active !== false,
      sortOrder: category.sortOrder ?? index,
    })),
    items: snapshot.catalog.map((item: any, index: number) => ({
      id: item.id, categoryId: item.categoryId, name: item.name, description: item.description || '',
      active: item.active !== false, available: item.isAvailable === true,
      sortOrder: item.sortOrder ?? index,
      photos: Array.isArray(item.photos) ? item.photos : item.photoUrl ? [item.photoUrl] : [],
      allergens: Array.isArray(item.allergensJson) ? item.allergensJson : [],
      tags: Array.isArray(item.tagsJson) ? item.tagsJson : [],
      variants: (item.variants || []).filter((variant: any) => variant.active !== false).map((variant: any) => ({
        id: variant.id, name: variant.name, priceIdr: variant.priceIdr,
        isDefault: variant.isDefault === true, available: variant.availableToSell > 0,
      })),
      modifierGroups: (item.modifierGroups || []).filter((group: any) => group.active !== false).map((group: any) => ({
        id: group.id, name: group.name, required: group.required, minSelect: group.minSelect, maxSelect: group.maxSelect,
        options: (group.options || []).filter((option: any) => option.active !== false).map((option: any) => ({ id: option.id, name: option.name, priceIdr: option.priceIdr })),
      })),
    })),
  };
  const tables = {
    schemaVersion: 1,
    tables: snapshot.tables.map((table: any) => ({
      id: table.id, label: table.label, areaName: table.areaName || '', qrToken: table.qrToken,
      capacity: table.capacity ?? 4, active: table.active !== false && table.physicalState !== 'OUT_OF_SERVICE',
    })),
  };
  return validateCatalogContent(menu, tables);
}
