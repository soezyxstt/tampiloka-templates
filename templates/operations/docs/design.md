# Desain Operations

Workspace menampilkan saldo per SKU, antrean dokumen, formulir tindakan, dan struk historis. SKU berbeda tidak dijumlahkan sebagai barang setara. Identitas, lokasi, produk, dan satuan berasal dari konfigurasi atau data domain; cimol hanya preset contoh.

## Pilihan demo

Tema `sand`, `forest`, dan `ink` mengubah presentasi. Mode `inventory`, `retail`, dan `full` menentukan fitur. Preset `food`, `retail`, dan `supplies` memilih ruang data demo. Ketiganya independen.

Toolbar menggunakan `DemoToolbarShell`, Radix Select, dan `demo.css` setelah CSS aplikasi. Tema, mode, dan peran berada di atas; ID/EN di kanan bawah. Offset sticky mengikuti tinggi toolbar terukur. URL mempertahankan pilihan demo, halaman, dokumen, lokasi, bahasa, parameter lain, dan hash.

## Token dan kontrol

Definisi warna hanya di `src/styles/tokens.css`. Komponen memakai token semantik; alias ui-core meliputi `--brand-canvas`, `--brand-text`, `--brand-action`, `--brand-on-action`, `--brand-focus`, `--tl-danger`, dan `--tl-overlay`.

| Peran | Token |
| --- | --- |
| Kanvas/panel | `--canvas`, `--surface`, `--surface-soft` |
| Teks | `--ink`, `--muted` |
| Kontrol/fokus | `--control-border`, `--action`, `--on-action`, `--focus` |
| Pembatas dekoratif | `--line` |
| Status tetap lintas tema | `--danger`, `--success`, `--warning`, `--info` dan pasangan `-surface` |
| Bentuk/ruang panel | `--radius`, `--radius-panel`, `--card-padding`, `--section-gap` |

Perhitungan luminansi sumber memeriksa 10 pasangan per tema: teks minimal 4,5:1 dan batas/fokus kontrol minimal 3:1. Seluruh 30 pasangan lolos; rasio kontrol terendah sand 3,86:1, forest 3,69:1, ink 3,76:1. Ini bukan pemeriksaan seluruh kombinasi atau hasil render.

`components/ui.tsx` mengekspor Button, Input, Textarea, dan Dialog ui-core. Picker membungkus Radix Select dengan portal, indikator pilihan, scrolling popup, dan nama aksesibel. Field menghubungkan label/bantuan ke kontrol. TaskForm memakai wrapper yang sama untuk perintah dan konfirmasi. Navigasi workspace memakai tautan asli; status disertai teks.

Target kontrol 44px, teks utama 14px, metadata minimal 12px, dan angka tabular. Input ponsel 16px. Tabel memiliki wadah gulir sendiri. Panel/formulir menjadi satu kolom pada layar kecil; ruang bawah menyediakan tempat kontrol bahasa.

## Motion dan verifikasi

Fokus terlihat memakai `--focus`. Umpan balik tombol/dialog mengikuti ui-core. Popup dan pergantian tampilan memakai animasi singkat tanpa menunda data; media query reduced motion mematikan durasi efektif. Aplikasi memakai MotionProvider bersama.

Browser, typecheck, build, interaksi Radix/fokus, perubahan reduced motion langsung, overflow 360/390/1024/1280px, serta parity bilingual tersembunyi belum dijalankan karena pembatasan CPU/RAM pengguna. Inventaris sumber dan kontras tidak membuktikan kelulusan visual. Lihat `verification.md` dan `ui.md`; family tetap planned dan belum dipublikasikan.

## Status cadangan

Halaman alat data memakai Panel, Button, Notice dan tata letak definisi bersama untuk status cadangan khusus pengelola. Teks ID/EN membedakan konfigurasi aktif, percobaan terakhir, salinan terverifikasi dan kegagalan; tombol periksa status memuat ulang tanpa memulai cadangan atau mengubah data. Waktu ditampilkan sebagai ISO UTC. Verifikasi salinan tidak disajikan sebagai bukti keberhasilan pemulihan layanan.

## Audit menurut waktu pencatatan

Layar audit menyediakan rentang tanggal UTC inklusif untuk dokumen, mutasi dan audit tindakan. Tanggal mustahil atau terbalik menampilkan pesan ID/EN dan tidak menghasilkan baris. Cakupan lokasi tetap memakai snapshot berizin. Catatan audit ditampilkan bertahap 40 baris dengan tombol bersama untuk catatan lebih lama; ini pembatasan render UI, bukan paginasi penyimpanan. Interaksi kontrol dan tampilan pada perangkat belum diperiksa browser.

## Pratinjau penugasan akun

