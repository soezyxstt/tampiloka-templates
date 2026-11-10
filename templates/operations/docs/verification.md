# Verifikasi

Checkpoint terbaru 2026-11-10: **76/76 tes**, desain dan konsistensi dokumen lulus. Browser lokal kini telah dijalankan atas permintaan lanjutan pengguna, termasuk revisi 15 halaman desktop/ponsel. Build dan typecheck tetap tidak dijalankan. Lihat [bukti revisi workspace](workspace-revision.md). Paragraf checkpoint lama di bawah dipertahankan sebagai riwayat, bukan status terbaru.

Status: **implementasi dengan verifikasi parsial**, family tetap planned. Runner terbaru `node --max-old-space-size=64 --experimental-transform-types templates/operations/tests/run.mjs` menjalankan **69 tes, seluruhnya lulus**, dalam 0,91 detik wall time pada 2026-11-10. Cakupan: domain fixture kecil, SQLite adapter, handler Worker dengan adapter, report/CSV, klasifikasi pemulihan, draf, serta cadangan terjadwal dan retensi. Ini bukan pengujian runtime Cloudflare atau browser dan bukan kelulusan penuh AT01–40.

Build, typecheck, install, browser, beban berat, deployment, dan penerimaan menyeluruh tidak dijalankan sesuai instruksi. Performa target, ketersediaan, jadwal backup, dan latihan pemulihan terukur tidak diklaim. Pemetaan KF01–38 dan AT01–40 ada di [requirements.md](requirements.md). Catatan di bawah merupakan riwayat pemeriksaan; hasil runner di atas menggantikan jumlah tes dari checkpoint lama.

Setelah implementasi lengkap dan larangan dicabut: instal lockfile beku, jalankan `pnpm lint:design`, `pnpm --filter @tampiloka/template-operations typecheck`, `pnpm --filter @tampiloka/template-operations build`, tes domain/API/akses dan seluruh AT dengan bukti; periksa registry, CLI, paket standalone, katalog dan dokumentasi. Uji browser 360, 390, 1024 dan 1280–1440 px, kedua bahasa, tema/mode independen, deep link, navigasi kembali, reduced motion, fokus dan data bersama. Uji khusus transaksi bersamaan, idempotensi, isolasi usaha dan peran, pencabutan hak, koreksi, backup/restore dan beban sesuai spesifikasi. Catat commit, perintah, bukti dan kegagalan sebelum mengubah status planned.

Pemeriksaan ringan pada 2026-11-10: `git diff --check` lulus untuk perubahan terlacak; pemeriksaan Node membaca JSON manifest dan sampel serta membandingkan entri registry JSON dengan runtime: cocok, status planned, enam lokasi dan dua produk. Importer lockfile disalin dari versi Booking dan belum divalidasi dengan instalasi. Katalog tidak ditambahkan: generator mengecualikan family yang belum `available`, dan belum ada URL maupun gambar demo terverifikasi.

Pemeriksaan konfigurasi lanjutan: `node --input-type=module` memuat `config/validate.ts` langsung menggunakan dukungan TypeScript Node 24.22.2 (tanpa compiler). Konfigurasi demo serta organisasi satu lokasi di Asia/Makassar dengan SKU kertas dan konversi rim 500 diterima. Tujuh perubahan tidak sah ditolak: referensi stok hilang, lokasi duplikat, faktor satuan dasar salah, USD yang belum didukung, zona waktu tidak sah, mode/modul tidak konsisten, dan stok pecahan untuk SKU diskret. Perintah selesai dalam kurang dari satu detik. Ini hanya membuktikan validator konfigurasi; tidak membuktikan API, ledger, instalasi standalone, atau alur pengguna.

Kontras: perhitungan luminansi WCAG melalui Node memeriksa sepuluh pasangan semantik per tema (30 total), termasuk body/muted/action/status pada latarnya dan border/focus pada surface. Semuanya mencapai minimum sesuai peran: teks 4,5:1, kontrol 3:1. Rasio terendah per tema adalah 3,86 (sand), 3,69 (forest), dan 3,76 (ink), semuanya pasangan kontrol. Pemeriksaan angka ini tidak membuktikan tampilan browser atau seluruh pasangan komposisi.

