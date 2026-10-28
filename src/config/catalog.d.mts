export type ModuleId = 'catalog' | 'ordering' | 'payments' | 'cashier' | 'kitchen' | 'dashboard' | 'tables' | 'loyalty' | 'marketing';
export type ThemeId = 'boxy' | 'rounded' | 'editorial' | 'playful' | 'airy';
export type PaymentMode = 'cashier' | 'online' | 'both';
export interface CafeConfig {
  schemaVersion: 1;
  brand: { name: string; shortName: string; description: string; logo: string; primaryColor: string };
  theme: ThemeId;
  modules: ModuleId[];
  venue: { tenantSlug: string; outletSlug: string; name: string; address: string; phone: string };
  locale: 'id-ID';
  currency: 'IDR';
  timezone: string;
  payment: { mode: PaymentMode };
}
export const MODULES: Record<ModuleId, { label: string; description: string }>;
export const THEMES: Record<ThemeId, { label: string; description: string }>;
export const THEME_ALIASES: Record<string, ThemeId>;
export const PRESETS: Record<string, { label: string; modules: ModuleId[]; paymentMode: PaymentMode }>;
export const DEFAULT_CONFIG: CafeConfig;
export class ConfigError extends Error { issues: string[]; constructor(issues: string[]); }
export function normalizeTheme(theme: string): ThemeId;
export function slugify(value: string): string;
export function brandInitials(value: string): string;
export function validateConfig(input: unknown): CafeConfig;
export function applyPreset(config: CafeConfig, preset: string): CafeConfig;
export function foregroundForColor(hex: string): string;
export function readableAccent(hex: string): string;
