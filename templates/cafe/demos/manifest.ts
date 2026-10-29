import { PRESETS, type ThemeId } from '../src/config/catalog.mjs';
import type { DemoPreset } from './components/demo-portal';

export const DEMO_DOMAIN = 'tampiloka.site';
export const DEMO_HUB = `https://cafe.${DEMO_DOMAIN}`;

const definitions: Array<[string, string, string, string, string, ThemeId]> = [
  ['catalog', 'Menu and waiter requests', 'Guests keep their own order list and send it to the waiter. Payment stays offline.', 'For table ordering handled by staff, without a POS or online payment.', 'cafe-catalog', 'editorial'],
  ['order-at-cashier', 'Order, pay at the counter', 'Guests send their order. Staff receive it and handle payment at the counter.', 'For self-ordering without online checkout.', 'cafe-order', 'rounded'],
  ['order-and-pay', 'Order and pay', 'The customer journey from a table menu to a simulated online payment.', 'For a complete guest checkout experience.', 'cafe-pay', 'airy'],
  ['cashier', 'Cashier', 'Build an order, apply a discount, take cash and manage the shift.', 'For counter service and walk-in orders.', 'cafe-pos', 'boxy'],
  ['cashier-kitchen', 'Cashier and kitchen', 'Connect the counter to clear preparation queues for the kitchen and bar.', 'For teams that need a shared order workflow.', 'cafe-kitchen', 'playful'],
  ['operations', 'Cafe operations', 'Cashier, preparation and reports in one staff workspace.', 'For owners who need a view of sales and daily operations.', 'cafe-operations', 'boxy'],
  ['menu-cashier', 'Menu and cashier', 'Guests browse the menu while staff enter and manage their orders.', 'For a digital menu with staff-led ordering.', 'cafe-menu-pos', 'rounded'],
  ['menu-order-cashier', 'Menu, orders and cashier', 'Let guests order from their table while the cashier manages bills and payment.', 'For a flexible mix of self-ordering and counter service.', 'cafe-menu-order-pos', 'editorial'],
  ['full', 'Full service', 'Explore the customer, cashier, kitchen, table and reporting experiences together.', 'For a complete cafe workflow demonstration.', 'cafe-full', 'rounded'],
];

export const DEMOS: DemoPreset[] = definitions.map(([id, name, description, useCase, subdomain, theme]) => ({
  id, name, description, useCase, subdomain, theme,
  modules: [...PRESETS[id].modules],
  ...(PRESETS[id].modules.includes('catalog') ? { customerPath: '/' } : {}),
  ...(PRESETS[id].modules.some(module => ['ordering', 'cashier', 'kitchen', 'dashboard', 'tables', 'marketing'].includes(module)) ? { staffPath: '/staff' } : {}),
}));

/** Canonical hosts select one preset; /p/<id> also supports local/Pages previews. */
export function resolveDemo(hostname: string, pathname: string): DemoPreset | undefined {
  const fromHost = DEMOS.find(demo => hostname === `${demo.subdomain}.${DEMO_DOMAIN}`);
  if (fromHost) return fromHost;
  const pathId = pathname.match(/^\/p\/([^/]+)/)?.[1];
  if (pathId) return DEMOS.find(demo => demo.id === pathId);
  const outlet = pathname.match(/^\/(?:t|staff)\/[^/]+\/([^/]+)/)?.[1];
  return DEMOS.find(demo => demo.subdomain === outlet);
}

export function demoBasePath(demo: DemoPreset): string {
  return location.hostname === `${demo.subdomain}.${DEMO_DOMAIN}` ? '' : `/p/${demo.id}`;
}

export function portalDemos(): DemoPreset[] {
  if (location.hostname === `cafe.${DEMO_DOMAIN}`) return DEMOS;
  return DEMOS.map(demo => ({ ...demo,
    ...(demo.customerPath ? { customerUrl: `/p/${demo.id}/` } : {}),
    ...(demo.staffPath ? { staffUrl: `/p/${demo.id}/staff` } : {}),
  }));
}
