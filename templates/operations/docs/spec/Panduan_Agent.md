# Panduan Agent Implementasi Sistem Operasional Multilokasi

## Tugas

Bangun template aplikasi operasional untuk usaha dengan beberapa gudang dan outlet. Template harus menghubungkan pencatatan stok, pengiriman, penerimaan, penjualan kasir, pembayaran, harga dan promosi, laporan, serta hak akses. Gunakan spesifikasi dalam paket ini sebagai acuan kebutuhan dan hasil yang harus dibuktikan.

Kerjakan sistem sampai alur antarpengguna berfungsi. Hasil pekerjaan harus mencakup aturan usaha, penyimpanan transaksi yang tetap ada, antarmuka tiap peran, konfigurasi untuk penggunaan ulang, data demo, dan bukti uji. Antarmuka contoh tanpa dampak transaksi belum memenuhi tugas.

## Berkas yang perlu dibaca

1. `Spesifikasi_Operasional_Multilokasi.md`, dokumen lengkap dan acuan utama.
2. `Uji_Penerimaan.csv` atau `Uji_Penerimaan.json`, berisi 40 kasus dengan kondisi awal, tindakan, hasil harapan, dan bukti yang perlu dikumpulkan.
3. Folder `diagram/`, berisi gambar SVG yang dapat diedit dan PNG untuk dibaca.
4. Aturan proyek pada repositori tujuan, termasuk `AGENTS.md`, arsitektur yang sudah ada, sistem tampilan, dan cara registrasi template atau demo jika tersedia.

Dokumen formal tidak memilih teknologi. Tentukan cara implementasi berdasarkan repositori dan aturan proyek. Jika repositori merupakan monorepo template Tampiloka, ikuti kontrak katalog, CLI, preset, demo, komponen bersama, serta dokumentasinya yang benar-benar ada setelah diperiksa. Jangan mengasumsikan nama folder atau kontrak dari ingatan.

## Kontrak inti

**Stok ialah hasil catatan perubahan.** Setiap pengesahan menghasilkan peristiwa dan mutasi yang dapat ditelusuri ke dokumen asal. Koreksi menambah catatan tertaut; jangan menghapus riwayat transaksi yang sudah sah.

**Penerimaan merupakan penambahan.** Saldo -5 ditambah penerimaan 200 menghasilkan 195. Form meminta jumlah yang datang, bukan saldo akhir. Jika fisik tersisa 195 karena 5 telah terjual, jumlah penerimaan tetap 200 setelah diperiksa berdasarkan bukti; jangan otomatis menyamakan sisa dengan jumlah datang.

**Pengiriman mempunyai jumlah sendiri.** Saat dikirim, asal berkurang dan jumlah belum selesai diterima bertambah. Saat diterima, jumlah itu berkurang dan tujuan bertambah. Bedakan status dalam perjalanan, tiba menunggu konfirmasi, dan selisih. Penanda tiba saja tidak mengubah saldo tujuan.

**Setiap tindakan berlaku sekali.** Klik ulang, respons hilang, atau dua perangkat tidak boleh menggandakan data atau menimpa hasil transaksi lain. Identitas sama dengan isi berbeda harus ditolak. Hak akses dan sisa barang diperiksa ketika tindakan disahkan.

**Opname tidak menimpa saldo kini.** Gunakan batas waktu dan selisih. Bereskan kedatangan relevan sebelum menutup hitungan. Jika penerimaan terlambat sudah tercakup dalam penyesuaian opname, lakukan koreksi tertaut agar barang tidak dihitung dua kali.

**Izin melekat pada peran beserta lokasi.** Kasir di A dan pengelola harga di B tidak berarti kasir di B. Terapkan pemeriksaan pada tindakan dan pembacaan data, termasuk rincian langsung, pencarian, serta ekspor. Owner memiliki semua kemampuan dalam usahanya, dengan audit dan aturan keutuhan yang tetap berlaku.

**Penjualan mempunyai satu titik pengesahan.** Penjualan selesai mengurangi stok sekali. Keranjang tidak mengurangi stok. Pembayaran, stok, kuota voucher, dan rincian penjualan harus konsisten. Bukti uang yang sudah diterima tetap perlu dilacak jika penjualan belum pasti. Jangan menagih ulang hanya karena respons hilang.

