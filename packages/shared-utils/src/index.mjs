/** Shared presentation helpers; no business rules or stored customer data. */
export function cn(...values) { return values.flat(Infinity).filter(Boolean).join(' '); }
export function formatCurrency(value, locale = 'id-ID', currency = 'IDR') {
  if (!Number.isFinite(value)) throw new TypeError('Currency value must be finite.');
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}
export function slugify(value) {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/g, '');
}
export function initials(value) { return String(value).trim().split(/\s+/).slice(0, 2).map(word => [...word][0] || '').join('').toUpperCase(); }
