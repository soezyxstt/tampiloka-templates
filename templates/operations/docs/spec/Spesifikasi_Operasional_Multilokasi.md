# Spesifikasi dan Rancangan Sistem Operasional Multilokasi

Dokumen acuan pembuatan template untuk Tampiloka

Versi 1.0 · 10 November 2026

Dokumen ini memuat Spesifikasi Kebutuhan Perangkat Lunak (SKPL), Deskripsi Perancangan Perangkat Lunak (DPPL) tingkat logis, dan kriteria penerimaan sistem untuk menghubungkan persediaan gudang, pengiriman, penerimaan outlet, dan penjualan kasir. Pembaca utama ialah pemilik usaha, penanggung jawab operasional, perancang, pengembang, agent implementasi, dan penguji.

Prinsip utama sistem ialah mencatat setiap perubahan persediaan dan menjaga hubungan antardokumen. Penerimaan menambah saldo yang sudah ada. Jika penjualan lebih dulu membuat saldo menjadi -5, penerimaan 200 unit menghasilkan saldo 195. Sistem harus tetap menjelaskan asal setiap angka dan siapa yang mencatatnya.

## Ringkasan isi

1. Kendali dokumen
2. Pendahuluan dan lingkup
3. Aturan bisnis
4. Aktor dan hak akses
5. Spesifikasi kebutuhan perangkat lunak
6. Spesifikasi kasus penggunaan
7. Rancangan proses dan data
8. Rancangan antarmuka
9. Rencana pengujian dan penerimaan
10. Penerapan template dan serah terima
11. Keputusan untuk validasi kebutuhan
12. Rujukan

# 1 Kendali dokumen

## Identitas dan status

| Unsur | Isi |
| --- | --- |
| Kode dokumen | SOM RPL 001 |
| Nama sistem | Sistem Operasional Multilokasi |
| Pemilik rancangan | Tampiloka |
| Versi | 1.0 |
| Tanggal | 10 November 2026 |
| Status | Rancangan acuan untuk validasi kebutuhan dan implementasi template |
| Cakupan | SKPL, DPPL tingkat logis, rencana uji penerimaan, dan panduan serah terima |
| Pihak yang menetapkan kebutuhan usaha | Pemilik usaha bersama penanggung jawab gudang, outlet, dan kasir |
| Persetujuan kebutuhan | Belum dicatat; daftar keputusan terdapat pada Bab 11 |

## Riwayat perubahan

| Versi | Tanggal | Perubahan |
| --- | --- | --- |
| 1.0 | 10 November 2026 | Penyusunan kebutuhan awal, model stok, peran, transaksi komersial, diagram, dan kriteria penerimaan. |

## Aturan pembacaan

Kata **harus** menyatakan kebutuhan yang diuji. Kata **boleh** menyatakan izin melalui kebijakan. Kata **usulan** menandai keputusan yang perlu pemilik usaha validasi sebelum pemakaian nyata. Agent dapat memakai nilai awal usulan untuk template dan demo.

**P0** berarti wajib pada versi awal yang berfungsi. **P1** berarti perluasan di luar syarat penerimaan versi awal. P0 dapat dikerjakan bertahap menurut urutan pada Bab 10.

Kode **K** menandai kebutuhan bisnis; **AB** aturan bisnis; **KF** kebutuhan fungsi; **KM** kebutuhan mutu; **UC** kasus penggunaan; **D** diagram; **UI** layar; **AT** uji penerimaan; dan **V** keputusan yang perlu divalidasi. Kode tetap dipakai saat nama layar atau cara implementasi berubah.

Struktur dokumen mengikuti praktik rekayasa kebutuhan, pemodelan, rancangan, dan pengujian. Rujukan [R1] memberi konteks materi RPL ITB; [R2] notasi UML; [R3] rekayasa kebutuhan. Dokumen ini bukan template resmi ITB dan belum melalui penilaian kepatuhan standar.

**Urutan acuan.** Kebutuhan yang disepakati dan aturan bisnis menjadi acuan utama. Diagram menjelaskan aturan tersebut. Agent harus mencatat dan memperbaiki pertentangan antarbagiannya sebelum menyatakan pekerjaan selesai. Agent tidak boleh mengganti aturan stok demi memudahkan antarmuka.

# 2 Pendahuluan dan lingkup

## Masalah dan tujuan

Pencatatan terpisah di gudang, outlet, dan kasir membuat pemilik usaha sulit mengetahui persediaan, barang yang belum selesai dikirim, serta jumlah yang terjual. Konfirmasi yang terlambat, penghitungan ulang, dan input ganda dapat memperbesar selisih.

Sistem menyediakan catatan bersama untuk kegiatan tersebut. Petugas tetap dapat mencatat sesuai urutan kerja nyata, termasuk menjual barang yang secara fisik sudah tiba sebelum penerimaan dibukukan. Sistem menjaga perhitungan, memberi tahu pengecualian, dan mempertahankan jejak pemeriksaan.

## Kebutuhan bisnis yang berasal dari pengguna

| ID | Kebutuhan |
| --- | --- |
| K01 | Pemilik melihat stok gudang, outlet, pengiriman, dan jumlah terjual dalam satu sistem. |
| K02 | Gudang mencatat barang keluar dan tujuan; outlet mengonfirmasi jumlah yang benar-benar datang. |
| K03 | Penjualan kasir langsung mengurangi stok produk pada lokasi penjualan. |
| K04 | Sistem menerima urutan pencatatan terlambat; saldo -5 ditambah penerimaan 200 harus menjadi 195. |
| K05 | Sistem mengelola harga, diskon, voucher, pajak, dan biaya layanan. |
| K06 | Tampilan dan tindakan mengikuti peran; satu akun dapat memiliki beberapa peran. |
| K07 | Pengelola memiliki seluruh fungsi dalam usahanya; petugas lain bekerja sesuai kewenangan. |
| K08 | Hasil rancangan dapat menjadi template yang dipakai kembali untuk usaha lain. |

## Cakupan versi awal

Versi awal meliputi satu atau beberapa gudang dan outlet, katalog produk, satuan, saldo awal, penerimaan dari luar usaha, transfer internal, penerimaan sebagian, penanganan selisih, stok ditahan, opname, kasir, pencatatan pembayaran, retur, harga dan promosi, pajak dan biaya layanan yang dapat diatur, laporan, pemberitahuan, serta jejak audit.

Setiap instalasi template harus dapat dikonfigurasi untuk usaha yang berbeda. Kepemilikan data menurut usaha tetap jelas. Platform langganan untuk banyak pelanggan, penagihan langganan, dan pendaftaran usaha secara mandiri berada di luar P0.

## Batas perluasan

| Area | Versi awal P0 | Perluasan P1 |
| --- | --- | --- |
| Persediaan | Produk siap jual, satuan dasar dan konversi tetap | Resep, bahan baku, produksi, hasil produksi berubah, nomor seri |
| Pengadaan | Catat penerimaan barang dari luar | Permintaan pembelian, pesanan pemasok, utang pemasok |
| Kasir | Penjualan langsung dan pencatatan pembayaran | Piutang pelanggan, pesanan daring, pengiriman pelanggan |
| Koneksi | Finalisasi saat terhubung; draf dan penanganan hasil belum pasti | Penjualan luring penuh dan penyatuan transaksi setelah tersambung |
| Keuangan | Nilai penjualan, pajak, biaya, pembayaran, refund, kas sif | Buku besar, laporan laba rugi, HPP, penyusutan, laporan pajak resmi |
| Pembayaran | Tunai atau nontunai dengan konfirmasi petugas | Sambungan otomatis ke penyedia pembayaran |
| Ketertelusuran pangan | Kondisi layak jual atau ditahan dan alasan | Batch, kedaluwarsa, FEFO, penarikan batch |
| Pengelolaan pelanggan | Data pelanggan opsional untuk bukti transaksi | Poin, keanggotaan, kampanye pelanggan |

Jika satu kantong cimol di gudang berubah menjadi sejumlah porsi yang tidak tetap, model produk siap jual tidak cukup. Keputusan mengenai satuan dan kebutuhan produksi harus selesai sebelum pilot. Fitur batch dan kedaluwarsa juga dapat menjadi syarat pilot bila usaha membutuhkannya.

## Asumsi awal untuk demo

Demo menggunakan satu usaha, satu gudang pusat, dan lima outlet di tiga kota. Semua lokasi memakai rupiah dan waktu usaha Asia/Jakarta. Angka ini menjadi data contoh, bukan batas tetap sistem. Versi awal memakai satu mata uang per usaha; transaksi antarmata uang berada di luar lingkup.

Barang contoh menggunakan satuan dasar porsi siap jual. Satu penjualan satu porsi mengurangi satu unit stok. Satu pak boleh berisi sepuluh unit hanya bila hubungan tersebut tetap dan disetujui. Demo tidak mengasumsikan berat bahan atau hasil resep.

## Ukuran keberhasilan pilot

Target berikut merupakan usulan untuk pilot selama 14 hari operasional: seluruh transfer mempunyai status yang jelas; setiap selisih mempunyai penanggung jawab; tidak ada perubahan stok tanpa dokumen asal; semua penjualan yang selesai masuk laporan; dan pengulangan kirim data tidak menambah transaksi. Persentase selisih fisik tidak ditetapkan sebelum usaha mempunyai hasil hitung awal yang dapat dipercaya.

Pemilik menilai kegunaan sistem melalui waktu rekap harian, jumlah selisih tanpa penjelasan, umur konfirmasi yang tertunda, dan jumlah input ulang. Ukur keadaan awal dengan proses yang sedang dipakai agar hasil pilot dapat dibandingkan.

## Istilah

| Istilah | Makna dalam dokumen |
| --- | --- |
| Usaha | Pemilik kumpulan lokasi, produk, akun, dan transaksi. |
| Lokasi | Gudang atau outlet yang mempunyai saldo persediaan sendiri. |
| SKU | Identitas satu jenis atau varian barang yang stoknya dihitung terpisah. |
| Mutasi stok | Catatan penambahan atau pengurangan jumlah untuk SKU dan penampung stok tertentu. |
| Stok layak jual | Saldo tercatat yang boleh dipakai untuk penjualan; dapat negatif bila kebijakan mengizinkan. |
| Stok ditahan | Barang yang sudah diakui berada di lokasi tetapi belum boleh dijual. |
| Belum selesai diterima | Jumlah yang sudah dikirim tetapi belum diterima atau diselesaikan dengan tindakan sah. |
| Waktu kejadian | Saat kegiatan nyata berlangsung, sesuai informasi petugas. |
| Waktu pencatatan | Saat sistem mengesahkan catatan; pengguna tidak dapat mengubahnya. |
| Pembukuan | Pengesahan dampak stok atau transaksi ke catatan bersama. |
| Opname | Penghitungan fisik untuk membandingkan stok dengan saldo pada batas waktu tertentu. |
| Pembalikan | Catatan baru yang menetralkan dampak catatan lama tanpa menghapus riwayat. |
| Refund | Pengembalian uang; tidak dengan sendirinya berarti barang kembali. |
| Sif kasir | Periode kerja kasir dengan catatan kas awal, penerimaan, pengeluaran sah, dan kas akhir. |

![D01 Konteks sistem](diagram/D01_Konteks.png)

D01 menunjukkan pihak yang berinteraksi dengan sistem. Pelanggan dan pemasok memberi barang, uang, atau bukti kepada petugas; keduanya tidak perlu mempunyai akun pada versi awal. Sambungan otomatis ke penyedia pembayaran merupakan perluasan.

# 3 Aturan bisnis

## Persediaan dan sumber angka

**AB01 Identitas stok.** Setiap saldo terkait dengan usaha, lokasi atau pengiriman, SKU, satuan dasar, dan kondisi barang. Varian yang tidak dapat saling menggantikan harus mempunyai SKU berbeda. Sistem tidak menjumlahkan SKU berlainan seolah setara tanpa satuan pembanding yang jelas.

**AB02 Saldo berasal dari perubahan.** Saldo kini ialah jumlah seluruh mutasi yang telah dibukukan, dihitung dari basis nol. Saldo pembukaan juga merupakan mutasi, sehingga tidak ditambahkan untuk kedua kali. Setiap mutasi menyimpan jumlah bertanda, satuan, dokumen dan baris asal, pelaku, waktu kejadian, waktu pencatatan, alasan, serta hubungan koreksi bila ada. Catatan yang telah dibukukan tidak boleh dihapus atau diganti diam-diam.

**AB03 Penerimaan menambah saldo.** Petugas memasukkan jumlah yang datang pada penerimaan ini. Sistem menambahkannya ke saldo saat transaksi disahkan. Sistem tidak memperlakukan angka tersebut sebagai saldo akhir. Penjualan yang terjadi lebih awal tetap mengurangi stok.

**AB04 Jenis persediaan.** Sistem membedakan stok layak jual, stok ditahan, dan jumlah belum selesai diterima per pengiriman. Jumlah ditahan dan jumlah belum selesai diterima tidak boleh negatif. Versi awal tidak menyediakan reservasi stok untuk pesanan; stok layak jual menjadi jumlah tercatat yang dapat dijual menurut kebijakan minus.

**AB05 Draf tidak mengubah stok.** Draf pengiriman, keranjang kasir, rencana penerimaan, dan draf opname tidak menambah atau mengurangi saldo. Membuat draf transfer tidak menjamin barang tersedia saat pengiriman disahkan.

