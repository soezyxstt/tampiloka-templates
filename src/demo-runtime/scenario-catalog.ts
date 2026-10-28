/** Reproducible starting points for demonstrations and lifecycle regression tests. */
export const DEMO_SCENARIOS = [
  { id: 'empty', label: 'Mulai dari kafe kosong', description: 'Menu, stok awal, dan meja tersedia. Belum ada pesanan atau pembayaran.', requires: [], expected: 'Tempatkan tamu, lalu jalankan alur dari awal.' },
  { id: 'walk-in', label: 'Tamu baru duduk', description: 'Rani dan Dimas sudah menempati M06, belum memesan.', requires: ['tables', 'ordering', 'cashier'], expected: 'Kunjungan aktif, meja terisi, belum ada tagihan.' },
  { id: 'pending-request', label: 'Pesanan menunggu persetujuan', description: 'Pesanan teh masuk dari pelanggan M06.', requires: ['tables', 'ordering', 'cashier'], expected: 'Terima atau tolak permintaan. Kunjungan belum boleh ditutup.' },
  { id: 'rejected-request', label: 'Pesanan ditolak staf', description: 'Permintaan pelanggan ditolak dengan alasan yang tercatat.', requires: ['tables', 'ordering', 'cashier'], expected: 'Tidak terbentuk tagihan atau reservasi stok; pelanggan dapat memesan ulang.' },
  { id: 'prepay-unpaid', label: 'Bayar dahulu · belum dibayar', description: 'Dua teh diterima. Pembayaran ditunggu sebelum masuk dapur.', requires: ['tables', 'ordering', 'cashier', 'payments', 'kitchen'], expected: 'Tagihan Rp41.580, unit tertahan, kunjungan belum dapat ditutup.' },
  { id: 'partial-payment', label: 'Pembayaran sebagian', description: 'Rp10.000 sudah diterima untuk tagihan Rp41.580.', requires: ['tables', 'ordering', 'cashier', 'payments', 'kitchen'], expected: 'Sisa Rp31.580. Dapur tetap menunggu pelunasan.' },
  { id: 'payment-pending', label: 'QRIS masih menunggu', description: 'Instruksi QRIS demo aktif; belum ada uang yang diterima.', requires: ['tables', 'ordering', 'cashier', 'payments', 'kitchen'], expected: 'Pembayaran kedua dan penutupan kunjungan ditolak sampai instruksi selesai atau dibatalkan.' },
  { id: 'kitchen-pending', label: 'Lunas · masih disiapkan', description: 'Tagihan sudah lunas, tetapi dua teh masih disiapkan.', requires: ['tables', 'ordering', 'cashier', 'payments', 'kitchen'], expected: 'Meja tetap terisi; tandai siap lalu antar sebelum menyelesaikan kunjungan.' },
  { id: 'paylater-served', label: 'Bayar belakangan · sudah diantar', description: 'Dua teh sudah diantar. Pelanggan belum membayar.', requires: ['tables', 'ordering', 'cashier', 'kitchen'], expected: 'Pesanan selesai disajikan, tagihan Rp41.580 masih terbuka.' },
  { id: 'ready-to-depart', label: 'Lunas dan sudah diantar', description: 'Seluruh tagihan dan penyajian M06 sudah selesai.', requires: ['tables', 'ordering', 'cashier', 'kitchen'], expected: 'Kunjungan boleh diselesaikan. Meja kemudian menunggu dibersihkan.' },
  { id: 'addon-unpaid', label: 'Pesanan tambahan belum lunas', description: 'Pesanan pertama lunas dan diantar. Satu teh tambahan belum dibayar.', requires: ['tables', 'ordering', 'cashier', 'payments', 'kitchen'], expected: 'Satu kunjungan, dua pesanan, dua status pembayaran; sisa Rp20.790.' },
  { id: 'dirty-table', label: 'Tamu pulang · meja belum bersih', description: 'Kunjungan selesai dan meja M06 perlu dibersihkan.', requires: ['tables', 'ordering', 'cashier', 'kitchen'], expected: 'Pesanan baru di meja ini ditolak sampai staf menandainya bersih.' },
  { id: 'takeaway-ready', label: 'Bawa pulang siap diambil', description: 'Pesanan dibayar dan siap diambil oleh pelanggan.', requires: ['cashier'], expected: 'Tandai diambil sebelum menyelesaikan kunjungan bawa pulang.' },
  { id: 'waitlist', label: 'Antrean dan meja ditahan', description: 'Rani dipanggil ke M06; Dimas masih menunggu.', requires: ['tables', 'cashier'], expected: 'Meja yang ditahan tidak boleh dipakai tamu lain. Tempatkan Rani atau lepaskan tahanannya.' },
] as const;

export type DemoScenarioId = typeof DEMO_SCENARIOS[number]['id'];

export function availableDemoScenarios(modules: readonly string[]) {
  return DEMO_SCENARIOS.filter(scenario => scenario.requires.every(module => modules.includes(module)));
}
