'use client';

/* eslint-disable @next/next/no-img-element -- This Vite entry serves local SVGs directly; Next's image loader is not available. */
import { useState, type SVGProps } from 'react';
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
  { id: 'boxy', name: 'Boxy', description: 'Straight edges, compact spacing, and clear rules.' },
  { id: 'rounded', name: 'Rounded', description: 'Soft corners and an easy, balanced rhythm.' },
  { id: 'editorial', name: 'Editorial', description: 'Serif headings and a menu that reads like a printed page.' },
  { id: 'playful', name: 'Playful', description: 'Bold outlines, generous curves, and a little character.' },
  { id: 'airy', name: 'Airy', description: 'Open surfaces, lighter type, and room to breathe.' },
];

const FEATURES = [
  { id: 'catalog', name: 'Menu' },
  { id: 'ordering', name: 'Ordering' },
  { id: 'payments', name: 'Online payment' },
  { id: 'cashier', name: 'Cashier' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'dashboard', name: 'Reports' },
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
  return <div className="dp-preview dp-theme" data-demo-theme={theme} aria-hidden="true">
    <div className="dp-preview-heading"><span>Dapur Pagi</span><CupIcon /></div>
    <div className="dp-preview-menu">
      <div className="dp-preview-product">
        <div className="dp-preview-image"><img src="/images/menu/es-kopi-susu-aren.svg" alt="" width="124" height="112" /></div>
        <div className="dp-preview-product-copy"><h3>Es Kopi Susu{' '}<br />Gula Aren</h3><span>Rp28.000</span></div>
      </div>
      <div className="dp-preview-product">
        <div className="dp-preview-image"><img src="/images/menu/croissant-mentega.svg" alt="" width="124" height="112" /></div>
        <div className="dp-preview-product-copy"><h3>Croissant{' '}<br />Mentega</h3><span>Rp24.000</span></div>
      </div>
    </div>
    <div className="dp-preview-total"><span>2 menu</span><strong>Rp52.000</strong><ArrowIcon /></div>
  </div>;
}

function PackageSample({ demo }: { demo: DemoPreset }) {
  const customer = demo.modules.includes('catalog');
  return <div className="dp-package-sample dp-theme" data-demo-theme={demo.theme} aria-hidden="true">
    <div className="dp-sample-name">Dapur Pagi</div>
    <div className="dp-sample-row">
      {customer ? <img src="/images/menu/es-kopi-susu-aren.svg" alt="" width="64" height="68" loading="lazy" /> : <div className="dp-sample-table">04</div>}
      <div><strong>{customer ? 'Es Kopi Susu' : 'Meja 04'}</strong><span>{customer ? 'Gula Aren' : '2 × Es Kopi Susu'}</span></div>
      <span className="dp-sample-price">{customer ? 'Rp28.000' : 'Rp56.000'}</span>
    </div>
  </div>;
}