**AB06 Transfer berpasangan.** Saat barang keluar disahkan, sistem mengurangi lokasi asal dan menambah jumlah belum selesai diterima pada pengiriman yang sama. Saat penerimaan disahkan, sistem mengurangi jumlah tersebut dan menambah stok tujuan menurut kondisinya. Semua dampak satu tindakan harus berhasil bersama.

**AB07 Keseimbangan pengiriman.** Untuk setiap baris SKU, jumlah dikirim setelah koreksi sah harus sama dengan jumlah diterima layak jual, diterima ditahan, kembali ke asal, kehilangan yang disahkan, dan sisa belum selesai. Semua komponen memakai satuan dasar dan tidak negatif. Transfer internal tidak mengubah jumlah stok total milik usaha.

**AB08 Kedatangan dan penerimaan berbeda.** Petugas boleh memberi tanda sudah tiba tanpa membukukan jumlah. Ringkasan membedakan dalam perjalanan, tiba menunggu konfirmasi, dan selisih belum selesai. Barang yang tiba tetapi belum dibukukan tetap berada dalam kelompok belum selesai diterima; stok tujuan baru bertambah ketika penerimaan dibukukan.

**AB09 Stok minus terkendali.** Kebijakan berlaku per lokasi dan jenis tindakan. Usulan awal: penjualan outlet boleh membuat stok layak jual negatif dengan peringatan; pengiriman keluar gudang ditolak jika stok kurang kecuali kewenangan pengecualian mengizinkan. Izin menjual saat minus tidak otomatis mengizinkan pengiriman, stok ditahan negatif, atau penerimaan melebihi kiriman. Setiap saldo minus masuk daftar pengecualian sampai terselesaikan.

**AB10 Satuan tetap.** Sistem mengubah satuan transaksi ke satuan dasar dengan faktor yang disimpan pada transaksi. Faktor harus positif. Barang hitungan tidak boleh mempunyai pecahan yang tidak sah. Perubahan faktor untuk transaksi baru tidak mengubah riwayat. Produk tanpa pemetaan satuan yang sah tidak boleh difinalisasi.

## Contoh wajib untuk stok terlambat

| Kejadian | Gudang | Belum selesai diterima | Outlet layak jual | Total tercatat |
| --- | ---: | ---: | ---: | ---: |
| Saldo awal | 1.000 | 0 | 0 | 1.000 |
| Kirim 200 | 800 | 200 | 0 | 1.000 |
| Terjual 5 sebelum konfirmasi | 800 | 200 | -5 | 995 |
| Konfirmasi penerimaan 200 | 800 | 0 | 195 | 995 |

Total tercatat mencakup lokasi, stok ditahan bila ada, dan jumlah belum selesai diterima. Angka tersebut menjelaskan catatan sistem, bukan jaminan jumlah fisik terkini pada setiap lokasi. Sistem harus menampilkan adanya pencatatan yang tertunda.

Jika petugas menemukan sisa fisik 195 setelah lima unit terjual, petugas tetap menerima **200 unit yang datang**. Mengisi penerimaan 195 akan menghasilkan saldo 190 dan salah menghitung barang. Layar menerima barang harus memakai label yang tegas dan menunjukkan penjualan sejak waktu tiba sebagai bahan pemeriksaan. Sistem tidak boleh otomatis menambah lima unit berdasarkan perkiraan.

## Penerimaan sebagian dan selisih

**AB11 Penerimaan bertahap.** Satu pengiriman boleh mempunyai beberapa penerimaan. Sistem memvalidasi jumlah tiap penerimaan terhadap sisa yang belum selesai pada saat pengesahan. Dua petugas tidak boleh menerima jumlah yang sama dua kali. Setiap penerimaan mempunyai nomor dan identitas tindakan sendiri.

**AB12 Kekurangan.** Barang yang belum ditemukan tetap menjadi sisa pengiriman berstatus selisih sampai ada penerimaan lanjutan, pengembalian, atau keputusan kehilangan. Petugas tidak boleh menutup pengiriman hanya dengan menyembunyikan sisa. Penutupan memerlukan sisa nol dan seluruh selisih selesai.

**AB13 Kerusakan.** Barang rusak yang benar-benar tiba masuk stok ditahan di tujuan dan keluar dari jumlah belum selesai diterima. Pemeriksaan berikutnya dapat meloloskan barang ke stok layak jual, mengembalikannya melalui transfer baru, atau memusnahkannya dengan alasan dan kewenangan yang sah. Barang yang sama tidak boleh dicatat rusak sekaligus hilang.

**AB14 Kelebihan.** Jika pengiriman mencatat 200 tetapi penerima menemukan 205, sistem menyimpan temuan tambahan lima unit tanpa membuat sisa pengiriman negatif. Petugas berwenang menyelidiki asalnya. Jika gudang memang mengirim 205, catat tambahan pengiriman lima unit yang mengurangi gudang sebelum menerima tambahan tersebut. Barang temuan belum menjadi stok yang dapat dijual sampai asal dan dokumennya sah.

**AB15 Pembatalan dan pengembalian transfer.** Draf boleh dibatalkan tanpa dampak stok. Setelah barang keluar, pembatalan administratif tidak mengembalikan stok ke asal. Barang yang masih dalam pengiriman baru menambah asal ketika petugas asal mengonfirmasi barang kembali. Barang yang sudah diterima tujuan menggunakan transfer balik baru. Koreksi kesalahan catat mempertahankan rujukan ke catatan awal dan memeriksa dampak lanjutan.

## Ketepatan pencatatan dan koreksi

**AB16 Satu tindakan satu hasil.** Setiap pengesahan mempunyai identitas tindakan tetap. Pengulangan dengan identitas dan isi sama mengembalikan hasil sebelumnya. Identitas sama dengan isi berbeda harus ditolak. Koreksi atau tindakan bisnis baru memakai identitas baru dan hubungan ke dokumen yang dikoreksi.

**AB17 Perubahan bersamaan.** Sistem menghitung ulang kewenangan, sisa kiriman, kuota voucher, dan kebijakan stok ketika mengesahkan tindakan. Dua kasir masing-masing menjual satu unit harus mengurangi dua unit, meskipun kedua layar sempat melihat saldo yang sama. Dalam kebijakan tanpa stok minus, hanya transaksi yang masih memenuhi saldo boleh selesai.

**AB18 Waktu dan periode.** Sistem menyimpan waktu kejadian serta waktu pencatatan. Laporan saldo historis baku memakai waktu pencatatan agar menunjukkan angka yang diketahui sistem saat itu. Analisis menurut waktu kejadian diberi label terpisah dan menandai catatan terlambat. Laporan atau sif yang telah ditutup tidak berubah diam-diam; koreksi tercatat pada periode terbuka dengan rujukan asal.

**AB19 Opname dengan batas waktu.** Sesi opname mencatat lokasi, SKU, kondisi, waktu batas, saldo tercatat pada batas, hasil fisik, dan transaksi sesudahnya. Selisih yang sah ialah hasil fisik pada batas dikurangi saldo pada batas. Sistem menerapkan selisih itu ke saldo kini, bukan mengganti saldo kini dengan angka hitung lama. Usulan P0: petugas menghentikan gerak barang untuk SKU yang sedang dihitung sampai angka hitung direkam; persetujuan boleh menyusul.

**AB20 Kedatangan tertunda saat opname.** Petugas harus menyelesaikan atau menjelaskan seluruh kedatangan yang masuk hitungan sebelum menutup opname. Sistem menolak penutupan jika ada pengiriman terkait yang tiba tetapi belum dibukukan. Jika kejadian lama baru diketahui setelah opname ditutup, petugas membuat koreksi tertaut yang menetralkan bagian penyesuaian opname yang sudah memuat barang tersebut, lalu membukukan dokumen yang benar. Proses harus disahkan bersama atau tidak sama sekali.

Contoh: saldo -5, fisik 195, dan penerimaan 200 belum dibukukan. Sistem tidak boleh membuat penyesuaian +200 lalu menerima +200 lagi. Jika salah penyesuaian sudah terlanjur sah, koreksi -200 terhadap penyesuaian dan penerimaan +200 harus memberi dampak bersih nol pada saldo kini, sambil memperbaiki asal catatan.

**AB21 Koreksi terukur.** Penyesuaian, pembalikan, kehilangan, pemusnahan, dan perubahan tanggal kejadian harus mempunyai alasan. Sistem menyimpan pelaku dan penyetuju jika kebijakan meminta. Pengelola dapat menyetujui pengecualian miliknya dengan alasan khusus; akun biasa tidak boleh menyetujui penyesuaian sendiri. Pembalikan tidak boleh membuat transit atau stok ditahan negatif atau menghapus penjualan yang telah terjadi.

**AB22 Koneksi terputus.** Hasil yang belum mendapat konfirmasi sistem ditampilkan sebagai belum pasti, bukan berhasil atau gagal secara sepihak. Pengguna memeriksa hasil dengan identitas yang sama sebelum mengulangi tindakan. Saat tidak terhubung, versi awal boleh menyimpan draf tetapi tidak boleh mengklaim penjualan telah selesai secara tersinkron. Stok minus tidak berarti sistem mendukung finalisasi luring.

## Harga dan transaksi komersial

**AB23 Harga berlaku.** Setiap SKU mempunyai harga dasar dan dapat mempunyai harga per lokasi dengan rentang berlaku. Untuk satu SKU, lokasi, dan waktu tidak boleh ada dua harga pada tingkat prioritas yang sama. Harga khusus lokasi mengalahkan harga dasar usaha. Keranjang menampilkan perubahan harga atau aturan yang terjadi sebelum finalisasi dan meminta konfirmasi ulang atas total baru.

**AB24 Rincian penjualan tetap.** Penjualan selesai menyimpan nama dan SKU saat transaksi, satuan dan faktor, jumlah, harga, diskon, voucher, dasar pajak, tarif, biaya layanan, pembulatan, total, serta versi aturan yang dipakai. Mengubah katalog atau harga tidak menghitung ulang transaksi lama. Nomor bukti transaksi tidak boleh dipakai ulang.

**AB25 Urutan perhitungan.** Usulan baku: nilai baris bruto; diskon baris; diskon transaksi atau voucher; pembagian diskon transaksi ke baris; biaya layanan; pajak; penjumlahan komponen yang sudah dibulatkan. Setiap profil menyatakan dasar biaya dan pajak, apakah biaya layanan kena pajak, dan apakah pajak sudah termasuk harga barang. Agent tidak boleh memilih urutan baru tanpa mengubah spesifikasi profil.

**AB26 Pembatasan diskon.** Diskon tidak boleh membuat dasar baris atau total barang negatif. Profil menetapkan produk, lokasi, masa berlaku, minimum belanja, batas nilai, prioritas, serta aturan penggabungan. Usulan awal: satu voucher per transaksi; promo otomatis tidak dapat digabung dengan voucher kecuali ditandai boleh. Sistem memilih prioritas tertinggi; bila setara, pilih potongan sah terbesar; bila tetap setara, gunakan identitas aturan dengan urutan terkecil. Sistem menampilkan aturan yang terpilih dan alasan penolakan aturan lain. Jika voucher tidak boleh digabung dengan promo otomatis yang sudah berlaku, sistem menolak voucher dengan alasan dan mempertahankan promo tersebut; sistem tidak mengganti promo secara diam-diam.

**AB27 Kuota voucher.** Pemeriksaan dan pemakaian kuota terjadi bersama finalisasi penjualan. Draf tidak memakai kuota. Dua kasir tidak boleh memakai kuota terakhir untuk dua penjualan. Minimum belanja baku dihitung dari barang yang berhak sesudah diskon baris dan sebelum voucher. Refund tidak otomatis mengembalikan kuota; pengembalian kuota memerlukan kebijakan dan catatan tersendiri. Batas per pelanggan hanya dapat dipakai jika identitas pelanggan yang diminta tersedia.

**AB28 Pajak dan biaya layanan.** Usaha menetapkan nama, tarif atau nilai tetap, lokasi, dasar hitung, masa berlaku, dan perlakuan terhadap diskon atau biaya lain. Contoh dalam dokumen hanya untuk menguji hitungan. Dokumen ini tidak menentukan tarif pajak yang berlaku bagi usaha. Versi awal mendukung satu komponen pajak persentase dan satu biaya layanan per profil transaksi; pajak majemuk merupakan perluasan.

**AB29 Pembulatan.** Nilai rupiah final menggunakan bilangan rupiah utuh. Usulan baku ialah pembulatan setengah ke atas pada diskon yang diterapkan, biaya, dan pajak; hasil komponen yang sudah dibulatkan dijumlahkan ke total. Pembagian diskon transaksi memakai proporsi nilai baris setelah diskon baris; sisa rupiah dibagi menurut pecahan terbesar, lalu urutan baris sebagai pemutus seri. Simpan nilai dasar dan hasil tiap komponen agar total dapat dihitung ulang secara sama.

Untuk profil pajak termasuk harga, sistem menghitung dasar sebelum pajak dengan membagi nilai barang neto inklusif oleh satu ditambah tarif. Bulatkan dasar itu, lalu hitung bagian pajak sebagai selisih nilai inklusif dan dasar yang sudah dibulatkan. Jumlah dasar dan bagian pajak harus tepat sama dengan nilai inklusif; pajak dalam harga tidak ditambahkan lagi ke tagihan.

Usulan P0 menetapkan biaya layanan persentase dari nilai barang neto sebelum pajak, atau nilai tetap yang ditulis pada profil. Biaya layanan selalu menjadi komponen terpisah yang belum termasuk pajak. Jika biaya layanan kena pajak, hitung pajaknya dengan tarif profil dan tambahkan satu kali; jika tidak, jangan menambah pajak biaya. Modus inklusif pada P0 berlaku untuk harga barang. Profil yang tidak menjelaskan dasar atau modus tidak boleh diaktifkan.

