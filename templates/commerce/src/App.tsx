import { t } from './lib/language';
import { setDemoContent, useLanguage } from './lib/language';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useEffect, type CSSProperties } from 'react';
import { brandVariables } from '@tampiloka/theme-engine';
import { useCommerce } from './lib/store';
import { DemoToolbar } from './components/DemoToolbar';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ProductDetail } from './components/ProductDetail';
import { CartDrawer } from './components/CartDrawer';
import { Button, EmptyState } from './components/ui';
import { Storefront } from './pages/Storefront';
import { Checkout } from './pages/Checkout';
import { CustomerOrders } from './pages/CustomerOrders';
import { StaffWorkspace } from './pages/StaffWorkspace';

export function App() {
  const { language } = useLanguage();
  const { data, loading, error, refresh, view, appearance, notice } = useCommerce();
  setDemoContent(Boolean(data?.demo));
  useEffect(() => { if (data) document.title = `${data.config.brand.name} · ${t(view === 'staff' ? 'Ruang staf' : view === 'checkout' ? 'Checkout' : view === 'orders' ? 'Pesanan saya' : 'Koleksi')}`; }, [data?.config.brand.name, view, language]);
  useEffect(() => { const vars = brandVariables(appearance.palette); for (const [name, value] of Object.entries(vars)) document.documentElement.style.setProperty(name, String(value)); document.documentElement.dataset.palette = appearance.palette; document.documentElement.dataset.button = appearance.button; }, [appearance]);
  if (loading) return <div className="app-loading"><span className="loading-wordmark">tampiloka<span>.</span></span><p>{t("Menyiapkan toko...")}</p><span className="loading-line" /></div>;
  if (!data) return <div className="page-container"><EmptyState icon={<XCircle size={32} />} title={t("Toko belum dapat dibuka")} description={error ? t(error) : t("Periksa sambungan internet dan coba lagi.")} action={<Button onClick={() => void refresh().catch(() => {})}><RefreshCw size={17} />{t("Coba lagi")}</Button>} /></div>;
  return <div className={`commerce-app ${data.demo ? 'is-demo' : ''}`} data-preset={data.config.preset} data-card={appearance.card}><a href={view === 'staff' ? '#staff-content' : '#main-content'} className="skip-link" onClick={event => { event.preventDefault(); document.getElementById(view === 'staff' ? 'staff-content' : 'main-content')?.focus(); }}>{t("Lewati ke isi")}</a><DemoToolbar />{view === 'staff' ? <StaffWorkspace /> : <><Header /><main id="main-content" tabIndex={-1}>{(view === 'shop' || view === 'wishlist') && <Storefront wishlist={view === 'wishlist'} />}{view === 'checkout' && <Checkout />}{view === 'orders' && <CustomerOrders />}</main><Footer /><ProductDetail /><CartDrawer /></>}{notice && <div className={`toast toast-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.kind === 'success' ? <CheckCircle2 size={19} /> : <XCircle size={19} />}<span>{t(notice.message)}</span></div>}</div>;
}
