'use client';

import { useState } from 'react';
import { Button, InlineError, Money } from './ui-primitives';
import { isModuleEnabled } from '@/src/config/cafe';

type Attempt = { id: string; status: string; method: string; isExternal?: boolean; expectedAmountIdr: number; providerOrderId: string };
type Bill = { id: string; lifecycle: string; ownerLabel: string; tableLabel: string; attempts?: Attempt[] };

/** Staff-only demo controls also serve ordering packages without a POS screen. */
export function DemoPaymentControls({ snapshot, busy, onCommand }: {
  snapshot: { runtime?: { demo?: boolean }; bills?: Bill[] }; busy: boolean;
  onCommand: (command: string, payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  if (!snapshot.runtime?.demo || !isModuleEnabled('payments')) return null;
  const attempts = (snapshot.bills || []).filter(bill => bill.lifecycle !== 'VOID').flatMap(bill => (bill.attempts || []).filter(attempt => attempt.isExternal !== false && ['CREATING', 'PENDING', 'UNKNOWN'].includes(attempt.status)).map(attempt => ({ ...attempt, owner: bill.ownerLabel, table: bill.tableLabel })));
  if (!attempts.length && !notice && !error) return null;

  const update = async (attemptId: string, action: 'SETTLE' | 'CANCEL' | 'EXPIRE') => {
    if (pending || busy) return;
    setPending(attemptId); setError(''); setNotice('');
    try {
      await onCommand('SETTLE_OR_CANCEL_ATTEMPT', { attemptId, action, actorName: 'Staf demo' });
      setNotice(action === 'SETTLE' ? 'Simulasi selesai. Pembayaran tercatat lunas pada data demo.' : action === 'CANCEL' ? 'Instruksi demo dibatalkan. Tagihan bisa memakai metode lain.' : 'Instruksi demo ditandai kedaluwarsa. Pelanggan bisa membuat instruksi baru.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Status demo belum berubah.'); }
    finally { setPending(''); }
  };

  return <section className="space-y-3 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-5" aria-label="Simulasi pembayaran">
    <div><h2 className="font-heading text-lg font-semibold">Uji pembayaran demo</h2><p className="text-sm text-[var(--muted-foreground)] mt-1">Simulasikan hasil pembayaran tanpa memindahkan uang.</p></div>
    <InlineError message={error} />
    {notice && <p role="status" className="text-sm text-[var(--status-success-fg)]">{notice}</p>}
    <div className="divide-y divide-[var(--border)]">{attempts.map(attempt => <div key={attempt.id} className="py-3 flex flex-wrap justify-between gap-4"><div><p className="font-semibold text-sm">{attempt.owner} · {attempt.table}</p><p className="text-sm mt-1">{attempt.method === 'VIRTUAL_ACCOUNT' ? 'Virtual Account' : attempt.method} · <Money amount={attempt.expectedAmountIdr} /></p><p className="text-xs text-[var(--muted-foreground)] break-all mt-1">{attempt.providerOrderId}</p></div><div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={busy || Boolean(pending)} onClick={() => update(attempt.id, 'SETTLE')}>{pending === attempt.id ? 'Memproses…' : 'Simulasikan lunas'}</Button><Button size="sm" variant="secondary" disabled={busy || Boolean(pending)} onClick={() => update(attempt.id, 'CANCEL')}>Batalkan</Button><Button size="sm" variant="ghost" disabled={busy || Boolean(pending)} onClick={() => update(attempt.id, 'EXPIRE')}>Kedaluwarsa</Button></div></div>)}</div>
  </section>;
}