// Adapted from the kit's OPEN-07 task-led introduction and OFFER-10 shared
// criteria comparison. Records and destinations come from the host manifest.
export function DemoPortal({ demos, baseDomain }: DemoPortalProps) {
  const [audience, setAudience] = useState<Audience>('all');
  const [previewTheme, setPreviewTheme] = useState<DemoTheme>('rounded');
  const selectedTheme = THEMES.find(theme => theme.id === previewTheme)!;
  const visibleDemos = demos.filter(demo => audience === 'all' || hasDestination(demo, audience));
  const audienceOptions: { id: Audience; label: string; count: number }[] = [
    { id: 'all', label: 'All packages', count: demos.length },
    { id: 'customer', label: 'Customer menus', count: demos.filter(demo => hasDestination(demo, 'customer')).length },
    { id: 'staff', label: 'Staff tools', count: demos.filter(demo => hasDestination(demo, 'staff')).length },
  ];

  return <div className="dp-demo-portal">
    <a className="dp-skip-link" href="#demo-main">Skip to demos</a>
    <header className="dp-portal-header dp-container">
      <a href="#demo-main" className="dp-portal-brand" aria-label="DP Dapur Pagi demo home"><span className="dp-brand-mark" aria-hidden="true">DP</span>{' '}<span>Dapur Pagi</span></a>
      <nav aria-label="Demo portal"><a href="#demos">Explore demos</a><a href="#compare">Compare packages</a></nav>
    </header>

    <main id="demo-main">
      <section className="dp-portal-hero dp-container" aria-labelledby="portal-title">
        <div className="dp-hero-copy">
          <h1 id="portal-title">Cafe demos</h1>
          <p className="dp-hero-description">A QR menu, a busy counter, or the whole café.<br className="dp-desktop-break" /> Find the setup that fits your service.</p>
          <div className="dp-hero-actions"><a href="#demos" className="dp-button dp-button-primary">Explore {demos.length} packages <ArrowIcon /></a><a href="#compare" className="dp-text-link">Compare features <ArrowIcon /></a></div>
          <div className="dp-sandbox-note"><CupIcon /><p>Your changes stay in this browser.<br />Reset any time. No real payments.</p></div>
        </div>

        <div className="dp-theme-explorer" role="region" aria-labelledby="theme-preview-title">
          <div className="dp-theme-explorer-title"><h2 id="theme-preview-title">Same café. Your style.</h2><span>5 themes</span></div>
          <ThemePreview theme={previewTheme} />
          <div className="dp-theme-controls" role="group" aria-label="Preview a component theme">
            {THEMES.map(theme => <button type="button" key={theme.id} aria-pressed={previewTheme === theme.id} onClick={() => setPreviewTheme(theme.id)}>{theme.name}</button>)}
          </div>
          <p className="dp-theme-description" aria-live="polite"><strong>{selectedTheme.name}.</strong> {selectedTheme.description}</p>
        </div>
      </section>

      <section className="dp-packages dp-container" id="demos" aria-labelledby="packages-title">
        <div className="dp-section-heading"><div><h2 id="packages-title">Choose your setup</h2><p>Each package opens its own interactive demo.</p></div><p className="dp-open-note">Customer views suit phones.<br />Staff views suit tablets and desktops.</p></div>
        <div className="dp-package-toolbar"><div className="dp-audience-controls" role="group" aria-label="Filter demo packages">{audienceOptions.map(option => <button type="button" key={option.id} aria-pressed={audience === option.id} onClick={() => setAudience(option.id)}>{option.label}<span>{option.count}</span></button>)}</div><span className="dp-result-count" role="status">{visibleDemos.length} {visibleDemos.length === 1 ? 'package' : 'packages'}</span></div>

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
              <div className="dp-package-meta"><span>{themeName} theme</span><span>{demo.modules.length} {demo.modules.length === 1 ? 'service' : 'services'}</span></div>
              <div className="dp-package-actions">
                {customerHref && <a className="dp-button dp-button-primary" href={customerHref} target="_blank" rel="noopener noreferrer" aria-label={`Try customer: ${demo.name}, opens in a new tab`}>Try customer <ArrowIcon diagonal /></a>}
                {staffHref && <a className={`dp-button ${customerHref ? 'dp-button-secondary' : 'dp-button-primary'}`} href={staffHref} target="_blank" rel="noopener noreferrer" aria-label={`Try staff: ${demo.name}, opens in a new tab`}>Try staff <ArrowIcon diagonal /></a>}
              </div>
            </div>
          </article></li>;
        })}</ul> : <div className="dp-empty-state"><h3>No demos in this view</h3><p>Choose another view to see the available packages.</p><button type="button" className="dp-button dp-button-secondary" onClick={() => setAudience('all')}>Show all packages</button></div>}
      </section>

      <section className="dp-comparison-section" id="compare" aria-labelledby="comparison-title"><div className="dp-container">
        <div className="dp-section-heading"><div><h2 id="comparison-title">See what’s included</h2><p>Compare the core services before you open a demo.</p></div><p className="dp-comparison-help">Scroll the table to see every service.</p></div>
        <div className="dp-comparison-scroll" role="region" aria-label="Package service comparison, scroll horizontally for more services" tabIndex={0}>
          <table className="dp-comparison"><caption className="dp-visually-hidden">Services included in each café demo package</caption><thead><tr><th scope="col">Package</th>{FEATURES.map(feature => <th key={feature.id} scope="col">{feature.name}</th>)}</tr></thead><tbody>{demos.map(demo => <tr key={demo.id}><th scope="row">{demo.name}</th>{FEATURES.map(feature => <td key={feature.id}>{demo.modules.includes(feature.id) ? <span className="dp-feature-included"><CheckIcon /><span className="dp-visually-hidden">Included</span></span> : <span className="dp-feature-absent"><span className="dp-feature-minus" aria-hidden="true" /><span className="dp-visually-hidden">Not included</span></span>}</td>)}</tr>)}</tbody></table>
        </div>
        <p className="dp-comparison-footnote">Online payment is simulated in every demo. Full service also includes table service, loyalty, and promotions.</p>
      </div></section>

      <section className="dp-try-flow dp-container" aria-labelledby="try-flow-title">
        <div className="dp-flow-intro"><h2 id="try-flow-title">Try both sides<br />of the counter</h2><p>Pick a package with customer ordering, then follow one sample order from menu to staff.</p></div>
        <ol className="dp-flow-steps">
          <li><span className="dp-step-number">1</span><div><h3>Start as a customer</h3><p>Open “Try customer”, choose a table, and add something to your order.</p></div></li>
          <li><span className="dp-step-number">2</span><div><h3>Continue in staff</h3><p>Open “Try staff” for the same package to see the order and carry it forward.</p></div></li>
          <li><span className="dp-step-number">3</span><div><h3>Make it your own</h3><p>Try the available tools, change your choices, or reset the demo and start again.</p></div></li>
        </ol>
      </section>
      <div className="dp-session-note dp-container"><p>Customer and staff tabs for the same demo share your changes in this browser. Other demo packages and devices have their own sessions. All names, orders, and payments are sample data.</p></div>
    </main>

    <footer className="dp-portal-footer dp-container"><span>Dapur Pagi · Cafe demos</span><a href="#demo-main">Back to top <ArrowIcon /></a></footer>
  </div>;
}

export const Portal = DemoPortal;
export default DemoPortal;
