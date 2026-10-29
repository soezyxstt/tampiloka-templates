# Tampiloka Commerce

Template toko untuk satu usaha, dari katalog sederhana sampai toko dengan operasional penjualan lengkap. Pembeli dan staf memakai API yang sama; harga, stok, pembayaran, dan hak akses diperiksa di server. Data tersimpan di Cloudflare D1.

Demo publik: [ecommerce.tampiloka.site](https://ecommerce.tampiloka.site). Rupa adalah brand contoh. Pembayaran demo tidak memindahkan uang dan setiap pengunjung memiliki ruang data tersendiri.

## Pilih tingkat fitur

| Level | Alur pembeli | Operasional toko |
| --- | --- | --- |
| `catalog` | Cari/filter produk, detail dan varian, tanya toko | Kelola produk, harga, foto, dan pengaturan |
| `whatsapp` | Semua fitur katalog, keranjang, wishlist, susun pesan WhatsApp | Kelola katalog; pesanan dan pembayaran disepakati lewat percakapan |
| `store` | Keranjang, wishlist, checkout, transfer manual/COD, riwayat dan pelacakan pesanan | Verifikasi pembayaran, stok, proses pesanan, pengiriman, pelanggan, laporan, CSV, riwayat stok, refund pembatalan |
| `advanced` | Semua fitur toko, gateway Midtrans, promo, ulasan, retur | Promo, tinjau retur, terima barang kembali, dan proses refund melalui gateway |

Pembatasan level diterapkan di server. Mengubah tampilan atau memanggil endpoint langsung tidak membuka fitur yang dinonaktifkan.

Peran staf pemilik, operasional, dan pembaca tersedia pada semua level; tiap peran hanya dapat memakai fitur yang aktif pada level tersebut.

Desain dapat dipilih terpisah dari level: empat susunan halaman (`editorial`, `market`, `atelier`, `compact`), tiga palet (`sand`, `ink`, `forest`), tiga kartu (`open`, `framed`, `soft`), serta tombol `solid`/`outline`. Pilihan tersimpan di `config/commerce.json`. Ruang staf menggunakan tata letak operasional yang konsisten.

## Jalankan dari monorepo

Gunakan Node.js 22.18+ dan pnpm 10.28.2.

```sh
corepack enable
pnpm install
pnpm dev:commerce
```

Buka `http://127.0.0.1:5174`. Perintah ini membuat database lokal, menerapkan migrasi, lalu menjalankan Vite dan Worker. Mode lokal selalu demo. Database lokal berada di `.data/` dan tidak masuk git.

Untuk mencoba build produksi dengan API lokal:

```sh
pnpm --filter @tampiloka/template-commerce build
pnpm --filter @tampiloka/template-commerce preview
```

Buka `http://127.0.0.1:4174`.

## Buat proyek klien mandiri

Dari checkout monorepo:

```sh
pnpm tampiloka create toko-rupa --template commerce --preset atelier --level store
cd toko-rupa
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev
```

CLI interaktif meminta template, preset, tingkat fitur, dan gaya komponen. Tambahkan `--yes` untuk memakai opsi yang diberikan tanpa pertanyaan. Proyek hasil generator menyertakan salinan paket bersama dengan dependensi `file:`; tidak memerlukan monorepo asal.

Ubah `config/commerce.json` untuk identitas usaha dan setelan awal. Data produk awal ada di `content/store.ts`. Setelah database toko terisi, perubahan produk/pengaturan dilakukan melalui ruang staf. Pengaturan yang tersimpan di database mengalahkan konfigurasi awal; mengedit JSON tidak menimpa identitas, produk, atau setelan toko yang sudah berjalan. Khusus level produksi, server selalu memakai `COMMERCE_LEVEL` atau nilai `level` dari konfigurasi deployment yang dibangun ulang.

## Coba alur pembeli dan staf

1. Pilih **Toko lengkap** di toolbar demo. Buka produk, pilih varian, lalu tambahkan ke keranjang.
2. Checkout dengan data contoh. Kode `RUPA10` memberi diskon 10% untuk subtotal minimal Rp200.000, maksimal potongan Rp75.000.
3. Untuk transfer, buka pesanan lalu pilih **Saya sudah transfer** dan isi referensi contoh. Untuk gateway demo, pilih **Bayar berhasil** atau **Bayar gagal** pada detail pesanan.
4. Buka **Staf → Pesanan**, periksa pembayaran, siapkan barang, lalu isi kurir/resi. Pesanan ambil di toko memakai alur siap diambil tanpa resi kurir.
5. Kembali sebagai pembeli untuk menandai pesanan diterima, menulis ulasan, atau mengajukan retur. Staf meninjau retur, mencatat barang kembali, dan menyelesaikan pencatatan refund.

Simpan nomor pesanan dan kode akses untuk melihat pesanan dari perangkat lain. Kode ini bersifat rahasia dan dapat diganti dari perangkat pemilik pesanan. Pelacakan lintas perangkat hanya membaca pesanan; tidak memberikan hak mengubah pesanan. Jangan gunakan data pribadi sungguhan di demo publik.

## Deploy toko klien ke Cloudflare

Jalankan dari folder proyek klien. Login memakai akun Cloudflare milik klien atau token deployment yang dikelola sendiri.

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create nama-toko
```

Masukkan UUID database yang dihasilkan ke `d1_databases[0].database_id` di `wrangler.jsonc`, lalu sesuaikan `database_name` dengan nama database tersebut. Pilih nama Worker dan domain milik klien. Pertahankan `DEMO_MODE: "false"` untuk toko sebenarnya. Konfigurasi demo Tampiloka tidak disalin oleh generator.

```sh
pnpm exec wrangler d1 migrations apply DB --remote
pnpm exec wrangler secret put STAFF_OWNER_PASSWORD
pnpm exec wrangler secret put STAFF_OPERATIONS_PASSWORD
pnpm exec wrangler secret put STAFF_VIEWER_PASSWORD
pnpm deploy
```

`pnpm deploy` menjalankan build sebelum mengunggah Worker dan aset.

Gunakan kata sandi unik setidaknya 12 karakter. Hanya buat peran yang diperlukan. Peran yang tidak memiliki secret tidak dapat masuk. Ruang staf ada di `/#/staff`. Jangan menaruh secret di `config/commerce.json`, kode browser, atau git.

Untuk Midtrans pada level `advanced`:

```sh
pnpm exec wrangler secret put MIDTRANS_SERVER_KEY
```

Set `MIDTRANS_ENVIRONMENT` ke `sandbox` atau `production` melalui vars Worker. Arahkan notifikasi pembayaran Midtrans ke `https://domain-toko/api/webhooks/midtrans`. Mulai dari akun sandbox merchant. Server memverifikasi signature dan memeriksa status langsung ke Midtrans sebelum menandai pesanan lunas. Tanpa server key, gateway produksi tidak ditawarkan saat checkout.

Atur rekening, nomor WhatsApp, kebijakan retur, serta layanan/tarif pengiriman milik klien. Tarif pengiriman saat ini tarif tetap per layanan, dapat diatur di ruang staf; tidak mengambil ongkir/resi dari API kurir. Staf memasukkan nomor resi. Pengembalian dana manual dicatat setelah dana benar-benar dikirim di luar aplikasi. Integrasi gateway mengikuti status dari provider.

Worker memiliki jadwal per jam untuk menutup reservasi kedaluwarsa dan membersihkan data demo. Database produksi tidak direset oleh jadwal ini. Tetap gunakan backup D1 dan prosedur operasional merchant sesuai kebutuhan usaha.

## Pengujian

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
# Terminal terpisah: pnpm preview
pnpm test:e2e
node tests/backend-live.mjs http://127.0.0.1:4174
```

`tests/backend.test.mjs` memakai SQLite nyata dengan schema dan trigger produksi, serta adapter D1. Uji browser dan `backend-live.mjs` memanggil Worker/D1 yang berjalan dan menolak target yang bukan demo. Untuk menguji demo publik:

```sh
COMMERCE_BASE_URL=https://ecommerce.tampiloka.site pnpm test:e2e
node tests/backend-live.mjs https://ecommerce.tampiloka.site
```

Bukti pengujian browser ditulis ke `test-results/`. Referensi endpoint, status, keamanan, dan batas integrasi ada di [docs/api.md](docs/api.md). Keputusan desain ada di [docs/design.md](docs/design.md), dan asal aset contoh di [docs/asset-sources.md](docs/asset-sources.md).

## Batas yang perlu dipahami

Ini template satu merchant dengan pengalaman belanja dan ruang staf. `advanced` bukan marketplace multi-penjual: belum mencakup onboarding seller, komisi/split settlement, escrow, langganan, sinkronisasi ERP, atau integrasi kurir. Pembeli menggunakan sesi tamu dan kode pelacakan, belum akun pelanggan dengan pemulihan password. Konfirmasi transfer menggunakan referensi teks; tidak ada upload bukti transfer yang disajikan sebagai verifikasi otomatis.

Integrasi Midtrans tersedia di kode dan diuji dengan respons provider terkontrol. Transaksi nyata perlu pengujian sandbox dengan kredensial merchant sebelum toko menerima uang. Dokumentasi ini tidak mengklaim adanya transaksi merchant nyata yang telah diuji pada demo.
