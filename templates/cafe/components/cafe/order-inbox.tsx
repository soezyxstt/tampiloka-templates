'use client';
import { useCafeLanguage } from '@/lib/language';

import { useState } from 'react';
import { Button, DialogModal, InlineError, Input, Label, Money, StatusLabel, Surface } from './ui-primitives';
import { isModuleEnabled } from '@/src/config/cafe';

/** Confirm a receipt from a separate cash register without opening a POS drawer. */
function ExternalCounterPayments({ snapshot, busy, onCommand }: { snapshot: any; busy: boolean; onCommand: (command: string, payload: any) => Promise<any> }) {
  const { t: tr } = useCafeLanguage();
  const [billId, setBillId] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  if (isModuleEnabled('cashier') || isModuleEnabled('payments') || !isModuleEnabled('ordering')) return null;
  const bills = (snapshot?.bills || []).filter((bill: any) => bill.lifecycle !== 'VOID' && bill.balanceIdr > 0);
  const selected = bills.find((bill: any) => bill.id === billId);
  const locked = busy || pending;
  return <Surface variant="ruled" className="space-y-3" aria-label={tr("Pembayaran kasir eksternal", "External counter payment")}>
    <div><h2 className="font-heading text-lg font-semibold">{tr("Pembayaran di kasir", "Payment at the counter")}</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">{tr("Kasir menangani uang melalui sistemnya sendiri. Konfirmasikan penerimaan di sini agar status pelanggan dan kunjungan ikut diperbarui.", "The cashier handles payment in their own system. Confirm receipt here to update the customer and visit status.")}</p></div>
    {!bills.length && <p className="text-sm text-[var(--muted-foreground)]">{tr("Tidak ada tagihan yang menunggu pembayaran kasir.", "No bills are awaiting counter payment.")}</p>}
    <div className="divide-y divide-[var(--border)]">{bills.map((bill: any) => <article key={bill.id} data-bill-id={bill.id} className="py-3 flex flex-wrap justify-between items-center gap-3"><div><p className="font-semibold text-sm">{bill.ownerLabel} · {bill.tableLabel}</p><p className="mt-1 text-sm">{tr("Sisa", "Remaining")} <Money amount={bill.balanceIdr} /></p></div><Button variant="secondary" size="sm" disabled={locked} onClick={() => { setBillId(bill.id); setReference(''); setConfirmed(false); setError(''); setKey(`counter_${crypto.randomUUID()}`); }}>{tr("Konfirmasi pembayaran kasir", "Confirm counter payment")}</Button></article>)}</div>
    <DialogModal open={Boolean(selected)} onClose={() => { if (!locked) setBillId(''); }} title={tr("Konfirmasi pembayaran kasir", "Confirm counter payment")}>
      {selected && <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); if (locked || !confirmed || reference.trim().length < 3) return;
        setPending(true); setError('');
        try { await onCommand('RECORD_PAYMENT', { billId: selected.id, method: 'EXTERNAL_COUNTER', amountIdr: selected.balanceIdr, referenceCode: reference.trim(), idempotencyKey: key }); setBillId(''); }
        catch (caught) { setError(caught instanceof Error ? caught.message : tr("Pembayaran belum tercatat.", "Payment was not recorded.")); }
        finally { setPending(false); }
      }}>
        <p className="text-sm">{selected.ownerLabel} · {tr('Konfirmasi pembayaran', 'Confirm payment of')} <Money amount={selected.balanceIdr} className="font-semibold" /> {tr('yang telah diterima kasir.', 'received by the cashier.')}</p>
        <div className="space-y-1.5"><Label htmlFor="external-counter-reference">{tr("Referensi pembayaran kasir", "Counter payment reference")}</Label><Input id="external-counter-reference" required minLength={3} maxLength={120} value={reference} onChange={event => setReference(event.target.value)} placeholder={tr("Nomor struk atau referensi kasir", "Receipt number or cashier reference")} /></div>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary-ink)]" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{tr("Pembayaran sudah diterima dan diverifikasi oleh kasir.", "Payment has been received and verified by the cashier.")}</label>
        <InlineError message={error} />
        <div className="flex justify-end gap-2"><Button variant="secondary" type="button" disabled={locked} onClick={() => setBillId('')}>{tr("Kembali", "Back")}</Button><Button type="submit" disabled={locked || !confirmed || reference.trim().length < 3}>{tr("Catat pembayaran kasir", "Record counter payment")}</Button></div>
      </form>}
    </DialogModal>
  </Surface>;
}

/** A small ordering package can complete an order without a dedicated kitchen display. */
export function OrderInbox({ snapshot, busy, onCommand }: { snapshot: any; busy: boolean; onCommand: (command: string, payload: any) => Promise<any> }) {
  const { t: tr } = useCafeLanguage();
  const [error, setError] = useState('');
  const orders = (snapshot?.orders || []).map((order: any) => ({ ...order, units: (snapshot?.orderUnits || []).filter((unit: any) => unit.orderId === order.id && !['CANCELLED', 'DELIVERED', 'PICKED_UP', 'SERVED'].includes(unit.fulfillmentStatus)) })).filter((order: any) => order.units.length);
  return <><Surface variant="ruled" className="space-y-3"><h2 className="font-heading text-lg font-semibold">{tr('Pesanan diterima', 'Accepted orders')} ({orders.length})</h2><InlineError message={error} />{!orders.length && <p className="text-sm text-[var(--muted-foreground)]">{tr("Belum ada pesanan aktif. Pesanan yang diterima staf akan muncul di sini.", "There are no active orders. Orders accepted by staff will appear here.")}</p>}<div className="divide-y divide-[var(--border)]">{orders.map((order: any) => <div key={order.id} data-order-id={order.id} className="flex flex-wrap items-start justify-between gap-4 py-3"><div><p className="font-semibold text-sm">{order.customerName} · {order.mode === 'TAKEAWAY' ? tr("Bawa pulang", "Takeaway") : tr(`Meja ${order.tableLabel || order.tableLabelSnapshot || ''}`, `Table ${order.tableLabel || order.tableLabelSnapshot || ''}`)}</p><p className="text-sm text-[var(--muted-foreground)] mt-1">{order.units.map((unit: any) => unit.itemNameSnapshot || unit.itemName).join(', ')}</p>{order.units.some((unit: any) => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT') && <StatusLabel label={tr("Menunggu pembayaran", "Awaiting payment")} tone="warning" />}</div><Button size="sm" variant="secondary" disabled={busy || order.units.some((unit: any) => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT')} onClick={async () => { setError(''); try { await onCommand('TRANSITION_UNITS', { unitIds: order.units.map((unit: any) => unit.id), targetStatus: order.mode === 'TAKEAWAY' ? 'PICKED_UP' : 'DELIVERED' }); } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Gagal memperbarui pesanan.", "Could not update the order.")); } }}>{tr("Tandai selesai", "Mark complete")}</Button></div>)}</div></Surface><ExternalCounterPayments snapshot={snapshot} busy={busy} onCommand={onCommand} /></>;
}