### Contoh perhitungan profil eksklusif

| Komponen | Hitungan | Nilai rupiah |
| --- | --- | ---: |
| Barang bruto | 10 porsi x 10.000 | 100.000 |
| Diskon baris | 10 persen dari 100.000 | -10.000 |
| Voucher | Nilai tetap sesudah diskon baris | -5.000 |
| Nilai barang neto | 100.000 - 10.000 - 5.000 | 85.000 |
| Biaya layanan | 5 persen dari barang neto | 4.250 |
| Dasar pajak | Barang neto dan biaya layanan | 89.250 |
| Pajak contoh | 10 persen dari dasar pajak | 8.925 |
| Total tagihan | 85.000 + 4.250 + 8.925 | 98.175 |

Profil contoh secara tegas mengizinkan penggabungan diskon baris dan voucher. Tarif pada contoh dipilih untuk pengujian aritmetika. Untuk contoh inklusif, barang 110.000 yang sudah memuat pajak contoh 10 persen mempunyai dasar 100.000 dan bagian pajak 10.000. Tanpa biaya layanan, total tetap 110.000. Jika profil menambahkan biaya layanan 5 persen dari dasar sebelum pajak dan biaya itu kena pajak, biaya menjadi 5.000, pajak biaya 500, dan total tagihan 115.500. Pajak barang 10.000 tetap menjadi bagian dari 110.000.

## Penjualan dan pengembalian

**AB30 Titik pengurangan stok.** P0 memakai penjualan langsung. Stok berkurang satu kali ketika penjualan berubah menjadi Selesai setelah pembayaran yang mencukupi terkonfirmasi. Pengecualian berlaku untuk tagihan nol yang berasal dari harga nol atau potongan sah: penjualan tetap mengurangi stok dan pembayaran bertanda Tidak diperlukan. Penjualan, catatan pembayaran sah atau penanda tagihan nol, pemakaian voucher, dan mutasi stok harus menjadi satu hasil yang utuh. Keranjang, penawaran, dan pembayaran belum pasti tidak mengurangi stok pada versi awal. Usulan P0 memakai satu metode pembayaran per penjualan; pembayaran gabungan merupakan perluasan.

**AB31 Pembayaran dan barang terpisah.** Status pembayaran tidak boleh menggantikan status barang. Refund uang tidak otomatis menambah stok. Retur barang baru menambah stok ketika petugas mengonfirmasi jumlah dan kondisi barang yang kembali. Usulan P0 menerima retur pelanggan di outlet penjualan asal; retur lintas outlet merupakan perluasan dengan aturan alokasi yang jelas.

**AB32 Retur parsial.** Jumlah kumulatif yang diretur tidak boleh melebihi jumlah yang terjual setelah memperhitungkan retur sebelumnya. Nilai refund memakai alokasi harga, diskon, pajak, dan biaya transaksi asli. Sisa pembulatan dikembalikan pada retur terakhir yang menutup baris. Barang baik menambah stok layak jual; barang rusak menambah stok ditahan; refund tanpa barang tidak mengubah stok.

**AB33 Pembatalan.** Draf penjualan boleh dibatalkan tanpa dampak stok. Penjualan selesai memakai dokumen pembalikan atau retur dan refund, sesuai apa yang benar-benar terjadi. Sistem tidak menyediakan penghapusan transaksi selesai. Pembatalan entri salah tanpa barang keluar harus menyimpan alasan dan persetujuan; pengembalian uang yang sebenarnya tetap dicatat.

**AB34 Sif dan kas.** Sif mencatat kas awal, penerimaan tunai bersih dari kembalian, refund tunai, masuk atau keluar kas dengan alasan, serta kas akhir yang dihitung. Penjualan nontunai tidak menambah kas laci. Penutupan menampilkan selisih; selisih kas tidak membuat penyesuaian stok. Sif tertutup mempertahankan laporan awal dan menampilkan koreksi terkait secara terpisah.

# 4 Aktor dan hak akses

## Peran bawaan

| Peran | Tanggung jawab | Cakupan baku |
| --- | --- | --- |
| Pengelola | Mengatur usaha, akses, kebijakan, persetujuan, dan seluruh operasi | Seluruh lokasi dalam usaha sendiri |
| Petugas persediaan | Mencatat barang masuk, pengiriman, hitung fisik, dan usulan koreksi | Lokasi asal atau gudang yang ditugaskan |
| Penerima outlet | Menandai tiba, memeriksa jumlah, menerima barang, dan melaporkan selisih | Lokasi tujuan yang ditugaskan |
| Kasir | Membuka sif, menjual, mencatat pembayaran, dan mengajukan retur | Outlet yang ditugaskan |
| Pengelola harga | Mengatur harga, diskon, voucher, pajak, dan biaya layanan | Lokasi yang ditugaskan atau usaha sesuai penugasan |
| Pemeriksa | Melihat laporan dan audit tanpa mengubah transaksi | Lokasi yang ditugaskan; opsional untuk tim kecil |

Satu orang dapat memegang beberapa peran. Petugas persediaan di gudang juga dapat menjadi penerima di outlet tertentu jika mendapat dua penugasan. Peran menyatakan kelompok kewenangan, bukan jabatan tetap perusahaan.

## Aturan penggabungan peran

Setiap penugasan menyatukan **akun, peran, dan cakupan lokasi**. Hak efektif merupakan gabungan penugasan yang sah pada lokasi tindakan. Sistem tidak boleh menggabungkan seluruh peran dengan seluruh lokasi secara silang.

Contoh: akun mempunyai peran Kasir di Outlet A dan Pengelola Harga di Outlet B. Akun tersebut boleh menjual di A dan mengatur harga di B. Ia tidak boleh otomatis menjual di B atau mengubah harga di A. Cakupan berlaku juga pada pencarian, rincian dokumen, ekspor, dan laporan.

Perubahan harga dasar atau profil bersama memerlukan cakupan usaha atau kewenangan pada seluruh lokasi yang terdampak. Pengelola harga yang hanya ditugaskan di B dapat membuat aturan khusus B, tetapi tidak boleh mengubah aturan bersama yang turut mengubah harga A.

Pengelola memiliki seluruh kemampuan dalam usahanya, tetapi tetap tunduk pada jejak audit, larangan menghapus transaksi sah, dan aturan keseimbangan stok. Jika satu akun menjadi anggota lebih dari satu usaha, sistem meminta konteks usaha aktif dan tidak mencampur data. Pengelola suatu usaha tidak memiliki hak atas usaha lain.

## Matriks kewenangan

Tanda **Ya** berarti boleh pada cakupan penugasan. **Usul** berarti dapat membuat usulan, tetapi perlu pihak berwenang mengesahkan. Hak yang tidak tercantum ditolak.

| Tindakan | Pengelola | Persediaan | Penerima | Kasir | Harga | Pemeriksa |
| --- | --- | --- | --- | --- | --- | --- |
| Kelola akun dan penugasan | Ya | Tidak | Tidak | Tidak | Tidak | Tidak |
| Kelola lokasi dan SKU | Ya | Usul | Tidak | Tidak | Tidak | Tidak |
| Lihat stok sesuai lokasi | Ya | Ya | Ya | Ya | Ya | Ya |
| Catat penerimaan eksternal | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Buat dan sahkan pengiriman asal | Ya | Ya | Tidak | Tidak | Tidak | Tidak |
| Konfirmasi penerimaan tujuan | Ya | Peran penerima | Ya | Tidak | Tidak | Tidak |
| Hitung fisik atau usul koreksi | Ya | Ya | Ya | Tidak | Tidak | Tidak |
| Sahkan kehilangan dan koreksi | Ya | Tidak | Tidak | Tidak | Tidak | Tidak |
| Jual dan catat pembayaran | Ya | Tidak | Tidak | Ya | Tidak | Tidak |
| Ajukan retur dan refund | Ya | Tidak | Tidak | Ya | Tidak | Tidak |
| Sahkan retur dan refund | Ya | Tidak | Tidak | Tidak | Tidak | Tidak |
| Ubah harga dan aturan komersial | Ya | Tidak | Tidak | Tidak | Ya | Tidak |
| Ekspor laporan operasional | Ya | Ya | Ya | Sif sendiri | Sesuai kebutuhan harga | Ya |
| Lihat jejak audit usaha | Ya | Dokumen sendiri | Dokumen sendiri | Dokumen sendiri | Aturan sendiri | Ya |

Untuk template tim kecil, pengelola dapat memberi kewenangan tambahan terpilih melalui peran yang sudah diatur. Pemberian kewenangan tidak boleh memperluas cakupan lokasi secara diam-diam. Sistem harus mempertahankan setidaknya satu pengelola aktif dan mencatat setiap perubahan penugasan.

![D02 Use case persediaan](diagram/D02_UseCase_Persediaan.png)

D02 memisahkan pengiriman dan penerimaan sebagai tujuan kerja yang berdiri sendiri. Penerimaan tidak menjadi langkah wajib yang dijalankan pada saat pengiriman. Hubungan include dipakai untuk pemeriksaan yang selalu berlangsung di dalam pengesahan terkait.

![D03 Use case kasir dan pengelolaan](diagram/D03_UseCase_Kasir.png)

D03 menampilkan hubungan peran dengan kasir, harga, akses, dan laporan. Pengelola mempunyai seluruh kewenangan melalui aturan peran pada bab ini; asosiasi yang ditampilkan dalam gambar dipilih untuk menjaga keterbacaan, bukan membatasi hak pengelola.

# 5 Spesifikasi kebutuhan perangkat lunak

## Identitas dan data induk

| ID | Kebutuhan yang harus dipenuhi | Prioritas |
| --- | --- | --- |
| KF01 | Sistem harus mengautentikasi akun, membatasi akses pada usaha aktif, dan menolak akun nonaktif. | P0 |
| KF02 | Pengelola harus dapat memberi beberapa penugasan peran beserta lokasi kepada satu akun dan melihat hak efektifnya. | P0 |
| KF03 | Pengelola harus dapat mengatur lokasi, jenis lokasi, kota, zona waktu usaha, serta status aktif tanpa menghapus riwayat lokasi lama. | P0 |
| KF04 | Sistem harus menyimpan SKU, nama, varian, satuan dasar, konversi tetap, kondisi, serta status aktif; SKU yang pernah dipakai tidak boleh didaur ulang. | P0 |
| KF05 | Sistem harus menerima saldo awal atau penerimaan eksternal berisi asal, bukti, jumlah, satuan, lokasi, kondisi, dan waktu kejadian. | P0 |

## Persediaan dan pengiriman

| ID | Kebutuhan yang harus dipenuhi | Prioritas |
| --- | --- | --- |
| KF06 | Sistem harus menampilkan saldo layak jual, ditahan, dan belum selesai diterima beserta waktu pembaruan dan penanda minus. | P0 |
| KF07 | Petugas berwenang harus dapat membuat draf transfer satu asal, satu tujuan, dan beberapa baris SKU dalam usaha yang sama. | P0 |
| KF08 | Pengesahan barang keluar harus mengurangi asal dan menambah jumlah pengiriman secara utuh, lalu membekukan rincian yang sudah disahkan. | P0 |
| KF09 | Penerima harus dapat menandai waktu tiba tanpa mengubah stok dan melihat daftar kiriman yang menunggu pemeriksaan. | P0 |
| KF10 | Penerima harus dapat menerima sebagian atau seluruh sisa kiriman, memisahkan barang baik dan ditahan, serta menambahkan jumlah ke saldo terkini. | P0 |
| KF11 | Sistem harus mencatat kekurangan, kelebihan, kerusakan, bukti, penanggung jawab, dan keputusan penyelesaian per baris. | P0 |
| KF12 | Sistem harus mendukung barang kembali ke asal, transfer balik, dan kehilangan sah tanpa memakai pembatalan sebagai pengganti gerak barang. | P0 |
| KF13 | Sistem harus menerapkan kebijakan stok minus menurut lokasi dan tindakan serta menampilkan daftar minus yang belum selesai. | P0 |
| KF14 | Sistem harus mencatat sesi opname, batas waktu, saldo pembanding, hitungan fisik, selisih, persetujuan, dan hubungan koreksi. | P0 |
| KF15 | Sistem harus mendukung penyesuaian, pembalikan, pelolosan barang ditahan, dan pemusnahan dengan alasan serta persetujuan yang sesuai. | P0 |
| KF16 | Pengelola harus dapat menelusuri setiap saldo hingga mutasi dan dokumen asal serta melihat riwayat sebelum dan sesudah koreksi. | P0 |
| KF17 | Sistem harus menjaga keseimbangan setiap pengiriman dan menolak penerimaan berlebih, penutupan bersisa, serta stok ditahan atau transit negatif. | P0 |
| KF18 | Sistem harus mengenali pengulangan tindakan, menolak identitas sama dengan isi berbeda, dan mempertahankan hasil saat ada input bersamaan. | P0 |

## Kasir dan ketentuan komersial

