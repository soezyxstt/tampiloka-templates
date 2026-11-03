# Menyesuaikan situs sekolah

Preset `institution` menyediakan kerangka situs sekolah dan dashboard konten. Demo memakai SMP Nusa Cendekia dan seluruh orang, kegiatan, prestasi, jadwal, serta biaya di dalamnya adalah fiktif. Untuk sekolah yang sebenarnya, gunakan mode produksi dan isi informasi sekolah Anda sendiri.

## Identitas dan gambar

1. Di `config/school.json`, atur `preset` menjadi `institution`, ubah `brandName`, `whatsapp`, `locale`, dan tampilan sesuai kebutuhan. WhatsApp menggunakan nomor internasional tanpa tanda `+`, misalnya `628...`; kosongkan jika tidak digunakan.
2. Di `config/institution.json`, isi `address`, `email`, `logo`, dan `heroImage`. Isi `teacherImage` untuk gambar pembuka halaman pendidik. Semua nilai gambar boleh kosong jika belum tersedia. `name` opsional: jika diisi, nama ini menggantikan `brandName` dan juga nama sekolah dalam preview demo. Jika kosong, produksi menggunakan `brandName` dan demo menggunakan nama contoh.
3. `images` mengatur gambar untuk area tertentu di beranda: `activities`, `extracurricular`, `immersion`, `journeyMain`, `journeyDetail`, `achievement`, `immersionFeature`, dan `invitation`. Gunakan path dari `public`, misalnya `/images/sekolah/gedung.webp`, setelah menambahkan file ke `public/images/sekolah/`. Gunakan gambar yang hak pakainya dimiliki sekolah.
4. Isi konten, foto halaman, berita, prestasi, galeri, guru, program, dan penerimaan melalui dashboard. Sediakan versi Indonesia dan Inggris untuk setiap teks yang ditampilkan. Periksa ulang semua jadwal, syarat dan biaya sebelum menerbitkannya.

Konfigurasi identitas dan aset merupakan bagian dari build; setelah mengubah file, bangun ulang dan jalankan ulang aplikasi. Perubahan `brandName`, alamat, email, dan konten dalam dashboard tersimpan dalam database. Konfigurasi seed hanya mengisi database baru: mengedit file konfigurasi tidak otomatis menimpa data yang sudah disimpan. Gunakan pengaturan dashboard untuk mengubah identitas dan kontak pada database yang sudah ada, dan editor konten untuk halaman yang sudah ada.

Di editor konten, pilih halaman `home` untuk mengubah judul dan ringkasan hero, serta teks tiap bagian beranda. Blok awal memiliki ID stabil `welcome`, `journey`, `information`, `news`, `achievement`, `immersion`, `activities`, dan `invitation`; ubah judul dan isi blok yang sudah ada agar masing-masing tetap terhubung ke bagiannya. Gambar utama halaman dapat diubah di editor konten; gambar dekoratif beranda diatur melalui `config/institution.json`.

`heroImage` mengisi foto awal ketika database dibuat. Setelah halaman dikelola di CMS, foto halaman yang diterbitkan menjadi sumber utama agar perubahan editor tidak tertutup oleh konfigurasi awal.

## Data awal dan demo

Database produksi baru untuk preset `institution` memiliki navigasi dan halaman awal yang dapat diedit. Isi halaman, daftar pendidik, program, berita, prestasi, dan galeri belum diisi dengan data sekolah; tambahkan data nyata sebelum digunakan. Biaya dan jadwal contoh dalam demo tidak menjadi ketentuan sekolah Anda.

Mode demo terpisah untuk memperlihatkan kemampuan template dan menggunakan konten contoh. Nilai identitas, kontak, dan aset yang diisi di `institution.json` juga menggantikan nilai contoh di preview; konten, orang, kegiatan, jadwal, dan biaya lainnya tetap fiktif. Kosongkan nilai konfigurasi untuk memakai contoh demo kembali. Jangan gunakan demo sebagai situs produksi. Ikuti [panduan deployment](deployment.md) untuk konfigurasi database, akun, dan rahasia server; jangan simpan kredensial dalam berkas konfigurasi atau gambar.

## Alamat halaman

Navigasi situs menggunakan route: `/profil`, `/visi-misi`, `/kontak`, `/penerimaan`, `/penerimaan/jalur-tes`, `/penerimaan/jalur-prestasi`, `/kehidupan-sekolah`, `/tenaga-pendidik`, `/berita`, `/berita/<slug>`, `/prestasi`, `/galeri`, dan `/informasi`. Dashboard berada di `/admin`, editor konten di `/admin/content`, portal di `/portal`, dan formulir di `/daftar`.

Versi Inggris memakai awalan `/en`, misalnya `/en/school-profile` dan `/en/news/<slug>`. Pergantian bahasa mempertahankan halaman yang sedang dibaca. Tautan lama `?page=...` tetap dikenali dan dinormalkan ke route baru. Query preset, level, layout, tema, serta peran khusus tetap tersedia untuk kontrol demo; query tersebut tidak memberikan akses di produksi.

Konfigurasi Vite dan Cloudflare sudah menyediakan fallback SPA, sehingga route dapat dibuka langsung atau dimuat ulang. Halaman yang tidak dikenal menampilkan pesan tidak ditemukan; fallback aset masih mengembalikan HTTP 200. Hosting di subfolder domain belum didukung. Uji hasil build dan database baru sebelum deployment.