Generator Operations disiapkan pada `packages/cli/src/operations.mjs` dengan normalisasi paket lokal, konfigurasi client tanpa data demo, pemilihan mode/tema/preset dan doctor. Jalur publik tetap ditolak oleh gate `availableOnly` karena family `planned`. Proses packing kini mengambil family `available` dari registry; Operations baru otomatis masuk setelah promosi. Build CLI, packed output, instalasi dan eksekusi proyek hasil generator belum dijalankan.

Pemeriksaan generator ringan (`node --input-type=module`, tanpa subprocess): 27 kombinasi preset/level/tema diterima validator; level tidak sah dan akses publik ke family planned ditolak. Pembuatan sumber menggunakan `createProject` dan registry uji sementara dalam memori menghasilkan `community-center` / supplies / inventory / forest di direktori sementara; `doctorOperations` lulus pemeriksaan berkas. Konfigurasi tidak membawa saldo/harga demo, SKU kertas dipilih, dependency ui-core memakai paket lokal, dan Worker memuat `const demo=false`. Direktori uji dibersihkan setelahnya. Registry di disk tetap planned. Proses ini selesai kurang dari satu detik dan tidak menjalankan aplikasi, instalasi, build, typecheck atau packed CLI.

Kontrak SQLite lokal: `node --max-old-space-size=64 --experimental-transform-types templates/operations/tests/storage-contract.test.mjs` menjalankan tiga pemeriksaan dalam satu proses, heap V8 dibatasi 64 MiB, selesai kurang dari satu detik. Adapter `node:sqlite` memuat kelas penyimpanan asli dengan pengganti minimal base class Cloudflare. Pengiriman bertahan setelah instance dibuat ulang, replay tidak menggandakan jurnal, dan penolakan stok ditahan tidak meninggalkan perubahan parsial. Pemeriksaan pertama menemukan lookup hasil mengembalikan bentuk respons yang salah; setelah perbaikan menjadi `{result,state}`, ketiga pemeriksaan lulus. Ini bukan pengujian Workers runtime, konkurensi lintas perangkat, atau penerimaan browser.

Domain: satu proses `node --max-old-space-size=64 --experimental-transform-types --input-type=module` mengimpor `tests/domain-stock.mjs`, `tests/domain-money.mjs` dan `tests/domain-access.mjs`; 24 kasus lulus, durasi proses sekitar 0,32 detik. Skenario domain utama menghasilkan gudang 800, transit 0, outlet 195 setelah penjualan lima dan penerimaan 200; replay penerimaan 100 kali tidak mengubah saldo. Profil eksklusif menghasilkan 98.175; profil inklusif dengan layanan menghasilkan 115.500. Label AT pada nama tes menunjukkan keterkaitan, bukan kelulusan penuh AT: browser, konkurensi nyata, jaringan putus dan target mutu belum diuji.

Regresi cakupan replay: `node --max-old-space-size=64 --experimental-transform-types templates/operations/tests/replay-scope.test.mjs` semula gagal karena pengirim diminta memiliki semua lokasi dokumen, termasuk tujuan. Setelah otorisasi replay menggunakan kewenangan tindakan asal, kasus lulus: petugas gudang dapat mengambil kembali hasil kirim sendiri, tetap tidak boleh menerima di outlet, dan tidak dapat replay setelah kewenangan gudang dicabut.

Pemulihan UI: `node --max-old-space-size=64 --experimental-transform-types templates/operations/tests/recovery-errors.test.mjs` lulus. Setelah retry mendapat penolakan bisnis definitif, formulir dapat diperbaiki dan diajukan kembali; kegagalan jaringan, autentikasi, throttling, timeout atau konflik identitas tetap mempertahankan tindakan belum pasti. Pemeriksaan ini memverifikasi klasifikasi kesalahan, bukan lifecycle React atau perilaku jaringan browser.

### Integrasi laporan pada UI