| ID | Kebutuhan yang harus dipenuhi | Prioritas |
| --- | --- | --- |
| KF19 | Sistem harus memilih harga menurut SKU, lokasi, waktu, dan prioritas, serta menolak rentang harga setara yang saling bertumpuk. | P0 |
| KF20 | Pengelola harga harus dapat mengatur diskon tetap atau persentase, sasaran, batas nilai, masa berlaku, prioritas, dan penggabungan. | P0 |
| KF21 | Sistem harus mengelola voucher, kuota, syarat, penolakan yang jelas, dan pemakaian kuota tepat satu kali pada penjualan selesai. | P0 |
| KF22 | Sistem harus menyediakan profil pajak dan biaya layanan dengan dasar hitung, modus inklusif atau eksklusif, urutan, serta pembulatan yang jelas. | P0 |
| KF23 | Kasir harus dapat mencari produk, mengubah jumlah, melihat rincian total, dan menyimpan atau membatalkan keranjang tanpa mengubah stok. | P0 |
| KF24 | Finalisasi penjualan harus menyimpan rincian harga tetap, pembayaran sah atau penanda tagihan nol yang sah, kuota terpakai, dan pengurangan stok tepat satu kali. | P0 |
| KF25 | Sistem harus membedakan pembayaran belum dikonfirmasi, perlu diperiksa, terkonfirmasi, gagal, tidak diperlukan untuk tagihan nol, serta ringkasan refund sebagian atau seluruhnya. | P0 |
| KF26 | Sistem harus menerbitkan bukti transaksi bernomor unik yang memuat lokasi, waktu, kasir, baris barang, potongan, biaya, pajak, total, dan pembayaran. | P0 |
| KF27 | Sistem harus mendukung retur parsial atau penuh dan refund tertaut, dengan batas jumlah, kondisi barang, nilai asli, serta persetujuan. | P0 |
| KF28 | Kasir harus dapat membuka dan menutup sif, mencatat gerak kas beralasan, serta membandingkan kas seharusnya dengan kas fisik. | P0 |

## Pemantauan dan operasi template

| ID | Kebutuhan yang harus dipenuhi | Prioritas |
| --- | --- | --- |
| KF29 | Pengelola harus dapat memfilter ringkasan stok dan penjualan menurut lokasi, kota, SKU, status, dan rentang waktu. | P0 |
| KF30 | Sistem harus memberi daftar tindakan untuk penerimaan terlambat, selisih, stok minus, dan permintaan persetujuan; status selesai harus mengikuti data asal. | P0 |
| KF31 | Sistem harus menyediakan laporan mutasi, transfer, penjualan, diskon, pajak, biaya, retur, pembayaran, dan sif dengan ekspor sesuai hak akses. | P0 |
| KF32 | Sistem harus membedakan waktu kejadian dan pencatatan serta memberi label pada laporan historis dan catatan terlambat. | P0 |
| KF33 | Sistem harus mencatat audit masuk akun, perubahan peran, data induk, aturan komersial, persetujuan, transaksi, dan koreksi. | P0 |
| KF34 | Pengguna harus dapat mengetahui status koneksi, data terakhir diperbarui, tindakan tertunda, dan hasil yang belum pasti; percobaan ulang tidak boleh menggandakan data. | P0 |
| KF35 | Template harus dapat mengubah identitas usaha, lokasi, katalog, peran, fitur aktif, dan kebijakan melalui konfigurasi yang jelas tanpa menyalin ulang aturan stok. | P0 |
| KF36 | Sistem harus menyediakan prosedur impor awal dengan pratinjau, validasi, penolakan baris salah, serta identitas impor untuk mencegah saldo awal ganda. | P0 |
| KF37 | Sistem harus menyediakan cadangan, pemulihan, dan rekonsiliasi yang dapat dibuktikan, serta membatasi pengarsipan agar riwayat tetap dapat ditelusuri. | P0 |
| KF38 | Sistem harus menyediakan pencarian dokumen dan rujukan silang dari laporan ke penjualan, kiriman, penerimaan, opname, dan koreksi terkait. | P0 |

## Kebutuhan mutu dan batas antarmuka

Target angka berikut merupakan usulan pengujian awal, bukan janji tingkat layanan yang sudah disepakati. Uji memakai satu usaha, 20 lokasi, 5.000 SKU, 50 pengguna aktif bersamaan, dan 200.000 baris mutasi historis. Beban ini dipilih untuk memeriksa ruang tumbuh template dan tidak menyatakan skala klien yang sudah diketahui.

| ID | Kebutuhan mutu dan cara verifikasi |
| --- | --- |
| KM01 | Seluruh dampak satu pengesahan berhasil bersama atau tidak terjadi. Uji kegagalan di tengah pengiriman dan penjualan harus menunjukkan tidak ada catatan separuh jadi. |
| KM02 | Akses ditolak pada usaha atau lokasi di luar penugasan, termasuk alamat rincian langsung, ekspor, pencarian, dan operasi yang dikirim ulang setelah peran dicabut. |
| KM03 | Pada jaringan uji dengan waktu pulang pergi paling lama 200 milidetik, 95 persen pencarian produk dan pengesahan transaksi lokal selesai paling lama 2 detik; laporan biasa paling lama 5 detik. Ukur di luar layanan pihak ketiga. |
| KM04 | Pada koneksi aktif yang sehat, 95 persen perubahan stok terlihat di sesi lokasi lain paling lama 5 detik setelah pengesahan. Kegagalan pembaruan harus terlihat sebagai data lama, bukan disembunyikan. |
| KM05 | Uji pengulangan 100 kali atas satu tindakan menghasilkan satu dampak; uji 50 penjualan bersamaan tetap mempertahankan jumlah dan kebijakan stok. |
| KM06 | Target ketersediaan usulan 99,5 persen per bulan di luar jendela pemeliharaan yang diumumkan. Metode ukur dan jam operasional harus disepakati sebelum kontrak layanan. |
| KM07 | Target kehilangan data maksimum saat pemulihan 15 menit dan target pemulihan layanan 4 jam. Uji pemulihan harus membuktikan kedua target; jangan menandai lulus hanya karena jadwal cadangan dibuat. |
| KM08 | Layar penerimaan nyaman pada lebar 360 piksel; kasir pada tablet atau layar 768 piksel ke atas; dashboard pada 1.280 piksel. Form dapat dipakai lewat papan ketik, mempunyai label, fokus jelas, dan pesan yang tidak hanya bergantung pada warna. |
| KM09 | Waktu pencatatan dan pelaku tidak dapat diedit pengguna. Audit dapat ditelusuri menurut dokumen dan rentang waktu, dengan akses serta masa simpan yang ditetapkan usaha. |
| KM10 | Angka stok memakai ketelitian satuan yang ditetapkan SKU; uang memakai aturan pembulatan yang sama di layar, bukti, laporan, dan refund. Ekspor harus cocok dengan total layar pada filter dan batas data yang sama. |
| KM11 | Penutupan aplikasi saat kirim data tidak menghilangkan hasil yang sudah disahkan. Saat dibuka lagi, pengguna dapat memeriksa identitas tindakan dan melanjutkan draf yang belum disahkan. |
| KM12 | Template dapat dipasang ulang dengan usaha contoh lain tanpa mencampur transaksi contoh dan data nyata. Pengujian harus membuktikan perubahan merek, lokasi, katalog, dan fitur tidak mengubah aturan hitung inti. |

Data akun, bukti pembayaran, dan lampiran hanya dapat dibaca pihak berwenang. Sistem membatasi jenis dan ukuran berkas, menolak berkas berbahaya, tidak menyimpan rahasia pembayaran di catatan audit, dan menghapus akses akun yang dinonaktifkan pada pengesahan berikutnya. Nilai batas berkas serta masa simpan ditetapkan dalam konfigurasi usaha.

Antarmuka luar P0 berupa layar pengguna, bukti transaksi, dokumen pengiriman, impor data awal, ekspor laporan, dan cadangan yang dapat dipulihkan. Sambungan otomatis ke kasir lama atau penyedia pembayaran harus mempunyai kontrak terpisah mengenai identitas transaksi, pemetaan SKU, waktu, status, dan pengulangan; keberadaannya tidak diasumsikan dalam P0.

# 6 Spesifikasi kasus penggunaan

Seluruh kasus penggunaan memerlukan akun aktif pada usaha dan lokasi yang sah, kecuali proses masuk akun. Pemeriksaan hak berlaku saat membuka data dan saat mengesahkan tindakan. Kegagalan tidak boleh meninggalkan perubahan stok atau uang yang hanya tercatat sebagian.

## UC01 Mengelola akun dan memilih konteks kerja

**Tujuan dan aktor.** Pengelola mengatur akses; setiap pengguna memilih usaha dan lokasi kerja yang sah. **Prasyarat:** usaha aktif dan masih ada pengelola aktif. **Pemicu:** pengguna masuk atau pengelola mengubah penugasan.

**Alur utama:** pengelola memilih akun; menambah atau mencabut pasangan peran dan cakupan; sistem menampilkan hak efektif; pengelola mengesahkan; sistem merekam audit dan menerapkan hak pada tindakan berikutnya. Pengguna yang masuk memilih konteks dari penugasannya.

**Alternatif dan kesalahan:** pengguna boleh memiliki beberapa peran; konteks yang tidak berhak ditolak; menonaktifkan pengelola terakhir ditolak; sesi lama harus mengikuti hak yang baru. **Hasil:** penugasan dan audit tersimpan tanpa mengubah transaksi lama. **Acuan:** KF01, KF02, KF33; D03 dan D12.

## UC02 Menyiapkan lokasi produk dan data awal

**Tujuan dan aktor.** Pengelola menyiapkan lokasi, SKU, satuan, dan data awal. **Prasyarat:** identitas usaha tersedia. **Pemicu:** pemasangan template atau penambahan lokasi dan produk.

**Alur utama:** pengelola memasukkan atau mengimpor data; sistem memeriksa identitas, satuan, konversi, dan duplikasi; pengguna memeriksa pratinjau; sistem menyimpan data sah dan daftar baris yang ditolak. Impor saldo awal memakai dokumen pembukaan yang dapat ditelusuri.

**Alternatif dan kesalahan:** perubahan nama tidak mengubah identitas; penonaktifan mempertahankan riwayat; konversi tidak sah menolak baris terkait; pengulangan impor dengan identitas sama tidak menambah saldo lagi. **Hasil:** data induk dan saldo pembukaan sah tersedia. **Acuan:** AB01, AB10; KF03 sampai KF05, KF36.

## UC03 Mencatat penerimaan dari luar usaha

**Tujuan dan aktor.** Petugas persediaan mencatat barang masuk dari pemasok atau sumber luar. **Prasyarat:** lokasi dan SKU aktif; asal barang dapat dijelaskan. **Pemicu:** barang masuk atau catatan masuk terlambat.

**Alur utama:** petugas memilih jenis penerimaan eksternal; memasukkan asal, bukti, waktu kejadian, jumlah dan kondisi; sistem memvalidasi satuan serta kewenangan; petugas mengesahkan; sistem menambah stok dan menerbitkan dokumen.

**Alternatif dan kesalahan:** barang rusak masuk ditahan; sumber internal harus memakai penerimaan transfer; bukti atau identitas yang menunjukkan duplikasi perlu diperiksa; catatan lama yang tercakup opname mengikuti koreksi tertaut. **Hasil:** stok bertambah satu kali dan sumbernya jelas. **Acuan:** AB02, AB03, AB16, AB20; KF05, KF15, KF18.

## UC04 Menyiapkan dan mengirim barang

**Tujuan dan aktor.** Petugas persediaan mengirim barang dari lokasi tugasnya. **Prasyarat:** asal dan tujuan berbeda, aktif, dan dalam usaha yang sama. **Pemicu:** kebutuhan pemindahan barang.

**Alur utama:** petugas membuat draf berisi tujuan dan baris SKU; memeriksa fisik serta satuan; mengonfirmasi jumlah yang benar-benar keluar; sistem memeriksa saldo dan kebijakan; sistem mengurangi asal, menambah jumlah kiriman, lalu memberi nomor dokumen.

**Alternatif dan kesalahan:** draf boleh dibatalkan; stok kurang mengikuti kebijakan pengiriman; barang yang sudah keluar tidak boleh dibatalkan tanpa pengembalian atau koreksi; perubahan jumlah sesudah pengesahan memakai dokumen koreksi. **Hasil:** pengiriman aktif, saldo asal turun, dan jumlah belum selesai diterima naik dengan nilai yang sama. **Acuan:** AB05 sampai AB09, AB15; KF07, KF08, KF17, KF18; D04 dan D08.

## UC05 Menerima barang di tujuan

**Tujuan dan aktor.** Penerima mengesahkan jumlah yang datang. **Prasyarat:** ada pengiriman aktif ke lokasi yang berhak diproses. **Pemicu:** barang tiba atau petugas menyelesaikan catatan tertunda.

**Alur utama:** penerima membuka kiriman; boleh menandai tiba; memeriksa jumlah datang dan kondisi; memasukkan jumlah penerimaan kali ini; sistem memeriksa sisa saat pengesahan; sistem mengurangi sisa kiriman dan menambah stok tujuan; status mengikuti hasil tiap baris.

**Alternatif dan kesalahan:** penerimaan sebagian meninggalkan sisa terbuka; stok tujuan yang minus tetap ditambah; jumlah melebihi sisa masuk UC06; hitungan sisa fisik tidak otomatis menjadi jumlah datang; pengulangan tindakan mengembalikan hasil semula. **Hasil:** penerimaan dan mutasi tertaut, termasuk hasil -5 + 200 = 195. **Acuan:** AB03, AB08, AB11 sampai AB14, AB16; KF09, KF10, KF17, KF18; D04, D06, D07.

## UC06 Menyelesaikan selisih pengiriman

**Tujuan dan aktor.** Penerima atau petugas persediaan melaporkan selisih; pengelola mengesahkan penyelesaiannya. **Prasyarat:** kiriman dan baris yang diperiksa jelas. **Pemicu:** kurang, berlebih, rusak, atau barang tidak ditemukan.

