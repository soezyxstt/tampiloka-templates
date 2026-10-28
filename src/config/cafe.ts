import rawConfig from '../../config/cafe.json' with { type: 'json' };
import { validateConfig, foregroundForColor, readableAccent, type ModuleId } from './catalog.mjs';

export type { CafeConfig, ModuleId, ThemeId, PaymentMode } from './catalog.mjs';
export { MODULES, PRESETS, THEMES } from './catalog.mjs';

/** Public configuration only. Credentials belong in server environment variables. */
export const cafeConfig = validateConfig(rawConfig);

export function isModuleEnabled(module: ModuleId): boolean {
  return cafeConfig.modules.includes(module);
}

export function hasStaffModules(): boolean {
  return (['cashier', 'ordering', 'kitchen', 'dashboard', 'tables', 'marketing'] as ModuleId[]).some(isModuleEnabled);
}

export function getDefaultStaffModule(): ModuleId | null {
  return (['cashier', 'ordering', 'kitchen', 'dashboard', 'tables', 'marketing'] as ModuleId[]).find(isModuleEnabled) ?? null;
}

export function getBrandCssVariables(): Record<string, string> {
  return {
    '--primary': cafeConfig.brand.primaryColor,
    '--primary-ink': readableAccent(cafeConfig.brand.primaryColor),
    '--primary-foreground': foregroundForColor(cafeConfig.brand.primaryColor),
    '--brand-tint': `color-mix(in srgb, ${cafeConfig.brand.primaryColor} 8%, white)`,
  };
}