UI sekarang memakai tipe hasil report domain, angka `selection` untuk ringkasan baris penjualan, dan mempertahankan struk asli di dialog. Ekspor menggunakan filter milik laporan yang ditampilkan serta revisinya; konflik revisi meminta pengguna memuat ulang. Filter tanggal invalid tidak lagi melempar exception saat render. Dokumentasi desain diperbarui dari rencana menjadi inventaris implementasi. Pemeriksaan `git diff --check` lulus; interaksi UI belum diuji di browser.

Layar laporan kini juga merender saldo kumulatif, pembayaran/refund teralokasi, uang tanpa SKU, kiriman, hitung fisik, sif, dan arus kas. Metadata alur kerja ditandai sebagai status terkini; bukan rekonstruksi historis. Table dipindahkan ke wrapper UI bersama. Pemeriksaan whitespace lulus; render dan interaksi tetap belum terverifikasi.

### Integrasi pemulihan uang dan satuan kasir

Kasir membaca `error.details.paymentId` dari envelope Worker, menyimpan pilihan pembayaran per draf, dan dapat menyelesaikan penjualan menggunakan `paymentId` terkonfirmasi tanpa penerimaan uang baru. Pemulihan menampilkan larangan menagih ulang; pembayaran review/pending menahan finalisasi. Kuantitas keranjang mendukung satuan produk, konversi stok dasar, dan langkah pecahan sesuai konfigurasi. Perintah awal kini mempertahankan identitas pada kegagalan autentikasi, throttling, timeout, atau konflik idempotensi seperti mekanisme retry. Tes recovery-errors diperluas untuk envelope pembayaran. Interaksi pengguna belum diuji di browser.

### Pemeriksaan kontrak formulir

Pemeriksaan Node satu proses (`--max-old-space-size=64 --experimental-transform-types`) mengimpor `tasks.ts` dan memastikan alasan audit berada di payload terluar untuk data induk, usaha, dan impor; field jadwal profil serta sif settlement tersedia. Lulus. Formulir akses dan impor khusus juga mengirim alasan; persetujuan menyediakan alasan pengecualian untuk transaksi sendiri. Penerimaan tidak lagi memiliki jumlah bawaan 200 dari contoh cimol. Koreksi penerimaan pascaopname meminta waktu tiba sebelum cutoff dan memakai satuan dasar. Whitespace diperiksa tanpa build/typecheck.

### Rujukan pemulihan pembayaran

`node --max-old-space-size=64 --experimental-transform-types --test --test-name-pattern='recovery money|sale rejection' templates/operations/tests/hardening.test.mjs`: 2 lulus, 0 gagal, kurang dari satu detik. Worker memakai rujukan pemulihan unik dan menyimpan `suppliedReference` terpisah. Tes mencakup rujukan kosong, duplikat, benturan dengan rujukan internal, serta retry yang tidak menggandakan uang. Percobaan awal tes memakai kegagalan rujukan pada transaksi normal (hasilnya benar-benar PAYMENT_REFERENCE_USED); fixture dikoreksi menjadi penolakan quote usang yang memang memicu pencatatan uang untuk diperiksa. Ini bukan bukti pembayaran eksternal diterima dan bukan pengujian Workers runtime.

Gate TaskBoard diperbaiki untuk mempertahankan payment.resolve/refund, shift settlement/cash/close/correction, dan permintaan retur ketika POS mati; panel retur historis tidak lagi disembunyikan. Impor menyediakan alasan pengecualian dan memasukkannya dalam payload yang dibandingkan dengan pratinjau.

### Draf server

`node --max-old-space-size=64 --experimental-transform-types --test templates/operations/tests/saved-carts.test.mjs`: 2 lulus. Draf hanya dapat diteruskan oleh kasir asal pada lokasi yang sama; draf yang diganti/dibatalkan/dijual tidak bisa dipakai kembali. Quote tidak menutup draf dan replay penjualan tidak menggandakan stok/penjualan. Percobaan awal assertion membaca `data.input` padahal dokumen cart memakai `data.lines`; assertion disesuaikan dengan format dokumen yang ada. UI menyediakan picker draf server dan pemulihan hasil save/cancel; browser belum diuji.