**Alur utama:** petugas mencatat jenis dan jumlah selisih serta bukti; menunjuk penanggung jawab; pengelola memilih penerimaan lanjutan, tambahan pengiriman sah, barang kembali, atau kehilangan; sistem memeriksa keseimbangan; sistem mencatat keputusan dan mutasi yang diperlukan.

**Alternatif dan kesalahan:** kelebihan yang asalnya belum jelas tetap menjadi temuan; barang rusak yang telah diterima berada di stok ditahan; sisa tidak boleh hilang karena tombol selesai. **Hasil:** selisih mempunyai penjelasan; kiriman hanya selesai jika sisa nol dan seluruh masalah ditutup. **Acuan:** AB07, AB12 sampai AB15, AB21; KF11, KF12, KF17; D08.

## UC07 Melakukan opname

**Tujuan dan aktor.** Petugas persediaan atau penerima menghitung fisik; pengelola menyetujui selisih. **Prasyarat:** lokasi, SKU, kondisi, dan batas waktu hitung jelas. **Pemicu:** jadwal hitung atau pemeriksaan selisih.

**Alur utama:** petugas menyiapkan sesi; menyelesaikan kedatangan relevan; menghentikan gerak SKU selama hitung; merekam batas, saldo pembanding, dan fisik; sistem menghitung selisih; pengelola memeriksa bukti; sistem menerapkan selisih ke saldo kini.

**Alternatif dan kesalahan:** gerak barang sesudah hitung tetap dipertahankan; pergerakan selama hitung yang belum direkonsiliasi menahan pengesahan; kiriman tiba belum dibukukan menahan penutupan; kejadian lama yang baru diketahui memakai koreksi tertaut. **Hasil:** hasil hitung, selisih, persetujuan, dan dampak kini dapat ditelusuri. **Acuan:** AB18 sampai AB21; KF14, KF15, KF32.

## UC08 Mengoreksi stok dan menangani barang ditahan

**Tujuan dan aktor.** Petugas mengajukan tindakan; pengelola mengesahkan. **Prasyarat:** dokumen asal atau alasan penyesuaian tersedia. **Pemicu:** salah catat, kerusakan, hasil pemeriksaan, atau pemusnahan.

**Alur utama:** petugas memilih tindakan dan jumlah; menjelaskan alasan; sistem menunjukkan dampak pada seluruh lokasi atau dokumen terkait; pihak berwenang memeriksa; sistem membukukan mutasi baru dan hubungan ke catatan asal.

**Alternatif dan kesalahan:** pembalikan yang membuat transit atau stok ditahan negatif ditolak; koreksi yang memengaruhi transaksi lanjutan harus menyelesaikan seluruh dampak; pengelola yang menyetujui usulan sendiri mencatat alasan pengecualian. **Hasil:** saldo berubah secara sah dan catatan semula tetap ada. **Acuan:** AB13, AB15, AB20, AB21; KF15, KF16, KF33.

## UC09 Mengatur harga promosi dan biaya

**Tujuan dan aktor.** Pengelola harga atau pengelola menetapkan ketentuan komersial. **Prasyarat:** SKU dan lokasi tersedia. **Pemicu:** harga baru, jadwal promosi, atau perubahan profil biaya.

**Alur utama:** petugas memilih cakupan dan masa berlaku; menetapkan nilai, syarat, prioritas, penggabungan, dan dasar hitung; sistem memeriksa konflik; petugas mencoba contoh transaksi; sistem mengaktifkan versi aturan dan menyimpan audit.

**Alternatif dan kesalahan:** masa berlaku setara bertumpuk ditolak; harga kosong tidak menjadi harga nol; pembatasan per pelanggan membutuhkan identitas; aturan yang dasar hitungnya belum lengkap tidak dapat aktif. **Hasil:** transaksi baru mengikuti aturan yang tepat; riwayat penjualan tetap. **Acuan:** AB23 sampai AB29; KF19 sampai KF22; D12.

## UC10 Menyelesaikan penjualan kasir

**Tujuan dan aktor.** Kasir menjual produk pada outlet tugasnya. **Prasyarat:** sif aktif bila modul sif digunakan; harga dan satuan sah. **Pemicu:** pelanggan membeli barang.

**Alur utama:** kasir memilih barang dan jumlah; sistem menghitung rincian; kasir memilih pembayaran; sistem memeriksa ulang harga, voucher, hak, dan stok; kasir mengonfirmasi pembayaran dan total; sistem mengesahkan penjualan beserta dampaknya; sistem menerbitkan bukti.

**Alternatif dan kesalahan:** perubahan harga meminta konfirmasi total baru; kebijakan minus dapat memberi peringatan atau penolakan; pembayaran kurang atau belum pasti tidak menyelesaikan penjualan; tagihan nol sah hanya dari harga nol atau potongan yang diizinkan dan tidak memerlukan penerimaan uang. **Hasil:** satu penjualan selesai mengurangi stok sekali. **Acuan:** AB16, AB17, AB23 sampai AB30; KF18 sampai KF26; D05 dan D09.

## UC11 Memeriksa hasil transaksi dan pembayaran

**Tujuan dan aktor.** Kasir memulihkan tindakan yang hasilnya belum pasti. **Prasyarat:** identitas tindakan dan bukti pembayaran, jika ada, tersimpan. **Pemicu:** koneksi putus, aplikasi ditutup, atau respons tidak diterima.

**Alur utama:** kasir membuka daftar perlu diperiksa; sistem mencari hasil berdasarkan identitas yang sama; jika sudah sah, sistem menampilkan hasil tersebut; jika belum sah, sistem memeriksa bukti dan prasyarat sebelum melanjutkan; setiap keputusan tercatat.

**Alternatif dan kesalahan:** kasir tidak menagih ulang hanya karena respons hilang; uang yang sudah diterima tetap mempunyai catatan pemeriksaan walau penjualan belum sah; bukti bertentangan masuk pemeriksaan pengelola; identitas sama dengan isi berbeda ditolak. Jika penjualan tidak dapat diselesaikan, pengelola dapat menyetujui refund atas pembayaran nyata yang belum dialokasikan. Refund ini mengacu pada pembayaran, tidak mensyaratkan penjualan Selesai, dan tidak mengubah stok. **Hasil:** transaksi terselesaikan atau tetap memiliki penanggung jawab tanpa pembayaran maupun stok ganda. **Acuan:** AB16, AB17, AB22, AB30; KF18, KF25, KF34; D07.

## UC12 Memproses retur dan pengembalian uang

**Tujuan dan aktor.** Kasir mengajukan; pengelola mengesahkan retur atau refund. **Prasyarat:** penjualan asal selesai dan sisa hak retur atau refund tersedia. **Pemicu:** barang kembali, salah transaksi, atau keluhan.

**Alur utama:** petugas membuka transaksi asal; memilih jumlah barang yang benar-benar kembali dan kondisinya; memilih nilai dan alasan refund; sistem menghitung dari rincian asli; pihak berwenang menyetujui; sistem mencatat dokumen tertaut, mutasi barang bila ada, serta pembayaran kembali.

**Alternatif dan kesalahan:** refund tanpa barang tidak menambah stok; barang rusak masuk ditahan; permintaan melebihi jumlah atau nilai tersisa ditolak; pengembalian sebagian mempertahankan sisa yang masih dapat diretur. **Hasil:** keadaan barang dan uang tercatat terpisah; penjualan asal tetap terbaca. **Acuan:** AB31 sampai AB33; KF27; D09 dan D12.

## UC13 Mengelola sif kasir

**Tujuan dan aktor.** Kasir mencocokkan kas selama bekerja. **Prasyarat:** outlet aktif dan kasir berwenang. **Pemicu:** awal atau akhir jam kerja.

**Alur utama:** kasir membuka sif dengan kas awal; sistem menautkan penjualan dan pembayaran; kasir mencatat masuk atau keluar kas yang sah; pada penutupan, kasir memasukkan kas fisik; sistem menghitung kas seharusnya dan selisih; kasir memberi alasan selisih untuk ditinjau.

**Alternatif dan kesalahan:** pembayaran nontunai tidak masuk kas laci; uang kembalian mengurangi penerimaan bruto; catatan tertunda harus ditangani sebelum penutupan; koreksi setelah tutup menjadi catatan terpisah. **Hasil:** sif tertutup mempunyai ringkasan tetap dan daftar koreksi bila ada. **Acuan:** AB18, AB34; KF28, KF31.

## UC14 Memantau laporan pengecualian dan audit

**Tujuan dan aktor.** Pengelola dan pengguna yang berhak menelusuri kegiatan sesuai cakupan. **Prasyarat:** data tersimpan. **Pemicu:** pemeriksaan harian atau tindak lanjut selisih.

**Alur utama:** pengguna memilih periode, lokasi, SKU, dan dasar waktu; sistem menampilkan saldo dan daftar pengecualian; pengguna membuka angka hingga dokumen asal; pengguna menugaskan tindak lanjut atau mengekspor hasil sesuai filter.

**Alternatif dan kesalahan:** laporan tanpa data menjelaskan filter; koneksi buruk menampilkan umur data; pengguna tidak berhak ditolak pada rincian maupun ekspor; laporan yang mencakup catatan terlambat memberi penanda. **Hasil:** angka dan asalnya dapat diperiksa, sementara hak lokasi tetap berlaku. **Acuan:** KF06, KF16, KF29 sampai KF34, KF38.

## UC15 Mengonfigurasi template dan memulihkan data

**Tujuan dan aktor.** Pengelola serta petugas pemulihan yang diberi tugas menyiapkan penggunaan ulang dan pemulihan. **Prasyarat:** kewenangan penuh dan prosedur operasi yang tercatat. **Pemicu:** usaha baru, perubahan modul, atau insiden.

**Alur utama:** pengelola menetapkan identitas, lokasi, fitur, dan kebijakan; sistem memeriksa ketergantungan fitur; petugas memisahkan data contoh dari data nyata; petugas menguji cadangan pada lingkungan pemeriksaan; petugas mencocokkan saldo, dokumen, dan hak sebelum layanan dipakai kembali.

**Alternatif dan kesalahan:** mematikan modul tidak menghapus riwayat; pemulihan gagal tidak boleh menimpa sumber yang masih sah; hak petugas pemulihan dibatasi waktu dan diaudit. **Hasil:** konfigurasi dapat dipakai ulang dan pemulihan mempunyai bukti hasil. **Acuan:** KF35 sampai KF37; KM07, KM12; D13.

# 7 Rancangan proses dan data

![D04 Aktivitas pengiriman dan penerimaan](diagram/D04_Aktivitas_Transfer.png)

Penerimaan dapat terjadi bertahap. Penjualan di tujuan merupakan proses tersendiri yang boleh berlangsung sebelum penerimaan dibukukan jika kebijakan minus mengizinkan. Diagram transfer tidak mewajibkan penjualan menjadi langkah transfer.

![D05 Aktivitas penjualan kasir](diagram/D05_Aktivitas_Penjualan.png)

Pengesahan penjualan memeriksa prasyarat terakhir. Jika uang secara nyata telah diterima tetapi penjualan belum dapat disahkan, sistem menyimpan rujukan pembayaran dalam status perlu diperiksa. Petugas harus menyelesaikan penjualan secara sah atau mengembalikan uang dengan catatan. Sistem tidak boleh menganggap penerimaan uang fisik otomatis batal hanya karena pencatatan gagal.

## Urutan pencatatan yang kritis

![D06 Penjualan sebelum penerimaan](diagram/D06_Urutan_Penerimaan_Terlambat.png)

D06 menjadi kontrak hasil untuk kasus utama pengguna. Jika urutan penjualan dan penerimaan dibalik, hasil akhir tetap 195. Perbedaannya hanya keadaan antara yang sempat tampil dan waktunya.

![D07 Pengulangan tindakan setelah respons hilang](diagram/D07_Urutan_Pengulangan.png)

D07 membedakan tindakan yang belum disahkan dari tindakan yang sudah sah tetapi responsnya hilang. Identitas tindakan tetap digunakan sampai hasil diketahui. Pemeriksaan kewenangan tetap berlaku ketika hasil dibaca atau tindakan dicoba ulang.

## Status pengiriman

![D08 Status dokumen pengiriman](diagram/D08_Status_Pengiriman.png)

Status dokumen tidak boleh menggantikan rincian jumlah per baris. Pengiriman dapat sudah diterima sebagian sekaligus mempunyai selisih. Karena itu tahap dokumen, kemajuan jumlah, status perjalanan, dan status selisih disimpan sebagai makna yang terpisah.

## Status penjualan pembayaran dan retur

![D09 Status penjualan pembayaran dan retur](diagram/D09_Status_Penjualan.png)

Penjualan selesai tetap menjadi riwayat penjualan selesai. Sistem menambahkan ringkasan retur dan refund serta dokumen tertaut. Dengan ini, nilai bruto, retur, penjualan bersih, penerimaan uang, dan pengembalian uang dapat dibedakan pada laporan.

## Rincian status dokumen

### Pengiriman

| Aspek | Nilai | Aturan |
| --- | --- | --- |
| Tahap dokumen | Draf, Siap, Aktif, Selesai, Dibatalkan | Siap bersifat opsional; hanya Draf atau Siap boleh dibatalkan tanpa mutasi. |
| Kemajuan jumlah | Belum diterima, Sebagian terselesaikan, Seluruhnya terselesaikan | Dihitung dari jumlah per baris; selesai dapat meliputi penerimaan, kembali ke asal, atau kehilangan sah. |
| Perjalanan | Belum berangkat, Dalam perjalanan, Tiba menunggu pemeriksaan | Penanda fisik tidak langsung mengubah saldo. |
| Selisih | Tidak ada, Terbuka, Dalam pemeriksaan, Selesai | Dapat bersamaan dengan kemajuan sebagian. |
| Syarat selesai | Semua sisa nol dan seluruh selisih selesai | Sistem menolak pengesahan selesai jika salah satu baris belum memenuhi. |

