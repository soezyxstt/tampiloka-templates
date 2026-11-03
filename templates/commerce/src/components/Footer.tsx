import { t, sampleText } from '../lib/language';
import { Button as ShadcnButton } from './shadcn/button';
import { MessageCircle } from 'lucide-react';
import { useCommerce } from '../lib/store';
import { ContactAction } from './ContactAction';

export function Footer() {
  const { data, navigate } = useCommerce(); if (!data) return null;
  return <footer className="store-footer"><div className="footer-main"><div><ShadcnButton variant="unstyled" size="none" className="brand footer-brand" onClick={() => navigate('shop')}>{data.config.brand.name}<span>.</span></ShadcnButton><p>{sampleText(data.config.brand.tagline)}</p></div><div className="footer-contact"><span>{data.config.brand.address}</span><ContactAction><MessageCircle size={16} aria-hidden="true" />{t("Hubungi toko")}</ContactAction></div><div className="footer-links"><ShadcnButton variant="unstyled" size="none" onClick={() => navigate('shop')}>{t("Semua koleksi")}</ShadcnButton>{data.capabilities.orders && <ShadcnButton variant="unstyled" size="none" onClick={() => navigate('orders')}>{t("Lacak pesanan")}</ShadcnButton>}<ShadcnButton variant="unstyled" size="none" onClick={() => navigate('staff')}>{t("Ruang staf")}</ShadcnButton></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {data.config.brand.name}</span>{data.demo ? <span>{t("Toko contoh untuk demo Tampiloka. Tidak menerima pembayaran nyata.")}</span> : <span>{data.config.brand.email}</span>}<a href="https://tampiloka.site" target="_blank" rel="noreferrer">{t("Dibuat bersama tampiloka")}</a></div></footer>;
}
