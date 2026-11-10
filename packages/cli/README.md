# Tampiloka CLI

Dari checkout monorepo, jalankan `pnpm tampiloka create nama-proyek` atau `npm install --global ./packages/cli`. Bin `tampiloka` memakai sumber monorepo saat terpasang dari folder lokal. Untuk paket mandiri, jalankan `pnpm cli:pack` lalu `npm install --global ./tampiloka-cli-1.0.0.tgz`.

`prepack` menyalin sumber template yang dapat dipakai dan paket bersama ke dalam arsip. Arsip tidak memerlukan checkout monorepo di mesin tujuan. Tidak ada paket npm publik yang diasumsikan sudah terbit.

```sh
tampiloka create kopi-senja
tampiloka create menu --template cafe --modules catalog --yes
tampiloka create rupa --template commerce --preset atelier --level store --yes
tampiloka list
tampiloka presets commerce
tampiloka doctor --dir ./rupa
```

Proyek yang dibuat mandiri: cafe memakai alur generator yang sudah ada; commerce, school, dan booking mendapat salinan paket bersama dengan dependensi `file:`. CLI tidak menyalin rahasia, database lokal, `node_modules`, atau hasil build. Folder yang sudah ada tidak pernah ditimpa.

Cafe `--modules catalog` membuat menu hanya-baca dari `content/menu.json` tanpa database demo; jalankan `npm run dev`. Preset `--preset catalog` tetap menyediakan permintaan pelayan dan memakai demo transaksi. Ganti dan periksa konten contoh sebelum publikasi. Opsi `--modules` tidak dapat digabung dengan `--preset`.

Operations masih `planned`. `tampiloka list` menampilkannya sebagai direncanakan; `presets operations` dan `create --template operations` tetap ditolak sampai standalone dan alur inti diverifikasi. Kontrak yang disiapkan mencakup preset food/retail/supplies, mode inventory/retail/full, serta tema sand/forest/ink. Implementasi generator dan doctor sudah ada untuk verifikasi internal, tetapi family belum disertakan dalam payload paket publik. Lihat [panduan Operations](../../templates/operations/README.md).