`pnpm test:operations` sekarang menunjuk runner satu proses dengan heap 64 MiB. Runner menggabungkan tes domain, storage adapter, hardening, laporan, recovery, dan draf; tidak memulai build/typecheck/browser. Runner gabungan telah dijalankan; hasil terbaru tercatat di bagian atas.

### Pemeriksaan desain dan filter status

`node --max-old-space-size=64 scripts/check-design-tokens.mjs --summary`: 0 finding(s). Ini pemeriksaan sumber warna/ukuran teks, bukan visual browser. UI laporan kini menyediakan filter status dengan penjelasan bahwa kosakata status berbeda per jenis catatan; query/filter ekspor menggunakan nilai yang sama.

### Temuan kiriman per SKU

Temuan kini menyimpan productId, jenis (shortage/excess/damage/other), serta jumlah satuan dasar. Formulir meminta ketiganya; shipment multisSKU menolak temuan tanpa SKU, dan SKU diskret menolak jumlah pecahan. Temuan hanya bukti/keputusan, tidak otomatis membuat mutasi. Daftar pengecualian membawa SKU/jumlah sehingga filter laporan tetap relevan. Tes terarah kerusakan/kelebihan sebelumnya (2) serta tes baru multi-SKU (1) lulus dengan heap 64 MiB; `git diff --check` lulus. Runner gabungan 60 tes di bagian atas mendahului penambahan tes baru ini.

### Detail tampilan dan beban pembaruan

Lookup nama lokasi memakai lokasi berizin terlebih dahulu lalu direktori tujuan minimal; array direktori kosong tidak lagi menyembunyikan nama lokasi yang memang boleh dilihat penerima/kasir. Struk menampilkan identitas usaha, metode pembayaran, status tagihan nol, dan rincian diskon/pajak/layanan per baris asli. Penghitung usia koneksi dipindahkan ke komponen tersendiri dengan interval 30 detik, sehingga timer tidak merender seluruh workspace tiap detik. Pemeriksaan whitespace lulus; hasil cetak dan perilaku render belum diverifikasi di browser.

### Pengajuan koreksi

UI opname menyediakan stock.propose bagi inventory/receiver, serta picker pengajuan terbuka pada stock.adjust. Picker memakai dokumen yang sudah difilter server dan lokasi formulir. Domain memastikan sumber persetujuan sama SKU bila pengajuan mencatat SKU. Tes terarah `source IDs` dari hardening lulus sebelum pengetatan SKU; pemeriksaan whitespace lulus. Tidak ada browser/typecheck/build.

### Dokumentasi registry dan dokumen kirim

`node --max-old-space-size=64 scripts/check-docs-consistency.mjs` semula gagal karena tabel root README memuat 5 dari 6 family. Setelah menambahkan baris Operations planned, perintah lulus. Uji gate registry kini mencakup semua family planned, bukan hanya Dashboard; suite registry penuh belum dijalankan. UI kiriman menyediakan dokumen cetak dengan identitas, asal/tujuan, SKU, satuan/faktor dokumen, dan label draf/batal. Cetakan dinyatakan sebagai ringkasan revisi saat ini, bukan bukti penerimaan stok. Belum ada uji browser/cetak.

### Identitas snapshot antartab

Snapshot kini menyertakan viewerId dari akun terautentikasi. UI memperbarui sesi bila viewer berbeda dan membatasi perbandingan revisi ke usaha/preset/viewer yang sama; state lama ber-revisi lebih tinggi tidak boleh mengalahkan dataset baru. Penerimaan command memeriksa viewer sebelum membersihkan identitas pending. Penolakan 401/403 menyegarkan sesi/CSRF tanpa menghapus tindakan yang belum pasti. Deep link saat login awal dipertahankan dengan sinkronisasi sessionRef sebelum refresh. Tiga tes cakupan akses lulus; lifecycle React antartab belum diverifikasi browser.

