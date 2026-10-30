import { Button, SelectField, Label } from '../../components/cafe/ui-primitives';
import { useState } from 'react';
import { cafeConfig } from '../config';
import { availableDemoScenarios } from '../../src/demo-runtime/scenario-catalog';
import { useCafeLanguage } from '@/lib/language';

const english: Record<string, [string, string, string]> = {
  empty: ['Start with an empty cafe', 'The menu, initial stock and tables are available. There are no orders or payments yet.', 'Seat a guest, then start the flow from the beginning.'],
  'walk-in': ['New guests seated', 'Rani and Dimas are at M06 and have not ordered yet.', 'The visit is active, the table is occupied and no bill exists yet.'],
  'pending-request': ['Order awaiting approval', 'A tea order has arrived from the customer at M06.', 'Accept or reject the request. The visit cannot be closed yet.'],
  'rejected-request': ['Order rejected by staff', 'A customer request was rejected with a recorded reason.', 'No bill or stock reservation is created; the customer can order again.'],
  'prepay-unpaid': ['Prepayment not yet paid', 'Two teas are accepted. Payment is required before preparation.', 'A Rp41,580 bill is open, items are held and the visit cannot be closed.'],
  'partial-payment': ['Partial payment', 'Rp10,000 has been received towards a Rp41,580 bill.', 'Rp31,580 remains. The kitchen still waits for full payment.'],
  'payment-pending': ['QRIS pending', 'Demo QRIS instructions are active; no payment has been received.', 'Another payment and visit closure are blocked until the instructions are resolved or cancelled.'],
  'kitchen-pending': ['Paid, still being prepared', 'The bill is paid, but two teas are still being prepared.', 'The table remains occupied; mark the items ready and serve them before closing the visit.'],
  'paylater-served': ['Pay later, already served', 'Two teas have been served. The customer has not paid yet.', 'Service is complete and the Rp41,580 bill remains open.'],
  'ready-to-depart': ['Paid and served', 'All M06 billing and service are complete.', 'The visit can be closed. The table then awaits cleaning.'],
  'addon-unpaid': ['Additional order unpaid', 'The first order is paid and served. One additional tea remains unpaid.', 'One visit, two orders and two payment statuses; Rp20,790 remains.'],
  'dirty-table': ['Guests left, table needs cleaning', 'The visit is complete and M06 needs cleaning.', 'New orders at this table are blocked until staff mark it clean.'],
  'takeaway-ready': ['Takeaway ready for pickup', 'The order is paid and ready for customer pickup.', 'Mark it picked up before closing the takeaway visit.'],
  waitlist: ['Waitlist and held table', 'Rani has been called to M06; Dimas is still waiting.', 'A held table cannot be used by another guest. Seat Rani or release the hold.'],
};

const storageKey = `cafe:${cafeConfig.venue.tenantSlug}:${cafeConfig.venue.outletSlug}:scenario`;

function previousScenario(): { scenarioId?: string; tableId?: string } {
  try { return JSON.parse(sessionStorage.getItem(storageKey) || '{}'); } catch { return {}; }
}

export function ScenarioPanel({ snapshot }: { snapshot: any }) {
  const { language, t } = useCafeLanguage();
  const scenarios = availableDemoScenarios(cafeConfig.modules);
  const [loaded] = useState(previousScenario);
  const [selected, setSelected] = useState(loaded.scenarioId || 'empty');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scenario = scenarios.find(entry => entry.id === selected) || scenarios[0];
  const table = snapshot.tables.find((entry: any) => entry.id === loaded.tableId);
  const load = async () => {
    if (!confirm(t('Muat data skenario ini? Pesanan dan perubahan demo saat ini di browser ini akan diganti.', 'Load this scenario? Current demo orders and changes in this browser will be replaced.'))) return;
    setBusy(true);
    setError('');
    try {
      const runtime = await import('../../src/demo-runtime/index');
      const current = await runtime.getBrowserSnapshot({ surface: 'staff' });
      if (!current.runtime.localOnly) throw new Error(t('Skenario uji hanya tersedia di demo lokal.', 'Scenarios are available only in the local demo.'));
      const response = await runtime.loadBrowserDemoScenario(scenario.id);
      const prefix = `cafe:${cafeConfig.venue.tenantSlug}:${cafeConfig.venue.outletSlug}`;
      for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
      sessionStorage.setItem(storageKey, JSON.stringify(response.result));
      location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('Skenario belum berhasil disiapkan.', 'Could not prepare the scenario.'));
      setBusy(false);
    }
  };
  return <details className="demo-scenarios">
    <summary>{t('Data untuk mencoba alur operasional', 'Data for trying operational flows')}</summary>
    <div className="demo-scenario-content">
      <div className="demo-scenario-controls">
        <Label htmlFor="demo-scenario">{t('Skenario uji', 'Test scenario')}</Label>
        <SelectField wrapperClassName="min-w-0 flex-1" id="demo-scenario" value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}>
          {scenarios.map(entry => <option key={entry.id} value={entry.id}>{language === 'en' ? english[entry.id][0] : entry.label}</option>)}
        </SelectField>
        <Button variant="secondary" disabled={busy} onClick={load}>{busy ? t('Menyiapkan data…', 'Preparing data…') : t('Muat skenario', 'Load scenario')}</Button>
      </div>
      <p>{language === 'en' ? english[scenario.id][1] : scenario.description}</p>
      <p><strong>{t('Yang perlu diperiksa:', 'What to check:')}</strong> {language === 'en' ? english[scenario.id][2] : scenario.expected}</p>
      {table && cafeConfig.modules.includes('catalog') && <a href={`/t/${cafeConfig.venue.tenantSlug}/${cafeConfig.venue.outletSlug}/m/${encodeURIComponent(table.qrToken)}`} target="_blank" rel="noopener noreferrer">{t('Buka pelanggan', 'Open customer view')} {table.label}</a>}
      {error && <p role="alert">{error}</p>}
    </div>
  </details>;
}
