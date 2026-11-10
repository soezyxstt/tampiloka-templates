'use client';

/* eslint-disable @next/next/no-img-element -- This Vite entry serves local SVGs directly; Next's image loader is not available. */
import { useState, type SVGProps } from 'react';
import { LanguageToggle, useCafeLanguage } from '@/lib/language';
import { localizeDemo } from '../manifest';
import './demo-portal.css';

export type DemoTheme = 'boxy' | 'rounded' | 'editorial' | 'playful' | 'airy';

export interface DemoPreset {
  id: string;
  name: string;
  description: string;
  useCase: string;
  theme: DemoTheme;
  subdomain: string;
  modules: readonly string[];
  customerPath?: string;
  staffPath?: string;
  customerUrl?: string;
  staffUrl?: string;
}

export interface DemoPortalProps {
  demos: readonly DemoPreset[];
  baseDomain: string;
}

type Audience = 'all' | 'customer' | 'staff';

const THEMES: readonly { id: DemoTheme; name: string; description: string }[] = [
  { id: 'boxy', name: 'Boxy', description: 'Garis tegas dan ruang yang ringkas untuk bekerja.' },
  { id: 'rounded', name: 'Rounded', description: 'Sudut membulat dengan tata letak yang nyaman diikuti.' },
  { id: 'editorial', name: 'Editorial', description: 'Judul berserif dan susunan menu seperti halaman cetak.' },
  { id: 'playful', name: 'Playful', description: 'Garis tegas dan bentuk membulat untuk tampilan yang ceria.' },
  { id: 'airy', name: 'Airy', description: 'Ruang yang lapang dengan tipografi yang ringan.' },
];

const FEATURES = [
  { id: 'catalog', name: 'Menu' },
  { id: 'ordering', name: 'Pesanan' },
  { id: 'payments', name: 'Pembayaran online' },
  { id: 'cashier', name: 'Kasir' },
  { id: 'kitchen', name: 'Dapur' },
  { id: 'dashboard', name: 'Laporan' },
] as const;

function ArrowIcon({ diagonal = false, ...props }: SVGProps<SVGSVGElement> & { diagonal?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h15m-6-6 6 6-6 6" />}
  </svg>;
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="m5 12 4.5 4.5L19 7" /></svg>;
}

function CupIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M6 11h17v10a7 7 0 0 1-7 7h-3a7 7 0 0 1-7-7V11Zm17 2h2a4 4 0 0 1 0 8h-2M10 4v3m5-5v5m5-3v3M4 28h23" />
  </svg>;
}

function hasDestination(demo: DemoPreset, audience: Exclude<Audience, 'all'>) {
  return audience === 'customer'
    ? Boolean(demo.customerUrl || demo.customerPath !== undefined)
    : Boolean(demo.staffUrl || demo.staffPath !== undefined);
}

function demoHref(demo: DemoPreset, audience: Exclude<Audience, 'all'>, baseDomain: string) {
  const explicit = audience === 'customer' ? demo.customerUrl : demo.staffUrl;
  if (explicit) return explicit;
  const path = audience === 'customer' ? demo.customerPath : demo.staffPath;
  if (path === undefined) return undefined;
  const domain = baseDomain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').replace(/^\.+/, '');
  return `https://${demo.subdomain}.${domain}${path.startsWith('/') ? path : `/${path}`}`;
}

function ThemePreview({ theme }: { theme: DemoTheme }) {
  const { t } = useCafeLanguage();
  return <div className="dp-preview dp-theme" data-demo-theme={theme} aria-hidden="true">
    <div className="dp-preview-heading"><span>Dapur Pagi</span><CupIcon /></div>
    <div className="dp-preview-menu">
      <div className="dp-preview-product">
        <div className="dp-preview-image"><img src="/images/menu/photos/kopi-aren.jpg" alt="" width="124" height="112" /></div>
        <div className="dp-preview-product-copy"><h3>{t('Es Kopi Susu', 'Iced Milk Coffee')}{' '}<br />{t('Gula Aren', 'Palm Sugar')}</h3><span>Rp28.000</span></div>
      </div>
      <div className="dp-preview-product">
        <div className="dp-preview-image"><img src="/images/menu/photos/croissant.jpg" alt="" width="124" height="112" /></div>
        <div className="dp-preview-product-copy"><h3>Croissant{' '}<br />{t('Mentega', 'Butter')}</h3><span>Rp24.000</span></div>
      </div>
    </div>
    <div className="dp-preview-total"><span>{t('2 menu', '2 items')}</span><strong>Rp52.000</strong><ArrowIcon /></div>
  </div>;
}

