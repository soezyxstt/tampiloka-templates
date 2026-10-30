'use client';
import { useCafeLanguage } from '@/lib/language';

import { useMemo, useState } from 'react';
import { Plus, Trash2, ArrowLeft, Check } from 'lucide-react';
import { Button, Input, Label, SelectField, QuantityControl, PaymentBreakdown, InlineError, Money, formatIdr } from './ui-primitives';
import { computePricingBreakdown } from '@/src/domain/rules';
import { isModuleEnabled } from '@/src/config/cafe';

type Line = { id: string; menuItemId: string; variantId: string; itemName: string; variantName: string; stationCode: string; quantity: number; unitPriceIdr: number; modifierOptionIds: string[]; modifierNames: string[]; note: string };

export function PosComposer({ snapshot, busy, actorId, actorName, actorRole, onCommand, onComplete }: {
  snapshot: any; busy: boolean; actorId: string; actorName: string; actorRole: string;
  onCommand: (command: string, payload: any) => Promise<any>;
  onComplete: (billId?: string) => void;
}) {
  const { t: tr } = useCafeLanguage();
  const [name, setName] = useState('Tamu kasir');
  const [mode, setMode] = useState<'DINE_IN' | 'TAKEAWAY'>('TAKEAWAY');
  const [tableId, setTableId] = useState(snapshot?.tables?.find((table: any) => table.active && ['AVAILABLE', 'OCCUPIED'].includes(table.physicalState))?.id || '');
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState('');
  const [item, setItem] = useState<any>(null);
  const [variantId, setVariantId] = useState('');
  const [modifiers, setModifiers] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [phase, setPhase] = useState<'edit' | 'review'>('edit');
  const [submitting, setSubmitting] = useState(false);
  const locked = busy || submitting;
  const catalog = (snapshot?.catalog || []).filter((entry: any) => `${entry.name} ${entry.externalCode || ''}`.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id')));
  const discountIdr = Number(discount) || 0;
  const estimate = useMemo(() => computePricingBreakdown({
    units: lines.flatMap(line => Array.from({ length: line.quantity }, (_, index) => ({ unitId: `${line.id}:${index}`, menuItemId: line.menuItemId, variantId: line.variantId, itemName: line.itemName, variantName: line.variantName, stationCode: line.stationCode, modifiersSummary: line.modifierNames.join(', '), note: line.note, grossIdr: line.unitPriceIdr }))),
    promoDiscountIdr: discountIdr,
    serviceChargeBps: snapshot?.outlet?.taxInclusiveDisplay ? 0 : snapshot?.outlet?.serviceChargeBps ?? 0,
    taxBps: snapshot?.outlet?.taxInclusiveDisplay ? 0 : snapshot?.outlet?.taxBps ?? 0,
    serviceInTaxBase: snapshot?.outlet?.serviceInTaxBase ?? true,
  }), [lines, discountIdr, snapshot?.outlet]);
  const totals = phase === 'review' && quote ? quote : estimate;
  const paymentPolicy = mode === 'TAKEAWAY' ? snapshot?.outlet?.takeawayPaymentPolicy : snapshot?.outlet?.paymentPolicy;
  const waitsForPayment = paymentPolicy === 'PREPAY' && totals.totalIdr > 0;
  const selectItem = (entry: any) => {
    setItem(entry); setVariantId(entry.variants?.find((variant: any) => variant.isDefault && variant.availableToSell > 0)?.id || entry.variants?.find((variant: any) => variant.availableToSell > 0)?.id || '');
    setModifiers((entry.modifierGroups || []).flatMap((group: any) => (group.options || []).filter((option: any) => option.isDefault).map((option: any) => option.id)));
    setQuantity(1); setNote(''); setError('');
  };
  const addLine = () => {
    const variant = item?.variants?.find((candidate: any) => candidate.id === variantId);
    if (!variant) return setError(tr("Pilih varian yang tersedia.", "Choose an available variant."));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return setError(tr("Jumlah harus 1 sampai 20.", "Quantity must be between 1 and 20."));
    for (const group of item.modifierGroups || []) {
      const selected = group.options.filter((option: any) => modifiers.includes(option.id)).length;
      if (selected < (group.required ? Math.max(1, group.minSelect) : group.minSelect || 0) || selected > group.maxSelect) return setError(tr(`Periksa pilihan ${group.name}. Pilih ${group.minSelect || 0} sampai ${group.maxSelect}.`, `Check ${group.name}. Choose ${group.minSelect || 0} to ${group.maxSelect}.`));
    }
    const options = (item.modifierGroups || []).flatMap((group: any) => group.options).filter((option: any) => modifiers.includes(option.id));
    setLines(current => [...current, { id: crypto.randomUUID(), menuItemId: item.id, variantId, itemName: item.name, variantName: variant.name, stationCode: item.stationCode || 'KITCHEN', quantity, unitPriceIdr: variant.priceIdr + options.reduce((sum: number, option: any) => sum + option.priceIdr, 0), modifierOptionIds: [...modifiers], modifierNames: options.map((option: any) => option.name), note }]);
    setItem(null); setError(''); setQuote(null);
  };
  const review = async () => {
    setError('');
    if (name.trim().length < 2) return setError(tr("Isi nama pemesan, minimal 2 karakter.", "Enter an order name of at least 2 characters."));
    if (!lines.length) return setError(tr("Tambahkan menu terlebih dahulu.", "Add an item first."));
    if (!Number.isSafeInteger(discountIdr) || discountIdr < 0 || discountIdr > estimate.subtotalIdr) return setError(tr("Diskon harus berupa Rupiah bulat dan tidak boleh melebihi subtotal.", "The discount must be a whole rupiah amount and no greater than the subtotal."));
    if (mode === 'DINE_IN' && !tableId) return setError(tr("Pilih meja.", "Choose a table."));
    try {
      const response = await onCommand('CREATE_QUOTE', { source: 'staff', principalId: `staff_${actorId}`, mode, tableId: mode === 'DINE_IN' ? tableId : undefined, manualDiscountIdr: discountIdr, items: lines.map(line => ({ menuItemId: line.menuItemId, variantId: line.variantId, modifierOptionIds: line.modifierOptionIds, quantity: line.quantity, note: line.note })) });
      setQuote(response.result); setPhase('review');
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Gagal menghitung total.", "Could not calculate the total.")); }
  };
  const submit = async () => {
    if (locked || !quote) return;
    if (Date.parse(quote.expiresAt) <= Date.now()) { setPhase('edit'); setQuote(null); setError(tr("Harga perlu diperbarui. Periksa pesanan lagi.", "Prices need updating. Review the order again.")); return; }
    setSubmitting(true); setError('');
    try {
      const response = await onCommand('SUBMIT_ORDER_REQUEST', { source: 'staff', quoteId: quote.quoteId, principalId: `staff_${actorId}`, customerName: name.trim(), mode, tableId: mode === 'DINE_IN' ? tableId : undefined, presenceVerified: true, idempotencyKey: `pos_${quote.quoteId}` });
      let result = response.result;
      if (result.orderRequestId && !result.orderId) {
        const accepted = await onCommand('ACCEPT_ORDER_REQUEST', { orderRequestId: result.orderRequestId, actorName, actorRole, source: 'staff' });
        result = accepted.result;
      }
      onComplete(result?.billId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : tr("Pesanan belum berhasil. Coba lagi.", "The order could not be completed. Try again.")); }
    finally { setSubmitting(false); }
  };

  return <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(300px,1fr)] gap-6">
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="pos-name">{tr("Nama pemesan", "Order name")}</Label><Input id="pos-name" value={name} disabled={phase === 'review'} maxLength={80} onChange={event => setName(event.target.value)} /></div><div><Label htmlFor="pos-mode">{tr("Layanan", "Service")}</Label><SelectField id="pos-mode" value={mode} disabled={phase === 'review'} onChange={event => setMode(event.target.value as 'DINE_IN' | 'TAKEAWAY')}><option value="TAKEAWAY">{tr("Bawa pulang", "Takeaway")}</option><option value="DINE_IN">{tr("Makan di tempat", "Dine in")}</option></SelectField></div></div>
      {mode === 'DINE_IN' && <div><Label htmlFor="pos-table">{tr("Meja", "Table")}</Label><SelectField id="pos-table" value={tableId} disabled={phase === 'review'} onChange={event => setTableId(event.target.value)}>{(snapshot?.tables || []).filter((table: any) => table.active && ['AVAILABLE', 'OCCUPIED'].includes(table.physicalState) && !(snapshot?.waitlistEntries || []).some((entry: any) => entry.status === 'CALLED' && entry.heldTableId === table.id && Date.parse(entry.holdExpiresAt) > Date.parse(snapshot.serverTime))).map((table: any) => <option key={table.id} value={table.id}>{table.label} · {table.areaName}</option>)}</SelectField></div>}
      {phase === 'edit' && !item && <><Input aria-label={tr("Cari menu kasir", "Search cashier menu")} placeholder={tr("Cari menu atau kode…", "Search menu or code…")} value={search} onChange={event => setSearch(event.target.value)} /><div className="grid grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">{catalog.map((entry: any) => <button key={entry.id} type="button" disabled={!entry.isAvailable || locked} onClick={() => selectItem(entry)} className="text-left rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-3 disabled:opacity-50"><span className="block font-semibold text-sm">{entry.name}</span><span className="block text-xs mt-2">{entry.isAvailable ? formatIdr(entry.minPriceIdr) : tr("Habis", "Sold out")}</span></button>)}{catalog.length === 0 && <p className="col-span-2 py-6 text-sm text-[var(--muted-foreground)]">{tr("Menu tidak ditemukan.", "No menu items found.")}</p>}</div></>}
      {phase === 'edit' && item && <div className="space-y-4 border border-[var(--border)] p-4 rounded-[var(--radius-panel)]"><Button variant="ghost" size="sm" onClick={() => setItem(null)}><ArrowLeft className="w-4 h-4" />{tr("Kembali ke menu", "Back to menu")}</Button><h3 className="font-semibold text-lg">{item.name}</h3><div><Label htmlFor="pos-variant">{tr("Varian", "Variant")}</Label><SelectField id="pos-variant" value={variantId} onChange={event => setVariantId(event.target.value)}>{item.variants.map((variant: any) => <option key={variant.id} value={variant.id} disabled={variant.availableToSell <= 0}>{variant.name} · {formatIdr(variant.priceIdr)}{variant.availableToSell <= 0 ? tr(" · Habis", " · Sold out") : ''}</option>)}</SelectField></div>{(item.modifierGroups || []).map((group: any) => <fieldset key={group.id} className="space-y-2"><legend className="font-semibold text-sm">{group.name} {group.required ? tr("(wajib)", "(required)") : tr("(opsional)", "(optional)")}</legend>{group.options.map((option: any) => <label key={option.id} className="flex items-center gap-2 text-sm min-h-9"><input type={group.maxSelect === 1 ? 'radio' : 'checkbox'} name={`pos-${group.id}`} checked={modifiers.includes(option.id)} onChange={() => setModifiers(current => group.maxSelect === 1 ? [...current.filter(id => !group.options.some((candidate: any) => candidate.id === id)), option.id] : current.includes(option.id) ? current.filter(id => id !== option.id) : [...current, option.id])} />{option.name}{option.priceIdr > 0 && <Money amount={option.priceIdr} signed />}</label>)}</fieldset>)}<div><Label htmlFor="pos-note">{tr("Catatan", "Note")}</Label><Input id="pos-note" maxLength={200} value={note} onChange={event => setNote(event.target.value)} placeholder={tr("Contoh: es dipisah", "Example: ice on the side")} /></div><div className="flex justify-between gap-3"><QuantityControl value={quantity} min={1} max={20} itemLabel={item.name} onChange={setQuantity} /><Button onClick={addLine} disabled={locked}><Plus className="w-4 h-4" />{tr("Tambah", "Add")}</Button></div></div>}
      {phase === 'review' && <div className="space-y-3 p-5 bg-[var(--accent-surface)] rounded-[var(--radius-panel)]"><Check className="w-6 h-6 text-[var(--primary-ink)]" /><h3 className="font-semibold">{tr("Pesanan siap dibuat", "Order ready to create")}</h3><p className="text-sm">{tr("Periksa menu, diskon, dan total.", "Check the items, discount and total.")} {waitsForPayment ? tr("Pesanan mulai dibuat setelah tagihan lunas.", "Preparation starts after the bill is paid.") : tr("Pesanan dapat dibuat lebih dahulu; tagihan diselesaikan sebelum kunjungan berakhir.", "Preparation can start first; settle the bill before the visit ends.")}</p><Button variant="secondary" onClick={() => { setPhase('edit'); setQuote(null); }} disabled={locked}>{tr("Ubah pesanan", "Edit order")}</Button></div>}
    </section>
    <section className="pos-summary space-y-4 border border-[var(--border)] rounded-[var(--radius-panel)] p-5 bg-[var(--background)]">
      <h3 className="font-heading text-lg font-semibold">{tr('Pesanan', 'Order')} ({lines.reduce((sum, line) => sum + line.quantity, 0)} {tr('item', 'items')})</h3>
      <div className="divide-y divide-[var(--border)] max-h-[330px] overflow-y-auto">{lines.map(line => <div key={line.id} className="py-3 space-y-2"><div className="flex justify-between gap-2"><div className="min-w-0"><p className="text-sm font-semibold">{line.itemName}</p><p className="text-xs text-[var(--muted-foreground)]">{line.variantName}{line.modifierNames.length ? ` · ${line.modifierNames.join(', ')}` : ''}</p>{line.note && <p className="text-xs mt-1">{line.note}</p>}</div>{phase === 'edit' && <button type="button" aria-label={tr(`Hapus ${line.itemName}`, `Remove ${line.itemName}`)} onClick={() => setLines(current => current.filter(entry => entry.id !== line.id))} className="min-w-10 min-h-10 self-start"><Trash2 className="w-4 h-4 mx-auto" /></button>}</div><div className="flex justify-between gap-2 items-center">{phase === 'edit' ? <QuantityControl value={line.quantity} min={0} max={20} itemLabel={line.itemName} onChange={next => setLines(current => next === 0 ? current.filter(entry => entry.id !== line.id) : current.map(entry => entry.id === line.id ? { ...entry, quantity: next } : entry))} /> : <span className="text-sm">{line.quantity}×</span>}<Money amount={line.unitPriceIdr * line.quantity} className="text-sm font-semibold" /></div></div>)}{!lines.length && <p className="py-8 text-sm text-[var(--muted-foreground)]">{tr("Pilih menu untuk mulai.", "Select an item to begin.")}</p>}</div>
      <div><Label htmlFor="pos-discount">{tr("Diskon (Rp)", "Discount (Rp)")}</Label><Input id="pos-discount" type="number" inputMode="numeric" min="0" max={estimate.subtotalIdr} step="1" value={discount} disabled={phase === 'review'} onChange={event => setDiscount(event.target.value)} placeholder="0" /></div>
      <PaymentBreakdown subtotalIdr={totals.subtotalIdr} discountIdr={totals.discountIdr} serviceIdr={totals.serviceIdr} taxIdr={totals.taxIdr} totalIdr={totals.totalIdr} serviceChargeBps={snapshot?.outlet?.serviceChargeBps} taxBps={snapshot?.outlet?.taxBps} taxInclusiveDisplay={snapshot?.outlet?.taxInclusiveDisplay} />
      <InlineError message={error} />
      {phase === 'edit' ? <Button className="w-full" disabled={locked || !lines.length || Boolean(item)} onClick={review}>{busy ? tr("Menghitung…", "Calculating…") : tr("Periksa pesanan", "Review order")}</Button> : <Button className="w-full" disabled={locked} onClick={submit}>{locked ? tr("Membuat pesanan…", "Creating order…") : waitsForPayment ? tr("Buat tagihan · menunggu bayar", "Create bill · awaiting payment") : isModuleEnabled('kitchen') ? tr("Buat tagihan & kirim ke dapur", "Create bill & send to kitchen") : tr("Buat tagihan", "Create bill")}</Button>}
    </section>
  </div>;
}
