import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, ShoppingBag, Store } from 'lucide-react';
import { DemoToolbarShell } from '@tampiloka/ui-core/demo';
import { KafeWorkspace, type WorkspaceView } from '../components/cafe/kafe-workspace';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { cafeConfig, hasStaffModules, isModuleEnabled, THEMES, type ThemeId } from './config';
import { DEMOS, demoNavigationUrl, localizeDemo } from './manifest';
import type { DemoPreset } from './components/demo-portal';
import { ScenarioPanel } from './components/scenario-panel';
import { LanguageToggle, useCafeLanguage } from '@/lib/language';

type Prepared = { snapshot: any; view: WorkspaceView; tableId?: string; billId?: string };

export default function DemoWorkspace({ demo }: { demo: DemoPreset }) {
  const { language, t } = useCafeLanguage();
  const [prepared, setPrepared] = useState<Prepared>();
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(cafeConfig.theme);
  const [activeView, setActiveView] = useState<WorkspaceView>(() => /\/staff(?:\/|$)/.test(location.pathname) || !isModuleEnabled('catalog') ? 'staf' : 'pelanggan');
  const customerRouteKey = `tampiloka:cafe-demo:${demo.id}:customer-route`;
  const [customerRoute, setCustomerRoute] = useState<string | undefined>(() => {
    if (!/\/staff(?:\/|$)/.test(location.pathname) && isModuleEnabled('catalog')) return `${location.pathname}${location.search}${location.hash}`;
    try { return sessionStorage.getItem(customerRouteKey) || undefined; } catch { return undefined; }
  });
  const readOnlyCatalog = cafeConfig.modules.length === 1 && isModuleEnabled('catalog');
  const gallery = language === 'en' ? 'https://tampiloka.site/en/templates' : 'https://tampiloka.site/templates';
  const localized = localizeDemo(demo, language);
  const href = useCallback((target: DemoPreset, view: WorkspaceView) => demoNavigationUrl(target, view, {
    currentUrl: location.href, currentDemoId: demo.id, theme, language, customerRoute,
  }), [demo.id, theme, language, customerRoute]);
  const rememberCustomerRoute = useCallback(() => {
    const route = `${location.pathname}${location.search}${location.hash}`;
    setCustomerRoute(route);
    try { sessionStorage.setItem(customerRouteKey, route); } catch { /* In-app navigation can still use the state value. */ }
    return route;
  }, [customerRouteKey]);
  useEffect(() => { if (activeView === 'pelanggan') rememberCustomerRoute(); }, [activeView, theme, language, rememberCustomerRoute]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const staffRoute = /\/staff(?:\/|$)/.test(location.pathname);
      if (staffRoute && !hasStaffModules()) throw new Error('Paket ini hanya menyediakan menu pelanggan.');
      const view: WorkspaceView = staffRoute || !isModuleEnabled('catalog') ? 'staf' : 'pelanggan';
      const token = location.pathname.match(/\/m\/([^/]+)\/?$/)?.[1];
      let snapshot;
      let runtime: typeof import('../src/demo-runtime/index') | undefined;
      if (readOnlyCatalog) {
        const [{ buildStaticCatalogSnapshot }, { default: menu }, { default: tables }] = await Promise.all([
          import('../src/catalog/static-catalog'), import('../content/menu.json'), import('../content/tables.json'),
        ]);
        const catalog = buildStaticCatalogSnapshot(menu, tables, cafeConfig);
        snapshot = { ...catalog, runtime: { ...catalog.runtime, demo: true, localOnly: true } };
      } else {
        runtime = await import('../src/demo-runtime/index');
        if (!active) return;
        cleanup = runtime.installBrowserDemoFetch();
        snapshot = await runtime.getBrowserSnapshot({ surface: view === 'staf' ? 'staff' : 'customer' });
      }
      const table = token ? snapshot.tables.find((entry: any) => entry.qrToken === decodeURIComponent(token)) : snapshot.tables.find((entry: any) => entry.active);
      if (token && !table) throw new Error('Tautan meja tidak tersedia dalam demo ini.');
      if (view === 'pelanggan' && runtime && table) snapshot = await runtime.getBrowserSnapshot({ surface: 'customer', tableId: table.id });
      const billToken = new URLSearchParams(location.search).get('bill');
      const billId = billToken ? snapshot.bills.find((bill: any) => bill.shareToken === billToken)?.id : undefined;
      if (active) { setActiveView(view); setPrepared({ snapshot, view, tableId: table?.id, billId }); }
    })().catch(caught => { console.error('Demo initialization failed', caught); if (active) setError(caught instanceof Error ? caught.message : 'Demo belum dapat dibuka.'); });
    return () => { active = false; cleanup?.(); };
  }, [demo.id, readOnlyCatalog]);

  useEffect(() => { document.title = `${localized.name} · ${cafeConfig.brand.name} demo`; }, [localized.name]);

  const changeTheme = (value: string) => {
    if (!Object.hasOwn(THEMES, value)) return;
    setTheme(value as ThemeId);
    document.documentElement.dataset.theme = value;
    const url = new URL(location.href);
    url.searchParams.set('theme', value);
    history.replaceState(null, '', url);
  };

  const changeMode = (id: string) => {
    const next = DEMOS.find(candidate => candidate.id === id);
    if (!next) return;
    const view = activeView === 'staf' && next.staffPath !== undefined ? 'staf' : next.customerPath !== undefined ? 'pelanggan' : 'staf';
    location.assign(href(next, view));
  };

  const viewChanged = useCallback((view: WorkspaceView) => {
    if (view === activeView) return;
    const previousCustomerRoute = activeView === 'pelanggan' ? rememberCustomerRoute() : customerRoute;
    const next = demoNavigationUrl(demo, view, { currentUrl: location.href, currentDemoId: demo.id, theme, language, customerRoute: previousCustomerRoute });
    history.replaceState(null, '', next);
    setActiveView(view);
  }, [activeView, customerRoute, demo, theme, language, rememberCustomerRoute]);

  const reset = async () => {
    if (!confirm(t('Mulai ulang demo ini? Pesanan dan perubahan demo di browser ini akan dihapus.', 'Reset this demo? Orders and demo changes in this browser will be deleted.'))) return;
    setResetting(true);
    try {
      if (!readOnlyCatalog) await (await import('../src/demo-runtime/index')).resetBrowserDemo();
      const prefix = `cafe:${cafeConfig.venue.tenantSlug}:${cafeConfig.venue.outletSlug}`;
      for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
      sessionStorage.removeItem(`${prefix}:scenario`);
      location.reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : t('Demo belum berhasil diulang.', 'Could not reset the demo.')); setResetting(false); }
  };

  return <div className="demo-session" data-demo-view={activeView}>
    <DemoToolbarShell family="cafe" label={t('Pengaturan demo Tampiloka', 'Tampiloka demo settings')} galleryLabel={t('Kembali ke template Tampiloka', 'Back to Tampiloka templates')} galleryUrl={gallery}
      controls={<>
        <Select value={theme} onValueChange={changeTheme}>
          <SelectTrigger className="tl-demo-select" aria-label={t('Tema demo', 'Demo theme')}><SelectValue /></SelectTrigger>
          <SelectContent className="tl-demo-select-menu" position="popper" align="start" sideOffset={6}>{Object.entries(THEMES).map(([id, item]) => <SelectItem key={id} value={id}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={demo.id} onValueChange={changeMode}>
          <SelectTrigger className="tl-demo-select" aria-label={t('Mode demo', 'Demo mode')}><SelectValue /></SelectTrigger>
          <SelectContent className="tl-demo-select-menu" position="popper" align="start" sideOffset={6}>{DEMOS.map(item => <SelectItem key={item.id} value={item.id}>{localizeDemo(item, language).name}</SelectItem>)}</SelectContent>
        </Select>
      </>}
      viewLabel={t('Tampilan demo', 'Demo view')} activeView={activeView}
      views={[
        ...(isModuleEnabled('catalog') ? [{ id: 'pelanggan', label: t('Pelanggan', 'Customer'), icon: <ShoppingBag size={16} />, href: href(demo, 'pelanggan') }] : []),
        ...(hasStaffModules() ? [{ id: 'staf', label: t('Staf', 'Staff'), icon: <Store size={16} />, href: href(demo, 'staf') }] : []),
      ]}
      actions={<button type="button" onClick={reset} disabled={resetting || !prepared} aria-label={t('Ulangi demo', 'Reset demo')} title={t('Ulangi demo', 'Reset demo')}><RotateCcw size={16} className={resetting ? 'demo-resetting' : undefined} /></button>}
    />
    <details className="demo-context"><summary>{t('Demo interaktif · tidak ada pembayaran nyata', 'Interactive demo · no real payments')}</summary><p>{localized.description} {t('Perubahan tersimpan di browser ini. Tampilan pelanggan dan staf pada mode yang sama berbagi data. Gunakan “Ulangi demo” untuk memulai kembali.', 'Changes are saved in this browser. Customer and staff views in the same mode share data. Use “Reset demo” to start again.')}</p></details>
    {activeView === 'staf' && prepared && !readOnlyCatalog && <ScenarioPanel snapshot={prepared.snapshot} />}
    {error ? <main className="demo-loading" role="alert"><h1>{t('Demo belum dapat dibuka', 'Demo unavailable')}</h1><p>{error}</p><button type="button" onClick={() => location.reload()}>{t('Coba lagi', 'Try again')}</button><a href={gallery}>{t('Lihat template lain', 'View other templates')}</a></main>
      : prepared ? <KafeWorkspace initialSnapshot={prepared.snapshot} initialView={prepared.view} initialTableId={prepared.tableId} initialBillId={prepared.billId} onViewChange={viewChanged} />
      : <main className="demo-loading" aria-live="polite"><span className="demo-spinner" /><h1>{t('Menyiapkan demo…', 'Preparing demo…')}</h1><p>{t('Pembukaan pertama membutuhkan beberapa saat. Setelah itu, data demo tersimpan di browser ini.', 'The first load may take a moment. Demo data is then saved in this browser.')}</p></main>}
    <LanguageToggle floating />
  </div>;
}