### Agregasi saldo satu lintasan

Snapshot dan validasi keseimbangan menggunakan stockLookup sementara yang dibentuk dari ledger sekali per snapshot. Laporan membentuk agregat cutoff dan transit keluar sekali, bukan memindai seluruh ledger untuk setiap lokasi/SKU. Snapshot menyalin hanya proyeksi berizin dan seluruh hasilnya terlepas dari state tersimpan. Tujuh tes report-contract lulus setelah perubahan. Ini perbaikan kompleksitas sumber, bukan hasil benchmark atau bukti kelulusan target 200.000 mutasi; proyeksi state menyeluruh dan sebagian scan lain masih perlu perbaikan/validasi beban.

### Penyelesaian kiriman historis

Picker SKU pada formulir dengan kiriman terpilih mengikuti baris kiriman, termasuk SKU yang sudah dinonaktifkan setelah pengiriman. Petugas tetap dapat menerima barang historis tanpa mengaktifkan penjualan SKU kembali. Penanda tiba menyediakan waktu kejadian sebenarnya; waktu pencatatan tetap ditetapkan server. Perubahan formulir diperiksa sumber dan whitespace saja, bukan interaksi browser.

### CLI list dan registry aktual

`node --max-old-space-size=64 packages/cli/bin/tampiloka.mjs list` menampilkan keenam family termasuk Operations sebagai Direncanakan. `presets operations --json` ditolak dengan pesan planned, sesuai gate publik saat ini. Perbandingan deep-equal runtime registry dengan JSON semula gagal karena urutan Operations/Booking berbeda; runtime dipindahkan agar identik dengan JSON, lalu pemeriksaan lulus termasuk gate availableOnly. Ini mengoreksi klaim checkpoint awal yang hanya membandingkan entri tanpa urutan. Packed CLI, install, dan full generation suite tetap belum dijalankan.


### Penyelesaian cadangan terjadwal (10 November 2026)

Panel status khusus pengelola terhubung pada alat data dengan pemuatan, kesalahan dan penyegaran ID/EN. Panduan `backup.md` mencatat konfigurasi opt-in R2/cron, batas 10 MiB / 10.000 command, pembersihan terbatas, penyimpanan secret dan prosedur latihan pemulihan. Konfigurasi bawaan tidak mengaktifkan cron dan tidak ada resource cloud yang dibuat.

- `node --max-old-space-size=64 --experimental-transform-types templates/operations/tests/run.mjs`: 69 lulus, 0 gagal; wall time 0,91 detik. Enam tes cadangan mencakup larangan demo, kebijakan wajib, snapshot/jurnal bertanda tangan, restore adapter, kegagalan tulis/baca, retensi, kegagalan cleanup dan pemulihan pada percobaan berikutnya, akses khusus pengelola serta batas jurnal. Runtime Cloudflare belum diuji.
- `node --max-old-space-size=64 scripts/check-design-tokens.mjs --summary`: 0 temuan.
- `node --max-old-space-size=64 scripts/check-docs-consistency.mjs`: lulus.
- `git diff --check`: lulus untuk berkas terlacak.
- `node --max-old-space-size=64 --test packages/registry/tests/registry.test.mjs`: gagal sebelum assertion karena `ERR_MODULE_NOT_FOUND` untuk `ajv`. Tidak melakukan instalasi; suite registry tetap belum terverifikasi.

Hasil memakai working tree yang belum di-commit. Build, typecheck, browser, instalasi, packed CLI, deployment dan tes beban tetap tidak dijalankan sesuai batasan pengguna. Family tetap planned; tidak ada klaim penerimaan penuh, jadwal cloud aktif atau RPO/RTO terpenuhi.

### Isolasi sumber daya backup pada generator

