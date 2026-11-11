# Tampiloka Commerce

Template toko untuk satu usaha, dari katalog sederhana sampai toko dengan operasional penjualan lengkap. Pembeli dan staf memakai API yang sama; harga, stok, pembayaran, dan hak akses diperiksa di server. Worker menyimpan data di Turso.

Demo publik: [ecommerce.tampiloka.site](https://ecommerce.tampiloka.site). Rupa adalah brand contoh. Pembayaran demo tidak memindahkan uang dan setiap pengunjung memiliki ruang data tersendiri.

## Pilih tingkat fitur

| Level | Alur pembeli | Operasional toko |
| --- | --- | --- |
| `catalog` | Cari/filter produk, detail dan varian, tanya toko | Kelola produk, harga, foto, dan pengaturan |
| `whatsapp` | Semua fitur katalog, keranjang, wishlist, susun pesan WhatsApp | Kelola katalog; pesanan dan pembayaran disepakati lewat percakapan |
| `store` | Keranjang, wishlist, checkout, transfer manual/COD, riwayat dan pelacakan pesanan | Verifikasi pembayaran, stok, proses pesanan, pengiriman, pelanggan, laporan, CSV, riwayat stok, refund pembatalan |
| `advanced` | Semua fitur toko, gateway Midtrans, promo, ulasan, retur | Promo, tinjau retur, terima barang kembali, dan proses refund melalui gateway |

Pembatasan level diterapkan di server. Mengubah tampilan atau memanggil endpoint langsung tidak membuka fitur yang dinonaktifkan.

**Modul tambahan tersedia:** `promotions`, `taxes`, `service-fees`, `customer-accounts`, `loyalty-points`, dan `membership-tiers`. Modul dipilih terpisah dari level, preset dan tema melalui `tampiloka create ... --features promotions,taxes`. Gunakan `--features none` untuk proyek tanpa tambahan; ketergantungan modul divalidasi. Poin masuk setelah pesanan selesai dan lunas, ditukar saat checkout, dan dikoreksi saat retur. Baca [panduan modul tambahan](docs/optional-modules.md), termasuk email OTP Resend dan batasnya.


Peran staf pemilik, operasional, dan pembaca tersedia pada semua level; tiap peran hanya dapat memakai fitur yang aktif pada level tersebut.

Desain dapat dipilih terpisah dari level: empat susunan halaman (`editorial`, `market`, `atelier`, `compact`), tiga palet (`sand`, `ink`, `forest`), tiga kartu (`open`, `framed`, `soft`), serta tombol `solid`/`outline`. Pilihan tersimpan di `config/commerce.json`. Ruang staf menggunakan tata letak operasional yang konsisten.

## Jalankan dari monorepo

Gunakan Node.js 22.18+ dan pnpm 10.28.2.

```sh
corepack enable
pnpm install
pnpm dev:commerce
```

Buka `http://127.0.0.1:5174`. Perintah ini membuat database lokal, menerapkan migrasi, lalu menjalankan Vite dan Worker. Mode lokal mengikuti `DEMO_MODE` di `.dev.vars`; proyek hasil generator memulai dalam mode klien. Database SQLite lokal ada di `.data/commerce.sqlite`. Mode ini tidak memerlukan token.

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

Contoh berikut untuk pilihan default Turso; untuk D1 atau PostgreSQL ikuti bagian Storage providers. Jalankan dari folder proyek klien. Beri setiap toko database Turso sendiri. Ganti `nama-grup-libsql` dengan nama grup libSQL Anda. Pilih nama Worker dan domain toko di `wrangler.jsonc` dan gunakan `DEMO_MODE: "false"`.

```sh
turso db create nama-toko --group nama-grup-libsql --wait
export TURSO_DATABASE_URL="$(turso db show nama-toko --http-url)"
export TURSO_AUTH_TOKEN="$(turso db tokens create nama-toko)"
pnpm db:remote
pnpm exec wrangler login
printf '%s' "$TURSO_DATABASE_URL" | pnpm exec wrangler secret put TURSO_DATABASE_URL
printf '%s' "$TURSO_AUTH_TOKEN" | pnpm exec wrangler secret put TURSO_AUTH_TOKEN
unset TURSO_AUTH_TOKEN
pnpm exec wrangler secret put STAFF_OWNER_PASSWORD
pnpm exec wrangler secret put STAFF_OPERATIONS_PASSWORD
pnpm exec wrangler secret put STAFF_VIEWER_PASSWORD
pnpm deploy
```

`pnpm deploy` menjalankan build sebelum mengunggah Worker dan aset.

Gunakan kata sandi unik setidaknya 12 karakter. Hanya buat peran yang diperlukan. Peran yang tidak memiliki secret tidak dapat masuk. Ruang staf ada di `/#/staff`. Jangan menaruh secret di `config/commerce.json`, kode browser, atau git.

Untuk login member pada proyek yang memilih modul `customer-accounts`, verifikasi domain pengirim email di Resend lalu tambahkan `RESEND_API_KEY` dan `MEMBER_EMAIL_FROM` sebagai secrets Worker. Tanpa keduanya, login member produksi tidak tersedia. Tidak ada kode OTP demo yang dikeluarkan pada produksi.

Untuk Midtrans pada level `advanced`:

```sh
pnpm exec wrangler secret put MIDTRANS_SERVER_KEY
```

Set `MIDTRANS_ENVIRONMENT` ke `sandbox` atau `production` melalui vars Worker. Arahkan notifikasi pembayaran Midtrans ke `https://domain-toko/api/webhooks/midtrans`. Mulai dari akun sandbox merchant. Server memverifikasi signature dan memeriksa status langsung ke Midtrans sebelum menandai pesanan lunas. Tanpa server key, gateway produksi tidak ditawarkan saat checkout.

Atur rekening, nomor WhatsApp, kebijakan retur, serta layanan/tarif pengiriman milik klien. Tarif pengiriman saat ini tarif tetap per layanan, dapat diatur di ruang staf; tidak mengambil ongkir/resi dari API kurir. Staf memasukkan nomor resi. Pengembalian dana manual dicatat setelah dana benar-benar dikirim di luar aplikasi. Integrasi gateway mengikuti status dari provider.

Worker memiliki jadwal per jam untuk menutup reservasi kedaluwarsa dan membersihkan data demo. Database produksi tidak direset oleh jadwal ini. Atur cadangan Turso sesuai kebutuhan toko.

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

`tests/backend.test.mjs` memakai SQLite lokal dengan skema dan pemicu transaksi yang sama dengan produksi. Uji browser dan `backend-live.mjs` memanggil API yang berjalan dan menolak target yang bukan demo. Untuk menguji demo publik:

```sh
COMMERCE_BASE_URL=https://ecommerce.tampiloka.site pnpm test:e2e
node tests/backend-live.mjs https://ecommerce.tampiloka.site
```

Bukti pengujian browser ditulis ke `test-results/`. Referensi endpoint, status, keamanan, dan batas integrasi ada di [docs/api.md](docs/api.md). Keputusan desain ada di [docs/design.md](docs/design.md), dan asal aset contoh di [docs/asset-sources.md](docs/asset-sources.md).

## Batas yang perlu dipahami

Ini template satu merchant dengan pengalaman belanja dan ruang staf. `advanced` bukan marketplace multi-penjual: belum mencakup onboarding seller, komisi/split settlement, escrow, langganan, sinkronisasi ERP, atau integrasi kurir. Pembeli menggunakan sesi tamu dan kode pelacakan, belum akun pelanggan dengan pemulihan password. Konfirmasi transfer menggunakan referensi teks; tidak ada upload bukti transfer yang disajikan sebagai verifikasi otomatis.

Integrasi Midtrans tersedia di kode dan diuji dengan respons provider terkontrol. Transaksi nyata perlu pengujian sandbox dengan kredensial merchant sebelum toko menerima uang. Dokumentasi ini tidak mengklaim adanya transaksi merchant nyata yang telah diuji pada demo.

### Storage providers

Turso is the Worker default. Configure `TURSO_DATABASE_URL` and a database-scoped `TURSO_AUTH_TOKEN` as Worker secrets, then run `pnpm db:remote` with the same migration environment. Its migration ledger verifies schema and detects drift; adopt a restored database only after the cutover checks. For D1 select `DATABASE_PROVIDER=d1`, configure the client-owned `DB` binding, and run `pnpm db:remote`. PostgreSQL uses `DATABASE_PROVIDER=postgresql`, `DATABASE_URL`, and its separate migrations with `pnpm db:remote`. Coordinate migrations and verify hosted transport before production. `pnpm dev`, `pnpm preview`, and `pnpm db:local` use isolated local SQLite, independently of the deployed provider. Do not put secrets in command-line arguments.

Staff can upload JPEG, PNG, or WebP images up to 5 MiB through `POST /api/staff/uploads` with the image as the request body and its MIME type in `Content-Type`. The response gives a scoped staff-only URL; authenticated staff can GET it, and owner or operations can DELETE it. Configure `OBJECT_STORAGE_PROVIDER=s3` with `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optionally `S3_REGION` and `S3_PUBLIC_URL`; or set `OBJECT_STORAGE_PROVIDER=uploadthing` and `UPLOADTHING_TOKEN`. Keep credentials in Worker secrets. Deleting demo data does not remove objects from the provider; configure provider lifecycle cleanup for abandoned uploads.
