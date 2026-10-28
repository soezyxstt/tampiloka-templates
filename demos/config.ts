import rawConfig from '../config/cafe.json';
import { applyPreset, validateConfig, foregroundForColor, readableAccent, type ModuleId, type CafeConfig } from '../src/config/catalog.mjs';
import { resolveDemo } from './manifest';

export type { CafeConfig, ModuleId, ThemeId, PaymentMode } from '../src/config/catalog.mjs';
export { MODULES, PRESETS, THEMES } from '../src/config/catalog.mjs';

export const activeDemo = typeof location === 'undefined' ? undefined : resolveDemo(location.hostname, location.pathname);
const base = applyPreset(validateConfig(rawConfig), activeDemo?.id || 'full');
declare global { var __CAFE_DEMO_CONFIG__: CafeConfig | undefined; }
export const cafeConfig = validateConfig(globalThis.__CAFE_DEMO_CONFIG__ || {
  ...base,
  theme: activeDemo?.theme || 'rounded',
  venue: { ...base.venue, tenantSlug: 'dapur-pagi', outletSlug: activeDemo?.subdomain || 'cafe-full' },
});
export const isModuleEnabled = (module: ModuleId) => cafeConfig.modules.includes(module);
export const hasStaffModules = () => (['cashier', 'ordering', 'kitchen', 'dashboard', 'tables', 'marketing'] as ModuleId[]).some(isModuleEnabled);
export const getDefaultStaffModule = () => (['cashier', 'ordering', 'kitchen', 'dashboard', 'tables', 'marketing'] as ModuleId[]).find(isModuleEnabled) ?? null;
export const getBrandCssVariables = (): Record<string, string> => ({
  '--primary': cafeConfig.brand.primaryColor,
  '--primary-ink': readableAccent(cafeConfig.brand.primaryColor),
  '--primary-foreground': foregroundForColor(cafeConfig.brand.primaryColor),
  '--brand-tint': `color-mix(in srgb, ${cafeConfig.brand.primaryColor} 8%, white)`,
});
