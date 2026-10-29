import { ArrowUpRight } from 'lucide-react';
import { useCommerce } from '../lib/store';
import { ContactAction } from './ContactAction';

export function Footer() {
  const { data, navigate } = useCommerce(); if (!data) return null;
  return <footer className="store-footer"><div className="footer-main"><div><button className="brand footer-brand" onClick={() => navigate('shop')}>{data.config.brand.name}<span>.</span></button><p>{data.config.brand.tagline}</p></div><div className="footer-contact"><span>{data.config.brand.address}</span><ContactAction>Hubungi toko<ArrowUpRight size={16} /></ContactAction></div><div className="footer-links"><button onClick={() => navigate('shop')}>Semua koleksi</button>{data.capabilities.orders && <button onClick={() => navigate('orders')}>Lacak pesanan</button>}<button onClick={() => navigate('staff')}>Ruang staf</button></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {data.config.brand.name}</span>{data.demo ? <span>Toko contoh untuk demo Tampiloka. Tidak menerima pembayaran nyata.</span> : <span>{data.config.brand.email}</span>}<a href="https://tampiloka.site" target="_blank" rel="noreferrer">Dibuat bersama tampiloka<ArrowUpRight size={13} /></a></div></footer>;
}
