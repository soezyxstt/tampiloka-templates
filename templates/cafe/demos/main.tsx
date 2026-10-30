import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import '@fontsource/manrope/latin-800.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-500.css';
import '@fontsource/source-sans-3/latin-600.css';
import '../app/globals.css';
import './showcase.css';
import { MotionProvider } from '../components/ui/motion';
import { DemoPortal } from './components/demo-portal';
import { activeDemo, cafeConfig, getBrandCssVariables } from './config';
import { DEMO_DOMAIN, portalDemos } from './manifest';
import { LanguageProvider } from '@/lib/language';

const DemoWorkspace = lazy(() => import('./workspace'));
for (const [key, value] of Object.entries(getBrandCssVariables())) document.documentElement.style.setProperty(key, value);
document.documentElement.dataset.theme = activeDemo?.theme || 'rounded';
document.title = activeDemo ? `${activeDemo.name} · ${cafeConfig.brand.name} demo` : 'Cafe demos · Tampiloka';

createRoot(document.getElementById('root')!).render(<LanguageProvider><MotionProvider>{activeDemo
  ? <Suspense fallback={<main className="demo-loading"><span className="demo-spinner" /><h1>Menyiapkan demo…</h1><p>Menu dan ruang staf akan segera tersedia.</p></main>}><DemoWorkspace demo={activeDemo} /></Suspense>
  : <DemoPortal demos={portalDemos()} baseDomain={DEMO_DOMAIN} />}</MotionProvider></LanguageProvider>);
