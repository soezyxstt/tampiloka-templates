import { PRESETS, type ThemeId } from '../src/config/catalog.mjs';
import type { DemoPreset } from './components/demo-portal';

export const DEMO_DOMAIN = 'tampiloka.site';
export const DEMO_HUB = `https://cafe.${DEMO_DOMAIN}`;

const definitions: Array<[string, string, string, string, string, ThemeId]> = [
  ['catalog', 'Menu dan permintaan pelayan', 'Pelanggan memilih menu dan menyampaikan daftar pesanan kepada pelayan. Pembayaran dilakukan langsung di kafe.', 'Untuk layanan meja tanpa kasir digital atau pembayaran online.', 'cafe-catalog', 'editorial'],
  ['order-at-cashier', 'Pesan, bayar di kasir', 'Pelanggan mengirim pesanan dari meja, lalu membayar melalui kasir.', 'Untuk pemesanan mandiri dengan pembayaran di tempat.', 'cafe-order', 'rounded'],
  ['order-and-pay', 'Pesan dan bayar', 'Pelanggan memilih menu, mengirim pesanan, dan mencoba simulasi pembayaran online.', 'Untuk mencoba alur pesan dan bayar dari meja.', 'cafe-pay', 'airy'],
  ['cashier', 'Kasir', 'Staf mencatat pesanan, menerapkan diskon, menerima uang tunai, dan mengelola giliran kerja.', 'Untuk melayani pesanan langsung di kasir.', 'cafe-pos', 'boxy'],
  ['cashier-kitchen', 'Kasir dan dapur', 'Pesanan yang dicatat kasir masuk ke antrean persiapan dapur dan bar.', 'Untuk tim kasir dan dapur yang bekerja bersama.', 'cafe-kitchen', 'playful'],
  ['operations', 'Operasional kafe', 'Kelola pesanan di kasir, pantau persiapan, dan lihat laporan dalam satu ruang staf.', 'Untuk memantau pekerjaan dan penjualan harian.', 'cafe-operations', 'boxy'],
  ['menu-cashier', 'Menu dan kasir', 'Pelanggan melihat menu, sementara staf mencatat dan mengelola pesanan.', 'Untuk menu digital dengan pemesanan melalui staf.', 'cafe-menu-pos', 'rounded'],
  ['menu-order-cashier', 'Menu, pesanan, dan kasir', 'Pelanggan memesan dari meja; kasir mengelola tagihan dan pembayaran.', 'Untuk layanan meja dengan kasir yang mengelola tagihan.', 'cafe-menu-order-pos', 'editorial'],
  ['full', 'Layanan lengkap', 'Coba alur pelanggan, kasir, dapur, layanan meja, dan laporan dalam satu demo.', 'Untuk melihat bagaimana seluruh bagian layanan bekerja bersama.', 'cafe-full', 'rounded'],
];

export const DEMOS: DemoPreset[] = definitions.map(([id, name, description, useCase, subdomain, theme]) => ({
  id, name, description, useCase, subdomain, theme,
  modules: [...PRESETS[id].modules],
  ...(PRESETS[id].modules.includes('catalog') ? { customerPath: '/' } : {}),
  ...(PRESETS[id].modules.some(module => ['ordering', 'cashier', 'kitchen', 'dashboard', 'tables', 'marketing'].includes(module)) ? { staffPath: '/staff' } : {}),
}));

