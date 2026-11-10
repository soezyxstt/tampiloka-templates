# Panduan petugas dan skenario pemeriksaan

Panduan ini menjelaskan alur yang dituju spesifikasi. Selama status template masih
`planned`, setiap langkah perlu dicocokkan dengan implementasi dan bukti uji.
Angka di bawah adalah hasil yang diharapkan, bukan hasil pengujian yang sudah dijalankan.

## Alur utama: barang tiba sebelum dibukukan

Gunakan satu sesi demo yang sama untuk semua peran. Mengganti peran tidak boleh
membuat usaha atau saldo baru. Pilih preset food dan mode full. Gunakan SKU
CIMOL-ORI; angka SKU berbeda tidak boleh digabung sebagai satu saldo.

1. Pengelola memeriksa saldo pembukaan: Gudang Pusat Garut 1.000 porsi dan Garut 1
   nol. Buka dokumen pembukaan untuk memastikan saldo mempunyai sumber mutasi.
2. Petugas persediaan memilih gudang sebagai asal dan Garut 1 sebagai tujuan,
   lalu menyimpan draf 200 porsi. Draf belum mengubah saldo. Pengesahan pengiriman
   menghasilkan gudang 800 dan kiriman belum selesai diterima 200.
3. Penerima Garut 1 menandai kedatangan. Penanda ini belum menambah stok outlet.
4. Kasir Garut 1 membuka sif, memilih lima porsi dan memeriksa rincian tagihan.
   Setelah pembayaran dikonfirmasi dan penjualan selesai, saldo outlet menjadi
   -5. Periksa nomor bukti, pembayaran, dan peringatan stok minus.
5. Penerima memasukkan **jumlah yang datang pada penerimaan ini: 200** porsi
   baik. Jangan mengisi sisa fisik 195. Hasil yang diharapkan: outlet 195,
   gudang 800 dan sisa kiriman nol. Total tercatat untuk SKU ini 995.
6. Pengelola membuka rincian kiriman, penjualan, penerimaan, dan mutasi. Seluruh
   dokumen tetap terbaca. Peringatan minus harus mengikuti saldo terbaru.

Untuk hasil pengiriman yang belum pasti, gunakan identitas tindakan yang sama
untuk memeriksa hasil. Jangan membuat penerimaan baru sebagai percobaan ulang.
Pengujian AT05 mengulang identitas yang sama 100 kali; itu pekerjaan pengujian
terpisah, bukan prosedur petugas untuk menekan tombol berulang kali.

## Penerimaan dan selisih

Penerimaan sebagian mengisi hanya jumlah yang diterima kali ini. Contoh: setelah
penjualan lima porsi, penerimaan 80 menghasilkan 75 dengan sisa kiriman 120.
Penerimaan berikutnya 120 menghasilkan 195. Pisahkan barang baik dari barang
ditahan. Barang ditahan tidak tersedia untuk dijual.

Catat kekurangan dengan alasan, bukti dan penanggung jawab; sisa tetap terbuka
sampai penerimaan lanjutan, barang kembali ke asal, atau kehilangan disahkan.
Temuan kelebihan belum menambah stok. Jika asal mengonfirmasi pengiriman tambahan,
catat tambahan pengiriman lebih dahulu sebelum menerima tambahannya.

## Kasir, retur dan sif

Periksa lokasi aktif, satuan dan total sebelum konfirmasi pembayaran. Jika harga
berubah, periksa perhitungan baru sebelum mengesahkan. Bila respons hilang,
periksa hasil; jangan menagih ulang. Uang yang sudah diterima tetapi belum
terhubung ke penjualan selesai harus tetap mempunyai catatan pemeriksaan.

Retur mengacu ke penjualan asli dan jumlah yang benar-benar kembali. Barang rusak
masuk ditahan. Refund uang tanpa barang tidak menambah stok. Nilai retur memakai
alokasi harga, potongan, pajak dan biaya asli, bukan harga katalog hari ini.

Saat menutup sif, hitung kas fisik dan jelaskan selisih. Pembayaran nontunai tidak
masuk kas laci. Koreksi setelah penutupan dicatat terpisah; laporan penutupan asli
tidak boleh berubah diam-diam.

## Opname dan koreksi

Selesaikan kedatangan terkait sebelum menutup hitungan. Hentikan gerak SKU selama
penghitungan sampai angka fisik direkam. Persetujuan menerapkan selisih pada saldo
kini dan mempertahankan transaksi sesudah batas hitung. Bila penerimaan lama sudah
tercakup penyesuaian, gunakan koreksi tertaut bersama penerimaan agar barang tidak
dihitung dua kali. Jangan mengganti saldo langsung atau menghapus mutasi.

## Pemeriksaan akses dan laporan

Akun contoh dengan kasir di Garut 1 dan pengelola harga di Garut 2 hanya mendapat
dua pasangan kewenangan tersebut. Ia tidak otomatis menjadi kasir di Garut 2.
Pemilihan tema, bahasa atau mode tidak boleh memperluas izin.

Saat mengekspor laporan, catat filter lokasi, SKU, periode dan dasar waktu.
Waktu pencatatan menjelaskan angka yang diketahui sistem saat itu; waktu kejadian
merupakan analisis terpisah yang dapat memuat catatan terlambat. Bandingkan ekspor
dengan tampilan pada filter dan batas data yang sama.

## Sebelum dipakai oleh organisasi lain

Ganti konfigurasi identitas, lokasi, katalog dan satuan. Inisialisasi instalasi
produksi terpisah tanpa saldo demo. Tetapkan akses dan kebijakan melalui akun
berwenang. Tinjau V01–V12 pada spesifikasi, khususnya unit tetap, kebijakan minus,
pembayaran, pajak/biaya, retur, opname, retensi bukti dan pemulihan. Uji cadangan
di lingkungan pemulihan sebelum mengandalkannya untuk operasional.

## Pengajuan koreksi stok

Petugas persediaan atau penerima membuka **Opname & koreksi**, memilih **Ajukan koreksi stok**, lalu mencatat lokasi, SKU, selisih yang diusulkan, kondisi, dan bukti pemeriksaan. Pengajuan tidak mengubah saldo. Pengelola memeriksa dokumen pada jejak audit, memilih **Penyesuaian tertaut**, lalu memilih pengajuan pada lokasi yang sama. SKU persetujuan harus cocok dengan pengajuan. Jumlah akhir tetap keputusan pengelola berdasarkan bukti; isi alasan dan pengecualian persetujuan sendiri bila berlaku. Pengajuan yang sudah ditautkan ke keputusan tidak ditawarkan lagi.
