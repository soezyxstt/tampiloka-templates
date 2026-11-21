'use client';
import { toast } from 'sonner';
import { useCafeLanguage } from '@/lib/language';

import { useId, useState } from 'react';
import { Button, Input, Label, InlineError, Money, StatusLabel, DialogModal } from './ui-primitives';
import { isModuleEnabled } from '@/src/config/cafe';

type Shift = {
  id: string; state: string; drawerName: string; operatorName: string;
  openingFloatIdr: number; cashReceiptsIdr: number; cashInIdr: number;
  cashOutIdr: number; cashRefundsIdr: number; expectedCashIdr: number;
};

/** Cash drawer operations belong to the cashier package, including cashier-only. */
export function ShiftControls({ snapshot, busy, onCommand }: {
  snapshot: { cashShifts?: Shift[]; bills?: { lifecycle: string; balanceIdr: number }[] }; busy: boolean;
  onCommand: (command: string, payload: Record<string, unknown>) => Promise<unknown>;
}) {
  const { t: tr } = useCafeLanguage();
  const prefix = useId();
  const active = snapshot.cashShifts?.find(shift => shift.state === 'OPEN');
  const [expanded, setExpanded] = useState(false);
  const [opening, setOpening] = useState('500000');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [counted, setCounted] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const locked = busy || pending;
  const countedValid = counted.trim() !== '' && Number.isSafeInteger(Number(counted)) && Number(counted) >= 0;
  const variance = active && countedValid ? Number(counted) - active.expectedCashIdr : null;
  const openBillCount = (snapshot.bills || []).filter(bill => bill.lifecycle === 'OPEN' && bill.balanceIdr > 0).length;
  if (!isModuleEnabled('cashier')) return null;

  const amountValue = (text: string, allowZero: boolean) => {
    const value = Number(text);
    if (!text.trim() || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
      throw new Error(allowZero ? tr("Isi nominal Rupiah bulat, minimal Rp0.", "Enter a whole rupiah amount of at least Rp0.") : tr("Isi nominal Rupiah bulat, lebih dari Rp0.", "Enter a whole rupiah amount greater than Rp0."));
    }
    return value;
  };

  const run = async (action: 'OPEN_SHIFT' | 'CASH_IN' | 'CASH_OUT' | 'CLOSE_SHIFT') => {
    if (locked) return;
    setError('');
    try {
      const payload: Record<string, unknown> = { action };
      if (action === 'OPEN_SHIFT') payload.amountIdr = amountValue(opening, true);
      else {
        if (!active) throw new Error(tr("Shift sudah ditutup. Muat ulang data kasir.", "The shift is closed. Refresh cashier data."));
        payload.shiftId = active.id;
        if (action === 'CLOSE_SHIFT') {
          payload.countedCashIdr = amountValue(counted, true);
          payload.reason = closeReason.trim();
          if (payload.countedCashIdr !== active.expectedCashIdr && !payload.reason) throw new Error(tr("Isi alasan selisih antara uang fisik dan catatan kas.", "Explain the difference between the cash counted and the cash record."));
        } else {
          payload.amountIdr = amountValue(amount, false);
          payload.reason = reason.trim();
          if (!payload.reason) throw new Error(tr("Isi keterangan kas masuk atau keluar.", "Enter a description for the cash movement."));
        }
      }
      setPending(true);
      await onCommand('CASH_SHIFT_ACTION', payload);
      toast.success(action === 'OPEN_SHIFT' ? tr("Shift dibuka. Kasir siap menerima pembayaran tunai.", "Shift opened. The cashier can receive cash payments.") : action === 'CLOSE_SHIFT' ? tr("Hitungan disimpan dan shift ditutup.", "Count saved and shift closed.") : tr("Perubahan kas tersimpan.", "Cash movement saved."));
      if (action === 'CLOSE_SHIFT') setExpanded(false);
      setAmount(''); setReason(''); setCounted(''); setCloseReason('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Perubahan kas belum tersimpan.", "Cash movement was not saved.")); }
    finally { setPending(false); }
  };

  return <section className="py-1.5 border-b border-[var(--border)] space-y-1.5" aria-label={tr("Shift kasir", "Cashier shift")}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2.5 text-sm">
        <StatusLabel label={active ? tr("Shift terbuka", "Shift open") : tr("Shift ditutup", "Shift closed")} tone={active ? 'success' : 'warning'} />
        {active && <span className="text-[var(--muted-foreground)]">{tr("Kas laci", "Expected drawer cash")} <Money amount={active.expectedCashIdr} className="font-semibold text-[var(--foreground)]" /></span>}
        {!active && !expanded && <span className="text-[var(--muted-foreground)]">{tr("Buka shift sebelum menerima pembayaran tunai.", "Open a shift before accepting cash payments.")}</span>}
      </div>
      <Button variant="ghost" size="sm" className="text-[var(--primary-ink)]" aria-haspopup="dialog" onClick={() => setExpanded(value => !value)}>{active ? tr("Atur Shift", "Manage cash & shift") : tr("Buka shift", "Open shift")}</Button>
    </div>
    <InlineError message={expanded ? "" : error} />
    <DialogModal open={expanded} onClose={() => { if (!locked) setExpanded(false); }} title={tr('Atur Shift', 'Manage shift')}>
    <div id={`${prefix}-details`} className="space-y-4">
      <InlineError message={error} />
      {!active ? <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label htmlFor={`${prefix}-opening`}>{tr("Modal awal laci (Rp)", "Opening drawer float (Rp)")}</Label><Input id={`${prefix}-opening`} type="text" inputMode="numeric" value={opening ? Number(opening).toLocaleString("id-ID") : ""} disabled={locked} onChange={event => setOpening(event.target.value.replace(/\D/g, ""))} /></div><Button disabled={locked} onClick={() => run('OPEN_SHIFT')}>{pending ? tr("Menyimpan…", "Saving…") : tr("Buka shift kasir", "Open cashier shift")}</Button></div> : <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3"><p className="text-sm font-semibold">{active.drawerName}</p><dl className="space-y-2 text-sm"><div className="flex justify-between gap-2"><dt>{tr("Modal awal", "Opening float")}</dt><dd><Money amount={active.openingFloatIdr} /></dd></div><div className="flex justify-between gap-2"><dt>{tr("Pembayaran tunai", "Cash payments")}</dt><dd><Money amount={active.cashReceiptsIdr} /></dd></div><div className="flex justify-between gap-2"><dt>{tr("Kas masuk", "Cash in")}</dt><dd><Money amount={active.cashInIdr} /></dd></div><div className="flex justify-between gap-2"><dt>{tr("Kas keluar", "Cash out")}</dt><dd><Money amount={active.cashOutIdr} /></dd></div><div className="flex justify-between gap-2"><dt>{tr("Pengembalian tunai", "Cash refunds")}</dt><dd><Money amount={active.cashRefundsIdr} /></dd></div><div className="flex justify-between gap-2 border-t border-[var(--border)] pt-2 font-semibold"><dt>{tr("Kas laci", "Expected drawer cash")}</dt><dd><Money amount={active.expectedCashIdr} /></dd></div></dl></div>
        <div className="space-y-3"><h3 className="font-semibold text-sm">{tr("Kas masuk / keluar", "Cash in / out")}</h3><div><Label htmlFor={`${prefix}-amount`}>{tr("Nominal (Rp)", "Amount (Rp)")}</Label><Input id={`${prefix}-amount`} type="text" inputMode="numeric" value={amount ? Number(amount).toLocaleString("id-ID") : ""} disabled={locked} onChange={event => setAmount(event.target.value.replace(/\D/g, ""))} /></div><div><Label htmlFor={`${prefix}-reason`}>{tr("Keterangan", "Description")}</Label><Input id={`${prefix}-reason`} value={reason} maxLength={200} disabled={locked} onChange={event => setReason(event.target.value)} placeholder={tr("Contoh: beli es batu", "Example: bought ice")} /></div><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" disabled={locked || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0 || !reason.trim()} onClick={() => run('CASH_IN')}>{tr("Catat kas masuk", "Record cash in")}</Button><Button variant="secondary" size="sm" disabled={locked || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0 || !reason.trim()} onClick={() => run('CASH_OUT')}>{tr("Catat kas keluar", "Record cash out")}</Button></div></div>
        <div className="space-y-3"><h3 className="font-semibold text-sm">{tr("Tutup shift", "Close shift")}</h3><div><Label htmlFor={`${prefix}-counted`}>{tr("Uang fisik terhitung (Rp)", "Cash counted (Rp)")}</Label><Input id={`${prefix}-counted`} type="text" inputMode="numeric" value={counted ? Number(counted).toLocaleString("id-ID") : ""} disabled={locked} onChange={event => setCounted(event.target.value.replace(/\D/g, ""))} /></div><div><Label htmlFor={`${prefix}-close-reason`}>{variance !== null && variance !== 0 ? tr("Alasan selisih (wajib)", "Reason for discrepancy (required)") : tr("Catatan", "Notes")}</Label><Input id={`${prefix}-close-reason`} value={closeReason} maxLength={200} disabled={locked} onChange={event => setCloseReason(event.target.value)} /></div>{openBillCount > 0 && <p className="text-sm text-[var(--status-warning-fg)]">{tr(`${openBillCount} tagihan belum lunas. Tagihan tetap terbuka setelah shift ditutup; pastikan serah terima dengan kasir berikutnya.`, `${openBillCount} bills remain unpaid. They stay open after this shift closes; arrange a handover to the next cashier.`)}</p>}
        <p className={`text-sm ${variance ? "text-[var(--status-warning-fg)] font-semibold" : ""}`}>{tr('Selisih uang fisik', 'Cash variance')}: {variance === null ? tr('Isi hitungan kas dahulu', 'Enter counted cash first') : <Money amount={variance} signed />}</p>
        {variance !== null && variance !== 0 && !closeReason.trim() && <p className="text-xs text-[var(--status-warning-fg)]">{tr("Isi alasan selisih untuk menutup shift.", "Enter a discrepancy reason to close the shift.")}</p>}
        <Button variant="primary" size="sm" disabled={locked || !countedValid || (variance !== 0 && !closeReason.trim())} onClick={() => run('CLOSE_SHIFT')}>{tr("Tutup Shift", "Save count & close shift")}</Button></div>
      </div>}
    </div>
    </DialogModal>
  </section>;
}
