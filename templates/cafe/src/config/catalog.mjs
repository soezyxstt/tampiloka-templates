/** Shared, dependency-free configuration rules used by the app and CLI. */
export const MODULES = Object.freeze({
  catalog: { label: 'Menu catalog', description: 'Public menu, search, categories, and table QR entry.' },
  ordering: { label: 'Customer ordering', description: 'Guest cart, order submission, and staff order inbox.' },
  payments: { label: 'Online payments', description: 'Online checkout UI. Live settlement needs a verified provider adapter.' },
  cashier: { label: 'Cashier / POS', description: 'Staff enters orders, discounts, bills, and cash payments.' },
  kitchen: { label: 'Kitchen display', description: 'Station queues and preparation status.' },
  dashboard: { label: 'Reports', description: 'Sales, transaction, and shift reports.' },
  tables: { label: 'Table service', description: 'Floor plan, table visits, help requests, and waitlist.' },
  loyalty: { label: 'Loyalty', description: 'Member and reward flows.' },
  marketing: { label: 'Promotions', description: 'Promotion management and customer feedback.' },
});

export const THEMES = Object.freeze({
  boxy: { label: 'Boxy', description: 'Square edges, compact spacing, clear rules.' },
  rounded: { label: 'Rounded', description: 'Soft corners and balanced spacing.' },
  editorial: { label: 'Editorial', description: 'Serif headings, open rows, and fine rules.' },
  playful: { label: 'Playful', description: 'Bold borders, lively type, and offset shadows.' },
  airy: { label: 'Airy', description: 'Loose spacing, light surfaces, and quiet borders.' },
});

export const THEME_ALIASES = Object.freeze({ boxie: 'boxy', roundy: 'rounded', fun: 'playful', loose: 'airy' });

export const PRESETS = Object.freeze({
  catalog: { label: 'Menu + waiter requests', modules: ['catalog', 'ordering'], paymentMode: 'cashier' },
  'order-at-cashier': { label: 'Menu + ordering, pay at cashier', modules: ['catalog', 'ordering'], paymentMode: 'cashier' },
  'order-and-pay': { label: 'Menu + ordering + online payment', modules: ['catalog', 'ordering', 'payments'], paymentMode: 'online' },
  cashier: { label: 'Cashier only', modules: ['cashier'], paymentMode: 'cashier' },
  'cashier-kitchen': { label: 'Cashier + kitchen', modules: ['cashier', 'kitchen'], paymentMode: 'cashier' },
  operations: { label: 'Cashier + kitchen + reports', modules: ['cashier', 'kitchen', 'dashboard'], paymentMode: 'cashier' },
  'menu-cashier': { label: 'Menu + cashier', modules: ['catalog', 'cashier'], paymentMode: 'cashier' },
  'menu-order-cashier': { label: 'Menu + ordering + cashier', modules: ['catalog', 'ordering', 'cashier'], paymentMode: 'cashier' },
  full: { label: 'Full service', modules: Object.keys(MODULES), paymentMode: 'both' },
});

export const DEFAULT_CONFIG = Object.freeze({
  schemaVersion: 1,
  brand: { name: 'Dapur Pagi', shortName: 'DP', description: 'Kopi, sajian hangat, dan waktu yang menyenangkan.', logo: '', primaryColor: '#A84A30' },
  theme: 'rounded',
  modules: Object.keys(MODULES),
  venue: { tenantSlug: 'dapur-pagi', outletSlug: 'dapur-pagi', name: 'Dapur Pagi', address: 'Bandung, Jawa Barat', phone: '' },
  locale: 'id-ID',
  currency: 'IDR',
  timezone: 'Asia/Jakarta',
  payment: { mode: 'both' },
});

