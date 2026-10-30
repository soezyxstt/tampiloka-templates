'use client';
import { useCafeLanguage } from '@/lib/language';
import { cafeConfig } from '@/src/config/cafe';
import { BrandMark } from './brand';

export function SetupRequired() {
  const { t: tr } = useCafeLanguage();
  return <main className="min-h-screen flex items-center justify-center p-6"><div className="max-w-xl w-full border border-[var(--border)] rounded-[var(--radius-panel)] bg-[var(--surface)] p-8 space-y-5"><BrandMark /><h1 className="text-3xl font-semibold">{tr("Siapkan", "Set up")} {cafeConfig.brand.name}</h1><p className="text-[var(--muted-foreground)]">{tr("Jalankan demo lokal untuk mencoba menu, kasir, dan alur pesanan.", "Run the local demo to try the menu, cashier and ordering flow.")}</p><pre className="bg-[var(--background)] p-4 rounded-[var(--radius-control)] overflow-auto text-sm">npm install{'\n'}npm run demo</pre><p className="text-sm text-[var(--muted-foreground)]">{tr("Demo memakai data contoh dan kode pembayaran yang tidak dapat dibayar. Untuk layanan nyata, hubungkan autentikasi staf dan penyedia pembayaran yang terverifikasi.", "The demo uses sample data and non-payable payment codes. For real service, connect staff authentication and a verified payment provider.")}</p></div></main>;
}
