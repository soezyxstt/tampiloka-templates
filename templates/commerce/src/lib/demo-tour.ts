import type { DemoTourContent, DemoTourText } from '@tampiloka/ui-core/demo';
import type { Bootstrap, StaffRole } from '../shared/contracts';

const staffRoles: Record<StaffRole, DemoTourText> = {
  owner: ['Pemilik', 'Owner'],
  operations: ['Operasional', 'Operations'],
  viewer: ['Pembaca', 'Viewer'],
};

export function commerceTour(data: Bootstrap, staff: boolean, language: 'id' | 'en'): DemoTourContent {
  const { capabilities, config, session } = data;
  const role = staff && session.role !== 'customer' ? session.role : null;
  const steps: DemoTourContent['steps'] = !staff
    ? [[['Cari produk', 'Find a product'], ['Buka produk untuk melihat foto, harga, dan pilihan yang tersedia.', 'Open a product to see its photos, price, and available options.']]]
    : role === 'owner'
      ? [[['Kelola etalase', 'Manage the storefront'], ['Buka Produk untuk melihat katalog dan Pengaturan untuk meninjau informasi toko.', 'Open Products to review the catalog and Settings to review the store information.']]]
      : role === 'operations'
        ? [[['Cek katalog', 'Check the catalog'], ['Buka Produk untuk melihat barang dan varian yang dijual.', 'Open Products to see the items and variants for sale.']]]
        : [[['Pantau toko', 'Monitor the store'], ['Buka Ringkasan untuk melihat kondisi toko dan Produk untuk menelusuri katalog.', 'Open Overview to see how the store is doing and Products to browse the catalog.']]];

  if (staff && capabilities.orders) steps.push(
    role === 'viewer'
      ? [['Pantau pesanan', 'Monitor orders'], ['Buka Pesanan untuk melihat status dan rincian pesanan contoh.', 'Open Orders to see sample order details and statuses.']]
      : [['Tangani pesanan', 'Manage orders'], ['Buka Pesanan untuk meninjau pembayaran dan memperbarui status pesanan contoh.', 'Open Orders to review payments and update sample order statuses.']],
  );
  if (!staff && capabilities.cart) steps.push(
    capabilities.whatsapp
      ? [['Siapkan pesanan WhatsApp', 'Prepare a WhatsApp order'], ['Tambahkan produk ke keranjang, lalu tinjau dan salin ringkasan pesanan contoh.', 'Add a product to your cart, then review and copy the sample order summary.']]
      : [['Coba checkout', 'Try checkout'], ['Tambahkan produk ke keranjang, lalu coba isi pengiriman dan pilih pembayaran.', 'Add a product to your cart, then try entering delivery details and choosing a payment method.']],
  );
  return {
    id: `${staff ? role ?? 'staff' : 'customer'}:${config.level}`,
    language,
    role: staff ? (role ? staffRoles[role] : ['Staf', 'Staff']) : ['Pembeli', 'Shopper'],
    steps,
  };
}
