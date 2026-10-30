import { Button as ShadcnButton } from './shadcn/button';
import { Select } from './ui';
import { Check, LayoutTemplate, RotateCcw, Settings2, ShoppingBag, Store, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useCommerce } from '../lib/store';
import { presets } from '../lib/appearance';
import { api } from '../lib/api';
import { levelLabels } from '../lib/format';
import { Button, Field, IconButton, Modal } from './ui';

export function DemoToolbar() {
  const { data, view, navigate, configure, busy, appearance, setAppearance, refresh, clearCart, notify } = useCommerce(); const [settings, setSettings] = useState(false); const [reset, setReset] = useState(false);
  const toolbar = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = toolbar.current;
    const update = () => document.documentElement.style.setProperty('--demo-height', `${data?.demo && element ? Math.ceil(element.getBoundingClientRect().height) : 0}px`);
    update();
    if (!element || !data?.demo) return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [data?.demo]);
  if (!data?.demo) return null;
  const active = presets.find(preset => preset.id === data.config.preset) || presets[0];
  const resetDemo = async () => { setReset(true); try { await api.resetDemo(); clearCart(); await refresh(); navigate('shop'); setSettings(false); notify('Demo direset. Pesanan uji sebelumnya dihapus.'); } catch (error) { notify(error instanceof Error ? error.message : 'Reset gagal.', 'error'); } finally { setReset(false); } };
  return <><aside ref={toolbar} className="demo-toolbar" aria-label="Pengaturan demo Tampiloka"><a className="demo-wordmark" href="https://tampiloka.site" target="_blank" rel="noreferrer">tampiloka<span> / commerce</span></a><div className="demo-center"><label><span className="sr-only">Preset desain</span><Select value={active.id} disabled={busy} onChange={event => { const preset = presets.find(p => p.id === event.target.value)!; setAppearance({ ...appearance, card: preset.card, button: preset.button }); void configure(data.config.level, preset.id); }}>{presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</Select></label><label><span className="sr-only">Tingkat fitur</span><Select value={data.config.level} disabled={busy} onChange={event => void configure(event.target.value, active.id)}>{Object.entries(levelLabels).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></label></div><div className="demo-actions"><ShadcnButton variant="unstyled" size="none" className={view !== 'staff' ? 'selected' : ''} onClick={() => navigate('shop')}><ShoppingBag size={15} /><span>Pembeli</span></ShadcnButton><ShadcnButton variant="unstyled" size="none" className={view === 'staff' ? 'selected' : ''} onClick={() => navigate('staff')}><Store size={15} /><span>Staf</span></ShadcnButton><IconButton label="Sesuaikan tampilan demo" onClick={() => setSettings(true)}><Settings2 size={16} /></IconButton></div></aside><Modal open={settings} onClose={() => setSettings(false)} title="Sesuaikan demo" description="Pilihan fitur dan tampilan bisa dipakai ulang saat membuat proyek klien."><div className="settings-stack"><section><h3>Susunan halaman</h3><div className="preset-options">{presets.map(preset => <ShadcnButton variant="unstyled" size="none" key={preset.id} className={active.id === preset.id ? 'selected' : ''} onClick={() => { setAppearance({ ...appearance, card: preset.card, button: preset.button }); void configure(data.config.level, preset.id); }} disabled={busy}><LayoutTemplate size={20} /><strong>{preset.name}</strong><small>{preset.description}</small>{active.id === preset.id && <Check size={16} />}</ShadcnButton>)}</div></section><div className="form-grid"><Field label="Palet"><Select value={appearance.palette} onChange={event => setAppearance({ ...appearance, palette: event.target.value as typeof appearance.palette })}><option value="sand">Pasir</option><option value="ink">Tinta</option><option value="forest">Hutan</option></Select></Field><Field label="Kartu produk"><Select value={appearance.card} onChange={event => setAppearance({ ...appearance, card: event.target.value as typeof appearance.card })}><option value="open">Terbuka</option><option value="framed">Bingkai</option><option value="soft">Lembut</option></Select></Field><Field label="Tombol"><Select value={appearance.button} onChange={event => setAppearance({ ...appearance, button: event.target.value as typeof appearance.button })}><option value="solid">Isi penuh</option><option value="outline">Garis</option></Select></Field></div><p className="help-text">Ini toko contoh. Produk, harga, pesanan, dan pembayaran di sini untuk uji coba. Data demo terpisah untuk tiap pengunjung.</p><Button variant="secondary" loading={reset} onClick={resetDemo}><RotateCcw size={16} />Reset data demo</Button></div></Modal></>;
}
