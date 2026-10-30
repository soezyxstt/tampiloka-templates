'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CustomerApp } from './customer-app';
import { StaffApp } from './staff-app';
import { cafeConfig, hasStaffModules, isModuleEnabled, THEMES } from '@/src/config/cafe';
import { useCafeLanguage } from '@/lib/language';
import { localizeSampleMenu } from '@/src/catalog/sample-menu';
import { localizeSystemMessage } from '@/lib/system-messages';

export type WorkspaceView = 'pelanggan' | 'staf';
type CustomerContext = { tableId: string; principalId: string };

export function KafeWorkspace({ initialSnapshot, initialView = 'pelanggan', initialTableId, initialBillId }: { initialSnapshot: any; initialView?: WorkspaceView; initialTableId?: string; initialBillId?: string }) {
  const { language, t } = useCafeLanguage();
  const [snapshot, setSnapshot] = useState<any>(initialSnapshot);
  const customerSnapshot = useMemo(() => localizeSampleMenu(snapshot, language), [snapshot, language]);
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
      if (!response.ok) throw new Error(localizeSystemMessage(json?.error?.message || t('Gagal memuat data.', 'Could not load data.'), language));
      if (request === latestRequest.current && json?.data) {
        setSnapshot(json.data);
        setConnectionError('');
        setLastUpdated(`${t('Diperbarui', 'Updated')} ${new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en', { hour: '2-digit', minute: '2-digit', timeZone: cafeConfig.timezone }).format(new Date())}`);
      }
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : t('Koneksi terputus. Data terakhir tetap tersedia.', 'Connection lost. The latest data is still available.'));
    } finally {
      if (!silent) setBusy(false);
    }
  }, [staticCatalog, language, t]);

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
    const offline = () => setConnectionError(t('Koneksi terputus. Keranjang Anda tetap tersimpan.', 'Connection lost. Your cart is still saved.'));
    const dataChanged = () => { if (!commandPending.current) void loadSnapshot(activeView, true); };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('cafe:data-changed', dataChanged);
    return () => { clearInterval(timer); window.removeEventListener('online', online); window.removeEventListener('offline', offline); window.removeEventListener('cafe:data-changed', dataChanged); };
  }, [activeView, loadSnapshot, staticCatalog, t]);

  const switchView = async (view: WorkspaceView) => {
    if ((view === 'staf' && !hasStaffModules()) || (view === 'pelanggan' && !isModuleEnabled('catalog'))) return;
    await loadSnapshot(view);
    setActiveView(view);
  };

  const executeCommand = async (command: string, payload: any) => {
    if (commandPending.current) throw new Error(t('Permintaan sebelumnya masih diproses.', 'The previous request is still being processed.'));
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
      if (!response.ok) throw new Error(localizeSystemMessage(json?.error?.message || t('Permintaan gagal diproses.', 'Request failed.'), language));
      if (json?.data?.snapshot) setSnapshot(json.data.snapshot);
      setConnectionError('');
      return json?.data;
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : t('Permintaan belum berhasil. Coba lagi.', 'Request failed. Try again.'));
      throw error;
    } finally {
      commandPending.current = false;
      setBusy(false);
    }
  };

  return <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
    {connectionError && <div className="connection-notice" role="status"><span>{connectionError}</span><button type="button" disabled={busy} className="font-semibold underline" onClick={refreshSnapshot}>{t('Coba lagi', 'Try again')}</button><button type="button" aria-label={t('Tutup pemberitahuan', 'Dismiss notification')} onClick={() => setConnectionError('')}>×</button></div>}
    {activeView === 'pelanggan' && isModuleEnabled('catalog') ? <CustomerApp snapshot={customerSnapshot} initialTableId={initialTableId} initialBillId={initialBillId} onContextChange={onContextChange} onCommand={executeCommand} busy={busy} onRefresh={refreshSnapshot} onOpenStaffPortal={hasStaffModules() ? () => { void switchView('staf'); } : undefined} /> : <StaffApp snapshot={snapshot} onCommand={executeCommand} onRefresh={refreshSnapshot} lastUpdated={lastUpdated} busy={busy} initialSignedIn={false} onBackToCustomer={isModuleEnabled('catalog') ? () => { void switchView('pelanggan'); } : undefined} />}
  </div>;
}
