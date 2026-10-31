# Tampiloka Templates

Satu monorepo untuk membuat proyek klien dari template yang bisa dipakai ulang. Cafe dan commerce punya alur pelanggan, ruang kerja staf, preset, konfigurasi, dan tes sendiri. CLI memilih template serta kelengkapannya, lalu membuat proyek mandiri.

Demo template tersedia melalui tautan berikut.

| Template | Status | Bisa dicoba |
| --- | --- | --- |
| Commerce | Tersedia | [ecommerce.tampiloka.site](https://ecommerce.tampiloka.site) |
| Cafe & resto | Tersedia, 9 preset | [cafe.tampiloka.site](https://cafe.tampiloka.site) |
| Dashboard | Direncanakan | Belum masuk pilihan CLI |
| School | Direncanakan | Belum masuk pilihan CLI |
| Booking | Direncanakan | Belum masuk pilihan CLI |

Demo memakai data contoh. Konfigurasi produksi punya database dan rahasia sendiri. Demo commerce menyimpan data pada server dalam sesi terpisah untuk tiap pengunjung; demo cafe mempertahankan runtime lokal browser yang sudah ada. Jangan memakai database demo untuk klien.

## Mulai

Gunakan Node.js 22.18 atau lebih baru. Node.js 24 dipakai dalam CI.

```sh
git clone https://github.com/soezyxstt/tampiloka-templates.git
cd tampiloka-templates
npm install --global pnpm@10.28.2
pnpm install --frozen-lockfile
pnpm tampiloka list
pnpm dev
```

Galeri lokal berjalan di `http://127.0.0.1:5175`.

```sh
pnpm dev:commerce
pnpm dev:cafe
```

Commerce berjalan di `http://127.0.0.1:5174` dengan API lokal pada port `8787`. Perintah dev menyiapkan migrasi D1 lokal. Cafe demo berjalan di `http://127.0.0.1:4173`. Jalankan masing-masing pada terminal terpisah.

## Satu CLI

Saat berada di monorepo, gunakan `pnpm tampiloka`. Untuk perintah global dari folder mana pun:

```sh
npm install --global ./packages/cli
cd ..
tampiloka create kopi-senja
```

Wizard menanyakan template, preset, nama brand, WhatsApp, serta pilihan desain yang berlaku. CLI dapat dipakai tanpa pertanyaan:

```sh
tampiloka create kopi-senja --template cafe --preset full --theme editorial --name "Kopi Senja" --yes
tampiloka create rupa --template commerce --preset atelier --level store --name "Rupa" --yes
tampiloka create katalog-brand --template commerce --level whatsapp --whatsapp 628123456789 --yes
tampiloka create toko-ramai --template commerce --preset market --level advanced --card framed --button solid --yes
tampiloka presets commerce
tampiloka doctor --dir ./rupa
```

`--out /path/ke/clients` memilih folder induk. `--dry-run` menampilkan pilihan tanpa menulis file. `--json` menghasilkan data untuk skrip. CLI menolak nama/path yang tidak aman, template yang belum dibuat, opsi yang salah, dan folder yang sudah ada. Jika pembuatan gagal, CLI menghapus folder sementara miliknya.

Untuk memasang CLI pada mesin tanpa checkout monorepo:

```sh
pnpm cli:pack
npm install --global ./tampiloka-cli-1.0.0.tgz
```

Arsip membawa sumber cafe, commerce, registry, dan paket bersama yang dibutuhkan. Paket ini belum diasumsikan terbit di npm.

## Tingkat fitur commerce

| Fitur | `catalog` | `whatsapp` | `store` | `advanced` |
| --- | :---: | :---: | :---: | :---: |
| Produk, pencarian, filter, detail, varian | Ya | Ya | Ya | Ya |
| Keranjang dan daftar favorit |  | Ya | Ya | Ya |
| Daftar belanja ke WhatsApp |  | Ya |  |  |
| Checkout dan riwayat pesanan |  |  | Ya | Ya |
| Transfer manual dan COD |  |  | Ya | Ya |
| Produk, stok, pelanggan, dan laporan staf |  |  | Ya | Ya |
| Kupon |  |  |  | Ya |
| Gateway Midtrans |  |  |  | Ya, perlu kunci provider |
| Retur dan ulasan pembeli |  |  |  | Ya |

Server memeriksa level fitur. Menyembunyikan tombol saja tidak cukup. Harga, ongkir, kupon, stok, dan perubahan status pesanan berasal dari server. Demo memakai simulasi pembayaran yang jelas; toko nyata memakai konfigurasi dan kredensial provider sendiri.

`advanced` adalah toko milik satu bisnis. Fitur multi-penjual seperti komisi seller, pencairan escrow, sengketa antarpihak, dan logistik marketplace belum menjadi bagian template. Rincian alur, endpoint, status, dan batas pembayaran ada di [panduan commerce](templates/commerce/docs/api.md).

## Desain terpisah dari fitur

| Pilihan | Nilai |
| --- | --- |
| Preset / layout commerce | `editorial`, `market`, `atelier`, `compact` |
| Warna contoh | `sand`, `ink`, `forest` |
| Kartu produk | `open`, `framed`, `soft` |
| Tombol utama | `solid`, `outline` |
| Tema cafe | `boxy`, `rounded`, `editorial`, `playful`, `airy` |

Preset menyediakan titik awal. `--layout`, `--theme`, `--card`, dan `--button` dapat mengubah pilihan secara terpisah. Warna contoh bukan aturan dari design kit. Klien tetap punya warna, font, logo, foto, dan nada bahasanya sendiri. `website-design-kit` mengarahkan susunan konten, alur baca, perilaku responsif, komponen, dan ulasan visual.

Empat layout commerce punya susunan yang berbeda: editorial membuka dengan foto dan koleksi; market menonjolkan kategori serta grid padat; atelier memakai galeri pilihan; compact memakai baris belanja cepat. Ruang kerja staf tetap memakai letak aksi dan alur tugas yang tetap.

## Struktur

| Folder | Fungsi |
| --- | --- |
| `packages/cli` | `tampiloka create`, daftar preset, dan doctor |
| `packages/registry` | Template, status, preset, level, dan manifest |
| `packages/ui-core` | Tombol, field, dialog Radix, dan motion bersama |
| `packages/theme-engine` | Pilihan komposisi dan token brand terpisah |
| `packages/shared-utils` | Format rupiah, slug, dan bantuan tampilan |
| `packages/config` | Aturan TypeScript bersama |
| `templates/cafe` | Source cafe lengkap beserta semua tes dan demo lama |
| `templates/commerce` | Storefront, staf, Worker, D1, dan tes commerce |
| `templates/dashboard`, `school`, `booking` | Manifest rencana; belum ditawarkan CLI |
| `design-kit` | Panduan pemakaian serta rujukan design kit utama |

## Proyek klien

CLI menyalin source template dan paket bersama yang memang dibutuhkan. Dependensi `workspace:*` berubah menjadi `file:./packages/...` pada commerce, sehingga proyek klien tetap berjalan sendiri. Cafe mempertahankan generator serta npm lockfile yang sudah teruji. CLI tidak menyalin `node_modules`, `.git`, data lokal, rahasia, atau hasil build.

Proyek klien tidak menerima pembaruan induk secara otomatis. Catat versi asal di `tampiloka.project.json`, lalu terapkan perbaikan yang dibutuhkan lewat commit yang bisa ditinjau. Cara ini menjaga perubahan khusus klien dari perubahan serentak yang tidak diuji.

## Pengujian

```sh
pnpm test:cli
pnpm test:registry
pnpm --filter @tampiloka/template-commerce test
pnpm --filter @tampiloka/template-cafe test
pnpm typecheck
pnpm build:commerce
pnpm build:cafe
```

`pnpm build` juga membangun aplikasi Next.js cafe. Tes browser commerce berjalan dengan `pnpm --filter @tampiloka/template-commerce test:e2e`; tes browser cafe tersedia di `templates/cafe/tests`. Jalankan alur pelanggan sampai staf, bukan hanya build.

## Deploy

Commerce memakai Cloudflare Worker dan D1. `wrangler.jsonc` adalah konfigurasi proyek baru dengan ID database kosong dan `DEMO_MODE=false`. `wrangler.demo.jsonc` khusus demo Tampiloka dan tidak ikut proyek klien. Siapkan D1, terapkan migrasi, simpan rahasia staf/gateway dengan Wrangler, lalu deploy. Perintah lengkap ada di [README commerce](templates/commerce/README.md).

Cafe tetap memakai proyek Pages dan domain demo yang sudah ada. Konfigurasi build setelah migrasi harus menunjuk `templates/cafe` atau menjalankan `pnpm build:cafe` dari root. Hasilnya berada di `templates/cafe/dist-demos`.

## Menambah template

1. Buat aplikasi mandiri di `templates/<id>` dan tambahkan `template.json`.
2. Definisikan preset, konfigurasi, alur utama, dan tesnya.
3. Tambahkan entri registry dengan status `planned` selama belum bisa dipakai.
4. Dukung generator, build, typecheck, dan uji alur pelanggan/staf.
5. Ubah status menjadi `available` setelah proyek hasil CLI juga bisa berjalan.

Jangan memindahkan aturan bisnis cafe ke paket global untuk dipakai commerce. Bagikan komponen dan fungsi yang benar-benar sama; simpan transaksi serta aturan tiap sistem di templatenya.

### Deployment otomatis demo

Push ke `main` memicu Pages untuk cafe jika file cafe atau konfigurasi workspace berubah. Build watch paths diatur pada project Cloudflare `tampiloka-cafe-demos`. Galeri dan commerce menggunakan workflow `.github/workflows/deploy-workers.yml`; masing-masing dideploy hanya jika direktori atau paket bersama yang dipakainya berubah. Perubahan lockfile dan konfigurasi workspace memicu keduanya. Workflow juga dapat dijalankan manual dari Actions untuk memulihkan deployment yang gagal.

Workflow Workers membutuhkan repository secrets `CLOUDFLARE_ACCOUNT_ID` dan `CLOUDFLARE_API_TOKEN` yang berwenang deploy Workers dan mengelola domain terkait. Perubahan skema D1 harus diterapkan secara terpisah sebelum deploy commerce jika diperlukan; workflow tidak menjalankan migrasi database otomatis. Deployment berjalan terpisah dari workflow verifikasi, jadi pantau hasil keduanya.

## School & Learning Center

`school` supports exam preparation, language courses, skills training, and institutions, from profile to Full enrollment/operations.

```sh
pnpm tampiloka create prima-academy --template school --preset exam-prep --level full --layout course-discovery --theme cobalt --yes
pnpm dev:school
pnpm test:school
```

Read [school setup and limits](templates/school/README.md). The standalone generator is available; the public school catalog lists the verified demo URLs and hosted previews.
## Appointment booking

`booking` now has a server-backed implementation. Generate medical, aesthetic, detailing, or consulting projects independently from their Catalog / WhatsApp / Booking / Full level, layout and palette. Run `pnpm dev:booking` for the isolated public demonstration. See [`templates/booking/README.md`](templates/booking/README.md) for setup, architecture, verification and merchant-specific payment limitations. Public catalog readiness remains separate from template availability.
