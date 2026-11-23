import { useCallback, useEffect, useState } from 'react';
import { ShoppingBag, Store } from 'lucide-react';
import { DemoToolbarShell } from '@tampiloka/ui-core/demo';
import { KafeWorkspace, type WorkspaceView } from '../components/cafe/kafe-workspace';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { cafeConfig, hasStaffModules, isModuleEnabled, THEMES, type ThemeId } from './config';
import { DEMOS, demoNavigationPath, demoNavigationUrl, localizeDemo } from './manifest';
import type { DemoPreset } from './components/demo-portal';
import type { DemoSeedLevel } from '../src/db/seed';
import { DemoTools } from './components/demo-tools';
import { TableEntry } from './components/table-entry';
import { LanguageToggle, useCafeLanguage } from '@/lib/language';
import { staffRoleLabel } from '../lib/staff-role-label';
import { customerTour, staffTour, tableEntryTour } from './tour';
import { toast } from 'sonner';

type DemoStaff = { id: string; userName: string; role: string; active?: boolean };
type Prepared = { snapshot: any; view: WorkspaceView; tableId?: string; billId?: string; staff: DemoStaff[] };

function chooseStaff(staff: DemoStaff[], requested: string | null): string | undefined {
  const available = staff.filter(person => person.active !== false);
  return available.find(person => person.id === requested)?.id
    || ((isModuleEnabled('cashier') || isModuleEnabled('ordering')) && available.find(person => person.role === 'CASHIER')?.id)
    || available[0]?.id;
}

