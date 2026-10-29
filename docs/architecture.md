# Keputusan arsitektur

## Monorepo untuk produksi internal

Repo ini menyimpan template yang dipakai tim. Setiap hasil CLI adalah proyek klien mandiri. Registry bukan database pelanggan, showcase bukan aplikasi tenant, dan paket bersama tidak menyimpan aturan order cafe atau commerce.

`pnpm-workspace.yaml` memetakan aplikasi, paket, dan template. Turbo menjalankan build/typecheck/test menurut dependensi. Cafe mempertahankan Next.js dan runtime demo browser yang sudah ada. Commerce memakai React/Vite, Worker, dan D1. Setiap template boleh memilih stack yang memenuhi kebutuhannya; CLI tidak mensyaratkan semuanya memakai router yang sama.

## Batas paket

UI core memuat perilaku dasar yang sama: field, tombol, dialog aksesibel, dan motion dengan reduced-motion. Theme engine hanya memberi pilihan tampilan dan token brand. Registry menyimpan katalog template/preset serta status rilis. Shared utils memuat fungsi tampilan kecil. Config memuat aturan TypeScript.

Kebenaran transaksi berada di server template. Harga integer rupiah, reservasi stok, peran staf, idempotensi, transisi status, webhook, dan audit bukan tanggung jawab komponen UI.

## Pembuatan proyek

CLI memvalidasi pilihan sebelum menulis. Proyek disusun dalam folder sementara di folder induk yang sama, lalu dipindah setelah selesai. CLI menolak target yang sudah ada dan membersihkan folder sementaranya saat gagal. Symlink source, rahasia, database lokal, dan output build tidak disalin.

Commerce menyalin paket bersama ke `packages/` proyek dan mengganti dependensi workspace menjadi `file:`. Tidak ada koneksi tersembunyi ke monorepo setelah proyek dibuat. Cafe tetap memakai generator lama agar kompatibilitas preset serta filter source tetap terjaga.

## Pembayaran dan data demo

Satu demo commerce memiliki ruang data server per sesi pengunjung. Pengunjung dapat mencoba pembeli dan staf dalam ruangnya sendiri. Demo tidak memproses uang nyata. Produksi mematikan demo, memakai database sendiri, mewajibkan rahasia staf, dan mengaktifkan gateway hanya bila kunci provider ada.

Tingkat fitur commerce adalah batas server. Konfigurasi visual tidak mengubah tingkat fitur. Pergantian preset hanya mengganti komposisi, warna contoh, dan varian komponen.

## Batas rilis pertama

Commerce melayani satu bisnis pemilik toko. Perbandingan dengan marketplace dipakai untuk kelengkapan alur pembeli/staf, bukan untuk mengklaim adanya multi-seller, escrow, pencairan komisi, atau integrasi kurir yang belum dibuat. Sistem mendukung pengiriman berbasis tarif yang diatur dan pencatatan resi; integrasi tarif atau pelacakan kurir perlu adaptor terpisah.

Dashboard, school, dan booking mempunyai manifest rencana. CLI menolak membuatnya sampai implementasi serta tes tersedia.
