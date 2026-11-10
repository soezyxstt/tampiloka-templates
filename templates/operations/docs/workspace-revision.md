# Revisi workspace Operations

Arahan: pengguna meminta bahasa alami, hierarki jelas, efisiensi ruang dan pengalaman seperti instalasi klien, dengan navbar demo tetap diperbolehkan. Skill yang diterapkan: `copywriting-bahasa-indonesia`, `brand-to-website`, dan prasyarat `website-design-kit` versi **2.1.0**, dibaca dari `/home/codespace/.agents/skills/website-design-kit/SKILL.md`. Identitas dan palette existing dipertahankan; ini revisi workspace staf, bukan riset merek atau situs pemasaran baru. Tidak ada pola kit baru atau aset fotografi yang diklaim.

## Peta tugas

- Ringkasan: angka dan tindak lanjut.
- Persediaan, pengiriman, penerimaan, opname, sif: daftar dahulu; editor tindakan dalam dialog bersama.
- Kasir dan retur: masukan transaksi serta peringatan keuangan yang relevan.
- Harga: daftar berlaku, editor dapat dibuka.
- Laporan: empat angka utama, penjualan, rincian dan filter dapat dibuka.
- Audit: pencarian, tanggal, dokumen.
- Data induk, akses, pengaturan: formulir pengelolaan dengan konfirmasi.
- Impor/cadangan: status dan tindakan pemeliharaan yang dapat dibuka.

## Bukti lokal

Baseline: `/home/codespace/.t3/scratch/operations-review-2026-11-10/`. Revisi: `/home/codespace/.t3/scratch/operations-revision-2026-11-10/manifest.json`, galeri dan 30 PNG (15 halaman × desktop 1280×800 / ponsel 390×844). Seluruh rute memuat judul yang sesuai tanpa error Vite atau overflow halaman. Tabel lebar tetap dapat digulir.

UI transaksi: buat draf Gudang Pusat Garut ke Garut 2, satu porsi Cimol Original; konfirmasi menampilkan nama, bukan JSON; penyimpanan menutup dialog dan menambah satu draf. Data penjualan terdahulu Rp50.000 tetap ada. Pengaturan nama sampel diperbarui lewat UI. Laporan EN pada 1024 px: filter membuka dengan klik, menutup dengan Enter, fokus tetap pada trigger. Pada 360 px ditemukan tombol Simulation meluap 5 px, diperbaiki melalui varian tombol berlabel; cek ulang tanpa overflow.

Pemeriksaan: 76/76 tes Operations; `pnpm lint:design` (175 file, OK); `node scripts/check-docs-consistency.mjs`; `git diff --check`. Build/typecheck tidak dijalankan mengikuti batas resource dari permintaan awal. Ini bukan sertifikasi seluruh skenario bisnis, reduced-motion lintas keluarga, seluruh popup ID/EN atau kesiapan produksi. Full Cafe/browser lintas keluarga belum diulang untuk perubahan toolbar bersama; jangan menandai PR siap ditinjau sebelum gate AGENTS dipenuhi.