const english: Record<string, [string, string, string]> = {
  catalog: ['Menu and waiter requests', 'Customers choose items and share their order with a waiter. Payment is made at the cafe.', 'For table service without a digital cashier or online payment.'],
  'order-at-cashier': ['Order, pay at the counter', 'Customers order from their table, then pay at the counter.', 'For self-service ordering with payment on site.'],
  'order-and-pay': ['Order and pay', 'Customers choose items, place an order and try a simulated online payment.', 'Try ordering and paying from a table.'],
  cashier: ['Cashier', 'Staff record orders, apply discounts, accept cash and manage shifts.', 'For serving orders directly at the counter.'],
  'cashier-kitchen': ['Cashier and kitchen', 'Orders entered at the counter reach the kitchen and bar preparation queue.', 'For cashier and kitchen teams working together.'],
  operations: ['Cafe operations', 'Manage counter orders, monitor preparation and view reports in one staff workspace.', 'For monitoring daily work and sales.'],
  'menu-cashier': ['Menu and cashier', 'Customers browse the menu while staff record and manage orders.', 'For a digital menu with staff-assisted ordering.'],
  'menu-order-cashier': ['Menu, orders and cashier', 'Customers order from their table; cashiers manage bills and payments.', 'For table service with cashier-managed billing.'],
  full: ['Full service', 'Try the customer, cashier, kitchen, table service and reporting flows in one demo.', 'See how all parts of service work together.'],
};

export function localizeDemo(demo: DemoPreset, language: 'id' | 'en'): DemoPreset {
  const translation = language === 'en' && english[demo.id];
  return translation ? { ...demo, name: translation[0], description: translation[1], useCase: translation[2] } : demo;
}

/** Canonical hosts select one preset; /p/<id> also supports local/Pages previews. */
export function resolveDemo(hostname: string, pathname: string): DemoPreset | undefined {
  // Explicit mode paths take priority so the switcher can stay on the same origin.
  const pathId = pathname.match(/^\/p\/([^/]+)/)?.[1];
  if (pathId) return DEMOS.find(demo => demo.id === pathId);
  const outlet = pathname.match(/^\/(?:t|staff)\/[^/]+\/([^/]+)/)?.[1];
  if (outlet) return DEMOS.find(demo => demo.subdomain === outlet);
  return DEMOS.find(demo => hostname === `${demo.subdomain}.${DEMO_DOMAIN}`);
}

export function demoNavigationPath(demo: DemoPreset, view: 'pelanggan' | 'staf', hostname: string): string {
  const base = hostname === `${demo.subdomain}.${DEMO_DOMAIN}` ? '' : `/p/${demo.id}`;
  return `${base}${view === 'staf' ? '/staff' : '/'}`;
}

/** Keep table/bill links intact within a mode; their context never crosses modes. */
export function demoNavigationUrl(demo: DemoPreset, view: 'pelanggan' | 'staf', options: {
  currentUrl: string;
  currentDemoId: string;
  theme: string;
  language: 'id' | 'en';
  customerRoute?: string | null;
}): string {
  let url = new URL(options.currentUrl);
  const sameMode = demo.id === options.currentDemoId;
  const wasStaff = /\/staff(?:\/|$)/.test(url.pathname);
  if (!sameMode) {
    url.pathname = demoNavigationPath(demo, view, url.hostname);
    for (const key of ['bill', 'table', 'principal']) url.searchParams.delete(key);
    url.hash = '';
  } else if (view === 'staf') {
    if (!wasStaff) url.pathname = demoNavigationPath(demo, view, url.hostname);
  } else if (wasStaff) {
    let restored = false;
    if (options.customerRoute) {
      try {
        const previous = new URL(options.customerRoute, url);
        const defaultCustomerRoute = previous.pathname === '/' || /^\/m\/[^/]+\/?$/.test(previous.pathname);
        const previousMode = resolveDemo(previous.hostname, previous.pathname)?.id || (defaultCustomerRoute ? 'full' : undefined);
        if (previous.origin === url.origin && previousMode === demo.id && !/\/staff(?:\/|$)/.test(previous.pathname)) {
          for (const key of new Set(url.searchParams.keys())) previous.searchParams.delete(key);
          for (const [key, value] of url.searchParams) previous.searchParams.append(key, value);
          if (url.hash) previous.hash = url.hash;
          url = previous;
          restored = true;
        }
      } catch { /* A stale stored route falls back to this mode's customer entry. */ }
    }
    if (!restored) url.pathname = demoNavigationPath(demo, view, url.hostname);
  }
  url.searchParams.set('theme', options.theme);
  url.searchParams.set('lang', options.language);
  return `${url.pathname}${url.search}${url.hash}`;
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

