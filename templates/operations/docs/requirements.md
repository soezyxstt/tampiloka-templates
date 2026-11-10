# Pemetaan kebutuhan

Status penerimaan penuh seluruh baris: **belum diverifikasi**. Implementasi domain, Worker dan UI sedang diintegrasikan. Bukti parsial tersedia pada [verifikasi](verification.md): 76 tes ringan domain/storage/report/recovery/draf/cadangan, pemeriksaan token desain (0 temuan), konfigurasi dan generator sumber. Referensi AT pada tabel tetap menunjukkan kebutuhan pembuktian lengkap, bukan klaim lulus berdasarkan tes unit saja.

Jalur implementasi saat ini: KF01–02 pada `worker/index.ts`, `worker/store.ts` dan otorisasi `src/domain/core.ts`; KF03–18, KF23–28 dan KF33 pada `src/domain/engine.ts`; KF19–22 pada `src/domain/pricing.ts`; KF29–32 dan KF38 pada `src/domain/report.ts` beserta halaman laporan/audit; KF34 pada `src/lib/api.ts`, `src/lib/store.tsx` dan jurnal command Worker; KF35 pada `config/operations.json`, `config/validate.ts` serta generator CLI; KF36 pada command impor; KF37 pada backup/restore Worker. Keberadaan jalur ini belum membuktikan semua rincian kebutuhan terpenuhi.

