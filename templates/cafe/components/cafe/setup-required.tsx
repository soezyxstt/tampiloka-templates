import { cafeConfig } from '@/src/config/cafe';
import { BrandMark } from './brand';

export function SetupRequired() {
  return <main className="min-h-screen flex items-center justify-center p-6"><div className="max-w-xl w-full border border-[var(--border)] rounded-[var(--radius-panel)] bg-[var(--surface)] p-8 space-y-5"><BrandMark /><h1 className="text-3xl font-semibold">Siapkan {cafeConfig.brand.name}</h1><p className="text-[var(--muted-foreground)]">Jalankan demo lokal untuk mencoba menu, kasir, dan alur pesanan.</p><pre className="bg-[var(--background)] p-4 rounded-[var(--radius-control)] overflow-auto text-sm">npm install{'\n'}npm run demo</pre><p className="text-sm text-[var(--muted-foreground)]">Demo memakai data contoh dan kode pembayaran yang tidak dapat dibayar. Untuk layanan nyata, hubungkan autentikasi staf dan penyedia pembayaran yang terverifikasi.</p></div></main>;
}
