import { applyPreset, THEMES, validateConfig } from '../src/config/catalog.mjs';
import { DEMOS, resolveDemo } from './manifest.ts';

/** Resolve every launcher (preset, role and table route) to its preset config. */
export function resolveDemoConfiguration(rawConfig: unknown, location?: Pick<Location, 'hostname' | 'pathname' | 'search'>) {
  const activeDemo = location ? resolveDemo(location.hostname, location.pathname) || DEMOS.find(demo => demo.id === 'full') : undefined;
  const base = applyPreset(validateConfig(rawConfig), activeDemo?.id || 'full');
  const requestedTheme = location ? new URLSearchParams(location.search).get('theme') : null;
  const config = validateConfig({
    ...base,
    theme: requestedTheme && Object.hasOwn(THEMES, requestedTheme) ? requestedTheme : activeDemo?.theme || 'rounded',
    venue: { ...base.venue, tenantSlug: 'dapur-pagi', outletSlug: activeDemo?.subdomain || 'cafe-full' },
  });
  return { activeDemo, config };
}