| ID | Kebutuhan | Area yang perlu dibuat / diubah | AT terkait | Status |
| --- | --- | --- | --- | --- |
| KF01 | Sistem harus mengautentikasi akun, membatasi akses pada usaha aktif, dan menolak akun nonaktif. | Identitas dan hak akses | AT21, AT22, AT23 | Belum diverifikasi |
| KF02 | Pengelola harus dapat memberi beberapa penugasan peran beserta lokasi kepada satu akun dan melihat hak efektifnya. | Identitas dan hak akses | AT21, AT22, AT23 | Belum diverifikasi |
| KF03 | Pengelola harus dapat mengatur lokasi, jenis lokasi, kota, zona waktu usaha, serta status aktif tanpa menghapus riwayat lokasi lama. | Data induk dan mutasi | AT01, AT38 | Belum diverifikasi |
| KF04 | Sistem harus menyimpan SKU, nama, varian, satuan dasar, konversi tetap, kondisi, serta status aktif; SKU yang pernah dipakai tidak boleh didaur ulang. | Data induk dan mutasi | AT01, AT20, AT38 | Belum diverifikasi |
| KF05 | Sistem harus menerima saldo awal atau penerimaan eksternal berisi asal, bukti, jumlah, satuan, lokasi, kondisi, dan waktu kejadian. | Data induk dan mutasi | AT01, AT20, AT38 | Belum diverifikasi |
| KF06 | Sistem harus menampilkan saldo layak jual, ditahan, dan belum selesai diterima beserta waktu pembaruan dan penanda minus. | Persediaan dan pengiriman | AT04, AT36 | Belum diverifikasi |
| KF07 | Petugas berwenang harus dapat membuat draf transfer satu asal, satu tujuan, dan beberapa baris SKU dalam usaha yang sama. | Persediaan dan pengiriman | AT01 | Belum diverifikasi |
| KF08 | Pengesahan barang keluar harus mengurangi asal dan menambah jumlah pengiriman secara utuh, lalu membekukan rincian yang sudah disahkan. | Persediaan dan pengiriman | AT02, AT13 | Belum diverifikasi |
| KF09 | Penerima harus dapat menandai waktu tiba tanpa mengubah stok dan melihat daftar kiriman yang menunggu pemeriksaan. | Persediaan dan pengiriman | AT02 | Belum diverifikasi |
| KF10 | Penerima harus dapat menerima sebagian atau seluruh sisa kiriman, memisahkan barang baik dan ditahan, serta menambahkan jumlah ke saldo terkini. | Persediaan dan pengiriman | AT04, AT05, AT07, AT09, AT11 | Belum diverifikasi |
| KF11 | Sistem harus mencatat kekurangan, kelebihan, kerusakan, bukti, penanggung jawab, dan keputusan penyelesaian per baris. | Persediaan dan pengiriman | AT08, AT09, AT10 | Belum diverifikasi |
| KF12 | Sistem harus mendukung barang kembali ke asal, transfer balik, dan kehilangan sah tanpa memakai pembatalan sebagai pengganti gerak barang. | Persediaan dan pengiriman | AT15 | Belum diverifikasi |
| KF13 | Sistem harus menerapkan kebijakan stok minus menurut lokasi dan tindakan serta menampilkan daftar minus yang belum selesai. | Persediaan dan pengiriman | AT03, AT12 | Belum diverifikasi |
| KF14 | Sistem harus mencatat sesi opname, batas waktu, saldo pembanding, hitungan fisik, selisih, persetujuan, dan hubungan koreksi. | Persediaan dan pengiriman | AT16, AT17, AT18 | Belum diverifikasi |
| KF15 | Sistem harus mendukung penyesuaian, pembalikan, pelolosan barang ditahan, dan pemusnahan dengan alasan serta persetujuan yang sesuai. | Persediaan dan pengiriman | AT09, AT16, AT18, AT19 | Belum diverifikasi |
| KF16 | Pengelola harus dapat menelusuri setiap saldo hingga mutasi dan dokumen asal serta melihat riwayat sebelum dan sesudah koreksi. | Persediaan dan pengiriman | AT04, AT19, AT35 | Belum diverifikasi |
| KF17 | Sistem harus menjaga keseimbangan setiap pengiriman dan menolak penerimaan berlebih, penutupan bersisa, serta stok ditahan atau transit negatif. | Persediaan dan pengiriman | AT02, AT07, AT08, AT09, AT10, AT11, AT15, AT17 | Belum diverifikasi |
| KF18 | Sistem harus mengenali pengulangan tindakan, menolak identitas sama dengan isi berbeda, dan mempertahankan hasil saat ada input bersamaan. | Persediaan dan pengiriman | AT05, AT06, AT11, AT12, AT13, AT14, AT18, AT28 | Belum diverifikasi |
| KF19 | Sistem harus memilih harga menurut SKU, lokasi, waktu, dan prioritas, serta menolak rentang harga setara yang saling bertumpuk. | Kasir dan aturan komersial | AT24, AT29 | Belum diverifikasi |
| KF20 | Pengelola harga harus dapat mengatur diskon tetap atau persentase, sasaran, batas nilai, masa berlaku, prioritas, dan penggabungan. | Kasir dan aturan komersial | AT25, AT26 | Belum diverifikasi |
| KF21 | Sistem harus mengelola voucher, kuota, syarat, penolakan yang jelas, dan pemakaian kuota tepat satu kali pada penjualan selesai. | Kasir dan aturan komersial | AT25, AT26, AT28 | Belum diverifikasi |
| KF22 | Sistem harus menyediakan profil pajak dan biaya layanan dengan dasar hitung, modus inklusif atau eksklusif, urutan, serta pembulatan yang jelas. | Kasir dan aturan komersial | AT25, AT26, AT27 | Belum diverifikasi |
| KF23 | Kasir harus dapat mencari produk, mengubah jumlah, melihat rincian total, dan menyimpan atau membatalkan keranjang tanpa mengubah stok. | Kasir dan aturan komersial | AT03, AT29 | Belum diverifikasi |
| KF24 | Finalisasi penjualan harus menyimpan rincian harga tetap, pembayaran sah atau penanda tagihan nol yang sah, kuota terpakai, dan pengurangan stok tepat satu kali. | Kasir dan aturan komersial | AT03, AT12, AT13, AT14, AT24, AT28, AT29, AT30, AT31 | Belum diverifikasi |
| KF25 | Sistem harus membedakan pembayaran belum dikonfirmasi, perlu diperiksa, terkonfirmasi, gagal, tidak diperlukan untuk tagihan nol, serta ringkasan refund sebagian atau seluruhnya. | Kasir dan aturan komersial | AT03, AT30 | Belum diverifikasi |
| KF26 | Sistem harus menerbitkan bukti transaksi bernomor unik yang memuat lokasi, waktu, kasir, baris barang, potongan, biaya, pajak, total, dan pembayaran. | Kasir dan aturan komersial | AT03, AT29 | Belum diverifikasi |
| KF27 | Sistem harus mendukung retur parsial atau penuh dan refund tertaut, dengan batas jumlah, kondisi barang, nilai asli, serta persetujuan. | Kasir dan aturan komersial | AT31, AT32 | Belum diverifikasi |
| KF28 | Kasir harus dapat membuka dan menutup sif, mencatat gerak kas beralasan, serta membandingkan kas seharusnya dengan kas fisik. | Kasir dan aturan komersial | AT33 | Belum diverifikasi |
| KF29 | Pengelola harus dapat memfilter ringkasan stok dan penjualan menurut lokasi, kota, SKU, status, dan rentang waktu. | Laporan dan operasi template | AT04, AT23, AT34 | Belum diverifikasi |
| KF30 | Sistem harus memberi daftar tindakan untuk penerimaan terlambat, selisih, stok minus, dan permintaan persetujuan; status selesai harus mengikuti data asal. | Laporan dan operasi template | AT04, AT08, AT36 | Belum diverifikasi |
| KF31 | Sistem harus menyediakan laporan mutasi, transfer, penjualan, diskon, pajak, biaya, retur, pembayaran, dan sif dengan ekspor sesuai hak akses. | Laporan dan operasi template | AT23, AT33, AT34 | Belum diverifikasi |
| KF32 | Sistem harus membedakan waktu kejadian dan pencatatan serta memberi label pada laporan historis dan catatan terlambat. | Laporan dan operasi template | AT18, AT35 | Belum diverifikasi |
| KF33 | Sistem harus mencatat audit masuk akun, perubahan peran, data induk, aturan komersial, persetujuan, transaksi, dan koreksi. | Laporan dan operasi template | AT19, AT21, AT22, AT35 | Belum diverifikasi |
| KF34 | Pengguna harus dapat mengetahui status koneksi, data terakhir diperbarui, tindakan tertunda, dan hasil yang belum pasti; percobaan ulang tidak boleh menggandakan data. | Laporan dan operasi template | AT05, AT14, AT30, AT36 | Belum diverifikasi |
| KF35 | Template harus dapat mengubah identitas usaha, lokasi, katalog, peran, fitur aktif, dan kebijakan melalui konfigurasi yang jelas tanpa menyalin ulang aturan stok. | Laporan dan operasi template | AT39 | Belum diverifikasi |
| KF36 | Sistem harus menyediakan prosedur impor awal dengan pratinjau, validasi, penolakan baris salah, serta identitas impor untuk mencegah saldo awal ganda. | Laporan dan operasi template | AT38 | Belum diverifikasi |
| KF37 | Sistem harus menyediakan cadangan, pemulihan, dan rekonsiliasi yang dapat dibuktikan, serta membatasi pengarsipan agar riwayat tetap dapat ditelusuri. | Laporan dan operasi template | AT37 | Belum diverifikasi |
| KF38 | Sistem harus menyediakan pencarian dokumen dan rujukan silang dari laporan ke penjualan, kiriman, penerimaan, opname, dan koreksi terkait. | Laporan dan operasi template | AT35 | Belum diverifikasi |

