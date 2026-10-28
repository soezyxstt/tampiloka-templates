# Uji UI aplikasi

219 screenshot Steel: Pelanggan 75, Kasir 44, Dapur & Pelayan 42, Pengelola 58. Data uji terpisah; pembayaran demo. Status mencatat hasil aktual, termasuk kendala.

Buka `index.html` setelah mengekstrak ZIP; galeri dapat dipakai offline. Gunakan filter peran, status, dan pencarian. `manifest.json` dan `use-cases.csv` memuat seluruh screenshot, langkah, hasil, dimensi, hash, dan sumber metadata. Screenshot adalah capture asli Steel, tanpa penyuntingan.

## Cakupan

| POV | Screenshot | Cakupan |
| --- | ---: | --- |
| Pelanggan | 75 | Menu desktop/mobile, kategori, pencarian, favorit, produk habis, varian/tambahan, catatan/jumlah, edit/hapus keranjang, identitas, promo, QR meja, lokasi/bawa pulang, layanan, antrean, ulasan, pesanan, pembayaran, status QR, struk digital, dan berbagi tagihan. |
| Kasir | 44 | Login/PIN, dashboard/filter/pencarian, terima/tolak, pesanan baru, pisah/gabung, batal/restock, tunai/kembalian, pembayaran sebagian/gabungan, QR pending, tagihan lunas, dan logout. |
| Dapur, barista, pelayan | 42 | Filter/stasiun/status tiket, proses dapur, PREPAY tertahan, suara, denah/status meja, editor/draft/publish, bantuan staf, waitlist, kode gabung, pindah meja, dan kunjungan selesai. |
| Pemilik/pengelola | 58 | Akses pemilik/manajer, katalog, kategori/menu, stok/ketersediaan, foto, impor/ekspor CSV, laporan, shift/kas, pengaturan biaya, promo, denah, dan logout. |

## Temuan utama

- Pesanan baru kasir gagal karena command UI tidak didukung backend.
- Refund satu item setelah pembayaran dari dua receipt gagal mengalokasikan pengembalian.
- Pengiriman ulasan pada kunjungan aktif gagal dan menampilkan SQL error mentah.
- Penyimpanan pengaturan biaya outlet gagal karena action UI tidak cocok dengan backend.
- Inspektor meja belum langsung memperbarui status setelah meja ditandai bersih.
- Promo kosong dan kode promo duplikat diterima pada UI pengelola.
- Cetak struk kasir belum tersedia; cetak QR meja masih placeholder.

Temuan rinci dan screenshot terkait tersimpan dalam metadata masing-masing sesi dan galeri. `verified` berarti skenario dijalankan sesuai hasil yang dijelaskan; jangan menafsirkan seluruh koleksi sebagai semua fitur bebas masalah. `partial`, `blocked`, dan `not_available` menandai keterbatasan. Percobaan otomatis yang diulang dicatat terpisah agar tidak dianggap bug aplikasi.

## Lingkungan dan batas verifikasi

Aplikasi diuji pada instance lokal port3100 dengan database PGlite baru di luar folder publik. Browser yang merender halaman adalah Steel Chromium. Respons HTTP aplikasi asli diteruskan ke origin sesi browser; aplikasi tidak dipublikasikan. Tidak ada pembayaran riil. Beberapa fixture kasir dibuat lewat API untuk menjangkau alur lain ketika form pesanan baru gagal; hal tersebut ditandai pada metadata.

Event unduhan dapat berhasil sementara berkas yang ditransfer dari Steel kosong. Ini dicatat sebagai keterbatasan verifikasi transfer. Screenshot QR tetap merekam UI nyata.
