export const commerceLevels = Object.freeze({
  catalog: { name: 'Katalog', description: 'Produk dan detail. Pembeli bertanya lewat kontak toko.', capabilities: ['catalog'] },
  whatsapp: { name: 'Keranjang + WhatsApp', description: 'Pembeli menyusun keranjang dan mengirim daftar lewat WhatsApp.', capabilities: ['catalog','cart','whatsapp','wishlist'] },
  store: { name: 'Toko', description: 'Checkout, transfer manual atau COD, stok, pesanan, dan pengiriman.', capabilities: ['catalog','cart','checkout','orders','inventory','wishlist','reports'] },
  advanced: { name: 'Toko lengkap', description: 'Tambah gateway, kupon, retur, dan ulasan pembeli.', capabilities: ['catalog','cart','checkout','orders','inventory','coupons','gateway','returns','reviews','wishlist','reports'] },
});
export const commercePresets = Object.freeze({
  editorial: { name: 'Editorial', description: 'Foto besar dan koleksi terbuka.', layout: 'editorial', palette: 'sand', card: 'open', button: 'solid' },
  market: { name: 'Market', description: 'Kategori tetap dan katalog padat.', layout: 'market', palette: 'ink', card: 'framed', button: 'solid' },
  atelier: { name: 'Atelier', description: 'Koleksi pilihan dengan ritme gambar beragam.', layout: 'atelier', palette: 'sand', card: 'open', button: 'outline' },
  compact: { name: 'Compact', description: 'Baris ringkas untuk belanja cepat.', layout: 'compact', palette: 'forest', card: 'soft', button: 'solid' },
});
export const cafePresets = Object.freeze({
  catalog: { name: 'Menu + permintaan ke pelayan', description: 'Katalog, daftar pesanan pengunjung, pembayaran offline.', url: 'https://cafe-catalog.tampiloka.site' },
  'order-at-cashier': { name: 'Pesan, bayar di kasir', description: 'Pesanan mandiri dan penerimaan oleh staf.', url: 'https://cafe-order.tampiloka.site' },
  'order-and-pay': { name: 'Pesan dan bayar', description: 'Menu, pesanan, dan simulasi pembayaran online.', url: 'https://cafe-pay.tampiloka.site' },
  cashier: { name: 'Kasir', description: 'Pesanan langsung, diskon, tunai, dan giliran kerja.', url: 'https://cafe-pos.tampiloka.site' },
  'cashier-kitchen': { name: 'Kasir + dapur', description: 'Kasir dan antrean persiapan dapur.', url: 'https://cafe-kitchen.tampiloka.site' },
  operations: { name: 'Operasional', description: 'Kasir, dapur, dan laporan.', url: 'https://cafe-operations.tampiloka.site' },
  'menu-cashier': { name: 'Menu + kasir', description: 'Pelanggan melihat menu, staf mencatat pesanan.', url: 'https://cafe-menu-pos.tampiloka.site' },
  'menu-order-cashier': { name: 'Menu + pesanan + kasir', description: 'Pesan dari meja dengan kendali tagihan di kasir.', url: 'https://cafe-menu-order-pos.tampiloka.site' },
  full: { name: 'Layanan lengkap', description: 'Pelanggan, kasir, dapur, meja, dan laporan.', url: 'https://cafe-full.tampiloka.site' },
});
export const templates = Object.freeze([
  { id: 'commerce', name: 'Commerce', description: 'Katalog brand hingga toko dengan stok, pesanan, pembayaran, dan staf.', status: 'available', directory: 'templates/commerce', presets: commercePresets, levels: commerceLevels, demoUrl: 'https://ecommerce.tampiloka.site', defaultPreset: 'editorial', defaultLevel: 'store' },
  { id: 'cafe', name: 'Cafe & resto', description: 'Menu, pesanan dari meja, kasir, dapur, dan operasional.', status: 'available', directory: 'templates/cafe', presets: cafePresets, demoUrl: 'https://cafe.tampiloka.site', defaultPreset: 'catalog' },
  { id: 'dashboard', name: 'Dashboard', description: 'Ruang kerja dan data perusahaan.', status: 'planned', directory: 'templates/dashboard', presets: {} },
  { id: 'school', name: 'School', description: 'Informasi dan operasional sekolah.', status: 'planned', directory: 'templates/school', presets: {} },
  { id: 'booking', name: 'Booking', description: 'Jadwal, layanan, dan pemesanan.', status: 'planned', directory: 'templates/booking', presets: {} },
]);
export function getTemplate(id, { availableOnly = false } = {}) {
  const template = templates.find(item => item.id === id || (id === 'ecommerce' && item.id === 'commerce'));
  if (!template) throw new Error(`Template "${id}" tidak ada. Pilih: ${templates.filter(item=>item.status==='available').map(item=>item.id).join(', ')}.`);
  if (availableOnly && template.status !== 'available') throw new Error(`Template ${id} masih direncanakan dan belum bisa dibuat.`);
  return template;
}
export function capabilitiesFor(level) {
  if (!Object.hasOwn(commerceLevels, level)) throw new Error(`Level commerce tidak dikenal: ${level}.`);
  return Object.fromEntries(['catalog','cart','whatsapp','checkout','orders','inventory','coupons','gateway','returns','reviews','wishlist','reports'].map(key=>[key,commerceLevels[level].capabilities.includes(key)]));
}
