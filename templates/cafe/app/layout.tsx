import type { Metadata, Viewport } from 'next';
import type { CSSProperties } from 'react';
// Use the already-installed local fonts so client builds never depend on Google Fonts uptime.
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/500.css';
import '@fontsource/source-sans-3/600.css';
import { cafeConfig, getBrandCssVariables } from '@/src/config/cafe';
import './globals.css';
import { MotionProvider } from '@/components/ui/motion';

const fontVariables = { '--font-brand-heading': '"Manrope"', '--font-sans': '"Source Sans 3"' };

export const metadata: Metadata = {
  title: { default: cafeConfig.brand.name, template: `%s | ${cafeConfig.brand.name}` },
  description: cafeConfig.brand.description,
  robots: process.env.CAFE_DEMO_DB === '1' ? { index: false, follow: false } : undefined,
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: cafeConfig.brand.primaryColor };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-theme={cafeConfig.theme} style={{ ...getBrandCssVariables(), ...fontVariables } as CSSProperties}>
      <body className="min-h-screen antialiased"><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
