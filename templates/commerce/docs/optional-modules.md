# Modul tambahan Tampiloka Commerce

Modul ditentukan saat proyek dibuat, terpisah dari level, susunan halaman, kartu, warna, dan gaya tombol. Modul hanya berlaku untuk level `store` dan `advanced`.

## Membuat proyek

```sh
tampiloka create toko-senja --template commerce --level store \
  --features promotions,taxes,service-fees,customer-accounts,loyalty-points,membership-tiers --yes
tampiloka doctor --dir ./toko-senja
```

ID modul: `promotions`, `taxes`, `service-fees`, `customer-accounts`, `loyalty-points`, `membership-tiers`. Gunakan `--features none` untuk menonaktifkan semuanya atau `--features all` untuk mengaktifkan seluruhnya. Bila tidak dipilih, level `advanced` tetap mendapat promo seperti versi lama; level `store` tidak menambah modul. Poin memerlukan akun; tier memerlukan poin. CLI menolak kombinasi tidak valid. Modul produksi tidak bisa diaktifkan dengan permintaan dari browser.

Konfigurasi tersimpan di `config/commerce.json`:

```json
{
  "level": "store",
  "modules": {
    "promotions": true, "taxes": true, "serviceFees": true,
    "customerAccounts": true, "loyaltyPoints": true, "membershipTiers": true
  },
  "pricing": {"taxBps": 0, "taxIncluded": false, "serviceFeeBps": 0},
  "loyalty": {
    "earnSpendIdr": 10000, "pointValueIdr": 100,
    "minRedeemPoints": 10, "silverSpendIdr": 1000000, "goldSpendIdr": 5000000
  }
}
```

`taxBps` dan `serviceFeeBps` menggunakan basis poin: 100 = 1%. Keduanya **nol secara default**. Pemilik mengubah tarif dan mode harga inklusif/eksklusif dari Pengaturan Toko. Pajak hanya boleh diaktifkan sesuai kewajiban merchant, bukan otomatis dikenakan ke semua UMKM. Ini kalkulasi checkout dan snapshot, **bukan** faktur pajak elektronik atau pelaporan pajak resmi. Pajak dihitung atas nilai barang setelah diskon dan penukaran poin (tanpa ongkir/biaya layanan); biaya layanan dihitung dari dasar nilai barang yang sama.

## Member dan OTP

`customer-accounts` menggunakan email terverifikasi. Pada demo, kode 6 angka terlihat di antarmuka dan tidak ada email sungguhan; tidak digunakan untuk merchant nyata. Untuk produksi, siapkan akun Resend, verifikasi domain pengirim, dan atur secrets:

```sh
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put MEMBER_EMAIL_FROM
```

`MEMBER_EMAIL_FROM` adalah identitas pengirim seperti `Toko <member@domain-toko.com>`. Tanpa dua konfigurasi ini, login member produksi gagal tertutup (503) dan tidak mengeluarkan kode demo. Kode berlaku 10 menit, dibatasi lima percobaan. Batas pengiriman per email dan IP diterapkan di server. Identity hanya diambil dari email yang berhasil diverifikasi; ID member tidak bisa diatur dari checkout.

**Batas:** akun member menyinkronkan saldo poin dan tier berdasarkan email terverifikasi. Riwayat dan tindakan pesanan masih terikat ke sesi checkout asal atau kode pelacakan baca-saja. Fitur ini belum menyatukan seluruh riwayat pesanan dari banyak perangkat ke satu halaman akun. Tidak ada login WhatsApp atau pembayaran membership berlangganan.

## Poin dan tier

Poin ditukar pada checkout sesuai saldo, batas minimum, dan nilai yang dikonfigurasi. Pengurangan saldo, pemakaian kupon, reservasi stok, dan pembuatan pesanan terjadi dalam satu transaksi D1, sehingga percobaan duplikat dan stok bersamaan tidak menggandakan penggunaan poin. Pengembalian stok karena pembatalan atau retur lengkap mengembalikan poin yang ditukar. Poin baru **diberikan saat pesanan selesai dan sudah lunas**, sekali per pesanan; kelayakan poin dan perhitungan belanja tier dicatat saat checkout, sehingga perubahan modul setelah checkout tidak mengubah hak pesanan tersebut; poin yang sempat diberikan ditarik kembali saat retur lengkap. Jika poin sudah digunakan sebelum retur, saldo dapat menjadi negatif sebagai kewajiban poin dan tidak bisa ditukar lagi sampai saldo cukup.

Nilai bawaan: 1 poin per Rp10.000 nilai produk bersih, penukaran 1 poin = Rp100, minimum penukaran 10 poin. Tier ditentukan dari belanja selesai yang lunas, setelah diskon dan penukaran poin, bukan total tagihan termasuk pajak/ongkir. Member biasa mendapatkan 1× poin, Silver (mulai Rp1.000.000) 2×, Gold (mulai Rp5.000.000) 3×. Tier bukan langganan berbayar dan **tidak secara otomatis memberikan diskon harga**.

## Nilai total pesanan dan migrasi

Migrasi `0002_optional_modules.sql` dan `0003_loyalty_eligibility.sql` bersifat additive; pesanan lama mempertahankan perilaku loyalitas sebelumnya. Migrasi tidak menghapus pesanan, ulasan atau histori sebelumnya. Total dan rincian order tetap dibekukan. Untuk kompatibilitas dengan batas CHECK bawaan database lama, kolom internal legacy `orders.shipping_fee` menyimpan jumlah tambahan (ongkir + pajak eksklusif + biaya layanan). Kolom baru `shipping_base_fee`, `tax_amount`, `tax_included`, `service_fee`, dan `points_discount` adalah sumber rincian yang ditampilkan di API. Kode laporan/pengguna harus memakai objek order dari mapper atau kolom rincian baru, **bukan menganggap kolom legacy `shipping_fee` sebagai ongkir murni**.

Terapkan migrasi D1 sebelum menjalankan Worker versi baru; checkout memerlukan kolom `loyalty_eligible` dari migrasi `0003`.

Batas lain: retur yang didukung adalah retur keseluruhan pesanan; belum ada penukaran poin parsial untuk retur per item, kedaluwarsa poin, gift card saldo, promo bertumpuk di level produk, atau peraturan pajak lintas yurisdiksi. Gateway Midtrans tetap perlu uji sandbox kredensial merchant sendiri.

## Operasional

Di ruang staf demo, modul bisa diaktifkan/nonaktifkan untuk membandingkan konfigurasi. Perubahan ini tersimpan hanya pada scope demo pengunjung. Di produksi, pilihan modul dikunci dari deployment; mengaktifkannya untuk klien berarti memperbarui konfigurasi dan redeploy yang diuji. Penyedia email dan SMS, proses pajak, dan biaya payment gateway merupakan biaya operasional terpisah. Perbarui `docs/api.md` dan jalankan pengujian penuh sebelum pemasangan ke klien.
