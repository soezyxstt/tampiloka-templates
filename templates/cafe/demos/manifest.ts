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
