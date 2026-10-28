'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CustomerApp } from './customer-app';
import { StaffApp } from './staff-app';
import { cafeConfig, hasStaffModules, isModuleEnabled, THEMES } from '@/src/config/cafe';

export type WorkspaceView = 'pelanggan' | 'staf';
type CustomerContext = { tableId: string; principalId: string };

export function KafeWorkspace({ initialSnapshot, initialView = 'pelanggan', initialTableId, initialBillId }: { initialSnapshot: any; initialView?: WorkspaceView; initialTableId?: string; initialBillId?: string }) {
  const [snapshot, setSnapshot] = useState<any>(initialSnapshot);
  const [activeView, setActiveView] = useState<WorkspaceView>(isModuleEnabled('catalog') ? initialView : 'staf');
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const context = useRef<CustomerContext>({ tableId: initialTableId || initialSnapshot?.tables?.[0]?.id || '', principalId: '' });
  const commandPending = useRef(false);
  const latestRequest = useRef(0);
  const staticCatalog = initialSnapshot?.runtime?.mode === 'catalog';

  useEffect(() => {
    if (!initialSnapshot?.runtime?.demo) return;
    const theme = new URLSearchParams(window.location.search).get('theme');
    if (theme && Object.hasOwn(THEMES, theme)) document.documentElement.dataset.theme = theme;
    return () => { document.documentElement.dataset.theme = cafeConfig.theme; };
  }, [initialSnapshot?.runtime?.demo]);

  const loadSnapshot = useCallback(async (view: WorkspaceView, silent = false) => {
    if (staticCatalog) return;
    const request = ++latestRequest.current;
    if (!silent) setBusy(true);
    const params = new URLSearchParams({ surface: view === 'staf' ? 'staff' : 'customer', table: context.current.tableId, principal: context.current.principalId });
    try {
      const response = await fetch(`/api/v1/snapshot?${params}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || 'Gagal memuat data.');
      if (request === latestRequest.current && json?.data) {
        setSnapshot(json.data);
        setConnectionError('');
        setLastUpdated(`Diperbarui ${new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: cafeConfig.timezone }).format(new Date())}`);
      }
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Koneksi terputus. Data terakhir tetap tersedia.');
    } finally {
      if (!silent) setBusy(false);
    }
  }, [staticCatalog]);

  const refreshSnapshot = useCallback(async () => { await loadSnapshot(activeView); }, [activeView, loadSnapshot]);
  const onContextChange = useCallback((tableId: string, principalId: string) => {
    if (context.current.tableId === tableId && context.current.principalId === principalId) return;
    context.current = { tableId, principalId };
    if (!commandPending.current) void loadSnapshot('pelanggan', true);
  }, [loadSnapshot]);

  useEffect(() => {
    if (staticCatalog) return;
    const timer = setInterval(() => {
      if (!document.hidden && !commandPending.current) void loadSnapshot(activeView, true);
    }, 8000);
    const online = () => { void loadSnapshot(activeView, true); };
    const offline = () => setConnectionError('Koneksi terputus. Keranjang Anda tetap tersimpan.');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => { clearInterval(timer); window.removeEventListener('online', online); window.removeEventListener('offline', offline); };
  }, [activeView, loadSnapshot, staticCatalog]);

  const switchView = async (view: WorkspaceView) => {
    if ((view === 'staf' && !hasStaffModules()) || (view === 'pelanggan' && !isModuleEnabled('catalog'))) return;
    await loadSnapshot(view);
    setActiveView(view);
  };

  const executeCommand = async (command: string, payload: any) => {
    if (commandPending.current) throw new Error('Permintaan sebelumnya masih diproses.');
    commandPending.current = true;
    ++latestRequest.current; // An older poll must never overwrite a command response.
    setBusy(true);
    try {
      const response = await fetch('/api/v1/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, payload, surface: activeView === 'staf' ? 'staff' : 'customer', tableId: context.current.tableId, principalId: context.current.principalId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || 'Permintaan gagal diproses.');
      if (json?.data?.snapshot) setSnapshot(json.data.snapshot);
      setConnectionError('');
      return json?.data;
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Permintaan belum berhasil. Coba lagi.');
      throw error;
    } finally {
      commandPending.current = false;
      setBusy(false);
    }
  };

  return <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
    {connectionError && <div className="connection-notice" role="status"><span>{connectionError}</span><button type="button" disabled={busy} className="font-semibold underline" onClick={refreshSnapshot}>Coba lagi</button><button type="button" aria-label="Tutup pemberitahuan" onClick={() => setConnectionError('')}>×</button></div>}
    {activeView === 'pelanggan' && isModuleEnabled('catalog') ? <CustomerApp snapshot={snapshot} initialTableId={initialTableId} initialBillId={initialBillId} onContextChange={onContextChange} onCommand={executeCommand} busy={busy} onRefresh={refreshSnapshot} onOpenStaffPortal={hasStaffModules() ? () => { void switchView('staf'); } : undefined} /> : <StaffApp snapshot={snapshot} onCommand={executeCommand} onRefresh={refreshSnapshot} lastUpdated={lastUpdated} busy={busy} initialSignedIn={false} onBackToCustomer={isModuleEnabled('catalog') ? () => { void switchView('pelanggan'); } : undefined} />}
  </div>;
}