Generator sekarang mereset vars ke DEMO_MODE=false dan BACKUP_ENABLED=false, mengosongkan cron, serta menghapus r2_buckets dan konfigurasi env yang mungkin diwariskan dari sumber. CLIENT_SETUP menunjuk panduan backup. Smoke test satu proses Node dengan heap 64 MiB menghasilkan client supplies/inventory/forest dari konfigurasi sumber sintetis yang memiliki bucket, cron, env, account dan route. Semua sumber daya tersebut dihapus, doctorOperations lulus, dan direktori sementara dibersihkan (0,10 detik). Ini pemeriksaan sumber generator, bukan instalasi atau eksekusi aplikasi hasil generasi.

Runner domain yang sama dijalankan ulang sesudah integrasi: 69 lulus, 0 gagal, wall time 0,90 detik. Batas verifikasi sebelumnya tetap berlaku.

### Batas ekspor manual dan byte kata sandi

Ekspor cadangan manual kini memeriksa ukuran proyeksi dan jurnal melalui penjagaan yang sama dengan penjadwal, membatasi pembacaan jurnal ke 10.000 command, dan menolak envelope bertanda tangan di atas batas restore 10 MiB. Pesan penolakan tersedia dalam ID/EN. Tes mencakup penolakan jurnal berlebih pada kedua jalur, akses tanpa sesi, dan kesamaan isi JSON manual/terjadwal. Assertion pertama membandingkan prototipe objek SQLite dengan JSON sehingga gagal; perbandingan diperbaiki ke format JSON yang benar-benar dikirim. Batas envelope akhir diperiksa sumber, tanpa membuat fixture besar.

Login sekarang mempertahankan byte kata sandi persis seperti input, termasuk spasi awal/akhir dan Unicode, sesuai kontrak provisioning; sebelumnya helper str memangkasnya. Regresi Worker memakai pengganti deriveBits agar tidak menjalankan hashing mahal, tetapi mengamati byte importKey dan hasil login. Ini bukan verifikasi kekuatan atau runtime KDF.

`node --max-old-space-size=64 --experimental-transform-types templates/operations/tests/run.mjs`: 70 lulus, 0 gagal, wall time 0,96 detik. Tidak ada build, typecheck, instalasi, browser atau proses cloud.

### Respons unduhan dan pilihan restore

Unduhan manual memakai request API yang memeriksa status HTTP sebelum membuat berkas. Penolakan server ditampilkan dalam Notice; JSON kesalahan tidak lagi diunduh sebagai cadangan. Tombol memakai wrapper Button, status sibuk dan larangan saat command belum pasti. Pemilihan berkas restore baru mengosongkan isi sebelumnya sebelum validasi ukuran; hasil baca asinkron dari pilihan lama diabaikan. Pemeriksaan sumber dan whitespace dilakukan; perilaku unduhan browser tetap belum diverifikasi.

### Batas waktu kewenangan restore

UC15 meminta hak pemulihan terbatas waktu. Restore kini mensyaratkan login pengelola dalam 15 menit terakhir, dengan umur login dihitung dari expiry sesi tetap 12 jam yang dibuat server. Sesi lama masih dapat membaca data tetapi tidak dapat restore; pesan ID/EN meminta keluar dan masuk kembali. Restore juga menolak preset berbeda walaupun ID usaha sama, agar hasilnya tetap dapat dicadangkan oleh instalasi yang cocok.

Regresi adapter SQLite membuktikan penolakan preset berbeda, penolakan sesi berumur 16 menit tanpa perubahan state/jurnal, penerimaan setelah login baru, dan pencabutan sesi setelah restore. Runner lengkap: 71 lulus, 0 gagal, heap 64 MiB, wall time 1,01 detik sebelum penambahan assertion preset; tes backup dijalankan ulang sesudahnya. Runtime dan interaksi browser belum diverifikasi.

### Audit rentang waktu (KM09)

AuditView sebelumnya hanya menampilkan 40 audit terakhir tanpa akses ke catatan lama dan tidak menyediakan rentang waktu. Filter tanggal pencatatan UTC sekarang diterapkan pada dokumen, mutasi dan audit yang sudah terbatasi hak akses. Filter lokasi juga diterapkan pada daftar audit tindakan. Tombol menambah batas tampilan 40 catatan, dengan jumlah hasil dan empty state ID/EN. Ini belum mengatasi materialisasi seluruh snapshot.

