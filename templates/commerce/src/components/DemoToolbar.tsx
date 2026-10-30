import { t, choose, useLanguage } from '../lib/language';
import { DemoToolbarShell } from '@tampiloka/ui-core/demo';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './shadcn/select';
import { Button as ShadcnButton } from './shadcn/button';
import { Check, LayoutTemplate, RotateCcw, Settings2, ShoppingBag, Store } from 'lucide-react';
import { useState } from 'react';
import { useCommerce } from '../lib/store';
import { presets } from '../lib/appearance';
import { api } from '../lib/api';
import { levelLabels } from '../lib/format';
import { Button, Field, Modal } from './ui';

export function DemoToolbar() {
  const { data, view, navigate, configure, busy, appearance, setAppearance, refresh, clearCart, notify } = useCommerce(); const [settings, setSettings] = useState(false); const [reset, setReset] = useState(false);
  const { language } = useLanguage();
  if (!data?.demo) return null;
  const active = presets.find(preset => preset.id === data.config.preset) || presets[0];
  const resetDemo = async () => { setReset(true); try { await api.resetDemo(); clearCart(); await refresh(); navigate('shop'); setSettings(false); notify('Demo direset. Pesanan uji sebelumnya dihapus.'); } catch (error) { notify(error instanceof Error ? error.message : 'Reset gagal.', 'error'); } finally { setReset(false); } };
  return <><DemoToolbarShell family="commerce" label={t("Pengaturan demo Tampiloka")}
    galleryLabel={choose('Kembali ke template Tampiloka', 'Back to Tampiloka templates')}
    galleryUrl={language === 'en' ? 'https://tampiloka.site/en/templates' : 'https://tampiloka.site/templates'}
    controls={<>
      <Select value={active.id} disabled={busy} onValueChange={value => {
        const preset = presets.find(item => item.id === value);
        if (!preset) return;
        setAppearance({ ...appearance, card: preset.card, button: preset.button });
        void configure(data.config.level, preset.id);
      }}>
        <SelectTrigger className="tl-demo-select" aria-label={choose('Tema demo', 'Demo theme')}><SelectValue /></SelectTrigger>
        <SelectContent className="tl-demo-select-menu" position="popper" align="start" sideOffset={6}>{presets.map(preset => <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={data.config.level} disabled={busy} onValueChange={value => void configure(value, active.id)}>
        <SelectTrigger className="tl-demo-select" aria-label={choose('Mode demo', 'Demo mode')}><SelectValue /></SelectTrigger>
        <SelectContent className="tl-demo-select-menu" position="popper" align="start" sideOffset={6}>{Object.entries(levelLabels).map(([id, name]) => <SelectItem key={id} value={id}>{t(name)}</SelectItem>)}</SelectContent>
      </Select>
    </>}
    viewLabel={choose('Tampilan demo', 'Demo view')} activeView={view === 'staff' ? 'staff' : 'customer'}
    views={[
      { id: 'customer', label: t('Pembeli'), icon: <ShoppingBag size={16} />, onSelect: () => navigate('shop') },
      { id: 'staff', label: t('Staf'), icon: <Store size={16} />, onSelect: () => navigate('staff') },
    ]}
    actions={<button type="button" aria-label={t('Sesuaikan tampilan demo')} title={t('Sesuaikan tampilan demo')} onClick={() => setSettings(true)}><Settings2 size={16} /></button>}
  /><Modal open={settings} onClose={() => setSettings(false)} title={t("Sesuaikan demo")} description={t("Pilihan fitur dan tampilan bisa dipakai ulang saat membuat proyek klien.")}><div className="settings-stack"><section><h3>{t("Susunan halaman")}</h3><div className="preset-options">{presets.map(preset => <ShadcnButton variant="unstyled" size="none" key={preset.id} className={active.id === preset.id ? 'selected' : ''} onClick={() => { setAppearance({ ...appearance, card: preset.card, button: preset.button }); void configure(data.config.level, preset.id); }} disabled={busy}><LayoutTemplate size={20} /><strong>{preset.name}</strong><small>{t(preset.description)}</small>{active.id === preset.id && <Check size={16} />}</ShadcnButton>)}</div></section><div className="form-grid"><Field label={t("Palet")}><Select value={appearance.palette} onValueChange={value => setAppearance({ ...appearance, palette: value as typeof appearance.palette })}><SelectTrigger aria-label={t("Palet")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sand">{t("Pasir")}</SelectItem><SelectItem value="ink">{t("Tinta")}</SelectItem><SelectItem value="forest">{t("Hutan")}</SelectItem></SelectContent></Select></Field><Field label={t("Kartu produk")}><Select value={appearance.card} onValueChange={value => setAppearance({ ...appearance, card: value as typeof appearance.card })}><SelectTrigger aria-label={t("Kartu produk")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">{t("Terbuka")}</SelectItem><SelectItem value="framed">{t("Bingkai")}</SelectItem><SelectItem value="soft">{t("Lembut")}</SelectItem></SelectContent></Select></Field><Field label={t("Tombol")}><Select value={appearance.button} onValueChange={value => setAppearance({ ...appearance, button: value as typeof appearance.button })}><SelectTrigger aria-label={t("Tombol")}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solid">{t("Isi penuh")}</SelectItem><SelectItem value="outline">{t("Garis")}</SelectItem></SelectContent></Select></Field></div><p className="help-text">{t("Ini toko contoh untuk mencoba fitur. Produk, harga, pesanan, dan pembayaran adalah data simulasi; setiap pengunjung memiliki sesi demo terpisah.")}</p><Button variant="secondary" loading={reset} onClick={resetDemo}><RotateCcw size={16} />{t("Reset data demo")}</Button></div></Modal></>;
}

