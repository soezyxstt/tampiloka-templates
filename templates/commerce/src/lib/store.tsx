import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Bootstrap, CartLine, Product } from '../shared/contracts';
import { api } from './api';
import { resolveAppearance } from '@tampiloka/theme-engine';
import { readAppearance, type Appearance } from './appearance';

export type View = 'shop' | 'checkout' | 'orders' | 'wishlist' | 'staff';
interface Notice { message: string; kind: 'success' | 'error' }
interface CommerceState {
  data: Bootstrap | null; loading: boolean; error: string; refresh: () => Promise<void>;
  cart: CartLine[]; addItem: (variantId: string, quantity: number) => void; setQuantity: (variantId: string, quantity: number) => void; clearCart: () => void;
  cartOpen: boolean; setCartOpen: (open: boolean) => void; product: Product | null; setProduct: (product: Product | null) => void;
  view: View; navigate: (view: View) => void; appearance: Appearance; setAppearance: (value: Appearance) => void;
  notice: Notice | null; notify: (message: string, kind?: 'success' | 'error') => void; configure: (level: string, preset: string) => Promise<void>; busy: boolean;
}
const Store = createContext<CommerceState | null>(null);
const validViews: View[] = ['shop', 'checkout', 'orders', 'wishlist', 'staff'];
function getView(): View { const current = location.hash.replace('#/', '').split('?')[0] as View; return validViews.includes(current) ? current : 'shop'; }
function readCart(): CartLine[] {
  try {
    const data = JSON.parse(localStorage.getItem('tampiloka-commerce-cart') || '[]');
    return Array.isArray(data) ? data.filter((x: CartLine) => typeof x.variantId === 'string' && Number.isInteger(x.quantity) && x.quantity > 0) : [];
  } catch { return []; }
}
function hasSavedAppearance() { try { return Boolean(localStorage.getItem('tampiloka-commerce-appearance')); } catch { return false; } }

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [product, setProductState] = useState<Product | null>(null);
  const [view, setView] = useState<View>(getView);
  const [appearance, setAppearanceState] = useState<Appearance>(readAppearance);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const productsRef = useRef<Product[]>([]);

  const notify = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setNotice({ message, kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 5000);
  }, []);

  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    inFlight.current = (async () => {
      try {
        let next = await api.bootstrap();
        if (!initialized.current) {
          const params = new URLSearchParams(location.search);
          const level = params.get('level');
          const preset = params.get('preset');
          const validLevel = level && ['catalog', 'whatsapp', 'store', 'advanced'].includes(level) ? level : null;
          const validPreset = preset && ['editorial', 'market', 'atelier', 'compact'].includes(preset) ? preset : null;
          if (next.demo && (validLevel || validPreset)) next = await api.configure({ level: validLevel || next.config.level, preset: validPreset || next.config.preset });
          if (!next.demo || !hasSavedAppearance()) setAppearanceState(resolveAppearance(next.config.appearance));
          initialized.current = true;
          const slug = params.get('product');
          if (slug) setProductState(next.products.find(item => item.slug === slug && item.active) || null);
        } else if (!next.demo) setAppearanceState(resolveAppearance(next.config.appearance));
        productsRef.current = next.products;
        setData(next);
        setError('');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Toko belum dapat dimuat.');
        throw cause;
      } finally { setLoading(false); inFlight.current = null; }
    })();
    return inFlight.current;
  }, []);

  useEffect(() => {
    void refresh().catch(() => {});
    const onNavigation = () => {
      setView(getView());
      const slug = new URLSearchParams(location.search).get('product');
      setProductState(slug ? productsRef.current.find(item => item.slug === slug && item.active) || null : null);
      setCartOpen(false);
    };
    window.addEventListener('hashchange', onNavigation);
    window.addEventListener('popstate', onNavigation);
    return () => {
      window.removeEventListener('hashchange', onNavigation);
      window.removeEventListener('popstate', onNavigation);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);
  useEffect(() => { try { localStorage.setItem('tampiloka-commerce-cart', JSON.stringify(cart)); } catch { /* The cart remains usable when storage is unavailable. */ } }, [cart]);

  const setProduct = (next: Product | null) => {
    setProductState(next);
    const url = new URL(location.href);
    if (next) { url.searchParams.set('product', next.slug); history.pushState(null, '', url); }
    else { url.searchParams.delete('product'); history.replaceState(null, '', url); }
  };
  const navigate = (next: View) => {
    setView(next); setProduct(null); setCartOpen(false);
    location.hash = `/${next}`;
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const setAppearance = (value: Appearance) => {
    setAppearanceState(value);
    try { localStorage.setItem('tampiloka-commerce-appearance', JSON.stringify(value)); } catch { /* Appearance still applies to this visit. */ }
  };
  const addItem = (variantId: string, quantity: number) => {
    if (!data?.capabilities.cart) return;
    const variant = data.products.flatMap(p => p.variants).find(v => v.id === variantId);
    if (!variant) return;
    setCart(items => {
      const current = items.find(line => line.variantId === variantId)?.quantity || 0;
      if (current + quantity > variant.stock) { queueMicrotask(() => notify('Jumlah melebihi stok yang tersedia.', 'error')); return items; }
      queueMicrotask(() => notify('Produk ditambahkan ke keranjang.'));
      return current ? items.map(line => line.variantId === variantId ? { ...line, quantity: line.quantity + quantity } : line) : [...items, { variantId, quantity }];
    });
  };
  const setQuantity = (variantId: string, quantity: number) => {
    const variant = data?.products.flatMap(p => p.variants).find(v => v.id === variantId);
    if (variant && quantity > variant.stock) { notify('Jumlah melebihi stok yang tersedia.', 'error'); return; }
    setCart(items => quantity <= 0 ? items.filter(line => line.variantId !== variantId) : items.map(line => line.variantId === variantId ? { ...line, quantity } : line));
  };
  const configure = async (level: string, preset: string) => {
    setBusy(true);
    try {
      const next = await api.configure({ level, preset });
      productsRef.current = next.products; setData(next);
      const url = new URL(location.href); url.searchParams.set('level', level); url.searchParams.set('preset', preset); history.replaceState(null, '', url);
      setProduct(null); setCartOpen(false); navigate(view === 'staff' ? 'staff' : 'shop');
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Pengaturan belum tersimpan.', 'error'); }
    finally { setBusy(false); }
  };
  return <Store.Provider value={{ data, loading, error, refresh, cart, addItem, setQuantity, clearCart: () => setCart([]), cartOpen, setCartOpen, product, setProduct, view, navigate, appearance, setAppearance, notice, notify, configure, busy }}>{children}</Store.Provider>;
}
export function useCommerce() { const store = useContext(Store); if (!store) throw new Error('CommerceProvider diperlukan'); return store; }