export default function DemoWorkspace({ demo }: { demo: DemoPreset }) {
  const { language, t } = useCafeLanguage();
  const [prepared, setPrepared] = useState<Prepared>();
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [theme, setTheme] = useState<ThemeId>(cafeConfig.theme);
  const [demoStaffId, setDemoStaffId] = useState<string | undefined>();
  const [activeView, setActiveView] = useState<WorkspaceView>(() => /\/staff(?:\/|$)/.test(location.pathname) || !isModuleEnabled('catalog') ? 'staf' : 'pelanggan');
  const customerRouteKey = `tampiloka:cafe-demo:${demo.id}:customer-route`;
  const [customerRoute, setCustomerRoute] = useState<string | undefined>(() => {
    if (!/\/staff(?:\/|$)/.test(location.pathname) && isModuleEnabled('catalog')) return `${location.pathname}${location.search}${location.hash}`;
    try { return sessionStorage.getItem(customerRouteKey) || undefined; } catch { return undefined; }
  });
  const readOnlyCatalog = cafeConfig.modules.length === 1 && isModuleEnabled('catalog');
  const gallery = language === 'en' ? 'https://tampiloka.site/en/templates' : 'https://tampiloka.site/templates';
  const localized = localizeDemo(demo, language);
  const isTableRoute = /\/m\/[^/]+\/?$/.test(location.pathname);
  const [browsingWithoutTable, setBrowsingWithoutTable] = useState(false);
  const tourResumeKey = `tampiloka:cafe-demo:${demo.id}:table-tour`;
  const [resumeCustomerTour, setResumeCustomerTour] = useState(() => {
    try { return isTableRoute && sessionStorage.getItem(tourResumeKey) === location.pathname; }
    catch { return false; }
  });
  useEffect(() => {
    try { sessionStorage.removeItem(tourResumeKey); } catch { /* The guide can still be opened manually. */ }
  }, [tourResumeKey]);
  const continueTableTour = (target: HTMLElement) => {
    if (!(target instanceof HTMLAnchorElement)) { setResumeCustomerTour(true); return; }
    try { sessionStorage.setItem(tourResumeKey, new URL(target.href).pathname); }
    catch { /* The linked menu still opens normally. */ }
  };
  const canShowTableEntry = !browsingWithoutTable && activeView === 'pelanggan' && !isTableRoute && !new URLSearchParams(location.search).has('bill');
  const showTableEntry = canShowTableEntry && prepared?.snapshot.tables?.some((table: any) => table.active !== false && table.qrToken);
  const href = useCallback((target: DemoPreset, view: WorkspaceView) => {
    const url = new URL(demoNavigationUrl(target, view, {
      currentUrl: location.href, currentDemoId: demo.id, theme, language, customerRoute,
    }), location.href);
    if (demoStaffId) url.searchParams.set('staff', demoStaffId);
    return `${url.pathname}${url.search}${url.hash}`;
  }, [demo.id, demoStaffId, theme, language, customerRoute]);
  const rememberCustomerRoute = useCallback(() => {
    const route = `${location.pathname}${location.search}${location.hash}`;
    setCustomerRoute(route);
    try { sessionStorage.setItem(customerRouteKey, route); } catch { /* In-app navigation can still use the state value. */ }
    return route;
  }, [customerRouteKey]);
  useEffect(() => {
    if (activeView !== 'pelanggan') return;
    const route = `${location.pathname}${location.search}${location.hash}`;
    try { sessionStorage.setItem(customerRouteKey, route); } catch { /* Route state still supports in-app navigation. */ }
  }, [activeView, theme, language, customerRouteKey]);

  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const staffRoute = /\/staff(?:\/|$)/.test(location.pathname);
      if (staffRoute && !hasStaffModules()) throw new Error('Paket ini hanya menyediakan menu pelanggan.');
      const view: WorkspaceView = staffRoute || !isModuleEnabled('catalog') ? 'staf' : 'pelanggan';
      const token = location.pathname.match(/\/m\/([^/]+)\/?$/)?.[1];
      let snapshot;
      let staff: DemoStaff[] = [];
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
        if (hasStaffModules()) {
          // Guest snapshots intentionally omit staff accounts; fetch the local staff surface for the demo picker.
          const staffSnapshot: any = view === 'staf' ? snapshot : await runtime.getBrowserSnapshot({ surface: 'staff' });
          staff = (staffSnapshot.staffRoles || staffSnapshot.staffAccounts || []).filter((person: DemoStaff) => person.active !== false);
        }
      }
      const table = token ? snapshot.tables.find((entry: any) => entry.qrToken === decodeURIComponent(token)) : snapshot.tables.find((entry: any) => entry.active);
      if (token && !table) {
        if (snapshot.tables.length) throw new Error('Tautan meja tidak tersedia dalam demo ini.');
        const url = new URL(location.href);
        url.pathname = demoNavigationPath(demo, view, url.hostname);
        for (const key of ['bill', 'table', 'principal']) url.searchParams.delete(key);
        history.replaceState(null, '', url);
      }
      if (view === 'pelanggan' && runtime && table) snapshot = await runtime.getBrowserSnapshot({ surface: 'customer', tableId: table.id });
      const billToken = new URLSearchParams(location.search).get('bill');
      const billId = billToken ? snapshot.bills.find((bill: any) => bill.shareToken === billToken)?.id : undefined;
      if (active) {
        const selected = chooseStaff(staff, new URLSearchParams(location.search).get('staff'));
        if (selected) {
          const url = new URL(location.href);
          url.searchParams.set('staff', selected);
          history.replaceState(null, '', url);
        }
        setDemoStaffId(selected);
        setActiveView(view);
        setPrepared({ snapshot, view, tableId: table?.id, billId, staff });
      }
    })().catch(caught => { console.error('Demo initialization failed', caught); if (active) setError(caught instanceof Error ? caught.message : 'Halaman belum dapat dibuka.'); });
    return () => { active = false; cleanup?.(); };
  }, [demo.id, readOnlyCatalog]);

  const tableEntryReady = canShowTableEntry && Boolean(prepared) && !readOnlyCatalog;
  const entryTableId = prepared?.tableId;
  useEffect(() => {
    if (!tableEntryReady) return;
    let active = true;
    let request = 0;
    const refresh = async () => {
      const current = ++request;
      try {
        const runtime = await import('../src/demo-runtime/index');
        const snapshot = await runtime.getBrowserSnapshot({ surface: 'customer', tableId: entryTableId });
        if (active && current === request) setPrepared(previous => previous ? { ...previous, snapshot } : previous);
      } catch {
        if (active && current === request) toast.error(t('Daftar meja belum diperbarui.', 'The table list could not be refreshed.'), {
          id: 'table-entry-sync', action: { label: t('Coba lagi', 'Try again'), onClick: () => { void refresh(); } },
        });
      }
    };
    const changed = () => { void refresh(); };
    const visible = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('cafe:data-changed', changed);
    document.addEventListener('visibilitychange', visible);
    void refresh();
    return () => {
      active = false;
      window.removeEventListener('cafe:data-changed', changed);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [tableEntryReady, entryTableId, t]);

  useEffect(() => { document.title = `${localized.name} · ${cafeConfig.brand.name}`; }, [localized.name]);

  useEffect(() => {
    const syncHistory = () => {
      const params = new URLSearchParams(location.search);
      const requestedTheme = params.get('theme');
      const nextTheme = requestedTheme && Object.hasOwn(THEMES, requestedTheme) ? requestedTheme as ThemeId : cafeConfig.theme;
      setTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      if (prepared?.staff.length) setDemoStaffId(chooseStaff(prepared.staff, params.get('staff')));
    };
    window.addEventListener('popstate', syncHistory);
    return () => window.removeEventListener('popstate', syncHistory);
  }, [prepared]);

  const changeTheme = (value: string) => {
    if (!Object.hasOwn(THEMES, value)) return;
    setTheme(value as ThemeId);
    document.documentElement.dataset.theme = value;
    const url = new URL(location.href);
    url.searchParams.set('theme', value);
    history.pushState(null, '', url);
  };

  const changeStaff = (value: string) => {
    if (!prepared?.staff.some(person => person.id === value && person.active !== false)) return;
    setDemoStaffId(value);
    const url = new URL(location.href);
    url.searchParams.set('staff', value);
    history.pushState(null, '', url);
  };

  const changeMode = (id: string) => {
    const next = DEMOS.find(candidate => candidate.id === id);
    if (!next) return;
    const view = activeView === 'staf' && next.staffPath !== undefined ? 'staf' : next.customerPath !== undefined ? 'pelanggan' : 'staf';
    location.assign(href(next, view));
  };

  const viewChanged = useCallback((view: WorkspaceView) => {
    if (view === activeView) return;
    setResumeCustomerTour(false);
    const previousCustomerRoute = activeView === 'pelanggan' ? rememberCustomerRoute() : customerRoute;
    const next = demoNavigationUrl(demo, view, { currentUrl: location.href, currentDemoId: demo.id, theme, language, customerRoute: previousCustomerRoute });
    history.replaceState(null, '', next);
    setActiveView(view);
  }, [activeView, customerRoute, demo, theme, language, rememberCustomerRoute]);

  const reset = async (level: DemoSeedLevel) => {
    if (!confirm(t('Mulai ulang dengan pilihan data ini? Data dan perubahan demo di browser ini akan diganti.', 'Reset with the selected data? Demo data and changes in this browser will be replaced.'))) return;
    setResetError('');
    setResetting(true);
    try {
      if (!readOnlyCatalog) await (await import('../src/demo-runtime/index')).resetBrowserDemo(level);
      const prefix = `cafe:${cafeConfig.venue.tenantSlug}:${cafeConfig.venue.outletSlug}`;
      for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
      sessionStorage.removeItem(`${prefix}:scenario`);
      sessionStorage.removeItem(customerRouteKey);
      const url = new URL(location.href);
      for (const key of ['bill', 'table', 'principal']) url.searchParams.delete(key);
      if (level === 'blank' && isTableRoute) url.pathname = demoNavigationPath(demo, activeView, url.hostname);
      history.replaceState(null, '', url);
      location.reload();
    } catch (caught) {
      const outdatedWorker = caught instanceof Error && 'code' in caught && caught.code === 'UNKNOWN_COMMAND';
      setResetError(outdatedWorker
        ? t('Tutup atau muat ulang tab demo Cafe lainnya, lalu ulangi reset.', 'Close or reload the other Cafe demo tabs, then try resetting again.')
        : t('Demo belum berhasil diulang. Coba lagi.', 'Could not reset the demo. Try again.'));
      setResetting(false);
    }
  };

  const staffRole = prepared?.staff.find(person => person.id === demoStaffId)?.role;
  return <div className="demo-session" data-demo-view={activeView} data-table-entry={showTableEntry ? "true" : undefined}>
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
        {activeView === 'staf' && prepared && prepared.staff.length > 0 && demoStaffId && <Select value={demoStaffId} onValueChange={changeStaff}>
          <SelectTrigger className="tl-demo-select" aria-label={t('Identitas staf demo', 'Demo staff identity')}><SelectValue /></SelectTrigger>
          <SelectContent className="tl-demo-select-menu" position="popper" align="start" sideOffset={6}>{prepared.staff.map(person => {
            return <SelectItem key={person.id} value={person.id}>{person.userName} · {staffRoleLabel(person.role, t)}</SelectItem>;
          })}</SelectContent>
        </Select>}
      </>}
      viewLabel={t('Tampilan demo', 'Demo view')} activeView={activeView}
      tour={prepared && !error ? {
        id: `${demo.id}:${activeView}:${demoStaffId ?? ''}:${showTableEntry}`,
        language,
        role: activeView === 'pelanggan' ? ['Pelanggan', 'Customer'] : [
          staffRole ? staffRoleLabel(staffRole, id => id) : 'Staf',
          staffRole ? staffRoleLabel(staffRole, (_, en) => en) : 'Staff',
        ],
        invitationKey: 'tampiloka:cafe:guide-welcome',
        resume: activeView === 'pelanggan' && !showTableEntry && resumeCustomerTour,
        actionSteps: activeView === 'pelanggan'
          ? showTableEntry ? tableEntryTour(continueTableTour) : customerTour(isTableRoute, href(demo, 'staf'))
          : staffTour(staffRole ?? '', isModuleEnabled('catalog') ? href(demo, 'pelanggan') : undefined),
      } : undefined}
      views={[
        ...(isModuleEnabled('catalog') ? [{ id: 'pelanggan', label: t('Pelanggan', 'Customer'), icon: <ShoppingBag size={16} />, href: href(demo, 'pelanggan') }] : []),
        ...(hasStaffModules() ? [{ id: 'staf', label: t('Staf', 'Staff'), icon: <Store size={16} />, href: href(demo, 'staf') }] : []),
      ]}
      actions={<DemoTools snapshot={prepared?.snapshot} resetting={resetting} resetError={resetError} onReset={level => { void reset(level); }} canUseScenarios={!readOnlyCatalog && hasStaffModules()} />}
    />
    {error ? <main className="demo-loading" role="alert"><h1>{t('Halaman belum dapat dibuka', 'Page unavailable')}</h1><p>{error}</p><button type="button" onClick={() => location.reload()}>{t('Coba lagi', 'Try again')}</button><a href={gallery}>{t('Lihat template lain', 'View other templates')}</a></main>
      : prepared ? showTableEntry ? <TableEntry tables={prepared.snapshot.tables} theme={theme} staffId={demoStaffId} onBrowseMenu={() => setBrowsingWithoutTable(true)} />
      : <KafeWorkspace initialSnapshot={prepared.snapshot} initialView={prepared.view} initialTableId={isTableRoute || prepared.billId ? prepared.tableId : undefined} initialBillId={prepared.billId} demoStaffId={demoStaffId} onViewChange={viewChanged} />
      : <main className="demo-loading" aria-live="polite"><span className="demo-spinner" /><h1>{activeView === 'staf' ? t('Menyiapkan ruang kerja…', 'Preparing workspace…') : t('Menyiapkan menu…', 'Preparing menu…')}</h1></main>}
    <LanguageToggle floating />
  </div>;
}
