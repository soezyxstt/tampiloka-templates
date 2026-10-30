'use client';
import { useCafeLanguage } from '@/lib/language';

import { useMemo, useState } from 'react';
import { Button, DialogModal, EmptyState, InlineError, Input, Label, Money, SelectField, StatusLabel, Textarea } from './ui-primitives';

type Summary = {
  canDepart: boolean;
  blockers: { code: string; message: string; count: number }[];
  outstandingBalanceIdr: number;
  refundDueIdr: number;
  pendingPaymentCount: number;
  pendingRequestCount: number;
  unfinishedUnitCount: number;
  unresolvedServiceCount: number;
};
const unavailableSummary: Summary = {
  canDepart: false, blockers: [{ code: 'REFRESH_REQUIRED', message: 'Perbarui data kunjungan sebelum melanjutkan.', count: 1 }],
  outstandingBalanceIdr: 0, refundDueIdr: 0, pendingPaymentCount: 0,
  pendingRequestCount: 0, unfinishedUnitCount: 0, unresolvedServiceCount: 0,
};

/** Seating, departure and cleaning are separate from payment and food status. */
export function VisitService({ snapshot, busy, canTables, actorRole, onCommand, onNotice, onOpenBills }: {
  snapshot: any;
  busy: boolean;
  canTables: boolean;
  actorRole: string;
  onCommand: (command: string, payload: Record<string, any>) => Promise<any>;
  onNotice: (message: string) => void;
  onOpenBills?: (visitId: string) => void;
}) {
  const { language, t: tr } = useCafeLanguage();
  const englishBlockers: Record<string, string> = {
    REFRESH_REQUIRED: 'Refresh visit data before continuing.', UNPAID_BILLS: 'Some bills are still unpaid.',
    REFUND_DUE: 'Complete the customer refund.', PENDING_PAYMENT: 'Complete or cancel active payment instructions.',
    PENDING_REQUESTS: 'Accept or reject pending order requests.', UNFINISHED_ITEMS: 'Deliver, hand over or cancel all order items.',
    OPEN_SERVICE_REQUESTS: 'Resolve customer assistance requests.',
  };
  const [seatingOpen, setSeatingOpen] = useState(false);
  const [seatingKey, setSeatingKey] = useState('');
  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [tableId, setTableId] = useState('');
  const [reviewVisitId, setReviewVisitId] = useState('');
  const [exceptionMode, setExceptionMode] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const locked = busy || pending;
  const canApproveException = ['OWNER', 'MANAGER'].includes(actorRole);
  const visits = snapshot?.visits || [];
  const activeVisits = visits.filter((visit: any) => visit.status === 'OPEN');
  const followupVisits = visits.filter((visit: any) => visit.status !== 'OPEN' && visit.financialIssueNote && (visit.lifecycleSummary?.blockers || []).some((blocker: any) => blocker.code !== 'VISIT_CLOSED'));
  const reviewVisit = visits.find((visit: any) => visit.id === reviewVisitId);
  const review: Summary = reviewVisit?.lifecycleSummary || unavailableSummary;
  const now = Date.parse(snapshot?.serverTime || new Date().toISOString());
  const availableTables = useMemo(() => (snapshot?.tables || []).filter((table: any) =>
    table.active && table.physicalState === 'AVAILABLE' && !(snapshot?.waitlistEntries || []).some((entry: any) =>
      entry.status === 'CALLED' && entry.heldTableId === table.id && Date.parse(entry.holdExpiresAt) > now)), [snapshot, now]);
  const fittingTables = availableTables.filter((table: any) => table.capacity >= Number(partySize));
  const selectedSeatingTable = fittingTables.find((table: any) => table.id === tableId);

  const run = async (payload: Record<string, any>, success: (result: any) => void) => {
    if (locked) return;
    setPending(true); setError('');
    try { const response = await onCommand('TABLE_OR_VISIT_ACTION', payload); success(response?.result); }
    catch (caught) { setError(caught instanceof Error ? caught.message : tr("Kunjungan belum diperbarui.", "The visit was not updated.")); }
    finally { setPending(false); }
  };
  const openReview = (visitId: string) => {
    setReviewVisitId(visitId); setExceptionMode(false); setExceptionReason(''); setError('');
  };

  return <section className="space-y-4" aria-label={tr("Layanan kunjungan", "Visit service")}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-heading text-lg font-semibold">{tr('Kunjungan aktif', 'Active visits')} ({activeVisits.length})</h2></div>
      {canTables && <Button disabled={locked} onClick={() => {
        setSeatingOpen(true); setSeatingKey(`seat_${crypto.randomUUID()}`); setName(''); setPartySize('2');
        setTableId(availableTables.find((table: any) => table.capacity >= 2)?.id || ''); setError('');
      }}>{tr("Tempatkan tamu", "Seat guests")}</Button>}
    </div>
    {!seatingOpen && !reviewVisitId && <InlineError message={error} />}
    {!activeVisits.length && <EmptyState title={tr("Belum ada kunjungan aktif", "No active visits")} description={canTables ? tr("Gunakan Tempatkan tamu untuk menyiapkan meja sebelum mereka memesan.", "Use Seat guests to prepare a table before they order.") : tr("Kunjungan muncul setelah pesanan diterima staf.", "Visits appear after staff accept an order.")} />}
    <div className="visit-list">{activeVisits.map((visit: any) => {
      const summary: Summary = visit.lifecycleSummary || unavailableSummary;
      const moveTo = moveTargets[visit.id] || '';
      const validMove = availableTables.some((table: any) => table.id === moveTo && table.capacity >= visit.partySize);
      return <article key={visit.id} data-visit-id={visit.id} aria-label={tr(`Kunjungan ${visit.customerName}`, `Visit for ${visit.customerName}`)} className="visit-row space-y-3">
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{visit.mode === 'DINE_IN' ? tr(`Meja ${(visit.tableLabelsJson || []).join(', ')}`, `Table ${(visit.tableLabelsJson || []).join(', ')}`) : tr(`Bawa pulang ${visit.pickupNumber || ''}`, `Takeaway ${visit.pickupNumber || ''}`)} · {visit.customerName}</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">{visit.mode === 'DINE_IN' ? tr(`${visit.partySize} orang · Tamu masih di kafe`, `${visit.partySize} guests · Still at cafe`) : tr("Menunggu penyelesaian pengambilan", "Awaiting pickup completion")}</p></div><StatusLabel label={summary.canDepart ? tr("Siap diselesaikan", "Ready to complete") : tr("Masih berlangsung", "In progress")} tone={summary.canDepart ? 'success' : 'info'} /></div>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm"><div><dt className="text-xs text-[var(--muted-foreground)]">{tr("Sisa seluruh tagihan", "Total outstanding balance")}</dt><dd className="mt-1 font-semibold"><Money amount={summary.outstandingBalanceIdr} /></dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">{tr("Belum disajikan / diambil", "Not served / collected")}</dt><dd className="mt-1 font-semibold">{summary.unfinishedUnitCount} item</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">{tr("Konfirmasi pesanan", "Confirm orders")}</dt><dd className="mt-1 font-semibold">{summary.pendingRequestCount} {tr("permintaan", "requests")}</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">{tr("Pembayaran dalam proses", "Payments in progress")}</dt><dd className="mt-1 font-semibold">{summary.pendingPaymentCount}</dd></div></dl>
        {summary.refundDueIdr > 0 && <p className="text-sm text-[var(--status-danger-fg)]">{tr("Pengembalian masih diperlukan:", "Refund still due:")} <Money amount={summary.refundDueIdr} /></p>}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenBills && <Button variant="secondary" size="sm" onClick={() => onOpenBills(visit.id)}>{tr("Lihat tagihan kunjungan", "View visit bills")}</Button>}
          <Button variant={summary.canDepart ? 'primary' : 'secondary'} size="sm" disabled={locked} onClick={() => openReview(visit.id)}>{visit.mode === 'DINE_IN' ? tr("Tinjau kepulangan", "Review departure") : tr("Selesaikan pengambilan", "Complete pickup")}</Button>
          {canTables && visit.mode === 'DINE_IN' && <><SelectField aria-label={tr(`Meja tujuan untuk ${visit.customerName}`, `Destination table for ${visit.customerName}`)} wrapperClassName="w-auto min-w-[160px]" value={moveTo} onChange={event => setMoveTargets(current => ({ ...current, [visit.id]: event.target.value }))}><option value="">{tr("Pilih meja tujuan", "Choose destination table")}</option>{availableTables.filter((table: any) => table.capacity >= visit.partySize).map((table: any) => <option key={table.id} value={table.id}>{tr("Meja", "Table")} {table.label} · {table.capacity} {tr("orang", "guests")}</option>)}</SelectField><Button variant="secondary" size="sm" disabled={locked || !validMove} onClick={() => run({ action: 'MOVE_TABLE', visitId: visit.id, fromTableId: visit.primaryTableId, toTableId: moveTo }, result => { onNotice(tr(`Tamu ${visit.customerName} dipindahkan ke Meja ${result?.newTableLabel}. Meja sebelumnya perlu dibersihkan.`, `${visit.customerName} moved to table ${result?.newTableLabel}. The previous table needs cleaning.`)); setMoveTargets(current => ({ ...current, [visit.id]: '' })); })}>{tr("Pindah meja", "Move table")}</Button><Button variant="ghost" size="sm" disabled={locked} onClick={() => run({ action: 'ISSUE_JOIN_CODE', visitId: visit.id }, result => onNotice(tr(`Kode gabung meja ${visit.customerName}: ${result?.code}`, `Table join code for ${visit.customerName}: ${result?.code}`)))}>{tr("Kode gabung meja", "Table join code")}</Button></>}
        </div>
      </article>;
    })}</div>
    {followupVisits.length > 0 && <section className="space-y-3 border-t border-[var(--border)] pt-4" aria-label={tr("Tindak lanjut kunjungan", "Visit follow-up")}><h3 className="font-semibold">{tr("Tamu sudah pulang, masih perlu tindak lanjut", "Guest has left; follow-up needed")}</h3>{followupVisits.map((visit: any) => <article key={visit.id} className="rounded-[var(--radius-panel)] border border-[var(--border)] p-4 text-sm space-y-2"><p className="font-semibold">{visit.customerName}</p><p>{visit.financialIssueNote}</p><p>{tr("Sisa tagihan:", "Balance due:")} <Money amount={visit.lifecycleSummary?.outstandingBalanceIdr || 0} /> · {visit.lifecycleSummary?.unfinishedUnitCount || 0} {tr("item belum selesai", "unfinished items")}</p>{onOpenBills && <Button variant="secondary" size="sm" onClick={() => onOpenBills(visit.id)}>{tr("Lihat tagihan kunjungan", "View visit bills")}</Button>}</article>)}</section>}

    <DialogModal open={seatingOpen} onClose={() => { if (!locked) setSeatingOpen(false); }} title={tr("Tempatkan tamu", "Seat guests")}>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (name.trim().length < 2 || !selectedSeatingTable || !Number.isSafeInteger(Number(partySize)) || Number(partySize) < 1) return; void run({ action: 'START_VISIT', tableId, customerName: name.trim(), partySize: Number(partySize), idempotencyKey: seatingKey }, () => { setSeatingOpen(false); onNotice(tr(`Kunjungan ${name.trim()} dimulai. Meja ${selectedSeatingTable.label} kini terisi.`, `Visit started for ${name.trim()}. Table ${selectedSeatingTable.label} is now occupied.`)); }); }}>
        <p className="text-sm text-[var(--muted-foreground)]">{tr("Kunjungan dimulai saat tamu duduk. Pesanan QR maupun pesanan dari kasir akan masuk ke kunjungan meja ini.", "The visit starts when guests are seated. QR and cashier orders will be added to this table visit.")}</p>
        <div className="space-y-1.5"><Label htmlFor="visit-guest-name">{tr("Nama tamu", "Guest name")}</Label><Input id="visit-guest-name" value={name} minLength={2} maxLength={60} required onChange={event => setName(event.target.value)} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="visit-party-size">{tr("Jumlah tamu", "Number of guests")}</Label><Input id="visit-party-size" type="number" min={1} max={50} step={1} value={partySize} required onChange={event => { setPartySize(event.target.value); if (!availableTables.some((table: any) => table.id === tableId && table.capacity >= Number(event.target.value))) setTableId(''); }} /></div>
        <div className="space-y-1.5"><Label htmlFor="visit-table">{tr("Meja untuk tamu", "Guest table")}</Label><SelectField id="visit-table" value={selectedSeatingTable?.id || ''} required onChange={event => setTableId(event.target.value)}><option value="">{tr("Pilih meja bersih yang tersedia", "Choose an available clean table")}</option>{fittingTables.map((table: any) => <option key={table.id} value={table.id}>{tr("Meja", "Table")} {table.label} · {table.capacity} {tr('orang', 'guests')} · {table.areaName}</option>)}</SelectField>{!fittingTables.length && <p className="text-sm text-[var(--muted-foreground)]">{tr("Belum ada meja tersedia dengan kapasitas yang cukup. Bersihkan meja atau gunakan antrean tamu.", "No available table has enough seats. Clean a table or use the waitlist.")}</p>}</div>
        <InlineError message={error} />
        <div className="flex justify-end gap-2"><Button variant="secondary" type="button" disabled={locked} onClick={() => setSeatingOpen(false)}>{tr("Kembali", "Back")}</Button><Button type="submit" disabled={locked || name.trim().length < 2 || !selectedSeatingTable || !Number.isSafeInteger(Number(partySize)) || Number(partySize) < 1}>{pending ? tr("Menempatkan tamu…", "Seating guests…") : tr("Mulai kunjungan", "Start visit")}</Button></div>
      </form>
    </DialogModal>

    <DialogModal open={Boolean(reviewVisit)} onClose={() => { if (!locked) setReviewVisitId(''); }} title={tr("Selesaikan kunjungan", "Complete visit")}>
      {reviewVisit && <div className="space-y-4">
        <div><p className="font-semibold">{reviewVisit.customerName}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{reviewVisit.mode === 'DINE_IN' ? (canTables ? tr("Pastikan tamu sudah selesai dan akan meninggalkan meja. Meja akan berstatus perlu dibersihkan.", "Confirm the guests are finished and leaving the table. The table will be marked for cleaning.") : tr("Pastikan tamu sudah selesai dan akan meninggalkan kafe.", "Confirm the guests are finished and leaving the cafe.")) : tr("Pastikan seluruh pesanan sudah diambil oleh pelanggan.", "Confirm the customer has collected the entire order.")}</p></div>
        <dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
          <div className="py-3 flex justify-between gap-3"><dt>{tr("Sisa seluruh tagihan", "Total outstanding balance")}</dt><dd className="font-semibold"><Money amount={review.outstandingBalanceIdr} /></dd></div>
          <div className="py-3 flex justify-between gap-3"><dt>{tr("Pengembalian belum selesai", "Outstanding refunds")}</dt><dd><Money amount={review.refundDueIdr} /></dd></div>
          <div className="py-3 flex justify-between gap-3"><dt>{tr("Pembayaran dalam proses", "Payments in progress")}</dt><dd>{review.pendingPaymentCount}</dd></div>
          <div className="py-3 flex justify-between gap-3"><dt>{tr("Pesanan menunggu konfirmasi", "Orders awaiting confirmation")}</dt><dd>{review.pendingRequestCount}</dd></div>
          <div className="py-3 flex justify-between gap-3"><dt>{tr("Item belum disajikan / diambil", "Items not served / collected")}</dt><dd>{review.unfinishedUnitCount}</dd></div>
          <div className="py-3 flex justify-between gap-3"><dt>{tr("Panggilan tamu belum selesai", "Unresolved guest calls")}</dt><dd>{review.unresolvedServiceCount}</dd></div>
        </dl>
        {!review.canDepart && <div role="status" className="rounded-[var(--radius-control)] bg-[var(--status-warning-bg)] p-3 text-sm"><p className="font-semibold">{tr("Selesaikan hal berikut sebelum menutup kunjungan:", "Resolve the following before closing the visit:")}</p><ul className="mt-2 list-disc pl-5 space-y-1">{review.blockers.map(blocker => <li key={blocker.code}>{language === 'en' ? englishBlockers[blocker.code] || blocker.message : blocker.message}</li>)}</ul></div>}
        {review.canDepart && <p role="status" className="text-sm text-[var(--status-success-fg)]">{tr("Seluruh tagihan, pesanan, dan permintaan layanan sudah selesai.", "All bills, orders and service requests are complete.")}</p>}
        <InlineError message={error} />
        {!exceptionMode && <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={locked} onClick={() => setReviewVisitId('')}>{tr("Kembali", "Back")}</Button><Button disabled={locked || !review.canDepart} onClick={() => run({ action: 'DEPART_VISIT', visitId: reviewVisit.id }, () => { onNotice(reviewVisit.mode === 'DINE_IN' ? tr(`Kunjungan ${reviewVisit.customerName} selesai.${canTables ? ' Meja perlu dibersihkan sebelum tamu berikutnya.' : ''}`, `Visit for ${reviewVisit.customerName} completed.${canTables ? ' The table needs cleaning before the next guest.' : ''}`) : tr(`Pengambilan ${reviewVisit.customerName} selesai.`, `Pickup for ${reviewVisit.customerName} completed.`)); setReviewVisitId(''); })}>{reviewVisit.mode === 'DINE_IN' ? tr("Konfirmasi tamu pulang", "Confirm guest departure") : tr("Konfirmasi pengambilan selesai", "Confirm pickup complete")}</Button></div>}
        {canApproveException && !review.canDepart && <div className="border-t border-[var(--border)] pt-4 space-y-3">
          <Button variant="ghost" size="sm" disabled={locked} onClick={() => setExceptionMode(value => !value)}>{exceptionMode ? tr("Kembali ke penyelesaian normal", "Return to normal completion") : tr("Catat kepulangan dengan masalah", "Record departure with outstanding issues")}</Button>
          {exceptionMode && <><p className="text-sm text-[var(--muted-foreground)]">{tr("Gunakan saat tamu benar-benar sudah pergi. Tagihan, pengembalian, dan pekerjaan yang tertinggal tetap tercatat dan harus ditindaklanjuti. Permintaan pesanan yang belum dikonfirmasi harus ditolak atau diterima terlebih dahulu.", "Use only after the guest has left. Outstanding bills, refunds and work remain recorded and need follow-up. Pending order requests must first be accepted or rejected.")}</p><Label htmlFor="visit-exception-reason">{tr("Alasan kepulangan dengan masalah", "Reason for departure with issues")}</Label><Textarea id="visit-exception-reason" value={exceptionReason} minLength={10} maxLength={500} onChange={event => setExceptionReason(event.target.value)} placeholder={tr("Catat kejadian dan tindak lanjut yang diperlukan", "Describe what happened and the required follow-up")} /><Button variant="danger" disabled={locked || exceptionReason.trim().length < 10 || review.pendingRequestCount > 0} onClick={() => run({ action: 'DEPART_VISIT_EXCEPTION', visitId: reviewVisit.id, reason: exceptionReason.trim() }, () => { onNotice(tr(`Kepulangan ${reviewVisit.customerName} dicatat dengan masalah. Kewajiban yang tersisa tetap perlu ditindaklanjuti.`, `Departure for ${reviewVisit.customerName} recorded with issues. Outstanding obligations still need follow-up.`)); setReviewVisitId(''); })}>{tr("Catat kepulangan bermasalah", "Record departure with issues")}</Button></>}
        </div>}
      </div>}
    </DialogModal>
  </section>;
}