export class ConfigError extends Error {
  constructor(issues) {
    super(`Invalid cafe configuration:\n${issues.map(issue => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

export function normalizeTheme(theme) {
  return THEME_ALIASES[theme] || theme;
}

export function slugify(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/g, '');
}

export function brandInitials(value) {
  return String(value).trim().split(/\s+/).slice(0, 2).map(word => [...word][0] || '').join('').toUpperCase();
}

/** Reject unknown keys so misspelled modules/options never silently fall back. */
export function validateConfig(input) {
  const issues = [];
  const object = (value, name, keys) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      issues.push(`${name} must be an object.`);
      return {};
    }
    for (const key of Object.keys(value)) if (!keys.includes(key)) issues.push(`Unknown setting ${name}.${key}.`);
    return value;
  };
  const string = (value, name, max, optional = false) => {
    if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
      issues.push(`${name} must be ${optional ? 'a' : 'a non-empty'} text value of at most ${max} characters without control characters.`);
      return '';
    }
    return value.trim();
  };
  const root = object(input, 'config', ['schemaVersion', 'brand', 'theme', 'modules', 'venue', 'locale', 'currency', 'timezone', 'payment']);
  if (root.schemaVersion !== 1) issues.push('schemaVersion must be 1.');
  const brand = object(root.brand, 'brand', ['name', 'shortName', 'description', 'logo', 'primaryColor']);
  const venue = object(root.venue, 'venue', ['tenantSlug', 'outletSlug', 'name', 'address', 'phone']);
  const payment = object(root.payment, 'payment', ['mode']);
  const clean = {
    schemaVersion: 1,
    brand: {
      name: string(brand.name, 'brand.name', 80),
      shortName: string(brand.shortName, 'brand.shortName', 20),
      description: string(brand.description, 'brand.description', 240, true),
      logo: string(brand.logo, 'brand.logo', 2048, true),
      primaryColor: string(brand.primaryColor, 'brand.primaryColor', 7),
    },
    theme: normalizeTheme(root.theme),
    modules: Array.isArray(root.modules) ? [...root.modules] : [],
    venue: {
      tenantSlug: string(venue.tenantSlug, 'venue.tenantSlug', 63),
      outletSlug: string(venue.outletSlug, 'venue.outletSlug', 63),
      name: string(venue.name, 'venue.name', 80),
      address: string(venue.address, 'venue.address', 240, true),
      phone: string(venue.phone, 'venue.phone', 40, true),
    },
    locale: root.locale,
    currency: root.currency,
    timezone: string(root.timezone, 'timezone', 80),
    payment: { mode: payment.mode },
  };
  if (!/^#[0-9a-f]{6}$/i.test(clean.brand.primaryColor)) issues.push('brand.primaryColor must use a six-digit hex color, such as #A84A30.');
  clean.brand.primaryColor = clean.brand.primaryColor.toUpperCase();
  if (clean.brand.logo) {
    const local = /^\/(?!\/)/.test(clean.brand.logo) && !clean.brand.logo.split(/[?#]/)[0].split('/').includes('..') && !clean.brand.logo.includes('\\');
    let remote = false;
    try { const url = new URL(clean.brand.logo); remote = url.protocol === 'https:' && !url.username && !url.password; } catch { /* Local public asset path. */ }
    if (!local && !remote) issues.push('brand.logo must be a /public-relative path or an HTTPS URL without credentials.');
  }
  if (typeof clean.theme !== 'string' || !Object.hasOwn(THEMES, clean.theme)) issues.push(`theme must be one of: ${Object.keys(THEMES).join(', ')}.`);
  if (!Array.isArray(root.modules) || clean.modules.length === 0) issues.push('modules must contain at least one module.');
  for (const capability of clean.modules) if (typeof capability !== 'string' || !Object.hasOwn(MODULES, capability)) issues.push(`Unknown module: ${String(capability)}.`);
  if (new Set(clean.modules).size !== clean.modules.length) issues.push('modules must not contain duplicates.');
  const has = module => clean.modules.includes(module);
  if (has('ordering') && !has('catalog')) issues.push('ordering requires catalog.');
  for (const capability of ['payments', 'kitchen', 'dashboard', 'loyalty']) {
    if (has(capability) && !has('ordering') && !has('cashier')) issues.push(`${capability} requires ordering or cashier.`);
  }
  if (has('marketing') && !has('catalog') && !has('cashier')) issues.push('marketing requires catalog or cashier.');
  for (const key of ['tenantSlug', 'outletSlug']) if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean.venue[key])) issues.push(`venue.${key} must use lowercase letters, numbers, and single hyphens.`);
  if (clean.locale !== 'id-ID') issues.push('locale must be id-ID; the current UI uses Indonesian copy.');
  if (clean.currency !== 'IDR') issues.push('currency must be IDR; pricing and settlement use integer rupiah.');
  try { new Intl.DateTimeFormat('en', { timeZone: clean.timezone }); } catch { issues.push('timezone must be a valid IANA timezone, such as Asia/Jakarta.'); }
  if (!['cashier', 'online', 'both'].includes(payment.mode)) issues.push('payment.mode must be cashier, online, or both.');
  if (has('payments') && payment.mode === 'cashier') issues.push('Enable payment.mode online or both when payments is enabled.');
  if (!has('payments') && payment.mode !== 'cashier') issues.push('payment.mode must be cashier when payments is disabled.');
  if (issues.length) throw new ConfigError(issues);
  clean.modules.sort((a, b) => Object.keys(MODULES).indexOf(a) - Object.keys(MODULES).indexOf(b));
  return clean;
}

export function applyPreset(config, preset) {
  if (!Object.hasOwn(PRESETS, preset)) throw new ConfigError([`Unknown preset ${preset}. Choose ${Object.keys(PRESETS).join(', ')}.`]);
  return { ...structuredClone(config), modules: [...PRESETS[preset].modules], payment: { mode: PRESETS[preset].paymentMode } };
}

/** Select whichever of black and white gives higher WCAG contrast. */
export function foregroundForColor(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new ConfigError(['Color must use six-digit hex notation.']);
  const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#FFFFFF';
}

/** Keep the brand hue, darkening only text/icon ink until it reads on both surfaces. */
export function readableAccent(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new ConfigError(['Color must use six-digit hex notation.']);
  const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const luminance = values => values.map(value => value / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
  const surfaces = [[255, 255, 255], [247, 245, 241]].map(luminance);
  const passes = values => {
    const ink = luminance(values);
    return surfaces.every(surface => (Math.max(ink, surface) + 0.05) / (Math.min(ink, surface) + 0.05) >= 4.5);
  };
  if (passes(rgb)) return hex.toUpperCase();
  let low = 0;
  let high = 1;
  for (let step = 0; step < 24; step += 1) {
    const factor = (low + high) / 2;
    if (passes(rgb.map(value => Math.round(value * factor)))) low = factor;
    else high = factor;
  }
  return `#${rgb.map(value => Math.round(value * low).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
