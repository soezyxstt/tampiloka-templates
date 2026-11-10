import { schoolTemplate } from './school.mjs';
export * from './school.mjs';
export const commerceLevels = Object.freeze({
  catalog: { name: 'Katalog', description: 'Tampilkan produk dan detailnya; pembeli dapat menghubungi toko untuk bertanya.', capabilities: ['catalog'] },
  whatsapp: { name: 'Keranjang + WhatsApp', description: 'Pembeli menyusun keranjang, lalu membuka daftar belanja di WhatsApp.', capabilities: ['catalog','cart','whatsapp','wishlist'] },
  store: { name: 'Toko', description: 'Terima pesanan dengan transfer manual atau COD, lalu kelola stok dan pengiriman.', capabilities: ['catalog','cart','checkout','orders','inventory','wishlist','reports'] },
  advanced: { name: 'Toko lengkap', description: 'Tambahkan pilihan gateway, kupon, retur, dan ulasan pada alur toko.', capabilities: ['catalog','cart','checkout','orders','inventory','coupons','gateway','returns','reviews','wishlist','reports'] },
});
export const commerceFeatureIds = Object.freeze(['promotions','taxes','serviceFees','customerAccounts','loyaltyPoints','membershipTiers']);
export const commerceFeatureLabels = Object.freeze({
  promotions:'Kode promo dan voucher',taxes:'Perhitungan pajak',serviceFees:'Biaya layanan',
  customerAccounts:'Akun pelanggan terverifikasi',loyaltyPoints:'Poin belanja',membershipTiers:'Tingkat member'
});
const featureAliases={promotions:'promotions',taxes:'taxes','service-fees':'serviceFees','customer-accounts':'customerAccounts','loyalty-points':'loyaltyPoints','membership-tiers':'membershipTiers'};
export function commerceModulesFor(level,features) {
  if(!Object.hasOwn(commerceLevels,level))throw new Error(`Level commerce tidak dikenal: ${level}.`);
  const provided=features===undefined?(level==='advanced'?'promotions':'none'):features;
  if(typeof provided!=='string')throw new Error('Daftar fitur harus berupa teks dipisahkan koma.');
  const tokens=provided.trim()==='all'?['promotions','taxes','service-fees','customer-accounts','loyalty-points','membership-tiers']:provided.trim()==='none'||provided.trim()===''?[]:provided.split(',').map(s=>s.trim());
  const ids=tokens.map(name=>featureAliases[name]);
  if(ids.some(id=>!id))throw new Error('Modul tidak dikenal. Gunakan: promotions,taxes,service-fees,customer-accounts,loyalty-points,membership-tiers.');
  if(new Set(ids).size!==ids.length)throw new Error('Modul dipilih lebih dari satu kali.');
  if(ids.length && !['store','advanced'].includes(level))throw new Error('Modul tambahan membutuhkan level store atau advanced.');
  if(ids.includes('loyaltyPoints')&&!ids.includes('customerAccounts'))throw new Error('loyalty-points membutuhkan customer-accounts.');
  if(ids.includes('membershipTiers')&&!ids.includes('loyaltyPoints'))throw new Error('membership-tiers membutuhkan loyalty-points.');
  return Object.fromEntries(commerceFeatureIds.map(id=>[id,ids.includes(id)]));
}
export const commercePresets = Object.freeze({
  editorial: { name: 'Editorial', description: 'Foto produk besar dan susunan koleksi yang lapang.', layout: 'editorial', palette: 'sand', card: 'open', button: 'solid' },
  market: { name: 'Market', description: 'Kategori yang mudah dijelajahi dan katalog dalam tampilan grid.', layout: 'market', palette: 'ink', card: 'framed', button: 'solid' },
  atelier: { name: 'Atelier', description: 'Tampilan koleksi dengan penekanan pada foto produk.', layout: 'atelier', palette: 'sand', card: 'open', button: 'outline' },
  compact: { name: 'Compact', description: 'Daftar produk ringkas untuk membandingkan pilihan.', layout: 'compact', palette: 'forest', card: 'soft', button: 'solid' },
});
export const cafePresets = Object.freeze({
  catalog: { name: 'Menu + permintaan ke pelayan', description: 'Menu digital dan daftar pilihan pelanggan; pembayaran dilakukan di tempat.', url: 'https://cafe-catalog.tampiloka.site' },
  'order-at-cashier': { name: 'Pesan, bayar di kasir', description: 'Pelanggan memesan dari meja, lalu staf menerima pesanannya.', url: 'https://cafe-order.tampiloka.site' },
  'order-and-pay': { name: 'Pesan dan bayar', description: 'Pilih menu, kirim pesanan, dan coba simulasi pembayaran online.', url: 'https://cafe-pay.tampiloka.site' },
  cashier: { name: 'Kasir', description: 'Catat pesanan langsung, diskon, pembayaran tunai, dan giliran kerja.', url: 'https://cafe-pos.tampiloka.site' },
  'cashier-kitchen': { name: 'Kasir + dapur', description: 'Catat pesanan di kasir dan pantau antrean persiapan dapur.', url: 'https://cafe-kitchen.tampiloka.site' },
  operations: { name: 'Operasional', description: 'Kelola pesanan, persiapan dapur, dan laporan dari ruang staf.', url: 'https://cafe-operations.tampiloka.site' },
  'menu-cashier': { name: 'Menu + kasir', description: 'Pelanggan melihat menu digital; staf mencatat pesanan di kasir.', url: 'https://cafe-menu-pos.tampiloka.site' },
  'menu-order-cashier': { name: 'Menu + pesanan + kasir', description: 'Pelanggan memesan dari meja; kasir mengelola tagihan.', url: 'https://cafe-menu-order-pos.tampiloka.site' },
  full: { name: 'Layanan lengkap', description: 'Coba alur pelanggan, kasir, dapur, layanan meja, dan laporan.', url: 'https://cafe-full.tampiloka.site' },
});
export const bookingLevels = Object.freeze({
  "catalog": {
    "name": "Catalog",
    "description": "Informasi layanan dan CMS tanpa pemesanan.",
    "capabilities": [
      "catalog",
      "cms"
    ]
  },
  "whatsapp": {
    "name": "WhatsApp",
    "description": "Pilih layanan dan siapkan pesan permintaan janji.",
    "capabilities": [
      "catalog",
      "cms",
      "whatsapp"
    ]
  },
  "booking": {
    "name": "Booking",
    "description": "Ketersediaan, pemesanan, jadwal staf, dan pembayaran di lokasi.",
    "capabilities": [
      "catalog",
      "cms",
      "whatsapp",
      "booking"
    ]
  },
  "full": {
    "name": "Full",
    "description": "Pemesanan, pembayaran terverifikasi, tiket QR, dan laporan.",
    "capabilities": [
      "catalog",
      "cms",
      "whatsapp",
      "booking",
      "payments",
      "tickets",
      "reports"
    ]
  }
});
export const bookingPresets = Object.freeze({
  "medical": {
    "name": "Medical",
    "description": "Dokter, spesialisasi, lokasi, dan jadwal konsultasi.",
    "layout": "appointment-first",
    "palette": "sage",
    "url": "https://booking.tampiloka.site/?preset=medical&layout=appointment-first&palette=sage&view=customer"
  },
  "aesthetic": {
    "name": "Aesthetic",
    "description": "Perawatan, paket, terapis, dan ruang layanan.",
    "layout": "editorial",
    "palette": "rose",
    "url": "https://booking.tampiloka.site/?preset=aesthetic&layout=editorial&palette=rose&view=customer"
  },
  "detailing": {
    "name": "Auto detailing",
    "description": "Kendaraan, paket, durasi, dan area kerja.",
    "layout": "service-market",
    "palette": "slate",
    "url": "https://booking.tampiloka.site/?preset=detailing&layout=service-market&palette=slate&view=customer"
  },
  "consulting": {
    "name": "Consulting",
    "description": "Profesional, format pertemuan, dan waktu konsultasi.",
    "layout": "minimal-professional",
    "palette": "ochre",
    "url": "https://booking.tampiloka.site/?preset=consulting&layout=minimal-professional&palette=ochre&view=customer"
  }
});
export const bookingLayouts = Object.freeze(['appointment-first','editorial','service-market','minimal-professional']);
export const bookingPalettes = Object.freeze(['sage','rose','slate','ochre']);
export const templates = Object.freeze([
  { id: 'commerce', name: 'Commerce', description: 'Katalog brand hingga toko dengan stok, pesanan, pembayaran, dan staf.', status: 'available', directory: 'templates/commerce', presets: commercePresets, levels: commerceLevels, demoUrl: 'https://ecommerce.tampiloka.site', defaultPreset: 'editorial', defaultLevel: 'store' },
  { id: 'cafe', name: 'Cafe & resto', description: 'Menu, pesanan dari meja, kasir, dapur, dan operasional.', status: 'available', directory: 'templates/cafe', presets: cafePresets, demoUrl: 'https://cafe.tampiloka.site', defaultPreset: 'catalog' },
  { id: 'dashboard', name: 'Dashboard', description: 'Ruang kerja dan data perusahaan.', status: 'planned', directory: 'templates/dashboard', presets: {} },
  schoolTemplate,
  {"id":"booking","name":"Booking","description":"Layanan dan janji dengan jadwal, kapasitas, pembayaran, serta tiket.","status":"available","directory":"templates/booking","presets":bookingPresets,"levels":bookingLevels,"defaultPreset":"medical","defaultLevel":"booking","demoUrl":"https://booking.tampiloka.site"},
  {"id":"operations","name":"Operations","description":"Operasional persediaan, pengiriman dan kasir multilokasi.","status":"planned","directory":"templates/operations","presets":{"food":{"name":"Food","description":"Produk siap jual."},"retail":{"name":"Retail","description":"Barang ritel."},"supplies":{"name":"Supplies","description":"Perlengkapan usaha."}},"levels":{"inventory":{"name":"Inventory","description":"Persediaan multilokasi.","capabilities":["inventory"]},"retail":{"name":"Retail","description":"Persediaan dan kasir.","capabilities":["inventory","sales"]},"full":{"name":"Full","description":"Operasional lengkap.","capabilities":["inventory","sales","promotions","taxes","reports"]}},"defaultPreset":"food","defaultLevel":"full"},
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
