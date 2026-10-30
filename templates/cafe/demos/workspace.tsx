import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, RotateCcw } from 'lucide-react';
import { KafeWorkspace, type WorkspaceView } from '../components/cafe/kafe-workspace';
import { cafeConfig, hasStaffModules, isModuleEnabled } from './config';
import { demoBasePath, DEMO_HUB, DEMO_DOMAIN, localizeDemo } from './manifest';
import type { DemoPreset } from './components/demo-portal';
import { ScenarioPanel } from './components/scenario-panel';
import { LanguageToggle, useCafeLanguage } from '@/lib/language';

type Prepared = { snapshot: any; view: WorkspaceView; tableId?: string; billId?: string };

export default function DemoWorkspace({ demo }: { demo: DemoPreset }) {
  const { language, t } = useCafeLanguage();
  const [prepared, setPrepared] = useState<Prepared>();
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const base = demoBasePath(demo);
  const readOnlyCatalog = cafeConfig.modules.length === 1 && isModuleEnabled('catalog');
  const hub = location.hostname.endsWith(`.${DEMO_DOMAIN}`) ? DEMO_HUB : '/';

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
      if (active) setPrepared({ snapshot, view, tableId: view === 'pelanggan' ? table?.id : undefined, billId });
    })().catch(caught => { console.error('Demo initialization failed', caught); if (active) setError(caught instanceof Error ? caught.message : 'Demo belum dapat dibuka.'); });
    return () => { active = false; cleanup?.(); };
  }, [demo.id, readOnlyCatalog]);

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

  return <div className="demo-session">
    <div className="demo-toolbar">
      <a href={hub} className="demo-back"><ArrowLeft size={16} /><span>{t("Semua demo", "All demos")}</span></a>
      <span className="demo-package-name">{localizeDemo(demo, language).name}</span>
      <div className="demo-toolbar-actions">
        {isModuleEnabled('catalog') && <a href={`${base}/`}>{t("Pelanggan", "Customer")}<ArrowUpRight size={14} /></a>}
        {hasStaffModules() && <a href={`${base}/staff`}>{t("Staf", "Staff")}<ArrowUpRight size={14} /></a>}
        <LanguageToggle />
        <button type="button" onClick={reset} disabled={resetting || !prepared} aria-label={t("Ulangi demo", "Reset demo")}><RotateCcw size={15} /><span>{resetting ? t('Mengulang…', 'Resetting…') : t('Ulangi', 'Reset')}</span></button>
      </div>
    </div>
    <details className="demo-context"><summary>{t('Demo interaktif · tidak ada pembayaran nyata', 'Interactive demo · no real payments')}</summary><p>{t('Perubahan tersimpan di browser ini. Tab pelanggan dan staf pada alamat demo yang sama berbagi data. Perangkat atau browser lain memiliki sesi sendiri. Gunakan “Ulangi” untuk memulai kembali.', 'Changes are saved in this browser. Customer and staff tabs on the same demo address share data. Other devices or browsers have separate sessions. Use “Reset” to start again.')}</p></details>
    {prepared?.view === 'staf' && !readOnlyCatalog && <ScenarioPanel snapshot={prepared.snapshot} />}
    {error ? <main className="demo-loading" role="alert"><h1>{t("Demo belum dapat dibuka", "Demo unavailable")}</h1><p>{error}</p><button type="button" onClick={() => location.reload()}>{t("Coba lagi", "Try again")}</button><a href={hub}>{t("Pilih demo lain", "Choose another demo")}</a></main>
      : prepared ? <KafeWorkspace initialSnapshot={prepared.snapshot} initialView={prepared.view} initialTableId={prepared.tableId} initialBillId={prepared.billId} />
      : <main className="demo-loading" aria-live="polite"><span className="demo-spinner" /><h1>{t('Menyiapkan demo…', 'Preparing demo…')}</h1><p>{t("Pembukaan pertama membutuhkan beberapa saat. Setelah itu, data demo tersimpan di browser ini.", "The first load may take a moment. Demo data is then saved in this browser.")}</p></main>}
  </div>;
}
