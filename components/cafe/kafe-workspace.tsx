'use client';

import React, { useState } from 'react';
import { CustomerApp } from './customer-app';
import { StaffApp } from './staff-app';

export type WorkspaceView = 'pelanggan' | 'staf';

export function KafeWorkspace({ initialSnapshot, initialView = 'pelanggan', initialTableId }: { initialSnapshot: any; initialView?: WorkspaceView; initialTableId?: string }) {
  const [snapshot, setSnapshot] = useState<any>(initialSnapshot);
  const [activeView, setActiveView] = useState<WorkspaceView>(initialView);
  const [busy, setBusy] = useState<boolean>(false);

  const refreshSnapshot = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/v1/snapshot', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Gagal memuat pesanan.');
      }
      if (json?.data) {
        setSnapshot(json.data);
      }
    } finally {
      setBusy(false);
    }
  };

  const executeCommand = async (command: string, payload: any) => {
    setBusy(true);
    try {
      const res = await fetch('/api/v1/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Permintaan gagal diproses server.');
      }
      if (json?.data?.snapshot) {
        setSnapshot(json.data.snapshot);
      }
      return json?.data;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      {activeView === 'pelanggan' ? (
        <CustomerApp
          snapshot={snapshot}
          initialTableId={initialTableId}
          onCommand={executeCommand}
          busy={busy}
          onRefresh={refreshSnapshot}
          onOpenStaffPortal={() => setActiveView('staf')}
        />
      ) : (
        <StaffApp
          snapshot={snapshot}
          onCommand={executeCommand}
          onRefresh={refreshSnapshot}
          busy={busy}
          initialSignedIn={false}
          onBackToCustomer={() => setActiveView('pelanggan')}
        />
      )}
    </div>
  );
}
