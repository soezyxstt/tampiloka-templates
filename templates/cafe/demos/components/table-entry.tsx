import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { MapPin, QrCode } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { BrandMark } from '../../components/cafe/brand';
import { cafeConfig } from '../config';
import { useCafeLanguage } from '@/lib/language';

type Table = { id: string; label: string; areaName?: string; qrToken: string; capacity?: number; active?: boolean; physicalState?: string };

/** A real table route is shared by the QR and the open action. */
export function TableEntry({ tables, theme, staffId }: { tables: Table[]; theme: string; staffId?: string }) {
  const { language, t } = useCafeLanguage();
  const available = useMemo(() => tables.filter(table => table.active !== false && table.qrToken && table.physicalState !== 'OUT_OF_SERVICE'), [tables]);
  const [tableId, setTableId] = useState(() => available[0]?.id || '');
  const [qrResult, setQrResult] = useState({ url: '', value: '', failed: false });
  const table = available.find(entry => entry.id === tableId) || available[0];
  const areaLabel = (area?: string) => language === 'en' ? ({ 'Ruang Utama (Indoor)': 'Main room (indoor)', 'Teras Kebun (Outdoor)': 'Garden terrace (outdoor)' } as Record<string, string>)[area || ''] || area : area;
  const tableUrl = useMemo(() => {
    if (!table) return '';
    const url = new URL(window.location.href);
    url.pathname = `/t/${encodeURIComponent(cafeConfig.venue.tenantSlug)}/${encodeURIComponent(cafeConfig.venue.outletSlug)}/m/${encodeURIComponent(table.qrToken)}`;
    for (const key of ['bill', 'table', 'principal']) url.searchParams.delete(key);
    url.searchParams.set('theme', theme);
    url.searchParams.set('lang', language);
    if (staffId) url.searchParams.set('staff', staffId);
    return url.href;
  }, [table, theme, language, staffId]);

  useEffect(() => {
    let active = true;
    if (tableUrl) void QRCode.toDataURL(tableUrl, { width: 320, margin: 2 }).then(value => { if (active) setQrResult({ url: tableUrl, value, failed: false }); }).catch(() => { if (active) setQrResult({ url: tableUrl, value: '', failed: true }); });
    return () => { active = false; };
  }, [tableUrl]);

  const qr = qrResult.url === tableUrl ? qrResult.value : '';
  const qrFailed = qrResult.url === tableUrl && qrResult.failed;
  if (!table) return null;
  return <main className="demo-table-entry">
    <div className="demo-entry-layout">
      <section className="demo-entry-intro" aria-labelledby="demo-entry-title">
        <div className="demo-entry-brand"><BrandMark /><span>{cafeConfig.brand.name}</span></div>
        <div className="demo-entry-copy">

          <h1 id="demo-entry-title">{t(`Menu ${cafeConfig.brand.name} di meja Anda.`, `${cafeConfig.brand.name} at your table.`)}</h1>

          <div className="demo-entry-location"><MapPin size={17} aria-hidden="true" />{cafeConfig.venue.address}</div>
        </div>
        <div className="demo-entry-photo"><img src="/images/menu/photos/kopi-aren.jpg" alt={t('Es kopi susu di Dapur Pagi', 'Iced milk coffee at Dapur Pagi')} /></div>
      </section>
      <section className="demo-entry-card" aria-labelledby="demo-table-title">
        <div className="demo-entry-card-heading"><span className="demo-entry-icon"><QrCode size={22} aria-hidden="true" /></span><div><h2 id="demo-table-title">{t('Menu di meja Anda', 'Your table menu')}</h2></div></div>
        <label className="demo-entry-label" htmlFor="demo-entry-table">{t('Pilih meja', 'Choose a table')}</label>
        <Select value={table.id} onValueChange={setTableId}>
          <SelectTrigger id="demo-entry-table" className="demo-entry-select"><SelectValue /></SelectTrigger>
          <SelectContent position="popper" align="start" sideOffset={6}>
            {available.map(entry => <SelectItem key={entry.id} value={entry.id}>{t('Meja', 'Table')} {entry.label}{entry.areaName ? ` · ${areaLabel(entry.areaName)}` : ''}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="demo-entry-qr-wrap">
          <div className="demo-entry-qr">{qr ? <img src={qr} width="200" height="200" alt={t(`Kode QR menu meja ${table.label}`, `Menu QR code for table ${table.label}`)} /> : <span aria-live="polite">{qrFailed ? t('Kode tidak tersedia. Buka menu langsung.', 'Code unavailable. Open the menu directly.') : t('Menyiapkan kode…', 'Preparing code…')}</span>}</div>
          <p>{t('Meja', 'Table')} <strong>{table.label}</strong></p>
        </div>
        <Button asChild size="lg" className="demo-entry-open"><a href={tableUrl}>{t('Buka menu meja', 'Open table menu')}</a></Button>
      </section>
    </div>
  </main>;
}