Penerimaan yang sudah dibukukan tidak diedit menjadi jumlah lain. Koreksi melahirkan peristiwa baru dan memperbarui ringkasan jumlah setelah memeriksa seluruh hubungan. Pengiriman tetap mempunyai bukti keadaan dan keputusan sebelumnya.

### Penjualan pembayaran retur dan sif

| Objek | Status penting | Ketentuan |
| --- | --- | --- |
| Penjualan | Draf, Menunggu pembayaran, Selesai, Dibatalkan | Dibatalkan tanpa dampak hanya sebelum Selesai. |
| Pembayaran | Belum terkonfirmasi, Perlu diperiksa, Terkonfirmasi, Gagal | Tagihan nol mempunyai penanda Tidak diperlukan, bukan pembayaran yang dikarang. |
| Refund | Diajukan, Disetujui, Selesai, Ditolak | Ringkasan pembayaran dapat menunjukkan dikembalikan sebagian atau penuh. |
| Retur barang | Diajukan, Diterima untuk diperiksa, Selesai, Ditolak | Stok bertambah saat pengesahan kondisi mengubah retur menjadi Selesai. Penolakan sebelum sah tidak mengubah stok. |
| Sif | Terbuka, Dalam pemeriksaan, Tertutup | Koreksi setelah tutup mempunyai catatan tersendiri. |

## Model kelas konseptual

![D10 Kelas domain persediaan](diagram/D10_Kelas_Domain.png)

Dokumen bisnis menjelaskan alasan perubahan. Peristiwa stok mengelompokkan seluruh dampak satu pengesahan. Mutasi stok memuat satu perubahan jumlah pada satu penampung. Saldo merupakan hasil perhitungan, sehingga bukan formulir untuk menimpa angka tanpa dokumen.

## Hubungan data logis

![D11 Hubungan data persediaan](diagram/D11_ER_Persediaan.png)

Satu pengiriman mempunyai satu asal, satu tujuan, dan satu atau lebih baris. Satu penerimaan mengacu pada satu pengiriman, dan setiap baris penerimaan mengacu pada baris kiriman yang tepat. Satu kiriman dapat mempunyai banyak penerimaan. Peristiwa stok mempunyai satu atau lebih mutasi; transfer internal sedikitnya memuat dua dampak berpasangan.

![D12A Hubungan data akses](diagram/D12A_ER_Akses.png)

Penugasan peran melekat pada keanggotaan akun dalam usaha. Cakupan lokasi melekat pada penugasan itu, sehingga hak satu peran tidak menyebar ke lokasi milik peran lain.

![D12B Hubungan data komersial](diagram/D12B_ER_Komersial.png)

Penjualan menyimpan rincian harga pada barisnya; aturan komersial menjadi rujukan versi asal. Catatan pembayaran boleh belum dialokasikan ke penjualan ketika hasilnya perlu diperiksa. P0 memakai satu metode dan paling banyak satu pembayaran sah untuk satu penjualan, sedangkan percobaan gagal tetap dapat dicatat. Diagram D12 berarti kedua bagian, D12A dan D12B.

## Kamus data logis

Tabel berikut memuat informasi minimum, bukan rancangan kolom penyimpanan. Setiap objek memakai identitas yang tetap. Nilai turunan diberi label dan tidak dapat diedit sebagai sumber kebenaran.

| Objek | Informasi utama | Aturan hubungan dan keutuhan |
| --- | --- | --- |
| Usaha | Identitas, nama, mata uang, zona waktu, kebijakan aktif | Menaungi lokasi, keanggotaan, katalog, dan transaksi. |
| Lokasi | Identitas, usaha, nama, kota, jenis, status | Seluruh dokumen menunjuk lokasi dari usaha yang sama. |
| Akun dan keanggotaan | Identitas akun, nama, status, usaha yang diikuti | Penonaktifan mempertahankan nama pelaku historis. |
| Peran dan penugasan | Peran, kemampuan, anggota, lokasi cakupan, masa aktif | Izin diperiksa pada gabungan peran dan cakupan dalam penugasan yang sama. |
| SKU dan satuan | Kode, nama, varian, satuan dasar, ketelitian, konversi | Faktor historis melekat pada transaksi; kode lama tidak didaur ulang. |
| Dokumen bisnis | Nomor, jenis, status, usaha, pelaku, waktu, alasan | Setiap peristiwa stok mempunyai tepat satu sumber sah yang jenisnya jelas. |
| Pengiriman dan baris | Asal, tujuan, SKU, jumlah keluar, satuan, faktor, waktu berangkat | Jumlah keluar setelah koreksi harus memenuhi AB07. |
| Penerimaan transfer dan baris | Kiriman, baris kiriman, jumlah baik, ditahan, waktu tiba dan kejadian, bukti | Jumlah pada setiap penerimaan tidak melampaui sisa saat pengesahan. |
| Penerimaan eksternal dan baris | Asal luar usaha, bukti, lokasi, SKU, jumlah, kondisi, waktu | Tidak memakai kiriman internal sebagai sumber; satu penerimaan eksternal menghasilkan peristiwa stok tertaut. |
| Selisih | Jenis, jumlah, bukti, penanggung jawab, keputusan, penyetuju | Temuan fisik berlebih belum menjadi stok sah sampai sumbernya jelas. |
| Peristiwa stok | Identitas tindakan, sumber, pelaku, kedua waktu, alasan, hubungan koreksi | Peristiwa yang sama dibukukan paling banyak sekali; sumbernya harus ada. |
| Mutasi stok | Peristiwa, penampung lokasi atau pengiriman, SKU, kondisi, jumlah bertanda | Salah satu penampung dipilih secara tegas; perubahan internal seimbang. |
| Saldo stok | Usaha, penampung, SKU, kondisi, jumlah, waktu pembaruan | Nilai turunan dari mutasi; harus dapat direkonsiliasi. |
| Sesi opname dan baris | Lokasi, SKU, kondisi, batas waktu, saldo batas, fisik, selisih, persetujuan | Penyesuaian memakai selisih dan mempertahankan gerak setelah batas. |
| Harga dan versi | SKU, cakupan, nilai, awal dan akhir berlaku, prioritas | Awal termasuk, akhir tidak termasuk; rentang setara tidak tumpang tindih. |
| Aturan komersial | Jenis, syarat, cakupan, nilai, urutan, masa berlaku, versi | Pajak, biaya, diskon, dan voucher menyatakan dasar serta penggabungan. |
| Penerapan aturan | Penjualan, aturan dan versi asal, dasar hitung, nilai, alokasi tiap baris | Menjelaskan hubungan aturan dengan penjualan; rincian historis tetap meski aturan berubah. |
| Voucher dan pemakaian | Kode, aturan, kuota, identitas pelanggan bila perlu, penjualan pemakai | Satu pemakaian per penjualan sesuai profil; kuota tidak negatif. |
| Penjualan dan baris | Nomor, lokasi, kasir, sif, produk, jumlah, harga dan rincian hitung tetap | Baris asli tetap tersedia setelah perubahan katalog dan retur. |
| Pembayaran | Penjualan atau pemeriksaan tertunda, metode, jumlah, status, bukti, rujukan unik | Satu penerimaan uang tidak dialokasikan dua kali; kembalian dicatat terpisah. |
| Retur dan baris | Penjualan asal, baris asal, jumlah, kondisi, alasan, penerima | Jumlah kumulatif tidak melampaui sisa penjualan; stok berubah saat barang diterima. |
| Refund | Satu pembayaran asal, alasan, jumlah, status, pelaku, penyetuju | Jumlah kumulatif tidak melampaui nilai yang dapat dikembalikan; tidak otomatis mengubah stok. Refund lintas pembayaran berada di luar P0. |
| Sif dan gerak kas | Kasir, outlet, waktu, kas awal, masuk, keluar, hitung akhir, selisih | Nilai kas hanya memuat gerak tunai yang sah. |
| Audit | Pelaku, tindakan, sasaran, waktu, nilai sebelum dan sesudah, alasan | Pengguna biasa tidak dapat menghapus atau menulis ulang jejak. |

Hubungan sumber mutasi harus mempunyai keutuhan yang dapat diperiksa. Jika implementasi memakai satu identitas sumber untuk beberapa jenis dokumen, sistem tetap wajib menjamin jenis benar, dokumen ada, usaha sama, dan sumber tidak dapat dihapus sesudah dibukukan. Menyimpan nomor teks tanpa hubungan yang dijaga tidak memenuhi aturan ini.

## Dampak kejadian terhadap stok

| Kejadian | Stok asal | Belum selesai diterima | Tujuan layak jual | Tujuan ditahan |
| --- | ---: | ---: | ---: | ---: |
| Draf kiriman q | 0 | 0 | 0 | 0 |
| Kirim q | -q | +q | 0 | 0 |
| Tandai tiba | 0 | 0 | 0 | 0 |
| Terima baik q | 0 | -q | +q | 0 |
| Terima rusak q | 0 | -q | 0 | +q |
| Jual q di tujuan | 0 | 0 | -q | 0 |
| Kembali dari perjalanan dan diterima asal q | +q | -q | 0 | 0 |
| Kehilangan perjalanan disahkan q | 0 | -q | 0 | 0 |
| Retur pelanggan baik q | 0 | 0 | +q | 0 |
| Retur pelanggan rusak q | 0 | 0 | 0 | +q |
| Lolos pemeriksaan q | 0 | 0 | +q | -q |
| Pemusnahan barang ditahan q | 0 | 0 | 0 | -q |

Untuk penerimaan eksternal, stok lokasi bertambah tanpa mengurangi stok lokasi internal. Untuk opname, dampak ialah selisih bertanda yang disahkan. Untuk refund tanpa barang, semua kolom stok tetap nol.

## Pembagian tanggung jawab logis

![D13 Komponen logis sistem](diagram/D13_Komponen_Logis.png)

Identitas dan akses memutuskan siapa boleh melakukan tindakan. Data induk menetapkan barang, satuan, dan lokasi. Persediaan menjaga seluruh dampak stok. Ketentuan komersial menghasilkan rincian harga. Kasir mengesahkan penjualan dan pembayaran. Laporan membaca hasil yang dapat ditelusuri. Audit menyimpan jejak tindakan penting.

Setiap fungsi yang mengubah stok harus memakai aturan persediaan yang sama, termasuk kasir, impor, koreksi, dan retur. Laporan tidak boleh mempunyai cara hitung persediaan yang mengabaikan mutasi tertentu. Pembagian ini merupakan kontrak tanggung jawab dan tidak memaksa pemisahan menjadi aplikasi atau layanan tersendiri.

# 8 Rancangan antarmuka

## Struktur navigasi menurut tugas

Setelah masuk, pengguna memilih usaha dan lokasi kerja yang sah. Sistem menampilkan navigasi sesuai kewenangan pada konteks tersebut. Pengguna dengan beberapa peran dapat berpindah tugas tanpa membuat akun terpisah. Nama lokasi aktif selalu terlihat pada layar transaksi dan saat pengesahan.

| ID | Layar | Informasi dan tindakan utama |
| --- | --- | --- |
| UI01 | Masuk dan pilih konteks | Akun, usaha, lokasi yang diizinkan, hak efektif ringkas, keluar akun. |
| UI02 | Ringkasan pengelola | Stok menurut lokasi, kiriman belum selesai, penjualan, minus, selisih, waktu pembaruan. |
| UI03 | Persediaan lokasi | Cari SKU; pisahkan layak jual dan ditahan; buka mutasi serta dokumen asal. |
| UI04 | Daftar dan rincian kiriman | Asal, tujuan, status perjalanan, kemajuan jumlah, sisa tiap SKU, penerimaan, dan selisih. |
| UI05 | Form penerimaan | Jumlah dikirim, sudah diterima, sisa, jumlah datang kali ini, baik, ditahan, waktu tiba, dan bukti. |
| UI06 | Opname dan koreksi | Batas hitung, saldo pembanding, fisik, gerak sesudah hitung, selisih, alasan, dan persetujuan. |
| UI07 | Kasir | Pencarian barang, keranjang, rincian potongan dan biaya, pembayaran, peringatan minus, bukti transaksi. |
| UI08 | Riwayat penjualan dan retur | Rincian asli, pembayaran, sisa hak retur, kondisi barang kembali, refund, serta persetujuan. |
| UI09 | Harga dan promosi | Harga lokasi, kalender berlaku, konflik, voucher, kuota, profil pajak dan biaya, pratinjau hitung. |
| UI10 | Sif kasir | Kas awal, transaksi, gerak kas, kas seharusnya, hitung akhir, selisih, dan laporan sif. |
| UI11 | Akun dan penugasan | Akun, peran, cakupan per penugasan, pratinjau hak, status, dan audit perubahan. |
| UI12 | Laporan dan audit | Filter sesuai hak, definisi waktu, rincian sumber, ekspor, dan penanda koreksi. |
| UI13 | Pengaturan dan impor | Identitas, lokasi, satuan, fitur, kebijakan minus, pratinjau impor, serta hasil pemulihan. |
| UI14 | Tindak lanjut dan sinkronisasi | Kiriman tertunda, selisih, minus, persetujuan, hasil belum pasti, dan tindakan periksa ulang. |

