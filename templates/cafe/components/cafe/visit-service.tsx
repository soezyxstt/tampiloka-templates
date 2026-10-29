'use client';

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
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Kunjungan belum diperbarui.'); }
    finally { setPending(false); }
  };
  const openReview = (visitId: string) => {
    setReviewVisitId(visitId); setExceptionMode(false); setExceptionReason(''); setError('');
  };

  return <section className="space-y-4" aria-label="Layanan kunjungan">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-heading text-lg font-semibold">Kunjungan aktif ({activeVisits.length})</h2></div>
      {canTables && <Button disabled={locked} onClick={() => {
        setSeatingOpen(true); setSeatingKey(`seat_${crypto.randomUUID()}`); setName(''); setPartySize('2');
        setTableId(availableTables.find((table: any) => table.capacity >= 2)?.id || ''); setError('');
      }}>Tempatkan tamu</Button>}
    </div>
    {!seatingOpen && !reviewVisitId && <InlineError message={error} />}
    {!activeVisits.length && <EmptyState title="Belum ada kunjungan aktif" description={canTables ? 'Gunakan Tempatkan tamu untuk menyiapkan meja sebelum mereka memesan.' : 'Kunjungan muncul setelah pesanan diterima staf.'} />}
    <div className="visit-list">{activeVisits.map((visit: any) => {
      const summary: Summary = visit.lifecycleSummary || unavailableSummary;
      const moveTo = moveTargets[visit.id] || '';
      const validMove = availableTables.some((table: any) => table.id === moveTo && table.capacity >= visit.partySize);
      return <article key={visit.id} data-visit-id={visit.id} aria-label={`Kunjungan ${visit.customerName}`} className="visit-row space-y-3">
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{visit.mode === 'DINE_IN' ? `Meja ${(visit.tableLabelsJson || []).join(', ')}` : `Bawa pulang ${visit.pickupNumber || ''}`} · {visit.customerName}</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">{visit.mode === 'DINE_IN' ? `${visit.partySize} orang · Tamu masih di kafe` : 'Menunggu penyelesaian pengambilan'}</p></div><StatusLabel label={summary.canDepart ? 'Siap diselesaikan' : 'Masih berlangsung'} tone={summary.canDepart ? 'success' : 'info'} /></div>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm"><div><dt className="text-xs text-[var(--muted-foreground)]">Sisa seluruh tagihan</dt><dd className="mt-1 font-semibold"><Money amount={summary.outstandingBalanceIdr} /></dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Belum disajikan / diambil</dt><dd className="mt-1 font-semibold">{summary.unfinishedUnitCount} item</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Konfirmasi pesanan</dt><dd className="mt-1 font-semibold">{summary.pendingRequestCount} permintaan</dd></div><div><dt className="text-xs text-[var(--muted-foreground)]">Pembayaran dalam proses</dt><dd className="mt-1 font-semibold">{summary.pendingPaymentCount}</dd></div></dl>
        {summary.refundDueIdr > 0 && <p className="text-sm text-[var(--status-danger-fg)]">Pengembalian masih diperlukan: <Money amount={summary.refundDueIdr} /></p>}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenBills && <Button variant="secondary" size="sm" onClick={() => onOpenBills(visit.id)}>Lihat tagihan kunjungan</Button>}
          <Button variant={summary.canDepart ? 'primary' : 'secondary'} size="sm" disabled={locked} onClick={() => openReview(visit.id)}>{visit.mode === 'DINE_IN' ? 'Tinjau kepulangan' : 'Selesaikan pengambilan'}</Button>
          {canTables && visit.mode === 'DINE_IN' && <><SelectField aria-label={`Meja tujuan untuk ${visit.customerName}`} wrapperClassName="w-auto min-w-[160px]" value={moveTo} onChange={event => setMoveTargets(current => ({ ...current, [visit.id]: event.target.value }))}><option value="">Pilih meja tujuan</option>{availableTables.filter((table: any) => table.capacity >= visit.partySize).map((table: any) => <option key={table.id} value={table.id}>Meja {table.label} · {table.capacity} orang</option>)}</SelectField><Button variant="secondary" size="sm" disabled={locked || !validMove} onClick={() => run({ action: 'MOVE_TABLE', visitId: visit.id, fromTableId: visit.primaryTableId, toTableId: moveTo }, result => { onNotice(`Tamu ${visit.customerName} dipindahkan ke Meja ${result?.newTableLabel}. Meja sebelumnya perlu dibersihkan.`); setMoveTargets(current => ({ ...current, [visit.id]: '' })); })}>Pindah meja</Button><Button variant="ghost" size="sm" disabled={locked} onClick={() => run({ action: 'ISSUE_JOIN_CODE', visitId: visit.id }, result => onNotice(`Kode gabung meja ${visit.customerName}: ${result?.code}`))}>Kode gabung meja</Button></>}
        </div>
      </article>;
    })}</div>
    {followupVisits.length > 0 && <section className="space-y-3 border-t border-[var(--border)] pt-4" aria-label="Tindak lanjut kunjungan"><h3 className="font-semibold">Tamu sudah pulang, masih perlu tindak lanjut</h3>{followupVisits.map((visit: any) => <article key={visit.id} className="rounded-[var(--radius-panel)] border border-[var(--border)] p-4 text-sm space-y-2"><p className="font-semibold">{visit.customerName}</p><p>{visit.financialIssueNote}</p><p>Sisa tagihan: <Money amount={visit.lifecycleSummary?.outstandingBalanceIdr || 0} /> · {visit.lifecycleSummary?.unfinishedUnitCount || 0} item belum selesai</p>{onOpenBills && <Button variant="secondary" size="sm" onClick={() => onOpenBills(visit.id)}>Lihat tagihan kunjungan</Button>}</article>)}</section>}

    <DialogModal open={seatingOpen} onClose={() => { if (!locked) setSeatingOpen(false); }} title="Tempatkan tamu">
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (name.trim().length < 2 || !selectedSeatingTable || !Number.isSafeInteger(Number(partySize)) || Number(partySize) < 1) return; void run({ action: 'START_VISIT', tableId, customerName: name.trim(), partySize: Number(partySize), idempotencyKey: seatingKey }, () => { setSeatingOpen(false); onNotice(`Kunjungan ${name.trim()} dimulai. Meja ${selectedSeatingTable.label} kini terisi.`); }); }}>
        <p className="text-sm text-[var(--muted-foreground)]">Kunjungan dimulai saat tamu duduk. Pesanan QR maupun pesanan dari kasir akan masuk ke kunjungan meja ini.</p>
        <div className="space-y-1.5"><Label htmlFor="visit-guest-name">Nama tamu</Label><Input id="visit-guest-name" value={name} minLength={2} maxLength={60} required onChange={event => setName(event.target.value)} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="visit-party-size">Jumlah tamu</Label><Input id="visit-party-size" type="number" min={1} max={50} step={1} value={partySize} required onChange={event => { setPartySize(event.target.value); if (!availableTables.some((table: any) => table.id === tableId && table.capacity >= Number(event.target.value))) setTableId(''); }} /></div>
        <div className="space-y-1.5"><Label htmlFor="visit-table">Meja untuk tamu</Label><SelectField id="visit-table" value={selectedSeatingTable?.id || ''} required onChange={event => setTableId(event.target.value)}><option value="">Pilih meja bersih yang tersedia</option>{fittingTables.map((table: any) => <option key={table.id} value={table.id}>Meja {table.label} · {table.capacity} orang · {table.areaName}</option>)}</SelectField>{!fittingTables.length && <p className="text-sm text-[var(--muted-foreground)]">Belum ada meja tersedia dengan kapasitas yang cukup. Bersihkan meja atau gunakan antrean tamu.</p>}</div>
        <InlineError message={error} />
        <div className="flex justify-end gap-2"><Button variant="secondary" type="button" disabled={locked} onClick={() => setSeatingOpen(false)}>Kembali</Button><Button type="submit" disabled={locked || name.trim().length < 2 || !selectedSeatingTable || !Number.isSafeInteger(Number(partySize)) || Number(partySize) < 1}>{pending ? 'Menempatkan tamu…' : 'Mulai kunjungan'}</Button></div>
      </form>
    </DialogModal>

    <DialogModal open={Boolean(reviewVisit)} onClose={() => { if (!locked) setReviewVisitId(''); }} title="Selesaikan kunjungan">
      {reviewVisit && <div className="space-y-4">
        <div><p className="font-semibold">{reviewVisit.customerName}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{reviewVisit.mode === 'DINE_IN' ? (canTables ? 'Pastikan tamu sudah selesai dan akan meninggalkan meja. Meja akan berstatus perlu dibersihkan.' : 'Pastikan tamu sudah selesai dan akan meninggalkan kafe.') : 'Pastikan seluruh pesanan sudah diambil oleh pelanggan.'}</p></div>
        <dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
          <div className="py-3 flex justify-between gap-3"><dt>Sisa seluruh tagihan</dt><dd className="font-semibold"><Money amount={review.outstandingBalanceIdr} /></dd></div>
          <div className="py-3 flex justify-between gap-3"><dt>Pengembalian belum selesai</dt><dd><Money amount={review.refundDueIdr} /></dd></div>
          <div className="py-3 flex justify-between gap-3"><dt>Pembayaran dalam proses</dt><dd>{review.pendingPaymentCount}</dd></div>
          <div className="py-3 flex justify-between gap-3"><dt>Pesanan menunggu konfirmasi</dt><dd>{review.pendingRequestCount}</dd></div>
          <div className="py-3 flex justify-between gap-3"><dt>Item belum disajikan / diambil</dt><dd>{review.unfinishedUnitCount}</dd></div>
          <div className="py-3 flex justify-between gap-3"><dt>Panggilan tamu belum selesai</dt><dd>{review.unresolvedServiceCount}</dd></div>
        </dl>
        {!review.canDepart && <div role="status" className="rounded-[var(--radius-control)] bg-[var(--status-warning-bg)] p-3 text-sm"><p className="font-semibold">Selesaikan hal berikut sebelum menutup kunjungan:</p><ul className="mt-2 list-disc pl-5 space-y-1">{review.blockers.map(blocker => <li key={blocker.code}>{blocker.message}</li>)}</ul></div>}
        {review.canDepart && <p role="status" className="text-sm text-[var(--status-success-fg)]">Seluruh tagihan, pesanan, dan permintaan layanan sudah selesai.</p>}
        <InlineError message={error} />
        {!exceptionMode && <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={locked} onClick={() => setReviewVisitId('')}>Kembali</Button><Button disabled={locked || !review.canDepart} onClick={() => run({ action: 'DEPART_VISIT', visitId: reviewVisit.id }, () => { onNotice(reviewVisit.mode === 'DINE_IN' ? `Kunjungan ${reviewVisit.customerName} selesai.${canTables ? ' Meja perlu dibersihkan sebelum tamu berikutnya.' : ''}` : `Pengambilan ${reviewVisit.customerName} selesai.`); setReviewVisitId(''); })}>{reviewVisit.mode === 'DINE_IN' ? 'Konfirmasi tamu pulang' : 'Konfirmasi pengambilan selesai'}</Button></div>}
        {canApproveException && !review.canDepart && <div className="border-t border-[var(--border)] pt-4 space-y-3">
          <Button variant="ghost" size="sm" disabled={locked} onClick={() => setExceptionMode(value => !value)}>{exceptionMode ? 'Kembali ke penyelesaian normal' : 'Catat kepulangan dengan masalah'}</Button>
          {exceptionMode && <><p className="text-sm text-[var(--muted-foreground)]">Gunakan saat tamu benar-benar sudah pergi. Tagihan, pengembalian, dan pekerjaan yang tertinggal tetap tercatat dan harus ditindaklanjuti. Permintaan pesanan yang belum dikonfirmasi harus ditolak atau diterima terlebih dahulu.</p><Label htmlFor="visit-exception-reason">Alasan kepulangan dengan masalah</Label><Textarea id="visit-exception-reason" value={exceptionReason} minLength={10} maxLength={500} onChange={event => setExceptionReason(event.target.value)} placeholder="Catat kejadian dan tindak lanjut yang diperlukan" /><Button variant="danger" disabled={locked || exceptionReason.trim().length < 10 || review.pendingRequestCount > 0} onClick={() => run({ action: 'DEPART_VISIT_EXCEPTION', visitId: reviewVisit.id, reason: exceptionReason.trim() }, () => { onNotice(`Kepulangan ${reviewVisit.customerName} dicatat dengan masalah. Kewajiban yang tersisa tetap perlu ditindaklanjuti.`); setReviewVisitId(''); })}>Catat kepulangan bermasalah</Button></>}
        </div>}
      </div>}
    </DialogModal>
  </section>;
}