Dialog perubahan akun menampilkan peran efektif per lokasi menggunakan predicate can/owner milik domain. Peran lokasi tidak dikalikan silang. Cakupan seluruh usaha, lokasi nonaktif dan akun nonaktif diberi penjelasan ID/EN; kewenangan final tetap mengikuti aturan transaksi. ID akun yang sudah dipilih terkunci, dan pembuatan akun baru menjelaskan provisioning kredensial terpisah. Penugasan owner tanpa cakupan eksplisit seluruh usaha menahan pengajuan dengan alasan terlihat. Kontrol memakai wrapper bersama; interaksi browser belum diperiksa.


## Temuan browser lokal 10 November 2026

Formulir barang memakai minimum 1 untuk SKU diskret dan 0,000001 dengan step any untuk SKU pecahan. Toolbar bersama dengan lima view atau lebih memakai baris peran terpisah dan wrapping sampai 1200 px; tinggi tetap diukur oleh shell. Smoke test 15 halaman desktop/390 px dan ringkasan 360/1024 px selesai tanpa overflow setelah perbaikan. Ini memperbarui catatan sebelumnya yang belum menjalankan browser; cakupan lengkap pada verification.md.


## Revisi hierarki dan bahasa — 2026-11-10

Halaman operasional mengutamakan catatan dan satu tindakan utama. TaskBoard membuka TaskForm di Dialog bersama; Picker memakai Radix Select, dan Disclosure memakai Radix Collapsible. Rincian laporan, editor harga dan impor/pemulihan dibuka saat dibutuhkan. Ringkasan laporan menampilkan empat nilai utama sebelum rincian. Konfirmasi barang memakai nama produk, jumlah, satuan dan kondisi, bukan JSON. Label menggunakan bahasa kerja singkat; keterangan simulasi berada di toolbar demo. Peringatan uang, stok dan transaksi tertunda tetap dekat tindakan.

Token radius kontrol/panel menjadi 6/8 px; padding/gap panel 16 px. Warna tidak berubah. Toolbar keluarga dengan lima peran atau lebih membungkus pada <=1600 px; `tl-demo-action-label` mendukung aksi teks tanpa memaksanya ke lebar ikon. Kontrol tetap memakai target sentuh 44 px.

Lihat [catatan revisi](workspace-revision.md) untuk sumber arahan, peta halaman dan bukti.


### Navbar demo ringkas

Operations mengaktifkan `collapsibleLabel` pada `DemoToolbarShell`. Default tertutup, satu baris logo dan tombol Pengaturan demo / Demo settings (target 44 px). Radix Collapsible mengelola expanded/controls serta keyboard Enter/Space; isi tertutup tidak masuk urutan fokus. Tema, mode, preset, peran, dan Simulasi berada di panel yang dibuka. ResizeObserver shell tetap mengukur tinggi terbuka/tertutup untuk offset area kerja. Tidak ada animasi tinggi yang menunda akses; ikon mengikuti reduced motion. Keluarga lain tetap memakai shell terbuka default.

Verifikasi perubahan ini: instalasi filtered lockfile beku, lint desain, tes Operations, pemeriksaan sintaks TSX dan diff. Browser, build/typecheck serta suite lintas keluarga belum diulang pada revisi navbar ini; screenshot sebelumnya menunjukkan versi sebelum disclosure. Batas resource sebelumnya tetap berlaku.


### Efisiensi ruang sebelum konten

Status koneksi berada di baris metadata judul, bukan blok terpisah. Panel menerima `toolbar` untuk menempatkan TaskBoard bersama judul dan filter tabel pada Persediaan, Pengiriman, Penerimaan, Opname dan Sif; urutan visual mengikuti DOM tanpa `order:-1`. Pada lebar sempit, kontrol membungkus tanpa mengurangi target 44 px. Pencarian Kasir berada pada header produk. Pemilih draf hanya muncul bila ada draf dan memakai Disclosure. Filter tanggal Audit dapat dilipat dengan rentang aktif tetap terlihat pada trigger.

Token `--workspace-padding:16px` mengendalikan ruang atas konten dan `--toolbar-gap:8px` jarak antar-kontrol. Ringkasan menggunakan empat kolom di atas 700 px agar tidak menjadi dua baris pada layar staf 1024 px. Ponsel menyandingkan identitas usaha dan pilihan lokasi sebelum baris navigasi. Tidak ada pengurangan ukuran teks atau pemangkasan peringatan transaksi.

Verifikasi revisi kepadatan: transform sintaks Vite/Oxc lulus untuk App, ui, Operations dan Cashier; lint desain dan 76 tes Operations lulus, konsistensi dokumen serta diff bersih. Browser belum diuji ulang pada revisi ini; tidak mengklaim persentase ruang atau hasil visual terukur. Build/typecheck tetap belum dijalankan sesuai batas resource sebelumnya.