## Perilaku yang wajib jelas

Form penerimaan harus menulis **Jumlah yang datang pada penerimaan ini**, bukan **Stok sekarang**. Tampilkan dampak yang akan terjadi, misalnya saldo tercatat -5, penerimaan 200, perkiraan saldo setelah pengesahan 195. Karena transaksi lain dapat masuk, angka pratinjau harus diberi penanda perkiraan; angka akhir berasal dari hasil pengesahan.

Layar kiriman menampilkan jumlah keluar, diterima baik, diterima ditahan, kembali ke asal, kehilangan sah, dan sisa. Jangan menyatukan seluruh keadaan menjadi satu label warna. Petugas harus dapat membuka alasan sisa dengan satu tindakan dari rincian kiriman.

Layar kasir memusatkan perhatian pada barang, jumlah, dan total. Kasir dapat membuka rincian perhitungan tanpa kehilangan keranjang. Tombol finalisasi menampilkan nilai akhir, lokasi, dan metode pembayaran. Bila harga berubah, sistem menunjukkan perubahan serta meminta kasir mengonfirmasi kembali sebelum menagih.

Layar pengelola mendahulukan masalah yang perlu ditindaklanjuti. Setiap angka ringkasan mempunyai definisi dan jalur menuju sumbernya. Stok dalam perjalanan, tiba belum dibukukan, dan selisih tetap dapat dibedakan. Angka penjualan tidak digabung dengan transfer internal.

## Keadaan layar dan pesan

| Keadaan | Perilaku yang diharapkan |
| --- | --- |
| Memuat | Pertahankan konteks lokasi dan cegah tindakan ganda; jangan mengganti saldo sementara dengan nol. |
| Kosong | Jelaskan apakah belum ada data atau filter tidak menemukan hasil. |
| Gagal sebelum pengesahan | Tampilkan sebab yang dapat ditindaklanjuti dan pertahankan isian. |
| Hasil belum pasti | Tampilkan identitas tindakan dan tombol Periksa hasil; jangan menawarkan transaksi baru sebagai solusi utama. |
| Data lama | Tampilkan waktu pembaruan terakhir dan status koneksi. |
| Stok minus | Tampilkan nilai negatif, kebijakan yang berlaku, serta kiriman terkait bila diketahui. |
| Hak tidak cukup | Jelaskan tindakan yang dibatasi tanpa membuka data lokasi lain. |
| Berhasil | Tampilkan nomor dokumen, hasil akhir, dan jalan untuk melihat rincian. |

Contoh pesan: “Penerimaan tercatat. Stok layak jual kini 195 porsi.”; “Hasil pengesahan belum diketahui. Periksa hasil sebelum mencoba lagi.”; dan “Ada 10 porsi yang belum selesai diterima. Catat tindak lanjut sebelum menutup kiriman.”

## Laporan dan bukti

Laporan saldo memuat lokasi, SKU, satuan, layak jual, ditahan, dan waktu pembaruan. Laporan transfer memuat asal, tujuan, jumlah keluar, seluruh penyelesaian, sisa, waktu, dan umur tertunda. Laporan penjualan memisahkan bruto, diskon, nilai barang neto, biaya layanan, pajak, retur, dan penjualan bersih. Laporan pembayaran memisahkan penerimaan, pengembalian, metode, dan hasil pemeriksaan.

Satu nilai uang tidak boleh diberi dua arti. Usulan definisi: **penjualan barang neto** ialah bruto dikurangi diskon; **total tagihan** ialah barang neto ditambah biaya dan pajak yang memang menambah tagihan; **penerimaan bersih** ialah pembayaran terkonfirmasi dikurangi refund. Pajak yang sudah termasuk harga ditampilkan sebagai rincian, bukan ditambah lagi. Semua ekspor menyertakan filter dan dasar waktu.

# 9 Rencana pengujian dan penerimaan

## Strategi pemeriksaan

Pengujian memeriksa hasil usaha dan hubungan catatan. Tombol yang dapat ditekan tidak cukup untuk menyatakan fungsi selesai. Setiap uji harus mencatat kondisi awal, tindakan, hasil, bukti angka, dokumen yang terbentuk, dan audit yang relevan. Paket agent menyertakan katalog rinci dalam CSV agar hasil aktual dan status dapat ditambahkan.

Data uji dipisahkan dari data nyata. Untuk uji yang tidak saling melanjutkan, pulihkan kondisi awal agar kegagalan mudah dilacak. Uji stok utama harus dijalankan dari tampilan gudang, penerima, kasir, dan pengelola dengan akun yang berbeda, lalu diulang dengan satu akun yang memiliki beberapa peran sah.

## Dataset contoh

| Unsur | Nilai awal demo |
| --- | --- |
| Usaha | Usaha Cimol Contoh |
| Gudang | Gudang Pusat Garut |
| Outlet | Garut 1, Garut 2, Bandung 1, Bandung 2, Tasikmalaya 1 |
| Produk utama | CIMOL ORI dengan satuan porsi; saldo gudang 1.000; saldo outlet 0 |
| Produk pembanding | CIMOL PEDAS; saldo dan harga berbeda untuk memeriksa pemisahan SKU |
| Kiriman utama | 200 porsi CIMOL ORI dari gudang ke Garut 1 |
| Kebijakan | Garut 1 boleh menjual saat minus dengan peringatan; gudang menolak kirim saat stok kurang |
| Akun contoh | Pengelola, petugas gudang, penerima Garut 1, kasir Garut 1, pengelola harga, akun peran ganda |
| Harga uji | 10.000 rupiah per porsi; profil simulasi komersial mengikuti Bab 3 |

## Katalog uji penerimaan

| ID | Skenario | Hasil utama yang harus terbukti |
| --- | --- | --- |
| AT01 | Saldo pembukaan dan draf | Gudang tetap 1.000, outlet 0, belum selesai diterima 0. Saldo awal memiliki dokumen dan mutasi; draf tidak mempunyai mutasi. |
| AT02 | Barang keluar dan penanda tiba | Gudang 800, belum selesai diterima 200, outlet 0. Penanda tiba tidak menambah outlet. Total tetap 1.000. |
| AT03 | Penjualan sebelum penerimaan | Outlet -5, gudang 800, belum selesai diterima 200; total 995. Bukti penjualan dan peringatan minus tersedia; stok berkurang sekali. |
| AT04 | Penerimaan terlambat menghasilkan 195 | Outlet 195, gudang 800, belum selesai diterima 0, total 995. Penjualan 5 tetap ada; kiriman selesai; penanda minus kini terselesaikan. |
| AT05 | Penerimaan diulang setelah respons hilang | Satu penerimaan dan satu dampak +200; outlet tetap 195. Sistem mengembalikan nomor serta hasil penerimaan pertama. |
| AT06 | Identitas sama dengan isi berbeda | Sistem menolak konflik. Riwayat dan saldo 195 tidak berubah. Koreksi harus menjadi tindakan baru yang tertaut. |
| AT07 | Penerimaan sebagian | Sesudah 80: outlet 75 dan sisa 120. Sesudah 120: outlet 195 dan sisa 0. Masing-masing penerimaan tertaut pada kiriman yang sama. |
| AT08 | Kekurangan dan penutupan kiriman | Penutupan awal ditolak dan sisa 10 tetap terlihat sebagai selisih. Setelah kehilangan sah, sisa 0; total usaha turun 10; audit menyimpan alasan dan penyetuju. |
| AT09 | Barang baik rusak dan belum ditemukan | Layak jual 180, ditahan 10, sisa kiriman 10. Sepuluh rusak tidak juga dianggap hilang. Penjualan barang ditahan ditolak. |
| AT10 | Kelebihan penerimaan | Penerimaan berlebih langsung ditolak; transit tidak negatif. Setelah koreksi kirim +5 dan penerimaan kumulatif 205, gudang 795, tujuan 205, sisa 0. |
| AT11 | Dua penerima memakai sisa yang sama | Paling banyak satu penerimaan 150 sah; lainnya ditolak dengan sisa terbaru 50. Sistem tidak menerima 300 dan tidak membuat sisa negatif. |
| AT12 | Penjualan bersamaan dan urutan berbeda | A mode larang: satu selesai, saldo 0. Mode boleh: dua selesai, saldo -1. B selalu berakhir 195. Tidak ada penjualan sah yang kehilangan dampak stok. |
| AT13 | Kegagalan di tengah pengesahan | Tidak ada asal berkurang tanpa kiriman bertambah. Tidak ada penjualan selesai tanpa pembayaran sah atau tagihan nol sah, kuota, dan mutasi yang sesuai. Pengulangan menghasilkan paling banyak satu hasil utuh. |
| AT14 | Koneksi terputus dan draf luring | Layar menampilkan belum pasti jika belum tahu hasil. Bila sudah sah, hasil lama kembali; bila belum, hanya satu pengesahan terjadi. Saat luring penuh, draf boleh tersedia tetapi tidak ditandai selesai tersinkron. |
| AT15 | Pembatalan dan barang kembali | Draf batal tanpa mutasi. Kiriman aktif tidak menambah asal hanya karena batal. Asal bertambah saat barang kembali diterima. Barang yang sudah diterima memakai transfer baru yang tertaut. |
| AT16 | Opname dengan penjualan setelah hitung | Sebelum koreksi saldo 192; sesudah koreksi saldo 190. Sistem tidak mengganti saldo kini menjadi 193. |
| AT17 | Opname saat kiriman belum dibukukan | Penutupan awal tertahan. Penerimaan 200 menghasilkan 195; hasil fisik 195 memberi selisih 0. Tidak ada penyesuaian +200 tambahan. |
| AT18 | Kejadian lama setelah opname tertutup | Kedua dampak disahkan bersama; saldo akhir tetap 195; sisa kiriman menjadi 0. Riwayat penyesuaian salah tetap terbaca dan sumber saldo kini benar. |
| AT19 | Koreksi dan barang ditahan | Layak jual bertambah 6; ditahan 0; total turun 4. Penghapusan riwayat dan pembalikan yang membuat ditahan negatif ditolak. Seluruh alasan dan pelaku tersimpan. |
| AT20 | Satuan dan riwayat produk | Saldo 17 porsi. Riwayat penerimaan tetap 20 porsi setelah faktor berubah. SKU nonaktif tidak dapat dijual baru tetapi riwayat tetap. Konversi kosong atau pecahan terlarang ditolak. |
| AT21 | Peran ganda dengan cakupan berbeda | Dua tindakan pertama sah; akses di luar cakupan ditolak, termasuk perubahan aturan bersama yang memengaruhi A. Gabungan peran tidak membentuk kombinasi lokasi baru; owner terbatas pada usahanya. |
| AT22 | Pencabutan hak dan pengelola terakhir | Tindakan berikutnya dari kasir ditolak; riwayat lama tetap. Penonaktifan pengelola terakhir ditolak. Pengguna biasa tidak dapat menaikkan haknya sendiri. |
| AT23 | Akses langsung laporan dan ekspor | Rincian kiriman yang diperlukan dapat dibaca. Saldo, transaksi lain, dan ekspor di luar cakupan ditolak tanpa membocorkan data. |
| AT24 | Harga berlaku dan transaksi historis | Tepat pukul 12.00 memakai 12.000; rentang konflik ditolak. Bukti lama tetap 10.000. Harga khusus lokasi mengalahkan harga dasar dan harga kosong tidak dianggap gratis. |
| AT25 | Syarat dan penggabungan promosi | Minimum mengikuti barang yang berhak sesudah diskon baris dan sebelum voucher. Aturan dipilih deterministik; voucher yang tidak boleh digabung ditolak tanpa mengganti promo otomatis; diskon tidak membuat dasar negatif. Identitas pelanggan wajib bila batas per pelanggan aktif. |
| AT26 | Hitungan eksklusif dan pembagian rupiah | Barang neto 85.000, service 4.250, pajak 8.925, total 98.175. Tiga alokasi diskon 334,333,333 menurut urutan tetap dan jumlah 1.000. |
| AT27 | Pajak termasuk harga | Dasar barang 100.000 dan pajak dalam harga 10.000. Varian A tagihan 110.000. Varian B service 5.000, pajak service 500, tagihan 115.500. Pajak barang tidak ditambahkan lagi. |
| AT28 | Kuota voucher terakhir bersamaan | Tepat satu transaksi memakai voucher. Yang lain melihat total baru dan harus konfirmasi ulang; kuota tidak negatif. Pengulangan tidak memakai kuota kedua. |
| AT29 | Keranjang berubah dan barang gratis | Perubahan total meminta konfirmasi ulang sebelum menagih. Transaksi gratis yang sah tetap mengurangi stok, pembayaran bertanda tidak diperlukan, bukan pembayaran palsu. Cetak ulang tidak mengubah stok. |
| AT30 | Pembayaran kurang dan hasil perlu diperiksa | Bayar kurang tidak menyelesaikan penjualan. Tunai 20.000 menghasilkan kembalian 2.000 dan penerimaan bersih 18.000. Uang yang nyata diterima tetap terlacak; tidak ditagih dua kali. Pembayaran tanpa penjualan sah boleh direfund melalui UC11 dengan persetujuan dan rujukan pembayaran, tanpa mutasi stok. |
| AT31 | Retur sebagian memakai rincian asli | Stok bertambah 2 pada retur pertama. Nilai memakai rincian asli. Jumlah kumulatif maksimal 10; refund tidak melebihi yang dapat dikembalikan. Retur terakhir menyerap sisa rupiah sehingga total alokasi sama dengan transaksi asal. |
| AT32 | Refund tanpa barang dan retur rusak | Refund tanpa barang tidak mengubah stok. Barang rusak menambah ditahan satu dan tidak menambah layak jual. Pengulangan tidak menambah stok atau refund lagi; riwayat penjualan tetap. |
| AT33 | Sif kasir dan koreksi setelah tutup | Kas seharusnya 113.000; selisih -1.000. Nontunai tidak menambah laci. Koreksi tercatat terpisah dan laporan penutupan awal tidak ditulis ulang. |
| AT34 | Rekonsiliasi laporan seluruh lokasi | Total cocok. Transfer internal tidak masuk penjualan. Barang neto, total tagihan, pajak inklusif, pembayaran bersih dan refund dibedakan. Ekspor sama dengan layar. |
| AT35 | Tanggal kejadian audit dan penelusuran | Waktu pencatatan hari ini tetap. Laporan yang diketahui kemarin tidak berubah diam-diam; analisis kejadian memberi penanda terlambat. Setiap koreksi memiliki pelaku, alasan, penyetuju, dan sumber. |
| AT36 | Pembaruan antarlayar dan kegunaan | Pada koneksi sehat 95 persen pembaruan terlihat paling lama 5 detik. Saat putus, umur data dan status lama terlihat. Jumlah penting, label, fokus, dan tindakan tetap terbaca tanpa terpotong. |
| AT37 | Pemulihan cadangan | Keutuhan hubungan dan angka benar. Target usulan kehilangan data paling lama 15 menit dan pulih paling lama 4 jam diuji; laporan menyatakan hasil nyata serta celah bila belum tercapai. |
| AT38 | Impor dan pembukaan berulang | Baris salah dijelaskan; tidak membuat catatan sebagian yang tersembunyi. Pengulangan tidak menggandakan SKU atau saldo awal. Hasil impor memiliki daftar berhasil/ditolak dan sumber mutasi. |
| AT39 | Penggunaan ulang template | Aturan inti tetap benar tanpa penulisan ulang logika stok. Riwayat voucher tetap pada transaksi lama. Tidak ada data usaha A yang muncul sebagai milik B atau data contoh masuk data nyata. |
| AT40 | Beban dan kesiapan operasi | 95 persen pencarian/pengesahan paling lama 2 detik, laporan biasa paling lama 5 detik; saldo tepat. Target 99,5 persen bulanan dibedakan dari hasil uji singkat; jangan mengklaim tercapai sebelum ada hasil periode yang sesuai. |

