# Benchmark Millehub

Dokumentasi pengujian langsung pada [situs sumber](https://order.millehub.com/?d3abc96a14764874b67ef5aeb43b84f0) tanggal 23 Oktober 2026. Screenshot asli disimpan tanpa penyuntingan. Galeri `index.html` membaca `manifest.json`; hasil alur utama terdapat pada `root-results.json`. Hasil `menu-*` dan `aux-*` melengkapi penelusuran menu serta fitur tambahan dan dicatat dalam hasil agen masing-masing.

## Status akhir

QRIS pembayaran **berhasil diterbitkan** untuk pesanan **26102308550IA4PUYJ**, pelanggan **Benchmark QRIS**, total **Rp30.000**. Tombol **Check Status** menunjukkan **Pending Payment**. Tidak ada pembayaran dilakukan. Screenshot akhir: `20-qris-generated.png`, `21-qris-status-unpaid.png`, dan `22-qris-mobile.png`.

Tombol Download juga diuji: event unduhan terpicu, tetapi file yang diterima dari browser cloud kosong (0 byte), sehingga ekspor file belum berhasil. Screenshot QRIS tetap valid dan dapat digunakan.

Pada percobaan pertama, tombol Confirm ditahan peninjauan otomatis. Pengguna kemudian memberi persetujuan eksplisit untuk menerbitkan tagihan tanpa membayar. Karena sesi browser pertama sudah berakhir dan riwayat browser baru kosong, pesanan uji yang sama dibuat ulang. Kode percobaan pertama adalah **2610230838AGHNV56U**, yang berhenti sebelum QRIS terbit; screenshot 01–18 tetap menjadi bukti tahap awal. Screenshot 19–23 membuktikan kelanjutan yang berhasil. Tidak mengklaim kedua kode sebagai pesanan lunas.

## Cakupan alur utama

| Fitur | Hasil | Bukti |
| --- | --- | --- |
| Beranda | Skeleton dan konten selesai dimuat tercatat | 01–02 |
| Pelanggan baru | Form, validasi nama kosong, identitas diterapkan | 03–04, 06, 10 |
| Pelanggan loyal | Form pencarian saja; akun nyata/OTP belum diuji | 05 |
| Identitas meja | Klik tidak mengubah halaman; 09 indoor tetap tampil | 06 |
| Detail produk, catatan, jumlah | Dicoba; jumlah sempat 2, pesanan akhir 1 | 07–10 |
| Keranjang dan rincian biaya | Subtotal, Service, PB1, total | 10–12 |
| Diskon | Dibuka; tidak ada diskon tersedia | 13 |
| Kirim pesanan dan pembayaran daring | Pesanan dikirim, halaman metode pembayaran terbuka | 14–16 |
| QRIS | Dipilih dan modal konfirmasi dibuka | 17–18 |
| Kode QRIS aktual | **Berhasil diterbitkan**, status Pending Payment | 20–22 |
| Pembayaran berhasil / lunas | Tidak dijalankan sesuai instruksi | Tidak ada |
| Bayar di kasir | Tombol terlihat, alur tidak dijalankan | 10 |

## Indeks screenshot alur utama

| Berkas | Ukuran | Keadaan yang dibuktikan |
| --- | --- | --- |
| [01-home-desktop.png](01-home-desktop.png) | 1440 × 1000 | Skeleton awal sebelum konten selesai dimuat. |
| [02-home-loaded-desktop.png](02-home-loaded-desktop.png) | 1911 × 988 | Banner promosi, identitas meja, kategori, rekomendasi, dan navigasi bawah tampil. |
| [03-customer-dialog.png](03-customer-dialog.png) | 1911 × 988 | Tab New Customer dengan nama serta telepon dan email opsional. |
| [04-customer-validation.png](04-customer-validation.png) | 1911 × 988 | Apply Customer tanpa nama menampilkan error panjang input 1–100. |
| [05-loyal-customer.png](05-loyal-customer.png) | 1911 × 988 | Tab Loyal Customer menampilkan kolom pencarian telepon; akun nyata dan OTP tidak diuji. |
| [06-table-info.png](06-table-info.png) | 1911 × 988 | Klik identitas meja tidak membuka halaman baru; beranda tetap menampilkan 09 indoor. |
| [07-product-affogatto.png](07-product-affogatto.png) | 1440 × 1000 | Foto, kolom catatan, kontrol jumlah, dan tombol Add to Cart. |
| [08-product-note-quantity.png](08-product-note-quantity.png) | 1440 × 1000 | Catatan benchmark diisi dan jumlah dinaikkan menjadi 2 pada detail; pesanan akhirnya memakai 1 item. |
| [09-added-to-cart.png](09-added-to-cart.png) | 1440 × 1000 | Affogatto ditandai 1x dan tombol Checkout 1 Items tampil. |
| [10-cart-checkout.png](10-cart-checkout.png) | 1440 × 1000 | Satu Affogatto, nama Benchmark QRIS, meja 09 indoor; subtotal Rp25.974 dan total Rp30.000. |
| [11-surcharge-breakdown.png](11-surcharge-breakdown.png) | 1440 × 1000 | Rincian Surcharge dibuka: Service Rp1.299. |
| [12-tax-breakdown.png](12-tax-breakdown.png) | 1440 × 1000 | Rincian Tax dibuka: PB1 Rp2.727. |
| [13-discount-dialog.png](13-discount-dialog.png) | 1440 × 1000 | Halaman 0 Discounts menyatakan tidak ada diskon saat ini; penerapan diskon tidak dapat diuji. |
| [14-online-payment.png](14-online-payment.png) | 1440 × 1000 | Online Payment membuka dialog Submit Order dengan Cancel dan Submit. |
| [15-submitted-payment.png](15-submitted-payment.png) | 1440 × 1000 | Dialog Submitting Order dengan Continue to Payment; tangkapan masih menunjukkan indikator proses. |
| [16-payment-page-0.png](16-payment-page-0.png) | 1440 × 1000 | Total Rp30.000, voucher, QRIS (BANK), serta judul Bank Transfer tanpa pilihan terlihat. |
| [17-qris-selected.png](17-qris-selected.png) | 1440 × 1000 | QRIS (BANK) terpilih sebelum Checkout. |
| [18-qris-checkout-0.png](18-qris-checkout-0.png) | 1440 × 1000 | Dialog Confirm Payment untuk Rp30.000 dengan logo QRIS. Belum ada kode QR pembayaran; tombol Confirm belum dijalankan. |

## Batas interpretasi

- Nama berkas bukan jaminan bahwa proses selesai. `01` masih skeleton dan `15` masih menampilkan proses; halaman pembayaran pada `16` menjadi bukti tahap berikutnya.
- `18` membuktikan modal konfirmasi, bukan kode QR pembayaran atau pembayaran lunas.
- Dimensi berbeda antartangkapan; perbandingan visual perlu memperhatikan viewport yang tercatat.
- Cakupan yang tidak tersedia atau terblokir tidak dihitung sebagai fitur yang berhasil diselesaikan.
- Penelusuran menu dan fitur tambahan perlu dibaca bersama hasil agen terpisah; README ini mengindeks 18 tangkapan alur utama.

## Cakupan menu dan navigasi tambahan

55 screenshot tercatat di `manifest.json` dan galeri `index.html`. Metadata `menu-results.json` memuat pencarian, kategori, varian, catatan, jumlah, keranjang beberapa varian, edit, hapus item, dan keranjang kosong. `aux-results.json` memuat Orders kosong, QR berbagi sesi, dialog Call Waiter yang dibatalkan, menu Mille, pilihan bahasa, serta pergantian Bahasa Indonesia.

Add-on dan produk habis belum diuji. Validasi varian wajib tidak berlaku pada Americano yang otomatis memilih Askara. Call Waiter hanya diuji sampai konfirmasi dan dibatalkan; tidak memanggil staf. Pelanggan loyal tidak dilanjutkan dengan akun nyata. About Mille tidak menghasilkan tampilan baru, sedangkan Get Help belum tuntas. Semua keterbatasan dicatat, sehingga koleksi ini belum mengklaim mencakup setiap fitur sepenuhnya.

Ada dua pasangan screenshot identik yang dipertahankan sebagai bukti klik tanpa perubahan: `aux-01-home.png` / `aux-07-table-info.png`, dan `aux-11-language-indonesia.png` / `aux-13-about-mille-action.png`. Ukuran viewport tercatat per gambar; jangan memperlakukan seluruh koleksi sebagai satu ukuran pixel-diff.

## Kelanjutan setelah persetujuan pengguna

| Berkas | Hasil |
| --- | --- |
| [19-resumed-order-summary.png](19-resumed-order-summary.png) | Pesanan uji dibuat ulang karena sesi browser lama berakhir; satu Affogatto, total Rp30.000. |
| [20-qris-generated.png](20-qris-generated.png) | Kode pembayaran QRIS nyata untuk Bean and Butter, pesanan 26102308550IA4PUYJ, Rp30.000. |
| [21-qris-status-unpaid.png](21-qris-status-unpaid.png) | Check Status menampilkan Pending Payment. |
| [22-qris-mobile.png](22-qris-mobile.png) | Kode QRIS, nominal Rp30.000, instruksi pembayaran terpisah melalui e-wallet/mobile banking, dan Pending Payment terlihat pada viewport 390×844. |
| [23-qris-after-download.png](23-qris-after-download.png) | Tombol Download memicu event unduhan, tetapi file yang diterima kosong (0 byte). Halaman tetap menampilkan QRIS tanpa pembayaran. |
