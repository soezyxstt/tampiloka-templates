# Alur kunjungan dan data uji

Panduan ini menjelaskan alur yang dijalankan aplikasi dan cara mengulang pengujiannya. Buka [demo full](https://cafe-full.tampiloka.site) untuk pelanggan dan [ruang staf](https://cafe-full.tampiloka.site/staff) di dua tab pada profil browser yang sama.

## Empat status yang berbeda

**Lunas**, **sudah disajikan**, **tamu sudah pulang**, dan **meja siap digunakan** tidak saling menggantikan. Pembayaran tidak menutup kunjungan atau membebaskan meja. Pengantaran pesanan tidak berarti pelanggan sudah meninggalkan kafe.

1. Staf membuka **Meja & Antrean → Tempatkan tamu**, mengisi nama dan jumlah tamu, lalu memilih meja bersih yang cukup besar. Kunjungan sudah ada sebelum pesanan pertama.
2. Pelanggan membuka QR meja, memilih menu, mengisi nama, memeriksa harga, lalu mengirim pesanan. Staf menerima atau menolak permintaan dengan alasan. Kasir juga dapat membuat pesanan untuk pelanggan yang tidak memakai ponsel.
3. Kebijakan **Bayar dahulu** menahan item sampai seluruh tagihan yang membiayainya lunas. **Bayar belakangan** langsung memasukkan pesanan ke antrean persiapan. Kebijakan makan di tempat dan bawa pulang dapat dipilih terpisah di **Pengaturan**.
4. Dapur/bar memperbarui item: antre → disiapkan → siap → diantar untuk makan di tempat, atau diambil untuk bawa pulang. Paket tanpa layar dapur menyediakan penyelesaian sederhana di daftar pesanan.
5. Pesanan tambahan tetap berada dalam kunjungan yang sama. Setiap pesanan membaca status pembayaran dari alokasi item pada tagihan yang benar, termasuk jika tagihan dipisah atau digabung.
6. Staf membuka **Tinjau kepulangan**. Sistem memeriksa semua tagihan, instruksi pembayaran aktif, refund, permintaan pesanan, item yang belum disajikan, dan panggilan bantuan. Konfirmasi kepulangan normal tersedia setelah semuanya selesai.
7. Kepulangan menjadikan meja **Perlu dibersihkan**. Staf menandainya bersih sebelum tamu berikutnya ditempatkan. Pesanan lama, kode gabung yang lama, dan harga yang disiapkan untuk kunjungan sebelumnya tidak boleh masuk ke kunjungan baru.

Bawa pulang memakai **Selesaikan pengambilan** dan tidak memerlukan langkah pembersihan meja. Pada paket tanpa modul `tables`, QR meja berfungsi sebagai identitas pesanan; aplikasi tidak menawarkan pengelolaan kebersihan meja yang tidak termasuk paket.

## Pembayaran dan keadaan bermasalah

- **Pembayaran sebagian:** kasir mencatat nominal yang dibayar dan uang yang diterima. Kembalian hanya dihitung dari nominal pembayaran tersebut. Rp0, nominal pecahan, kelebihan pembayaran terhadap sisa tagihan, dan uang tunai yang kurang ditolak.
- **QRIS/VA masih aktif:** pembayaran lain, pembatalan item yang mengubah nominal, dan kepulangan normal ditahan sampai instruksi selesai atau dibatalkan. Tombol simulasi tidak menerima uang nyata.
- **Percobaan ulang:** pengiriman pesanan, penerimaan pesanan, pembukaan kunjungan, dan pencatatan pembayaran memakai kunci percobaan ulang untuk mencegah transaksi ganda.
- **Pembatalan sebelum persiapan:** reservasi stok dilepas. Pembatalan setelah persiapan mencatat makanan terbuang; stok makanan matang tidak dikembalikan sebagai bahan tersedia.
- **Refund:** pengembalian dapat mengambil dari beberapa bukti pembayaran. Jika pengembalian ditunda, kewajiban tetap muncul dan menghalangi kepulangan normal. Mencoba mengembalikan dana dua kali tidak boleh menggandakan uang keluar.
- **Tamu pergi dengan kewajiban tersisa:** pemilik/manajer dapat mencatat kepulangan bermasalah dengan alasan. Tagihan dan pekerjaan yang tertinggal tetap muncul untuk tindak lanjut; tindakan ini tidak membuat tagihan lunas.
- **Kasir di luar sistem:** preset `order-at-cashier` menyediakan **Konfirmasi pembayaran kasir** dengan nomor referensi struk. Pencatatan ini menandai konfirmasi kasir eksternal dan tidak mengubah laci kas dalam aplikasi.
- **Antrean:** meja yang ditahan untuk tamu yang dipanggil tidak dapat dipakai tamu lain. Tiket pribadi pelanggan menampilkan status antreannya sendiri sampai ditempatkan dan kunjungan selesai.

## Memuat mock data

Di ruang staf demo, buka **Data untuk mencoba alur operasional**, pilih **Skenario uji**, lalu klik **Muat skenario**. Aplikasi meminta konfirmasi karena skenario mengganti data demo pada browser tersebut. Menu dan stok awal dikembalikan, pesanan lama dihapus, dan setiap keadaan dibangun melalui layanan pesanan/pembayaran yang juga dipakai aplikasi. Pilihan hanya muncul jika modulnya tersedia.

| ID | Kondisi awal | Hasil yang perlu diperiksa |
| --- | --- | --- |
| `empty` | Kafe kosong | Mulai kunjungan dan pesanan dari awal |
| `walk-in` | Tamu M06 sudah duduk, belum memesan | Kunjungan aktif tanpa tagihan |
| `pending-request` | Permintaan pesanan belum diputuskan | Kepulangan ditahan; staf dapat menerima/menolak |
| `rejected-request` | Permintaan ditolak | Alasan terlihat; tidak ada tagihan atau reservasi stok |
| `prepay-unpaid` | Dua teh, Rp41.580 belum dibayar | Dapur menunggu pelunasan |
| `partial-payment` | Rp10.000 dari Rp41.580 sudah dibayar | Sisa Rp31.580; item masih tertahan |
| `payment-pending` | Instruksi QRIS demo aktif | Tidak ada bukti pembayaran sebelum simulasi berhasil |
| `kitchen-pending` | Lunas, dua item sedang disiapkan | Tamu belum boleh diselesaikan normal |
| `paylater-served` | Dua teh sudah diantar, belum dibayar | Tagihan Rp41.580 masih harus dilunasi |
| `ready-to-depart` | Lunas dan semua item diantar | Kepulangan diperbolehkan |
| `addon-unpaid` | Pesanan pertama selesai, satu teh tambahan belum dibayar | Sisa Rp20.790 pada tagihan tambahan |
| `dirty-table` | Tamu sudah pulang | Meja tidak dapat ditempati sampai dibersihkan |
| `takeaway-ready` | Bawa pulang sudah dibayar | Tandai diambil sebelum menyelesaikan kunjungan |
| `waitlist` | Satu tamu dipanggil, satu menunggu | Kepemilikan dan masa berlaku penahanan meja diperiksa |

Semua nama, menu, pembayaran, dan struk merupakan data contoh. Dua teh pada tabel di atas memakai harga dasar Rp36.000, biaya layanan 5%, dan pajak 10% atas harga beserta layanan: total Rp41.580.

## Mengulang pengujian

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run test:demo-runtime
npm run build
npm run demos:build
npx playwright install chromium
npm run test:demo-all
```

`test:demo-all` membuka server lokal sementara, menguji seluruh preset, menjalankan alur pelanggan/staf, lalu menghentikan server. Hasil dan tangkapan layar ditulis ke `test-results/` yang tidak masuk Git. CI menjalankan pemeriksaan yang sama dan menyimpan hasil browser sebagai artifact **cafe-browser-verification**.

Untuk memeriksa versi yang sudah dideploy:

```sh
CAFE_DEMO_BASE_DOMAIN=tampiloka.site npm run test:demo-browser
CAFE_DEMO_BASE_DOMAIN=tampiloka.site npm run test:demo-lifecycle
```

Pengujian browser menolak menulis sebelum memastikan `runtime.demo` dan `runtime.localOnly`. Semua transaksi uji berjalan dalam profil browser terpisah; tidak ada permintaan transaksi jaringan atau pembayaran sungguhan.

### Sumber skenario dan pemeriksaan

| Lokasi | Cakupan |
| --- | --- |
| `src/db/lifecycle-fixtures.ts` | Aktor, menu, meja, dan database terisolasi untuk uji layanan |
| `src/db/service.lifecycle.test.ts` | Transaksi, stok, status kunjungan, pembayaran/refund, antrean, konflik dan percobaan ulang |
| `src/domain/order-billing.test.ts` | Hubungan pesanan dengan tagihan terpisah/gabungan |
| `src/demo-runtime/scenario-catalog.ts` | Daftar mock data dan modul yang dibutuhkan |
| `src/demo-runtime/scenarios.ts` | Pembentukan mock data melalui perintah layanan |
| `tests/browser-runtime-scenarios.test.mjs` | Jumlah uang dan keadaan masing-masing mock data |
| `tests/demos-lifecycle-fixtures.mjs` | Aktor dan tujuan setiap alur browser |
| `tests/demos-lifecycle.mjs` | Formulir/tombol pelanggan 390 px dan staf 1024 px, disertai pemeriksaan data hasilnya |
| `tests/demos-browser.mjs` | Kesembilan preset, pembatasan modul, gambar, responsivitas, dan alur pemesanan |
| `tests/preset-integration.mjs` | Proyek CLI terpisah dan route/API server tiap paket |

## Batas hasil pengujian

Pengujian ini memverifikasi logika backend dan antarmuka untuk runtime demo yang tersedia. Cloudflare Pages menyimpan transaksi secara lokal dalam browser dan berbagi data antartab pada alamat preset yang sama. Profil browser atau perangkat lain memiliki data sendiri.

Pemasangan transaksi nyata masih memerlukan integrasi autentikasi/sesi yang tervalidasi, database server bersama yang dikelola, dan penyedia pembayaran dengan verifikasi server. Jalur transaksi produksi tetap diblokir sampai integrasi tersebut tersedia. Lihat [cakupan runtime](runtime.md) dan [catatan verifikasi](verification.md) untuk batas yang tepat; hasil lulus pada demo tidak menyatakan pembayaran nyata atau perangkat kasir telah diuji.