function PackageSample({ demo }: { demo: DemoPreset }) {
  const { t } = useCafeLanguage();
  const customer = demo.modules.includes('catalog');
  return <div className="dp-package-sample dp-theme" data-demo-theme={demo.theme} aria-hidden="true">
    <div className="dp-sample-name">Dapur Pagi</div>
    <div className="dp-sample-row">
      {customer ? <img src="/images/menu/photos/kopi-aren.jpg" alt="" width="64" height="68" loading="lazy" /> : <div className="dp-sample-table">04</div>}
      <div><strong>{customer ? t('Es Kopi Susu', 'Iced Milk Coffee') : t('Meja 04', 'Table 04')}</strong><span>{customer ? t('Gula Aren', 'Palm Sugar') : t('2 × Es Kopi Susu', '2 × Iced Milk Coffee')}</span></div>
      <span className="dp-sample-price">{customer ? 'Rp28.000' : 'Rp56.000'}</span>
    </div>
  </div>;
}

// Adapted from the kit's OPEN-07 task-led introduction and OFFER-10 shared
// criteria comparison. Records and destinations come from the host manifest.
export function DemoPortal({ demos: sourceDemos, baseDomain }: DemoPortalProps) {
  const { language, t } = useCafeLanguage();
  const demos = sourceDemos.map(demo => localizeDemo(demo, language));
  const [audience, setAudience] = useState<Audience>('all');
  const [previewTheme, setPreviewTheme] = useState<DemoTheme>('rounded');
  const selectedTheme = THEMES.find(theme => theme.id === previewTheme)!;
  const visibleDemos = demos.filter(demo => audience === 'all' || hasDestination(demo, audience));
  const audienceOptions: { id: Audience; label: string; count: number }[] = [
    { id: 'all', label: t('Semua demo', 'All demos'), count: demos.length },
    { id: 'customer', label: t('Untuk pelanggan', 'For customers'), count: demos.filter(demo => hasDestination(demo, 'customer')).length },
    { id: 'staff', label: t('Untuk staf', 'For staff'), count: demos.filter(demo => hasDestination(demo, 'staff')).length },
  ];

  return <div className="dp-demo-portal">
    <a className="dp-skip-link" href="#demo-main">{t("Lewati ke daftar demo", "Skip to demos")}</a>
    <header className="dp-portal-header dp-container">
      <a href="#demo-main" className="dp-portal-brand" aria-label={t("Beranda demo Dapur Pagi", "Dapur Pagi demo home")}><span className="dp-brand-mark" aria-hidden="true">DP</span>{' '}<span>Dapur Pagi</span></a>
      <nav aria-label={t("Navigasi demo", "Demo navigation")}><a href="#demos">{t("Lihat demo", "View demos")}</a><a href="#compare">{t("Bandingkan fitur", "Compare features")}</a><LanguageToggle /></nav>
    </header>

    <main id="demo-main">
      <section className="dp-portal-hero dp-container" aria-labelledby="portal-title">
        <div className="dp-hero-copy">
          <h1 id="portal-title">{t("Demo kafe", "Cafe demos")}</h1>
          <p className="dp-hero-description">{t("Dari menu digital hingga operasional kafe,", "From digital menus to cafe operations,")}<br className="dp-desktop-break" /> {t("pilih alur yang sesuai dengan cara Anda melayani.", "choose the flow that suits the way you serve.")}</p>
          <div className="dp-hero-actions"><a href="#demos" className="dp-button dp-button-primary">{t('Lihat', 'View')} {demos.length} demo <ArrowIcon /></a><a href="#compare" className="dp-text-link">{t("Bandingkan fitur", "Compare features")} <ArrowIcon /></a></div>
          <div className="dp-sandbox-note"><CupIcon /><p>{t("Perubahan tersimpan di browser ini.", "Changes are saved in this browser.")}<br />{t("Bisa diulang kapan saja. Tidak ada pembayaran nyata.", "Reset anytime. No real payments are made.")}</p></div>
        </div>

        <div className="dp-theme-explorer" role="region" aria-labelledby="theme-preview-title">
          <div className="dp-theme-explorer-title"><h2 id="theme-preview-title">{t("Satu kafe, beragam tampilan.", "One cafe, different looks.")}</h2><span>{t("5 tema", "5 themes")}</span></div>
          <ThemePreview theme={previewTheme} />
          <div className="dp-theme-controls" role="group" aria-label={t("Pilih contoh tema", "Choose a sample theme")}>
            {THEMES.map(theme => <button type="button" key={theme.id} aria-pressed={previewTheme === theme.id} onClick={() => setPreviewTheme(theme.id)}>{theme.name}</button>)}
          </div>
          <p className="dp-theme-description" aria-live="polite"><strong>{selectedTheme.name}.</strong> {language === 'en' ? ({ boxy: 'Clean lines and a compact workspace.', rounded: 'Rounded corners and an easy-to-follow layout.', editorial: 'Serif headings and a print-inspired menu.', playful: 'Bold lines and rounded shapes for a playful look.', airy: 'Generous space and light typography.' } as const)[selectedTheme.id] : selectedTheme.description}</p>
        </div>
      </section>

      <section className="dp-packages dp-container" id="demos" aria-labelledby="packages-title">
        <div className="dp-section-heading"><div><h2 id="packages-title">{t("Pilih alur yang ingin dicoba", "Choose a flow to try")}</h2></div></div>
        <div className="dp-package-toolbar"><div className="dp-audience-controls" role="group" aria-label={t("Saring demo", "Filter demos")}>{audienceOptions.map(option => <button type="button" key={option.id} aria-pressed={audience === option.id} onClick={() => setAudience(option.id)}>{option.label}<span>{option.count}</span></button>)}</div><span className="dp-result-count" role="status">{visibleDemos.length} demo</span></div>

        {visibleDemos.length ? <ul className="dp-package-grid">{visibleDemos.map(demo => {
          const customerHref = demoHref(demo, 'customer', baseDomain);
          const staffHref = demoHref(demo, 'staff', baseDomain);
          const themeName = THEMES.find(theme => theme.id === demo.theme)?.name || demo.theme;
          return <li key={demo.id}><article className="dp-package-card" aria-labelledby={`demo-${demo.id}`}>
            <PackageSample demo={demo} />
            <div className="dp-package-content">
              <h3 id={`demo-${demo.id}`}>{demo.name}</h3>
              <p className="dp-package-description">{demo.description}</p>
              <p className="dp-package-use-case">{demo.useCase}</p>
              <div className="dp-package-meta"><span>{t('Tema', 'Theme')} {themeName}</span><span>{demo.modules.length} {t('fitur', 'features')}</span></div>
              <div className="dp-package-actions">
                {customerHref && <a className="dp-button dp-button-primary" href={customerHref} target="_blank" rel="noopener noreferrer" aria-label={`${t('Coba sebagai pelanggan', 'Try customer view')}: ${demo.name}, ${t('terbuka di tab baru', 'opens in a new tab')}`}>{t("Coba pelanggan", "Try customer view")} <ArrowIcon diagonal /></a>}
                {staffHref && <a className={`dp-button ${customerHref ? 'dp-button-secondary' : 'dp-button-primary'}`} href={staffHref} target="_blank" rel="noopener noreferrer" aria-label={`${t('Coba sebagai staf', 'Try staff view')}: ${demo.name}, ${t('terbuka di tab baru', 'opens in a new tab')}`}>{t("Coba staf", "Try staff view")} <ArrowIcon diagonal /></a>}
              </div>
            </div>
          </article></li>;
        })}</ul> : <div className="dp-empty-state"><h3>{t("Tidak ada demo untuk pilihan ini", "No demos match this selection")}</h3><p>{t("Pilih tampilan lain untuk melihat demo yang tersedia.", "Choose another view to see available demos.")}</p><button type="button" className="dp-button dp-button-secondary" onClick={() => setAudience('all')}>{t("Tampilkan semua demo", "Show all demos")}</button></div>}
      </section>

      <section className="dp-comparison-section" id="compare" aria-labelledby="comparison-title"><div className="dp-container">
        <div className="dp-section-heading"><div><h2 id="comparison-title">{t("Bandingkan fitur demo", "Compare demo features")}</h2><p>{t("Lihat fitur utama pada setiap demo sebelum mencobanya.", "See the main features of each demo before trying it.")}</p></div><p className="dp-comparison-help">{t("Geser tabel untuk melihat semua fitur.", "Scroll the table to see all features.")}</p></div>
        <div className="dp-comparison-scroll" role="region" aria-label="Perbandingan fitur demo; geser ke samping untuk melihat fitur lainnya" tabIndex={0}>
          <table className="dp-comparison"><caption className="dp-visually-hidden">{t("Fitur yang tersedia pada setiap demo kafe", "Features available in each cafe demo")}</caption><thead><tr><th scope="col">Demo</th>{FEATURES.map(feature => <th key={feature.id} scope="col">{language === 'en' ? ({catalog: 'Menu', ordering: 'Orders', payments: 'Online payment', cashier: 'Cashier', kitchen: 'Kitchen', dashboard: 'Reports'} as const)[feature.id] : feature.name}</th>)}</tr></thead><tbody>{demos.map(demo => <tr key={demo.id}><th scope="row">{demo.name}</th>{FEATURES.map(feature => <td key={feature.id}>{demo.modules.includes(feature.id) ? <span className="dp-feature-included"><CheckIcon /><span className="dp-visually-hidden">{t("Tersedia", "Available")}</span></span> : <span className="dp-feature-absent"><span className="dp-feature-minus" aria-hidden="true" /><span className="dp-visually-hidden">{t("Tidak tersedia", "Not available")}</span></span>}</td>)}</tr>)}</tbody></table>
        </div>

      </div></section>

      <section className="dp-try-flow dp-container" aria-labelledby="try-flow-title">
        <div className="dp-flow-intro"><h2 id="try-flow-title">{t("Coba dari sisi pelanggan", "Try the customer")}<br />{t("dan staf", "and staff views")}</h2><p>{t("Pilih demo yang menyediakan pemesanan pelanggan, lalu ikuti perjalanan satu pesanan sampai diterima staf.", "Choose a demo with customer ordering, then follow an order until staff receive it.")}</p></div>
        <ol className="dp-flow-steps">
          <li><span className="dp-step-number">1</span><div><h3>{t("Mulai sebagai pelanggan", "Start as a customer")}</h3><p>{t("Buka \"Coba pelanggan\", pilih meja, lalu tambahkan menu ke pesanan.", "Open the customer view, choose a table, then add items to your order.")}</p></div></li>
          <li><span className="dp-step-number">2</span><div><h3>{t("Lanjutkan sebagai staf", "Continue as staff")}</h3><p>{t("Buka \"Coba staf\" pada demo yang sama untuk melihat dan memproses pesanan.", "Open the staff view of the same demo to view and process the order.")}</p></div></li>
          <li><span className="dp-step-number">3</span><div><h3>{t("Coba alur lainnya", "Try other flows")}</h3><p>{t("Jelajahi fitur yang tersedia atau ulangi demo untuk mencoba dari awal.", "Explore the available features or reset the demo to start again.")}</p></div></li>
        </ol>
      </section>

    </main>

    <footer className="dp-portal-footer dp-container"><span>Dapur Pagi · Demo kafe</span><a href="#demo-main">{t("Kembali ke atas", "Back to top")} <ArrowIcon /></a></footer>
  </div>;
}

export const Portal = DemoPortal;
export default DemoPortal;