| AT | Skenario | Kebutuhan | Status |
| --- | --- | --- | --- |
| AT01 | Saldo pembukaan dan draf | KF03 KF04 KF05 KF07 | Belum diverifikasi / belum dijalankan |
| AT02 | Barang keluar dan penanda tiba | KF08 KF09 KF17 | Belum diverifikasi / belum dijalankan |
| AT03 | Penjualan sebelum penerimaan | KF13 KF23 KF24 KF25 KF26 | Belum diverifikasi / belum dijalankan |
| AT04 | Penerimaan terlambat menghasilkan 195 | KF06 KF10 KF16 KF29 KF30 | Belum diverifikasi / belum dijalankan |
| AT05 | Penerimaan diulang setelah respons hilang | KF10 KF18 KF34 KM05 KM11 | Belum diverifikasi / belum dijalankan |
| AT06 | Identitas sama dengan isi berbeda | KF18 | Belum diverifikasi / belum dijalankan |
| AT07 | Penerimaan sebagian | KF10 KF17 | Belum diverifikasi / belum dijalankan |
| AT08 | Kekurangan dan penutupan kiriman | KF11 KF17 KF30 | Belum diverifikasi / belum dijalankan |
| AT09 | Barang baik rusak dan belum ditemukan | KF10 KF11 KF15 KF17 | Belum diverifikasi / belum dijalankan |
| AT10 | Kelebihan penerimaan | KF11 KF17 | Belum diverifikasi / belum dijalankan |
| AT11 | Dua penerima memakai sisa yang sama | KF10 KF17 KF18 KM01 KM05 | Belum diverifikasi / belum dijalankan |
| AT12 | Penjualan bersamaan dan urutan berbeda | KF13 KF18 KF24 KM05 | Belum diverifikasi / belum dijalankan |
| AT13 | Kegagalan di tengah pengesahan | KF08 KF18 KF24 KM01 | Belum diverifikasi / belum dijalankan |
| AT14 | Koneksi terputus dan draf luring | KF18 KF24 KF34 KM11 | Belum diverifikasi / belum dijalankan |
| AT15 | Pembatalan dan barang kembali | KF12 KF17 | Belum diverifikasi / belum dijalankan |
| AT16 | Opname dengan penjualan setelah hitung | KF14 KF15 | Belum diverifikasi / belum dijalankan |
| AT17 | Opname saat kiriman belum dibukukan | KF14 KF17 | Belum diverifikasi / belum dijalankan |
| AT18 | Kejadian lama setelah opname tertutup | KF14 KF15 KF18 KF32 | Belum diverifikasi / belum dijalankan |
| AT19 | Koreksi dan barang ditahan | KF15 KF16 KF33 KM09 | Belum diverifikasi / belum dijalankan |
| AT20 | Satuan dan riwayat produk | KF04 KF05 KM10 | Belum diverifikasi / belum dijalankan |
| AT21 | Peran ganda dengan cakupan berbeda | KF01 KF02 KF33 KM02 | Belum diverifikasi / belum dijalankan |
| AT22 | Pencabutan hak dan pengelola terakhir | KF01 KF02 KF33 KM02 | Belum diverifikasi / belum dijalankan |
| AT23 | Akses langsung laporan dan ekspor | KF01 KF02 KF29 KF31 KM02 | Belum diverifikasi / belum dijalankan |
| AT24 | Harga berlaku dan transaksi historis | KF19 KF24 | Belum diverifikasi / belum dijalankan |
| AT25 | Syarat dan penggabungan promosi | KF20 KF21 KF22 | Belum diverifikasi / belum dijalankan |
| AT26 | Hitungan eksklusif dan pembagian rupiah | KF20 KF21 KF22 KM10 | Belum diverifikasi / belum dijalankan |
| AT27 | Pajak termasuk harga | KF22 KM10 | Belum diverifikasi / belum dijalankan |
| AT28 | Kuota voucher terakhir bersamaan | KF18 KF21 KF24 KM05 | Belum diverifikasi / belum dijalankan |
| AT29 | Keranjang berubah dan barang gratis | KF19 KF23 KF24 KF26 | Belum diverifikasi / belum dijalankan |
| AT30 | Pembayaran kurang dan hasil perlu diperiksa | KF24 KF25 KF34 | Belum diverifikasi / belum dijalankan |
| AT31 | Retur sebagian memakai rincian asli | KF24 KF27 KM10 | Belum diverifikasi / belum dijalankan |
| AT32 | Refund tanpa barang dan retur rusak | KF27 | Belum diverifikasi / belum dijalankan |
| AT33 | Sif kasir dan koreksi setelah tutup | KF28 KF31 | Belum diverifikasi / belum dijalankan |
| AT34 | Rekonsiliasi laporan seluruh lokasi | KF29 KF31 KM10 | Belum diverifikasi / belum dijalankan |
| AT35 | Tanggal kejadian audit dan penelusuran | KF16 KF32 KF33 KF38 KM09 | Belum diverifikasi / belum dijalankan |
| AT36 | Pembaruan antarlayar dan kegunaan | KF06 KF30 KF34 KM04 KM08 KM11 | Belum diverifikasi / belum dijalankan |
| AT37 | Pemulihan cadangan | KF37 KM07 | Belum diverifikasi / belum dijalankan |
| AT38 | Impor dan pembukaan berulang | KF03 KF04 KF05 KF36 | Belum diverifikasi / belum dijalankan |
| AT39 | Penggunaan ulang template | KF35 KM12 | Belum diverifikasi / belum dijalankan |
| AT40 | Beban dan kesiapan operasi | KM03 KM05 KM06 KM07 | Belum diverifikasi / belum dijalankan |
