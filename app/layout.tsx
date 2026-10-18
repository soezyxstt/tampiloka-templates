import type { Metadata } from 'next';
import { Manrope, Source_Sans_3 } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
  variable: '--font-heading',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Kafe Order & POS — Kedai Meranti',
  description:
    'Aplikasi pemesanan meja mandiri, kasir operasional, layar dapur/bar, denah ruang, membership promo, dan laporan untuk kafe dan restoran.',
  openGraph: {
    title: 'Kafe Order & POS — Kedai Meranti',
    description:
      'Aplikasi pemesanan meja mandiri, kasir operasional, layar dapur/bar, denah ruang, membership promo, dan laporan untuk kafe dan restoran.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kafe Order & POS — Kedai Meranti',
    description:
      'Aplikasi pemesanan meja mandiri, kasir operasional, layar dapur/bar, denah ruang, membership promo, dan laporan untuk kafe dan restoran.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${manrope.variable} ${sourceSans.variable}`}>
      <body suppressHydrationWarning className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  );
}
