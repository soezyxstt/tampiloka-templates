import type { CafeConfig } from '../config/catalog.mjs';

/** Data/worker compatibility, independent of the active view, theme and locale. */
export function browserDemoIdentity(config: Pick<CafeConfig, 'venue' | 'modules' | 'payment'>): string {
  return JSON.stringify({
    tenant: config.venue.tenantSlug,
    outlet: config.venue.outletSlug,
    modules: config.modules,
    payment: config.payment.mode,
  });
}