Dua tes audit-range memeriksa batas awal/akhir hari, offset zona waktu, tanggal mustahil, rentang terbalik, rentang terbuka dan tahun kabisat; keduanya lulus dalam proses heap 64 MiB. UI diperiksa sumber; belum ada verifikasi interaksi browser. Delegasi audit Sol high dicoba tetapi orkestrator menolak parent_not_active; tidak ada subagent baru yang berjalan.

Runner lengkap setelah filter audit: 73 lulus, 0 gagal, heap 64 MiB, wall time 1,23 detik. Design-token guard 0 temuan; git diff --check lulus.

### Hak efektif sebelum penyimpanan (KF02 / UC01)

Dialog akses sekarang menyajikan cakupan per lokasi melalui fungsi can/owner domain, bukan hanya mengulang daftar input. Akun nonaktif tidak ditampilkan seolah tetap berwenang; owner seluruh usaha mencakup lokasi baru. Pratinjau menjelaskan bahwa fitur dan aturan transaksi tetap berlaku. Pilihan akun dipisahkan dari input ID baru; ID existing dikunci agar edit tidak menghasilkan akun lain secara tidak sengaja. Owner tanpa scope * ditolak pada formulir dengan alasan terlihat, sesuai validasi server.

Perubahan diperiksa sumber, design-token guard (0 temuan) dan whitespace. Tes domain-access terarah dijalankan untuk predicate/cakupan yang dipakai bersama; ini tidak membuktikan lifecycle dialog atau interaksi browser.

Hasil pemeriksaan akses: 10 tes domain-access lulus, 0 gagal, wall time 0,31 detik dengan heap 64 MiB. Konsistensi dokumentasi dan git diff --check lulus.

### Identitas tindakan setelah tab ditutup (KM11, bukti parsial)

Sesi HTTP kini menyertakan recoveryScope stabil per namespace instalasi/preset, terpisah dari token autentikasi. Snapshot HTTP membawa scope yang sama agar pergantian cookie antartab terdeteksi meskipun ID akun sama. Request pemulihan dan command dari UI menyertakan scope; server menolak scope berbeda sebelum dispatch. Header scope bukan pengganti autentikasi atau otorisasi.

Identitas command disimpan sebagai satu localStorage key per scope dan command sebelum request dikirim. Penghapusan hanya menyentuh identitas yang terselesaikan, sehingga penyelesaian di satu tab tidak menghapus identitas tab lain. Kegagalan penyimpanan menahan pengiriman; record rusak menahan pemulihan. Event storage/focus menyegarkan daftar pending, dan hasil harus cocok dengan commandId sebelum dihapus. Record sessionStorage lama masih dapat dicari hasilnya, tetapi tidak boleh dikirim ulang karena tidak memiliki scope. Draf keranjang lokal masih memakai sessionStorage dan tetap memerlukan penyelesaian terpisah untuk tutup/buka aplikasi.

`node --max-old-space-size=64 --experimental-transform-types templates/operations/tests/run.mjs`: 76 lulus, 0 gagal, wall time 0,97 detik. Tes baru memakai penyimpanan Map persisten antar-reader serta Worker dengan stub kecil: identitas terpisah tidak tertimpa, scope berbeda tidak tercampur, kegagalan/kerusakan ditolak, token berganti mempertahankan scope, dan request scope salah tidak didispatch. Ini bukan bukti browser tutup/buka, lifecycle React, konkurensi browser nyata atau durability setelah browser menghapus penyimpanan.


### Browser lokal dan screenshot (10 November 2026, permintaan pengguna)

Pengguna meminta menjalankan web lokal serta screenshot halaman dan skenario. Dependensi terfilter dipasang dengan `pnpm --filter @tampiloka/template-operations... install --frozen-lockfile --network-concurrency=2 --child-concurrency=1` (lulus). Pustaka sistem browser dipasang melalui `sudo -n env PATH=/home/codespace/.local/bin:/usr/local/bin:/usr/bin:/bin t3 browser setup --base-dir /home/codespace/.t3`. Demo berjalan dengan `NODE_OPTIONS=--max-old-space-size=512 pnpm dev:operations`: Vite 5177 dan Wrangler/workerd lokal 8788. Tidak menjalankan build produksi atau typecheck.

