# Cadangan terjadwal dan pemulihan

Implementasi ini belum dijalankan di Cloudflare atau diuji melalui latihan pemulihan layanan. Tes lokal memakai SQLite dan bucket pengganti. Family tetap `planned`.

## Mengaktifkan pada instalasi nyata

Konfigurasi bawaan `wrangler.jsonc` berisi `BACKUP_ENABLED="false"` dan daftar cron kosong. Demo tidak dapat menjalankan cadangan terjadwal. Generator client menghapus binding R2, konfigurasi environment, vars sumber dan jadwal cron yang diwariskan; setiap instalasi harus menyiapkan kebijakannya sendiri. Untuk instalasi nyata yang sudah diinisialisasi:

1. Siapkan bucket R2 privat khusus instalasi, lalu tambahkan binding `BACKUPS` pada `r2_buckets` di konfigurasi Worker client. Jangan aktifkan akses publik pada bucket.
2. Provision `BACKUP_SECRET` sebagai secret acak minimal 32 karakter. Simpan salinan secret secara aman di luar aplikasi; secret ini diperlukan untuk memverifikasi cadangan saat pemulihan. Jangan memasukkannya ke `vars` atau konfigurasi frontend.
3. Tetapkan `BACKUP_RETENTION_DAYS` (bilangan bulat 1–3650) dan `BACKUP_CLEANUP_LIMIT` (1–100 objek per percobaan), lalu `BACKUP_ENABLED="true"`. Nilai kebijakan yang hilang atau tidak sah menggagalkan proses tanpa menghapus cadangan.
4. Isi `triggers.crons` dengan jadwal UTC yang disepakati, misalnya `"*/10 * * * *"`. Deploy melalui proses instalasi client setelah verifikasi runtime. Tidak ada resource atau jadwal cloud yang dibuat oleh pekerjaan implementasi ini.
5. Masuk sebagai pengelola, buka alat data dan pilih **Periksa status**. Periksa waktu percobaan, waktu salinan terverifikasi, revisi, dan kegagalan. Konfigurasi aktif saja tidak membuktikan cron berhasil berjalan. Pantau status dan kegagalan Worker secara operasional.

Penjadwal merutekan hanya ke instalasi nyata dari konfigurasi server. RPC internal `scheduledBackup()` tidak tersedia sebagai tindakan API. Snapshot dan jurnal command ditangkap bersama dalam transaksi SQLite; sesi dan kredensial tidak disertakan. Envelope JSON ditandatangani HMAC, ditulis ke R2, dibaca kembali, lalu diperiksa tanda tangan dan kesamaan isinya sebelum status berhasil disimpan.

## Batas dan retensi

Envelope maksimal 10 MiB agar sesuai dengan batas unggah pemulihan, dan jurnal maksimal 10.000 command. Jika batas terlampaui, proses gagal dengan `BACKUP_TOO_LARGE`, tanpa memangkas cadangan lama. Ini batas implementasi, bukan kebijakan pengarsipan: jangan menghapus jurnal atau bukti transaksi untuk menghindarinya. Rencanakan pengembangan penyimpanan/pemulihan sebelum mencapai batas tersebut.

Objek berada di `operations-backups/v1/<businessId>/<preset>/`. Pembersihan hanya memeriksa satu halaman terbatas per percobaan, meneruskan cursor pada percobaan berikutnya. Hanya berkas dengan pola nama penulis cadangan dan waktu unggah lebih lama dari retensi yang dapat dihapus. Salinan berhasil terbaru dan salinan berhasil sebelumnya dilindungi pada percobaan itu; prefix lain dan berkas manual tidak disentuh. Retensi bukan jaminan penghapusan tepat pada hari batas.

Pembersihan dimulai setelah verifikasi salinan baru. Kegagalan tulis/baca mempertahankan metadata keberhasilan sebelumnya; kegagalan pembersihan mempertahankan metadata salinan baru yang telah terverifikasi. Status gagal perlu ditindaklanjuti meskipun waktu cadangan berhasil masih tersedia. Penandatanganan menjamin pemeriksaan integritas, bukan enkripsi isi cadangan.

## Latihan pemulihan

1. Unduh envelope JSON dari bucket privat melalui akses operator berizin, atau gunakan unduhan cadangan manual khusus pengelola. Pertahankan envelope dan tanda tangan asli; jangan mengedit isi.
2. Siapkan instalasi nyata kosong terpisah dengan identitas usaha dan preset yang sama, secret penandatanganan yang cocok, serta autentikasi yang diprovision. Jangan mengarahkan latihan ke instalasi aktif.
3. Masuk ulang sebagai pengelola dan gunakan unggah cadangan pada alat data dalam 15 menit. Sesi biasa berlaku 12 jam, tetapi restore memerlukan autentikasi baru; lewat batas ini, keluar dan masuk kembali. Server memeriksa tanda tangan, identitas, integritas stok/uang dan jurnal sebelum menulis secara atomik. Instalasi yang sudah memiliki dokumen, mutasi, atau penjualan menolak pemulihan.
4. Setelah berhasil, masuk ulang; seluruh sesi telah dibatalkan. Rekonsiliasi saldo per lokasi/SKU, kiriman, penjualan, pembayaran/refund dan sif, lalu uji pengulangan command agar tidak menggandakan transaksi.
5. Catat waktu snapshot, kehilangan data aktual, waktu pemulihan, hasil rekonsiliasi, versi aplikasi dan bukti. Hanya latihan ini pada runtime tujuan yang dapat membuktikan RPO/RTO; tes fixture dan label salinan terverifikasi tidak cukup.

Cadangan manual memakai format dan batas yang sama. Ukuran proyeksi dan jurnal diperiksa sebelum materialisasi jurnal; envelope bertanda tangan diperiksa kembali terhadap batas 10 MiB sebelum respons unduhan. Ukuran proyeksi yang dimuat untuk autentikasi permintaan masih mengikuti penyimpanan state menyeluruh. Cadangan terjadwal mencatat kegagalan batas pada status pengelola; kegagalan unduhan manual ditampilkan langsung. Jangan menghapus riwayat transaksi untuk mengecilkan cadangan.
