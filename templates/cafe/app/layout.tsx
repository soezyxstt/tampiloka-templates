import type { Metadata, Viewport } from 'next';
import type { CSSProperties } from 'react';
import { Manrope, Source_Sans_3 } from 'next/font/google';
import { cafeConfig, getBrandCssVariables } from '@/src/config/cafe';
import './globals.css';
import { MotionProvider } from '@/components/ui/motion';

const manrope = Manrope({ subsets: ['latin'], weight: ['600', '700', '800'], display: 'swap', variable: '--font-brand-heading' });
const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap', variable: '--font-sans' });

export const metadata: Metadata = {
  title: { default: cafeConfig.brand.name, template: `%s | ${cafeConfig.brand.name}` },
  description: cafeConfig.brand.description,
  robots: process.env.CAFE_DEMO_DB === '1' ? { index: false, follow: false } : undefined,
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: cafeConfig.brand.primaryColor };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-theme={cafeConfig.theme} className={`${manrope.variable} ${sourceSans.variable}`} style={getBrandCssVariables() as CSSProperties}>
      <body className="min-h-screen antialiased"><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
