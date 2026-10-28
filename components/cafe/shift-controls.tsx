'use client';

import { useId, useState } from 'react';
import { Button, Input, Label, InlineError, Money, StatusLabel } from './ui-primitives';
import { isModuleEnabled } from '@/src/config/cafe';

type Shift = {
  id: string; state: string; drawerName: string; operatorName: string;
  openingFloatIdr: number; cashReceiptsIdr: number; cashInIdr: number;
  cashOutIdr: number; cashRefundsIdr: number; expectedCashIdr: number;
};

/** Cash drawer operations belong to the cashier package, including cashier-only. */
export function ShiftControls({ snapshot, busy, onCommand }: {
  snapshot: { cashShifts?: Shift[] }; busy: boolean;
  onCommand: (command: string, payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const prefix = useId();
  const active = snapshot.cashShifts?.find(shift => shift.state === 'OPEN');
  const [expanded, setExpanded] = useState(false);
  const [opening, setOpening] = useState('500000');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [counted, setCounted] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const locked = busy || pending;
  if (!isModuleEnabled('cashier')) return null;

  const amountValue = (text: string, allowZero: boolean) => {
    const value = Number(text);
    if (!text.trim() || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
      throw new Error(allowZero ? 'Isi nominal Rupiah bulat, minimal Rp0.' : 'Isi nominal Rupiah bulat, lebih dari Rp0.');
    }
    return value;
  };

  const run = async (action: 'OPEN_SHIFT' | 'CASH_IN' | 'CASH_OUT' | 'CLOSE_SHIFT') => {
    if (locked) return;
    setError(''); setNotice('');
    try {
      const payload: Record<string, unknown> = { action };
      if (action === 'OPEN_SHIFT') payload.amountIdr = amountValue(opening, true);
      else {
        if (!active) throw new Error('Shift sudah ditutup. Muat ulang data kasir.');
        payload.shiftId = active.id;
        if (action === 'CLOSE_SHIFT') {
          payload.countedCashIdr = amountValue(counted, true);
          payload.reason = closeReason.trim();
          if (payload.countedCashIdr !== active.expectedCashIdr && !payload.reason) throw new Error('Isi alasan selisih antara uang fisik dan catatan kas.');
        } else {
          payload.amountIdr = amountValue(amount, false);
          payload.reason = reason.trim();
          if (!payload.reason) throw new Error('Isi keterangan kas masuk atau keluar.');
        }
      }
      setPending(true);
      await onCommand('CASH_SHIFT_ACTION', payload);
      setNotice(action === 'OPEN_SHIFT' ? 'Shift dibuka. Kasir siap menerima pembayaran tunai.' : action === 'CLOSE_SHIFT' ? 'Hitungan disimpan dan shift ditutup.' : 'Perubahan kas tersimpan.');
      setAmount(''); setReason(''); setCounted(''); setCloseReason('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Perubahan kas belum tersimpan.'); }
    finally { setPending(false); }
  };

  return <section className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-4 space-y-4" aria-label="Shift kasir">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold">Kasir</h2><StatusLabel label={active ? 'Shift terbuka' : 'Shift ditutup'} tone={active ? 'success' : 'warning'} />{active && <span className="text-sm text-[var(--muted-foreground)]">Perkiraan laci <Money amount={active.expectedCashIdr} className="font-semibold text-[var(--foreground)]" /></span>}</div>
      <Button variant="secondary" size="sm" aria-expanded={expanded} aria-controls={`${prefix}-details`} onClick={() => setExpanded(value => !value)}>{expanded ? 'Tutup rincian' : active ? 'Kelola kas & shift' : 'Buka shift'}</Button>
    </div>
    {!active && !expanded && <p className="text-sm text-[var(--muted-foreground)]">Buka shift sebelum menerima pembayaran tunai.</p>}
    <InlineError message={error} />
    {notice && <p role="status" className="text-sm text-[var(--status-success-fg)]">{notice}</p>}
    {expanded && <div id={`${prefix}-details`}>
      {!active ? <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label htmlFor={`${prefix}-opening`}>Modal awal laci (Rp)</Label><Input id={`${prefix}-opening`} type="number" inputMode="numeric" min={0} step={1} value={opening} disabled={locked} onChange={event => setOpening(event.target.value)} /></div><Button disabled={locked} onClick={() => run('OPEN_SHIFT')}>{pending ? 'Menyimpan…' : 'Buka shift kasir'}</Button></div> : <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3"><p className="text-sm font-semibold">{active.drawerName}</p><dl className="space-y-2 text-sm"><div className="flex justify-between gap-2"><dt>Modal awal</dt><dd><Money amount={active.openingFloatIdr} /></dd></div><div className="flex justify-between gap-2"><dt>Pembayaran tunai</dt><dd><Money amount={active.cashReceiptsIdr} /></dd></div><div className="flex justify-between gap-2"><dt>Kas masuk</dt><dd><Money amount={active.cashInIdr} /></dd></div><div className="flex justify-between gap-2"><dt>Kas keluar</dt><dd><Money amount={active.cashOutIdr} /></dd></div><div className="flex justify-between gap-2"><dt>Pengembalian tunai</dt><dd><Money amount={active.cashRefundsIdr} /></dd></div><div className="flex justify-between gap-2 border-t border-[var(--border)] pt-2 font-semibold"><dt>Perkiraan laci</dt><dd><Money amount={active.expectedCashIdr} /></dd></div></dl></div>
        <div className="space-y-3"><h3 className="font-semibold text-sm">Kas masuk / keluar</h3><div><Label htmlFor={`${prefix}-amount`}>Nominal (Rp)</Label><Input id={`${prefix}-amount`} type="number" inputMode="numeric" min={1} step={1} value={amount} disabled={locked} onChange={event => setAmount(event.target.value)} /></div><div><Label htmlFor={`${prefix}-reason`}>Keterangan</Label><Input id={`${prefix}-reason`} value={reason} maxLength={200} disabled={locked} onChange={event => setReason(event.target.value)} placeholder="Contoh: beli es batu" /></div><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" disabled={locked} onClick={() => run('CASH_IN')}>Catat kas masuk</Button><Button variant="secondary" size="sm" disabled={locked} onClick={() => run('CASH_OUT')}>Catat kas keluar</Button></div></div>
        <div className="space-y-3"><h3 className="font-semibold text-sm">Tutup shift</h3><div><Label htmlFor={`${prefix}-counted`}>Uang fisik terhitung (Rp)</Label><Input id={`${prefix}-counted`} type="number" inputMode="numeric" min={0} step={1} value={counted} disabled={locked} onChange={event => setCounted(event.target.value)} /></div><div><Label htmlFor={`${prefix}-close-reason`}>Catatan / alasan selisih</Label><Input id={`${prefix}-close-reason`} value={closeReason} maxLength={200} disabled={locked} onChange={event => setCloseReason(event.target.value)} /></div><Button variant="primary" size="sm" disabled={locked} onClick={() => run('CLOSE_SHIFT')}>Simpan hitungan & tutup shift</Button></div>
      </div>}
    </div>}
  </section>;
}
