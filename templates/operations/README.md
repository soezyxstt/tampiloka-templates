# Operations — planned

Template operasional multilokasi untuk persediaan, kiriman, penerimaan, kasir, opname, retur, sif, dan laporan. Implementasi domain, Worker Durable Object SQLite, workspace bilingual, shared demo toolbar, konfigurasi reusable, dan jalur generator sudah tersedia. Family tetap `planned`: belum tersedia lewat CLI `create` publik dan belum dipublikasikan sebagai demo.

Pilihan independen: preset `food`, `retail`, `supplies`; mode `inventory`, `retail`, `full`; tema `sand`, `forest`, `ink`. Identitas usaha, zona waktu, lokasi, SKU, satuan, dan kebijakan ada di `config/operations.json`. Mata uang saat ini IDR; nilai menggunakan rupiah bulat. Instalasi nyata tidak memakai saldo/harga demo. Ubah konfigurasi sebelum inisialisasi; setelah tersimpan, ubah data melalui perintah terautentikasi.

## Menjalankan di mesin yang memadai

Ikuti setup root: Node 22.18+ dan pnpm 10.28.2, lalu instal lockfile beku. Perintah berikut didokumentasikan, bukan bukti bahwa server/build telah dijalankan pada pekerjaan ini:

- `pnpm dev:operations`: Vite 5177 dan Worker 8788 untuk demo.
- `pnpm --filter @tampiloka/template-operations dev:client`: instalasi nyata lokal; siapkan secret autentikasi menurut [kontrak domain](docs/domain.md).
- `pnpm test:operations`: tes kecil dalam satu proses dengan heap V8 64 MiB; memakai adapter SQLite Node, bukan runtime Cloudflare.
- `pnpm --filter @tampiloka/template-operations typecheck` dan `build`: gerbang verifikasi yang masih harus dilakukan di mesin yang memadai.

Penyimpanan lokal demo dan client terpisah di `.wrangler/state/demo` dan `.wrangler/state/client`. Kredensial server memakai `OPERATIONS_AUTH`; tidak ada kata sandi produksi bawaan. Siapkan `BACKUP_SECRET` terpisah. Jangan memasukkan secret ke konfigurasi frontend. Selector peran hanya untuk demo. Generator client mengunci mode demo agar nonaktif dan menyalin paket bersama sebagai dependensi lokal.

## Cakupan bukti dan pekerjaan tersisa

Runner domain/storage/report/recovery/draf/cadangan: 76 tes lulus pada 10 November 2026 dalam satu proses, heap 64 MiB. Ini membuktikan kasus terarah pada fixture kecil. Uji penerimaan AT01–40 secara menyeluruh, browser, build, typecheck, instalasi standalone, deployment-native runtime/crypto, konkurensi nyata, dan target beban belum diverifikasi. Nama AT pada tes bukan sertifikasi kelulusan penuh.

Penyimpanan masih memakai proyeksi keseluruhan state; indeks/paginasi untuk beban besar belum selesai. Bukti berupa rujukan, belum layanan unggah/pemindaian lampiran. Cadangan terjadwal dan retensi R2 tersedia secara opt-in; konfigurasi default tetap nonaktif. Jadwal cloud dan latihan pemulihan terukur belum diverifikasi. Lihat [panduan cadangan](docs/backup.md). Status alur kerja historis belum direkonstruksi penuh; laporan menandai metadata terkini secara eksplisit. Jangan mempromosikan family atau mengklaim siap produksi sebelum batas ini diselesaikan.

## Panduan

- [Konfigurasi](config/contract.md), [desain](docs/design.md), dan [kontrak UI](docs/ui.md).
- [Panduan petugas](docs/operator-guide.md), [domain/API](docs/domain.md), dan [laporan/CSV](docs/report-contract.md).
- [Pemetaan KF01–38 dan AT01–40](docs/requirements.md), [catatan verifikasi](docs/verification.md), dan [spesifikasi sumber](docs/spec/Spesifikasi_Operasional_Multilokasi.md).

Referensi gambar dalam salinan spesifikasi mengarah ke ZIP sumber. Periksa keputusan V01–V12 sebelum pilot. Deployment dan katalog publik memerlukan bukti tersendiri menurut AGENTS.md; tidak ada deployment atau publikasi pada pekerjaan ini.

## Tingkatan CLI Operations

Generator menyediakan tingkatan berikut, terpisah dari preset usaha dan tema:

- `inventory` — **Stok saja** (default): persediaan multilokasi, pengiriman, penerimaan dan opname; harga dan transaksi kasir dinonaktifkan.
- `retail` — **Stok + harga + kasir**: fitur stok, pengaturan harga, transaksi penjualan dan pembayaran; promosi dan profil pajak tambahan dinonaktifkan.
- `full` — opsi lengkap yang tetap didukung: stok, harga, kasir, promosi dan profil pajak.

Saat Operations tersedia, wizard akan meminta tingkatan dan tema. Untuk otomatisasi, gunakan `--template operations --level inventory` atau `--template operations --level retail`; tanpa `--level` memakai `inventory`. ID level lama tetap berlaku.

Operations masih `planned`; `create` publik tetap ditolak sampai verifikasi standalone dan rilis selesai. Pilihan ini diuji melalui fixture generator internal, bukan bukti ketersediaan CLI publik. Demo tetap memakai mode lengkap secara default agar semua fitur dapat ditinjau.
