import type { Location, Product } from '../src/domain/contract.ts';

export interface InstallationConfig {
  schemaVersion: 1;
  business: { id: string; name: string; timezone: string; currency: 'IDR' };
  preset: 'food' | 'retail' | 'supplies';
  mode: 'inventory' | 'retail' | 'full';
  theme: 'sand' | 'forest' | 'ink';
  modules: { pos: boolean; commercial: boolean };
  locations: Location[];
  products: Product[];
  demo: {
    openingStock: { locationId: string; productId: string; quantity: number; condition: 'sellable' | 'held' }[];
    prices: { productId: string; amount: number }[];
  };
}

/** Validate before creating an installation. Never seeds stock or grants access. */
export function validateInstallation(input: unknown): InstallationConfig {
  const fail = (path: string): never => { throw new Error(`Invalid operations configuration: ${path}`); };
  const object = (value: unknown, path: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path);
    return value as Record<string, unknown>;
  };
  const text = (value: unknown, path: string): string => {
    if (typeof value !== 'string' || !value.trim() || value.length > 200) return fail(path);
    return value.trim();
  };
  const id = (value: unknown, path: string): string => {
    const result = text(value, path);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(result)) return fail(path);
    return result;
  };
  const boolean = (value: unknown, path: string): boolean => typeof value === 'boolean' ? value : fail(path);
  const choice = <T extends string>(value: unknown, values: readonly T[], path: string): T =>
    typeof value === 'string' && values.includes(value as T) ? value as T : fail(path);
  const array = (value: unknown, path: string): unknown[] => Array.isArray(value) ? value : fail(path);
  const positive = (value: unknown, path: string): number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1e12 ? value : fail(path);
  const unique = (values: string[], path: string) => { if (new Set(values).size !== values.length) fail(path); };
  const root = object(input, 'root');
  if (root.schemaVersion !== 1) fail('schemaVersion');
  const rawBusiness = object(root.business, 'business');
  const timezone = text(rawBusiness.timezone, 'business.timezone');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { fail('business.timezone'); }
  const business = {
    id: id(rawBusiness.id, 'business.id'), name: text(rawBusiness.name, 'business.name'), timezone,
    currency: choice(rawBusiness.currency, ['IDR'] as const, 'business.currency (only integer IDR is supported)'),
  };
  const preset = choice(root.preset, ['food', 'retail', 'supplies'] as const, 'preset');
  const mode = choice(root.mode, ['inventory', 'retail', 'full'] as const, 'mode');
  const theme = choice(root.theme, ['sand', 'forest', 'ink'] as const, 'theme');
  const rawModules = object(root.modules, 'modules');
  const modules = { pos: boolean(rawModules.pos, 'modules.pos'), commercial: boolean(rawModules.commercial, 'modules.commercial') };
  if (modules.commercial && !modules.pos) fail('commercial requires pos');
  if (modules.pos !== (mode !== 'inventory') || modules.commercial !== (mode === 'full')) fail('modules must match mode');
  const locations: Location[] = array(root.locations, 'locations').map((value, index) => {
    const path = `locations[${index}]`, row = object(value, path);
    return { id: id(row.id, `${path}.id`), name: text(row.name, `${path}.name`),
      city: text(row.city, `${path}.city`), kind: choice(row.kind, ['warehouse', 'outlet'] as const, `${path}.kind`),
      active: boolean(row.active, `${path}.active`), allowNegativeSale: boolean(row.allowNegativeSale, `${path}.allowNegativeSale`) };
  });
  if (!locations.some(row => row.active)) fail('at least one active location is required');
  unique(locations.map(row => row.id), 'duplicate location ID');
  const products: Product[] = array(root.products, 'products').map((value, index) => {
    const path = `products[${index}]`, row = object(value, path);
    const baseUnit = text(row.baseUnit, `${path}.baseUnit`);
    const units = Object.fromEntries(Object.entries(object(row.units, `${path}.units`)).map(([unit, factor]) =>
      [text(unit, `${path}.unit name`), positive(factor, `${path}.units.${unit}`)]));
    if (units[baseUnit] !== 1) fail(`${path}.baseUnit must have factor 1`);
    return { id: id(row.id, `${path}.id`), sku: text(row.sku, `${path}.sku`), name: text(row.name, `${path}.name`),
      variant: row.variant === '' ? '' : text(row.variant, `${path}.variant`), baseUnit, units,
      fractional: boolean(row.fractional, `${path}.fractional`), active: boolean(row.active, `${path}.active`) };
  });
  unique(products.map(row => row.id), 'duplicate product ID');
  unique(products.map(row => row.sku), 'duplicate SKU');
  const rawDemo = object(root.demo ?? { openingStock: [], prices: [] }, 'demo');
  const openingStock = array(rawDemo.openingStock, 'demo.openingStock').map((value, index) => {
    const path = `demo.openingStock[${index}]`, row = object(value, path);
    const locationId = id(row.locationId, `${path}.locationId`), productId = id(row.productId, `${path}.productId`);
    const product = products.find(item => item.id === productId && item.active);
    if (!locations.some(item => item.id === locationId && item.active) || !product) fail(`${path}.reference`);
    const quantity = positive(row.quantity, `${path}.quantity`);
    if (!product!.fractional && !Number.isSafeInteger(quantity)) fail(`${path}.quantity precision`);
    return { locationId, productId, quantity, condition: choice(row.condition, ['sellable', 'held'] as const, `${path}.condition`) };
  });
  unique(openingStock.map(row => `${row.locationId}/${row.productId}/${row.condition}`), 'duplicate demo opening');
  const prices = array(rawDemo.prices, 'demo.prices').map((value, index) => {
    const path = `demo.prices[${index}]`, row = object(value, path);
    const productId = id(row.productId, `${path}.productId`);
    if (!products.some(item => item.id === productId && item.active)) fail(`${path}.productId`);
    if (typeof row.amount !== 'number' || !Number.isSafeInteger(row.amount) || row.amount < 0 || row.amount > 1e12) fail(`${path}.amount`);
    return { productId, amount: row.amount as number };
  });
  unique(prices.map(row => row.productId), 'duplicate demo price');
  return { schemaVersion: 1, business, preset, mode, theme, modules, locations, products, demo: { openingStock, prices } };
}