Browser T3 berhasil merender 15 halaman pada 1280 × 1000: dashboard, stock, shipments, receiving, cashier, pricing, counts, returns, shifts, reports, audit, masters, access, settings, data. Pemeriksaan lebar dokumen seluruh halaman pada 390 px tidak menemukan overflow horizontal setelah perbaikan. Ringkasan juga diperiksa pada 360 dan 1024 px. Screenshot adalah viewport, bukan bukti pemeriksaan seluruh konten panjang.

Alur dilaksanakan dengan kontrol UI dalam satu sesi demo: Gudang membuat draf 200 porsi CIMOL-ORI dari warehouse ke outlet-a, mengesahkan kirim; Penerima menandai tiba; Kasir membuka sif dengan modal Rp100.000, menghitung dan menjual 5 porsi dengan tunai Rp50.000; UI stok menampilkan −5 dan 200 belum diterima. Penerima membukukan 200 barang baik dengan alasan; UI stok menjadi 195 dan 0 belum diterima. Laporan pengelola menunjukkan gudang 800, outlet 195, transit 0, penjualan/penerimaan Rp50.000. Ekspor CSV melalui tombol berhasil mengunduh operations-7.csv (15.946 byte). Refresh/deep link mempertahankan data. Pergantian tema Forest dan ID→EN mempertahankan revisi 7.

Ditemukan dan diperbaiki saat menjalankan browser: kurung JSX penutup yang hilang pada label draf kasir; minimum pecahan yang berbenturan dengan step bilangan bulat pada formulir barang; toolbar tujuh peran yang menyebabkan lebar dokumen 585 px pada viewport 390 px. Toolbar bersama kini memberi baris terpisah yang membungkus jika jumlah peran minimal lima pada lebar ≤1200 px. Layout family dengan kurang dari lima view tidak ditargetkan aturan ini; regresi browser family lain belum dijalankan.

Setelah perbaikan: runner satu proses `node --max-old-space-size=64 --experimental-transform-types templates/operations/tests/run.mjs` lulus 76/76 (suite terbaru sudah memuat perubahan lain sejak checkpoint 69); `node --max-old-space-size=64 scripts/check-design-tokens.mjs --summary` menghasilkan 0 temuan; `git diff --check` lulus. Artifak sesi: `/home/codespace/.t3/scratch/operations-review-2026-11-10/` berisi manifest, galeri dan 29 PNG/ZIP.

Ini smoke test browser dan satu alur transaksi nyata lokal, bukan kelulusan AT01–40. Retur/refund, seluruh varian opname, impor, konflik jaringan/konkurensi, akses lintas usaha, backup R2/restore produksi, reduced-motion dan semua kombinasi tema/mode/peran belum diuji menyeluruh. Family tetap planned dan belum dideploy.

## CLI level selection — 2026-11-10

Working-tree follow-up to `2d68107`: Operations wizard now offers `inventory` (Stok saja, default), `retail` (Stok + harga + kasir) and the existing `full` level. Preset/theme remain independent. Registry and manifest defaults match; demo default remains full. No availability or public catalog promotion.

- `pnpm test:cli`: 35 passed, including generated configurations for the default and all three levels, empty demo balances/prices, project metadata and the public planned-family gate.
- Interactive PTY dry-run with an available-only test fixture: selecting option 2 and the default theme produced `operations / food / retail`; no Cafe theme or unsupported WhatsApp prompt appeared.
- `node scripts/check-docs-consistency.mjs`: passed.
- `pnpm catalog:test`: 5 passed.
- `git diff --check`: passed.
- `pnpm test:registry`: 19 passed; registry schema suite blocked by missing local `ajv` dependency.
- No runtime UI or domain logic changed. Browser/build/standalone release gates for the complete PR remain outstanding; this follow-up does not make the draft ready for review or Operations publicly available.
