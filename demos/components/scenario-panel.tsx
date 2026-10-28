import { useState } from 'react';
import { cafeConfig } from '../config';
import { availableDemoScenarios } from '../../src/demo-runtime/scenario-catalog';

const storageKey = `cafe:${cafeConfig.venue.tenantSlug}:${cafeConfig.venue.outletSlug}:scenario`;

function previousScenario(): { scenarioId?: string; tableId?: string } {
  try { return JSON.parse(sessionStorage.getItem(storageKey) || '{}'); } catch { return {}; }
}

export function ScenarioPanel({ snapshot }: { snapshot: any }) {
  const scenarios = availableDemoScenarios(cafeConfig.modules);
  const [loaded] = useState(previousScenario);
  const [selected, setSelected] = useState(loaded.scenarioId || 'empty');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scenario = scenarios.find(entry => entry.id === selected) || scenarios[0];
  const table = snapshot.tables.find((entry: any) => entry.id === loaded.tableId);
  const load = async () => {
    if (!confirm('Muat data skenario ini? Pesanan dan perubahan demo saat ini di browser ini akan diganti.')) return;
    setBusy(true);
    setError('');
    try {
      const runtime = await import('../../src/demo-runtime/index');
      const current = await runtime.getBrowserSnapshot({ surface: 'staff' });
      if (!current.runtime.localOnly) throw new Error('Skenario uji hanya tersedia di demo lokal.');
      const response = await runtime.loadBrowserDemoScenario(scenario.id);
      const prefix = `cafe:${cafeConfig.venue.tenantSlug}:${cafeConfig.venue.outletSlug}`;
      for (const key of Object.keys(localStorage)) if (key.startsWith(prefix)) localStorage.removeItem(key);
      sessionStorage.setItem(storageKey, JSON.stringify(response.result));
      location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Skenario belum berhasil disiapkan.');
      setBusy(false);
    }
  };
  return <details className="demo-scenarios">
    <summary>Data untuk mencoba alur operasional</summary>
    <div className="demo-scenario-content">
      <div className="demo-scenario-controls">
        <label htmlFor="demo-scenario">Skenario uji</label>
        <select id="demo-scenario" value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}>
          {scenarios.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
        <button type="button" disabled={busy} onClick={load}>{busy ? 'Menyiapkan data…' : 'Muat skenario'}</button>
      </div>
      <p>{scenario.description}</p>
      <p><strong>Yang perlu diperiksa:</strong> {scenario.expected}</p>
      {table && cafeConfig.modules.includes('catalog') && <a href={`/t/${cafeConfig.venue.tenantSlug}/${cafeConfig.venue.outletSlug}/m/${encodeURIComponent(table.qrToken)}`} target="_blank" rel="noopener noreferrer">Buka pelanggan {table.label}</a>}
      {error && <p role="alert">{error}</p>}
    </div>
  </details>;
}
