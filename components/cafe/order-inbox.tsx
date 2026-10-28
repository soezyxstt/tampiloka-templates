'use client';

import { useState } from 'react';
import { Button, DialogModal, InlineError, Input, Label, Money, StatusLabel } from './ui-primitives';
import { isModuleEnabled } from '@/src/config/cafe';

/** Confirm a receipt from a separate cash register without opening a POS drawer. */
function ExternalCounterPayments({ snapshot, busy, onCommand }: { snapshot: any; busy: boolean; onCommand: (command: string, payload: any) => Promise<any> }) {
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
  return <section className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3" aria-label="Pembayaran kasir eksternal">
    <div><h2 className="font-heading text-lg font-semibold">Pembayaran di kasir</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Kasir menangani uang melalui sistemnya sendiri. Konfirmasikan penerimaan di sini agar status pelanggan dan kunjungan ikut diperbarui.</p></div>
    {!bills.length && <p className="text-sm text-[var(--muted-foreground)]">Tidak ada tagihan yang menunggu pembayaran kasir.</p>}
    <div className="divide-y divide-[var(--border)]">{bills.map((bill: any) => <article key={bill.id} data-bill-id={bill.id} className="py-3 flex flex-wrap justify-between items-center gap-3"><div><p className="font-semibold text-sm">{bill.ownerLabel} · {bill.tableLabel}</p><p className="mt-1 text-sm">Sisa <Money amount={bill.balanceIdr} /></p></div><Button variant="secondary" size="sm" disabled={locked} onClick={() => { setBillId(bill.id); setReference(''); setConfirmed(false); setError(''); setKey(`counter_${crypto.randomUUID()}`); }}>Konfirmasi pembayaran kasir</Button></article>)}</div>
    <DialogModal open={Boolean(selected)} onClose={() => { if (!locked) setBillId(''); }} title="Konfirmasi pembayaran kasir">
      {selected && <form className="space-y-4" onSubmit={async event => {
        event.preventDefault(); if (locked || !confirmed || reference.trim().length < 3) return;
        setPending(true); setError('');
        try { await onCommand('RECORD_PAYMENT', { billId: selected.id, method: 'EXTERNAL_COUNTER', amountIdr: selected.balanceIdr, referenceCode: reference.trim(), idempotencyKey: key }); setBillId(''); }
        catch (caught) { setError(caught instanceof Error ? caught.message : 'Pembayaran belum tercatat.'); }
        finally { setPending(false); }
      }}>
        <p className="text-sm">{selected.ownerLabel} · Konfirmasi pembayaran <Money amount={selected.balanceIdr} className="font-semibold" /> yang telah diterima kasir.</p>
        <div className="space-y-1.5"><Label htmlFor="external-counter-reference">Referensi pembayaran kasir</Label><Input id="external-counter-reference" required minLength={3} maxLength={120} value={reference} onChange={event => setReference(event.target.value)} placeholder="Nomor struk atau referensi kasir" /></div>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary-ink)]" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Pembayaran sudah diterima dan diverifikasi oleh kasir.</label>
        <InlineError message={error} />
        <div className="flex justify-end gap-2"><Button variant="secondary" type="button" disabled={locked} onClick={() => setBillId('')}>Kembali</Button><Button type="submit" disabled={locked || !confirmed || reference.trim().length < 3}>Catat pembayaran kasir</Button></div>
      </form>}
    </DialogModal>
  </section>;
}

/** A small ordering package can complete an order without a dedicated kitchen display. */
export function OrderInbox({ snapshot, busy, onCommand }: { snapshot: any; busy: boolean; onCommand: (command: string, payload: any) => Promise<any> }) {
  const [error, setError] = useState('');
  const orders = (snapshot?.orders || []).map((order: any) => ({ ...order, units: (snapshot?.orderUnits || []).filter((unit: any) => unit.orderId === order.id && !['CANCELLED', 'DELIVERED', 'PICKED_UP', 'SERVED'].includes(unit.fulfillmentStatus)) })).filter((order: any) => order.units.length);
  return <><section className="border border-[var(--border)] rounded-[var(--radius-panel)] bg-[var(--surface)] p-5 space-y-4"><h2 className="font-heading text-lg font-semibold">Pesanan diterima ({orders.length})</h2><InlineError message={error} />{!orders.length && <p className="text-sm text-[var(--muted-foreground)]">Belum ada pesanan aktif. Pesanan yang diterima staf akan muncul di sini.</p>}<div className="divide-y divide-[var(--border)]">{orders.map((order: any) => <div key={order.id} data-order-id={order.id} className="flex flex-wrap items-start justify-between gap-4 py-3"><div><p className="font-semibold text-sm">{order.customerName} · {order.mode === 'TAKEAWAY' ? 'Bawa pulang' : `Meja ${order.tableLabel || order.tableLabelSnapshot || ''}`}</p><p className="text-sm text-[var(--muted-foreground)] mt-1">{order.units.map((unit: any) => unit.itemNameSnapshot || unit.itemName).join(', ')}</p>{order.units.some((unit: any) => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT') && <StatusLabel label="Menunggu pembayaran" tone="warning" />}</div><Button size="sm" variant="secondary" disabled={busy || order.units.some((unit: any) => unit.fulfillmentStatus === 'HELD_FOR_PAYMENT')} onClick={async () => { setError(''); try { await onCommand('TRANSITION_UNITS', { unitIds: order.units.map((unit: any) => unit.id), targetStatus: order.mode === 'TAKEAWAY' ? 'PICKED_UP' : 'DELIVERED' }); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Gagal memperbarui pesanan.'); } }}>Tandai selesai</Button></div>)}</div></section><ExternalCounterPayments snapshot={snapshot} busy={busy} onCommand={onCommand} /></>;
}
