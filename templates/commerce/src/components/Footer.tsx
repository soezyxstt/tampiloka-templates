import { Button as ShadcnButton } from './shadcn/button';
import { ArrowUpRight } from 'lucide-react';
import { useCommerce } from '../lib/store';
import { ContactAction } from './ContactAction';

export function Footer() {
  const { data, navigate } = useCommerce(); if (!data) return null;
  return <footer className="store-footer"><div className="footer-main"><div><ShadcnButton variant="unstyled" size="none" className="brand footer-brand" onClick={() => navigate('shop')}>{data.config.brand.name}<span>.</span></ShadcnButton><p>{data.config.brand.tagline}</p></div><div className="footer-contact"><span>{data.config.brand.address}</span><ContactAction>Hubungi toko<ArrowUpRight size={16} /></ContactAction></div><div className="footer-links"><ShadcnButton variant="unstyled" size="none" onClick={() => navigate('shop')}>Semua koleksi</ShadcnButton>{data.capabilities.orders && <ShadcnButton variant="unstyled" size="none" onClick={() => navigate('orders')}>Lacak pesanan</ShadcnButton>}<ShadcnButton variant="unstyled" size="none" onClick={() => navigate('staff')}>Ruang staf</ShadcnButton></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {data.config.brand.name}</span>{data.demo ? <span>Toko contoh untuk demo Tampiloka. Tidak menerima pembayaran nyata.</span> : <span>{data.config.brand.email}</span>}<a href="https://tampiloka.site" target="_blank" rel="noreferrer">Dibuat bersama tampiloka<ArrowUpRight size={13} /></a></div></footer>;
}