**Harga historis tetap.** Simpan rincian harga, satuan, potongan, pajak, biaya, pembulatan, dan aturan yang dipakai saat penjualan. Retur memakai alokasi transaksi asal. Refund uang tanpa barang kembali tidak menambah stok.

## Cara bekerja

Mulai dengan membaca repositori dan menyusun pemetaan KF01 sampai KF38 terhadap bagian yang sudah ada, yang perlu diubah, dan yang perlu dibuat. Pertahankan ID kebutuhan, use case, serta uji agar penyelesaian dapat diperiksa.

Bangun alur kecil yang terhubung lebih dahulu: data induk dan izin; mutasi; kirim; terima; kasir; lalu laporan. Selesaikan aturan yang paling berisiko sebelum memperluas tampilan. Gunakan komponen dan pola UI yang konsisten dengan repositori, dengan perhatian pada jumlah, lokasi aktif, status, serta tindakan utama.

Setelah alur utama benar, lengkapi penerimaan sebagian, barang rusak, kekurangan, kelebihan, koreksi, opname, retur, harga, promo, pajak, biaya, dan sif sesuai P0. Tambahkan impor, ekspor, pemulihan, serta konfigurasi template. Jangan menandai selesai ketika fungsi penting masih berupa contoh data tetap atau tombol tanpa hasil.

Gunakan nilai awal pada Bab 11 untuk demo. Catat asumsi tersebut pada laporan pekerjaan. Jika ada keputusan yang mengubah makna stok, nilai uang, atau akses dan tidak mendapat jawaban dari dokumen, jelaskan masalah beserta pilihan konkret; lanjutkan bagian yang tidak terdampak.

Jangan memperluas lingkup menjadi produksi penuh, pembukuan lengkap, penjualan luring penuh, sambungan pembayaran otomatis, loyalitas, atau penagihan platform tanpa tugas tambahan. P0 sudah menyediakan tempat yang jelas untuk perluasan tersebut.

## Data demo dan pembuktian wajib

Sediakan satu usaha contoh, satu gudang, lima outlet di tiga kota, sekurangnya dua SKU, dan akun tiap peran. Sediakan pula satu akun dengan dua peran pada lokasi berbeda agar pengujian cakupan nyata dapat dijalankan.

Skenario utama harus dapat diulang dari layar pengguna:

1. Gudang mempunyai 1.000 porsi; outlet 0.
2. Kirim 200; gudang 800, belum selesai diterima 200, outlet 0.
3. Kasir menjual 5 sebelum penerimaan; outlet -5.
4. Penerima mengonfirmasi 200; outlet 195, belum selesai diterima 0.
5. Ulangi konfirmasi yang sama; outlet tetap 195.
6. Buka laporan dan telusuri seluruh perubahan sampai dokumen asal.

Jalankan juga transaksi bersamaan, penerimaan sebagian, selisih, opname dengan catatan terlambat, voucher kuota terakhir, perubahan harga, retur parsial, akses lintas lokasi, serta koneksi putus. Ukur kebutuhan mutu dengan kondisi uji yang tertulis. Uji singkat tidak membuktikan ketersediaan satu bulan.

## Syarat selesai

- Seluruh kebutuhan P0 dalam lingkup mempunyai implementasi dan bukti uji yang sesuai.
- Tampilan pengelola, gudang, penerima, kasir, dan pengelola harga memakai data yang sama dan benar-benar terhubung.
- Jumlah stok dan uang cocok; transaksi ganda, perubahan bersamaan, serta koreksi telah diperiksa.
- Pembatasan akses berlaku pada data dan tindakan, termasuk sesi lama setelah hak dicabut.
- Rincian historis, lampiran yang sah, dokumen asal, serta audit tetap dapat dibaca.
- Template dapat memakai identitas dan data usaha lain tanpa menulis ulang aturan inti.
- Data demo terpisah dari data nyata; dokumentasi pemasangan dan panduan petugas tersedia.
- Laporan akhir menyebut fitur selesai, hasil AT01 sampai AT40, hasil ukur mutu, asumsi, batas, dan masalah yang masih ada.

## Bentuk laporan akhir agent

Sampaikan perubahan dan hasil pengguna terlebih dahulu. Sertakan tabel kebutuhan beserta status, hasil skenario utama dengan saldo akhir, hasil uji penerimaan, cara menjalankan demo, serta daftar keputusan yang masih perlu klien sahkan sebelum pilot. Jangan mengklaim target yang belum diukur atau fungsi yang baru berupa rancangan telah selesai.
