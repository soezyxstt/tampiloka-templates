'use client';
import { useCafeLanguage } from '@/lib/language';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, Coffee, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import Image from 'next/image';
import { cafeConfig, hasStaffModules, isModuleEnabled, THEMES, PRESETS, MODULES, type ThemeId } from '@/src/config/cafe';
import { Button, SelectField, Label } from './ui-primitives';
import { BrandMark } from './brand';

const quoteArg = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;
export function DemoStudio({ tables }: { tables: { id: string; label: string; token: string; area: string }[] }) {
  const { t: tr } = useCafeLanguage();
  const moduleLabels: Record<string, string> = {
    catalog: tr('Katalog menu', 'Menu catalog'), ordering: tr('Pemesanan pelanggan', 'Customer ordering'),
    payments: tr('Pembayaran online', 'Online payments'), cashier: tr('Kasir / POS', 'Cashier / POS'),
    kitchen: tr('Tampilan dapur', 'Kitchen display'), dashboard: tr('Laporan', 'Reports'),
    tables: tr('Layanan meja', 'Table service'), loyalty: tr('Loyalitas', 'Loyalty'), marketing: tr('Promosi', 'Promotions'),
  };
  const presetLabels: Record<string, string> = {
    catalog: tr('Menu dan permintaan pelayan', 'Menu and waiter requests'),
    'order-at-cashier': tr('Menu dan pesanan, bayar di kasir', 'Menu and ordering, pay at cashier'),
    'order-and-pay': tr('Menu, pesanan dan pembayaran online', 'Menu, ordering and online payment'),
    cashier: tr('Kasir', 'Cashier only'), 'cashier-kitchen': tr('Kasir dan dapur', 'Cashier and kitchen'),
    operations: tr('Kasir, dapur dan laporan', 'Cashier, kitchen and reports'),
    'menu-cashier': tr('Menu dan kasir', 'Menu and cashier'),
    'menu-order-cashier': tr('Menu, pesanan dan kasir', 'Menu, ordering and cashier'), full: tr('Layanan lengkap', 'Full service'),
  };
  const themeDescriptions: Record<string, string> = {
    boxy: tr('Tegas dan rapat', 'Bold and compact'), rounded: tr('Lembut dan seimbang', 'Soft and balanced'),
    editorial: tr('Daftar dengan serif', 'Serif-led list'), playful: tr('Garis tebal, lebih ekspresif', 'Bold and expressive'),
    airy: tr('Lega dan ringan', 'Open and light'),
  };
  const [theme, setTheme] = useState<ThemeId>(cafeConfig.theme);
  const [preset, setPreset] = useState('full');
  const [table, setTable] = useState(tables[0]?.token || '');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const tablePath = `/t/${cafeConfig.venue.tenantSlug}/${cafeConfig.venue.outletSlug}/m/${table}`;
  const staffPath = `/staff/${cafeConfig.venue.tenantSlug}/${cafeConfig.venue.outletSlug}`;
  const command = `npm run cafe -- init ../new-client --name ${quoteArg(cafeConfig.brand.name)} --preset ${preset} --theme ${theme} --color ${quoteArg(cafeConfig.brand.primaryColor)} --yes`;
  useEffect(() => { document.documentElement.dataset.theme = theme; return () => { document.documentElement.dataset.theme = cafeConfig.theme; }; }, [theme]);
  useEffect(() => { let active = true; if (table) void QRCode.toDataURL(new URL(`${tablePath}?theme=${theme}`, window.location.origin).toString(), { width: 320, margin: 2 }).then(data => { if (active) setQr(data); }); return () => { active = false; }; }, [table, tablePath, theme]);
  return <main className="max-w-6xl mx-auto px-5 md:px-10 py-8 md:py-14 space-y-10">
    <header className="flex flex-wrap items-center justify-between gap-5 border-b border-[var(--border)] pb-6"><div className="flex items-center gap-3"><BrandMark /><div><h1 className="font-heading text-2xl md:text-3xl font-semibold">{tr("Studio demo", "Demo studio")}</h1><p className="text-sm text-[var(--muted-foreground)]">{cafeConfig.brand.name}</p></div></div><a href="https://www.figma.com/design/eXWI36xzNr8gtLBxFW0G6r/Design-Kit?node-id=116-43" target="_blank" rel="noreferrer" className="text-sm inline-flex items-center gap-2 underline underline-offset-4">{tr("Lihat kit Figma", "View Figma kit")}<ArrowUpRight className="w-4 h-4" /></a></header>
    <section className="space-y-4"><h2 className="font-heading text-2xl font-semibold">{tr("Pilih gaya", "Choose a style")}</h2><p className="text-[var(--muted-foreground)]">{tr("Coba bentuk, huruf, dan jarak dengan warna brand yang sama. Pilihan ini hanya mengubah pratinjau.", "Try shapes, typography and spacing with the same brand colors. This only changes the preview.")}</p><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{Object.entries(THEMES).map(([id, option]) => <button key={id} type="button" onClick={() => setTheme(id as ThemeId)} aria-pressed={theme === id} className={`min-h-32 text-left border-2 p-4 bg-[var(--surface)] ${theme === id ? 'border-[var(--primary)]' : 'border-[var(--border)]'}`} style={{ borderRadius: id === 'rounded' ? 20 : id === 'playful' ? 26 : id === 'airy' ? 10 : 0, boxShadow: id === 'playful' ? '3px 3px 0 var(--foreground)' : undefined }}><span className="flex items-center justify-between"><Coffee className="w-5 h-5 text-[var(--primary-ink)]" />{theme === id && <Check className="w-4 h-4" />}</span><span className="block mt-5 font-semibold text-lg" style={{ fontFamily: id === 'editorial' ? 'Georgia, serif' : undefined }}>{option.label}</span><span className="block text-xs text-[var(--muted-foreground)] mt-1">{themeDescriptions[id]}</span></button>)}</div></section>
    <section className="grid md:grid-cols-2 gap-6"><div className="space-y-5 border border-[var(--border)] bg-[var(--surface)] p-6 rounded-[var(--radius-panel)]"><h2 className="font-heading text-xl font-semibold">{tr("Buka alur demo", "Open demo flows")}</h2><p className="text-sm text-[var(--muted-foreground)]">{tr("Data contoh tersimpan di perangkat yang menjalankan server. Pembayaran demo tidak memindahkan uang.", "Sample data is stored on the device running the server. Demo payments do not transfer money.")}</p><div className="flex flex-wrap gap-3">{isModuleEnabled('catalog') && <Button asChild><a href={`${tablePath}?theme=${theme}`} target="_blank" rel="noreferrer">{tr("Menu pelanggan", "Customer menu")}<ArrowUpRight className="w-4 h-4" /></a></Button>}{hasStaffModules() && <Button asChild variant="secondary"><a href={`${staffPath}?theme=${theme}`} target="_blank" rel="noreferrer">{tr("Ruang staf", "Staff workspace")}<ArrowUpRight className="w-4 h-4" /></a></Button>}</div><div><h3 className="font-semibold text-sm mb-2">{tr("Modul aktif", "Active modules")}</h3><ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{cafeConfig.modules.map(id => <li key={id} className="flex items-center gap-2"><Check className="w-3 h-3 text-[var(--primary-ink)]" />{moduleLabels[id] || MODULES[id].label}</li>)}</ul></div></div><div className="space-y-4 border border-[var(--border)] bg-[var(--surface)] p-6 rounded-[var(--radius-panel)]"><h2 className="font-heading text-xl font-semibold">{tr("QR meja", "Table QR code")}</h2>{isModuleEnabled('catalog') ? <><Label htmlFor="demo-table">{tr("Pilih meja untuk dicoba", "Choose a table to try")}</Label><SelectField id="demo-table" value={table} onChange={event => setTable(event.target.value)}>{tables.map(entry => <option key={entry.id} value={entry.token}>{entry.label} · {entry.area}</option>)}</SelectField><div className="flex items-center gap-5">{qr && <Image src={qr} width={320} height={320} unoptimized alt={tr("QR menu meja yang dipilih", "Menu QR code for selected table")} className="w-32 h-32" />}<div className="space-y-3"><a href={qr} download={`menu-${cafeConfig.venue.outletSlug}-${tables.find(entry => entry.token === table)?.label || 'meja'}.png`} className="text-sm font-semibold underline underline-offset-4">{tr("Unduh QR meja", "Download table QR code")}</a><p className="text-xs text-[var(--muted-foreground)] max-w-52">{tr("QR memakai alamat server saat ini. Gunakan alamat yang bisa dibuka ponsel atau domain demo saat membagikannya.", "The QR code uses the current server address. Use an address a phone can open or a demo domain when sharing.")}</p></div></div></> : <p className="text-sm text-[var(--muted-foreground)]">{tr("Paket ini hanya memakai ruang staf. Tambahkan modul catalog untuk QR menu.", "This package only uses the staff workspace. Add the catalog module for menu QR codes.")}</p>}</div></section>
    <section className="space-y-4 border-t border-[var(--border)] pt-8"><h2 className="font-heading text-2xl font-semibold">{tr("Mulai klien baru", "Start a new client project")}</h2><div className="max-w-md"><Label htmlFor="demo-preset">{tr("Cakupan layanan", "Service scope")}</Label><SelectField id="demo-preset" value={preset} onChange={event => setPreset(event.target.value)}>{Object.entries(PRESETS).map(([id, option]) => <option key={id} value={id}>{presetLabels[id] || option.label}</option>)}</SelectField></div><div className="flex flex-col sm:flex-row gap-3"><pre className="flex-1 min-w-0 overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"><code>{command}</code></pre><Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } }}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? tr("Tersalin", "Copied") : tr("Salin perintah", "Copy command")}</Button></div><p className="text-sm text-[var(--muted-foreground)]">{tr("Ganti nama dan folder tujuan sesuai klien. Perintah membuat proyek baru; konfigurasi demo yang sedang dibuka tetap sama.", "Change the name and destination folder for your client. The command creates a new project; the current demo configuration stays the same.")}</p></section>
  </main>;
}