## Matriks keterlacakan

Tabel berikut menghubungkan setiap kelompok kebutuhan fungsi ke kasus penggunaan dan bukti penerimaan. Rincian per uji menyebut nomor kebutuhan pada berkas CSV. Kebutuhan mutu diverifikasi melalui pengujian gangguan, beban, akses, pemulihan, dan penggunaan layar.

| Kebutuhan | Kasus penggunaan | Rancangan utama | Uji penerimaan |
| --- | --- | --- | --- |
| KF01, KF02 | UC01 | D03, D12, UI01, UI11 | AT21, AT22, AT23 |
| KF03, KF04, KF05 | UC02, UC03 | D10, D11, UI03, UI13 | AT01, AT20, AT38 |
| KF06, KF07, KF08, KF09, KF10 | UC04, UC05, UC14 | D04, D06, D08, UI03 sampai UI05 | AT01 sampai AT07 |
| KF11, KF12 | UC06, UC08 | D04, D08, UI04, UI06 | AT08, AT09, AT10, AT15 |
| KF13, KF17, KF18 | UC04, UC05, UC10, UC11 | D06, D07, D08 | AT03, AT05, AT06, AT11 sampai AT14 |
| KF14, KF15, KF16 | UC07, UC08, UC14 | D10, D11, UI06 | AT16 sampai AT19, AT35 |
| KF19, KF20, KF21, KF22 | UC09, UC10 | D05, D12, UI09 | AT24 sampai AT29 |
| KF23, KF24, KF25, KF26 | UC10, UC11 | D05, D07, D09, UI07 | AT03, AT12, AT14, AT29, AT30 |
| KF27 | UC12 | D09, D12, UI08 | AT31, AT32 |
| KF28 | UC13 | D09, UI10 | AT33 |
| KF29, KF30, KF31, KF32 | UC14 | D08, D09, UI02, UI12, UI14 | AT04, AT08, AT23, AT34, AT35, AT36 |
| KF33, KF38 | UC01, UC08, UC14 | D11, D12, UI11, UI12 | AT19, AT21, AT22, AT35 |
| KF34 | UC11, UC14 | D07, UI14 | AT05, AT14, AT30, AT36 |
| KF35, KF36, KF37 | UC02, UC15 | D13, UI13 | AT37, AT38, AT39 |
| KM01 sampai KM05 | UC04, UC05, UC10, UC11 | D04 sampai D07 | AT11 sampai AT14, AT28, AT36, AT40 |
| KM06, KM07 | UC15 | D13 | AT37, AT40 dan bukti operasi pilot |
| KM08 sampai KM12 | UC02, UC08, UC14, UC15 | UI01 sampai UI14 | AT19, AT20, AT23, AT35 sampai AT40 |

## Syarat kelulusan

Versi awal lulus ketika seluruh AT yang masuk lingkup P0 mempunyai bukti lulus; seluruh KF mempunyai jalur implementasi dan uji; tidak ada cacat yang menyebabkan stok atau uang salah, kehilangan transaksi, akses lintas kewenangan, atau riwayat hilang; dan petugas uji dapat menyelesaikan pengiriman, penerimaan, serta penjualan dari layar masing-masing.

Target beban dan pemulihan memerlukan hasil ukur. Ketersediaan bulanan tidak dapat dibuktikan hanya dengan uji singkat; laporan kesiapan harus membedakan target, hasil uji, dan hasil operasi yang benar-benar diamati. Penerimaan demo tidak otomatis berarti target layanan produksi telah terbukti.

Sebelum pilot, pemilik meninjau keputusan V01 sampai V12, data awal, pembagian tugas, dan prosedur ketika hasil transaksi belum pasti. Pilot dimulai pada satu gudang dan satu outlet, kemudian memakai seluruh lokasi setelah angka harian dan alur koreksi cocok.

# 10 Penerapan template dan serah terima

## Prinsip penggunaan ulang

Template memisahkan identitas dan data usaha dari aturan inti. Perubahan merek, lokasi, produk, satuan, harga, atau akun tidak boleh menuntut penulisan ulang aturan stok. Ketergantungan antarfitur harus jelas.

| Pilihan template | Isi | Catatan |
| --- | --- | --- |
| Persediaan multilokasi | Lokasi, barang, transfer, penerimaan, opname, koreksi, laporan | Cocok untuk validasi alur barang. |
| Persediaan dan kasir | Semua fitur persediaan, kasir, pembayaran, retur, harga dasar | Memakai pengurangan stok yang sama. |
| Operasional lengkap | Persediaan, kasir, promosi, pajak, biaya, sif, dan laporan | Target kelengkapan rancangan ini. |

Menonaktifkan modul hanya menghentikan pemakaian baru. Bukti transaksi, rincian voucher, dan asal mutasi penjualan lama tetap tersedia.

## Urutan implementasi yang disarankan

1. Baca aturan bisnis dan matriks keterlacakan; petakan fitur yang sudah ada pada repositori tujuan.
2. Selesaikan identitas usaha, peran dan lokasi, SKU, satuan, serta mutasi stok.
3. Bangun layar dan alur kirim, tiba, terima sebagian, selisih, dan koreksi.
4. Hubungkan kasir dan pembayaran; buktikan -5 + 200 = 195, input ulang, dan operasi bersamaan.
5. Tambahkan harga, promosi, pajak, biaya, retur, dan sif dengan rincian historis yang tetap.
6. Selesaikan laporan, ekspor, pengecualian, opname, impor, pemulihan, dan pilihan template.
7. Jalankan uji penerimaan, perbaiki temuan, dan siapkan panduan serta demo yang dapat diulang.

Hasil tiap tahap dapat diuji bersama klien. Template baru lengkap ketika seluruh P0 yang disepakati selesai. Catat perubahan lingkup per nomor kebutuhan.

## Isi serah terima

Agent menyerahkan template yang berfungsi; data dan akun demo; daftar konfigurasi; panduan tiap peran; bukti uji; keputusan terbuka; serta cara pemulihan. Akun demo tidak memuat rahasia produksi. Laporan menyebut hasil stok dan uang pada skenario utama. Agent mengikuti repositori dan aturan proyek, sambil memenuhi spesifikasi ini.

## Batas pekerjaan agent

Agent harus menjaga seluruh aturan stok, uang, dan akses. Kasir harus menjalankan transaksi nyata; menu tersembunyi tidak cukup untuk melindungi data. P1 hanya dikerjakan setelah lingkup diperbarui. Jika spesifikasi bertentangan, catat masalah dan pilihan penyelesaiannya sambil melanjutkan bagian yang tidak terdampak.

# 11 Keputusan untuk validasi kebutuhan

Tabel ini membedakan aturan yang sudah berasal dari permintaan pengguna dari nilai awal usulan. Nilai awal cukup untuk membuat template dan demo; keputusan yang memengaruhi operasi klien harus disepakati sebelum pilot.

| ID | Hal yang perlu dipastikan | Nilai awal untuk template | Dampak jika berbeda |
| --- | --- | --- | --- |
| V01 | Barang gudang dan barang jual memakai unit yang sama atau tidak | Produk siap jual; konversi tetap saja | Bila ada resep atau hasil berubah, tambah modul produksi sebelum stok dipakai nyata. |
| V02 | Kebutuhan batch dan kedaluwarsa | Belum aktif pada P0 | Dapat menjadi syarat pilot untuk operasi pangan yang melacak kedaluwarsa. |
| V03 | Lokasi dan tindakan yang boleh minus | Outlet boleh jual dengan peringatan; gudang menolak kirim kurang | Ubah kebijakan dan uji sesuai pembagian kewenangan. |
| V04 | Siapa menerima dan siapa menyetujui selisih | Penerima lokasi mengonfirmasi; pengelola menyetujui koreksi | Tambah kewenangan terbatas bila tim membagi persetujuan. |
| V05 | Cara kasir memastikan pembayaran | Tunai atau nontunai yang dikonfirmasi petugas | Sambungan pembayaran otomatis memerlukan kontrak tambahan. |
| V06 | Kebutuhan penjualan saat tidak ada koneksi | Draf saja; finalisasi perlu koneksi | Penjualan luring penuh membutuhkan rancangan dan uji terpisah. |
| V07 | Pajak biaya dan aturan promo usaha | Profil dapat diatur; angka contoh hanya simulasi | Tetapkan dasar dan tarif nyata sebelum transaksi nyata. |
| V08 | Tempat retur dan kebijakan refund | Outlet asal; persetujuan pengelola; rincian transaksi asli | Retur lintas lokasi atau refund biaya khusus perlu aturan tambahan. |
| V09 | Jadwal serta cara opname | Gerak SKU dihentikan singkat saat hitung; kedatangan relevan dibereskan dahulu | Hitung sambil operasi penuh memerlukan pencatatan gerak yang lebih rinci. |
| V10 | Masa simpan bukti audit dan cadangan | Pengelola menetapkan sebelum pilot | Menentukan akses riwayat, biaya simpan, serta prosedur pemulihan. |
| V11 | Target beban jam layanan dan pemulihan | Target usulan KM03 sampai KM07 | Menentukan biaya dan bentuk layanan yang dapat dijanjikan. |
| V12 | Kasir yang dibangun baru atau sistem lama | Kasir di dalam template | Integrasi kasir lama memerlukan akses dan pemetaan transaksi yang jelas. |

Pertanyaan wawancara berikut membantu memvalidasi model tanpa membahas teknologi: dalam satu hari berapa kali barang dikirim; siapa yang menghitung; apakah satu kiriman dapat datang bertahap; bagaimana barang rusak atau tersisa ditangani; kapan kasir menutup hari; apakah satu porsi mempunyai isi tetap; dan kejadian salah catat apa yang paling sering terjadi. Minta satu contoh dokumen kirim, rekap kasir, serta proses tutup hari untuk mencocokkan istilah dan alur.

# 12 Rujukan

**R1.** Institut Teknologi Bandung. Mata Kuliah IF2150 Rekayasa Perangkat Lunak, kurikulum 2024. Halaman resmi memuat rekayasa kebutuhan, pemodelan, rancangan, dan pengujian sebagai bagian materi serta capaian pembelajaran. https://six.itb.ac.id/pub/kur2024/matakuliah/51852. Diakses 10 November 2026.

**R2.** Object Management Group. Unified Modeling Language versi 2.5.1. Rujukan notasi aktor, use case, aktivitas, urutan, status, dan kelas. https://www.omg.org/spec/UML/2.5.1/. Diakses 10 November 2026.

**R3.** ISO. ISO/IEC/IEEE 29148:2018 Systems and software engineering Life cycle processes Requirements engineering. Rujukan umum proses serta informasi kebutuhan; dokumen ini tidak menyalin standar atau menyatakan kepatuhan penuh. https://www.iso.org/standard/72089.html. Diakses 10 November 2026.

**R4.** Kebutuhan usaha yang disampaikan Adi Haditya Nursyam pada 10 November 2026: sinkronisasi gudang, pengiriman, outlet, kasir, penerimaan terlambat, aturan komersial, dan akun dengan beberapa peran. Aturan terperinci, target mutu, serta nilai awal yang belum disebut pengguna merupakan keputusan rancangan yang ditandai dalam dokumen.
