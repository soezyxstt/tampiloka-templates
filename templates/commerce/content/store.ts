import type { Category, CommerceLevel, Product, ShippingMethod, StoreConfig, Coupon } from '../src/shared/contracts.ts';

// Rupa is a fictional demonstration brand. Licensed sample photos are served locally.
// Replace these images and sample product descriptions with licensed client assets.
const photo = (id: string) => `/images/${id}.webp`;
export const defaultConfig: StoreConfig = {
  brand: { name: 'Rupa', tagline: 'Pilihan baik untuk setiap hari.', description: 'Pakaian, kulit, dan benda rumah dengan bentuk yang tenang. Rupa adalah toko contoh untuk demo Tampiloka.', whatsapp: '', email: 'demo@tampiloka.site', address: 'Bandung, Jawa Barat' },
  level: 'advanced', preset: 'editorial', currency: 'IDR',
  bank: { name: 'Bank demo', accountNumber: '0000000000', accountHolder: 'RUPA DEMO' },
  shippingNote: 'Tarif contoh per pesanan. Toko mengisi nomor resi setelah mengirim barang.', returnDays: 7,
};
export const categories: Category[] = [
  { id: 'pakaian', name: 'Pakaian', description: 'Bahan nyaman, potongan yang mudah dipakai.' },
  { id: 'tas', name: 'Tas', description: 'Untuk barang yang selalu ikut.' },
  { id: 'kulit', name: 'Kulit', description: 'Detail sederhana untuk pemakaian lama.' },
  { id: 'rumah', name: 'Rumah', description: 'Benda kecil untuk ruang sehari-hari.' },
];
export const shippingMethods: ShippingMethod[] = [
  { id: 'regular', name: 'Reguler', description: 'Tarif tetap contoh, toko mengatur kurir.', fee: 18000, estimatedDays: '2–4 hari', requiresAddress: true },
  { id: 'express', name: 'Ekspres', description: 'Layanan prioritas dengan tarif tetap contoh.', fee: 35000, estimatedDays: '1–2 hari', requiresAddress: true },
  { id: 'pickup', name: 'Ambil di toko', description: 'Tunggu konfirmasi pesanan siap diambil.', fee: 0, estimatedDays: 'Setelah dikonfirmasi', requiresAddress: false },
];
const specs = [
  { id: 'linen-shirt', name: 'Kemeja Katun Senja', category: 'pakaian', price: 329000, compareAtPrice: 379000, description: 'Kemeja lengan panjang bermotif kecil dengan potongan santai. Ringan dipakai untuk kegiatan sehari-hari.', material: 'Katun', images: [photo('photo-1596755094514-f87e34085b2c')], variants: ['S', 'M', 'L', 'XL'], featured: true },
  { id: 'everyday-tee', name: 'Kaos Harian', category: 'pakaian', price: 149000, description: 'Kaos katun dengan leher bulat dan jahitan yang rapi. Mudah dipadukan dengan apa saja.', material: 'Katun combed 24s', images: [photo('photo-1521572163474-6864f9cf17ab')], variants: ['S', 'M', 'L', 'XL'], featured: true },
  { id: 'canvas-tote', name: 'Pouch Kanvas Buku', category: 'tas', price: 189000, description: 'Pouch kanvas untuk menyimpan buku dan barang kecil. Penutup kancing menjaga isinya tetap rapi.', material: 'Kanvas katun 12 oz', images: [photo('canvas-tote')], variants: ['Natural', 'Hitam'], featured: true },
  { id: 'leather-sling', name: 'Tas Kulit Lintar', category: 'tas', price: 689000, description: 'Tas selempang kulit dengan tali yang bisa diatur. Ruang terpisah menjaga barang tetap rapi.', material: 'Kulit sapi, lapis katun', images: [photo('leather-sling')], variants: ['Cokelat', 'Hitam'], featured: true },
  { id: 'leather-wallet', name: 'Dompet Kulit Lipat', category: 'kulit', price: 289000, description: 'Dompet tipis dengan enam ruang kartu dan tempat uang. Bentuk ringkas untuk saku harian.', material: 'Kulit sapi', images: [photo('photo-1627123424574-724758594e93')], variants: ['Cokelat', 'Hitam'], featured: false },
  { id: 'wide-trousers', name: 'Celana Katun Ruang', category: 'pakaian', price: 349000, description: 'Celana katun berpotongan ramping untuk kegiatan sehari-hari. Mudah dipadukan dengan kaos atau kemeja.', material: 'Katun twill', images: [photo('photo-1473966968600-fa801b869a1a')], variants: ['S', 'M', 'L', 'XL'], featured: false },
  { id: 'ceramic-cup', name: 'Cangkir Pagi', category: 'rumah', price: 129000, description: 'Cangkir keramik 250 ml untuk kopi atau teh. Perbedaan kecil pada glasir memberi tiap cangkir ciri sendiri.', material: 'Keramik berlapis glasir', images: [photo('photo-1514228742587-6b1558fcca3d')], variants: ['Pasir', 'Arang'], featured: true },
  { id: 'woven-throw', name: 'Selimut Rajut Rasa', category: 'rumah', price: 459000, description: 'Selimut rajut tebal berukuran 130 × 170 cm. Nyaman dipakai saat membaca atau beristirahat.', material: 'Benang rajut', images: [photo('woven-throw')], variants: ['Natural', 'Abu'], featured: false },
] as const;
export const seedProducts: Product[] = specs.map((p, index) => ({
  id: p.id, slug: p.id, name: p.name, description: p.description, category: p.category,
  price: p.price, ...('compareAtPrice' in p ? { compareAtPrice: p.compareAtPrice } : {}),
  images: [...p.images], material: p.material, featured: p.featured, active: true,
  variants: p.variants.map((name, j) => ({ id: `${p.id}-${name.toLowerCase()}`, productId: p.id, name, sku: `RPA-${String(index + 1).padStart(3, '0')}-${name.toUpperCase()}`, price: p.price, stock: j === 3 ? 4 : 18 + index * 2, options: { [p.category === 'pakaian' ? 'Ukuran' : 'Warna']: name } })),
  createdAt: '2026-10-01T00:00:00.000Z',
}));
export const seedCoupons: Coupon[] = [
  { code: 'RUPA10', kind: 'percentage', value: 10, minSpend: 200000, maxDiscount: 75000, active: true, useLimit: 100, usedCount: 0, expiresAt: null },
  { code: 'HEMAT25', kind: 'fixed', value: 25000, minSpend: 350000, maxDiscount: 25000, active: true, useLimit: 50, usedCount: 0, expiresAt: null },
];
export const levels: CommerceLevel[] = ['catalog', 'whatsapp', 'store', 'advanced'];
