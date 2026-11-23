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
import '@tampiloka/ui-core/styles.css';
import '@tampiloka/ui-core/demo.css';
import { MotionProvider } from '../components/ui/motion';
import { activeDemo, cafeConfig, getBrandCssVariables } from './config';
import { DEMOS } from './manifest';
import { LanguageProvider, useCafeLanguage } from '@/lib/language';

const DemoWorkspace = lazy(() => import('./workspace'));
for (const [key, value] of Object.entries(getBrandCssVariables())) document.documentElement.style.setProperty(key, value);
document.documentElement.dataset.theme = cafeConfig.theme;
document.title = activeDemo ? `${activeDemo.name} · ${cafeConfig.brand.name}` : 'Cafe demos · Tampiloka';

const entryUrl = new URL(location.href);
const guide = entryUrl.searchParams.get('guide');
const guideView = guide === 'staff' ? 'staf' : guide === 'customer' ? 'pelanggan' : undefined;
if (guideView) {
  entryUrl.searchParams.delete('guide');
  history.replaceState(history.state, '', entryUrl);
}

function DemoLoading() {
  const { t } = useCafeLanguage();
  return <main className="demo-loading"><span className="demo-spinner" /><h1>{t('Menyiapkan halaman…', 'Preparing page…')}</h1><p>{t('Mohon tunggu sebentar.', 'Please wait a moment.')}</p></main>;
}

createRoot(document.getElementById('root')!).render(<LanguageProvider><MotionProvider>
  <Suspense fallback={<DemoLoading />}><DemoWorkspace initialGuideView={guideView} demo={activeDemo || DEMOS.find(demo => demo.id === 'full')!} /></Suspense>
</MotionProvider></LanguageProvider>);

