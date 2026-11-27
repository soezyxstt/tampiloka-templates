'use client';
import { useCafeLanguage } from '@/lib/language';

import { useId, useMemo, useState } from 'react';
import { cafeConfig, isModuleEnabled } from '@/src/config/cafe';
import { supervisesOperations } from '@/src/domain/capabilities';
import { canTransitionUnit, isFinishedOrderUnit } from '@/src/domain/rules';
import { localizeSampleName } from '@/src/catalog/sample-menu';
import { FloorMap, tableAvailability, tableAvailabilityLabel } from './floor-map';
import styles from './visit-service.module.css';
import { Button, DialogModal, EmptyState, InlineError, Input, Label, Money, SelectField, StatusLabel } from './ui-primitives';

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
  const detailId = useId();
  const [roomId, setRoomId] = useState('');
  const [tableDetailOpen, setTableDetailOpen] = useState(false);
  const [takeawayExpanded, setTakeawayExpanded] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [seatingOpen, setSeatingOpen] = useState(false);
  const [seatingKey, setSeatingKey] = useState('');
  const [name, setName] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [tableId, setTableId] = useState('');
  const [reviewVisitId, setReviewVisitId] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [joinCodes, setJoinCodes] = useState<Record<string, string>>({});
  const locked = busy || pending;
  const readOnly = supervisesOperations(actorRole);
  const visits = snapshot?.visits || [];
  const activeVisits = visits.filter((visit: any) => visit.status === 'OPEN');
  const followupVisits = visits.filter((visit: any) => visit.status !== 'OPEN' && visit.financialIssueNote && (visit.lifecycleSummary?.blockers || []).some((blocker: any) => blocker.code !== 'VISIT_CLOSED'));
  const reviewVisit = visits.find((visit: any) => visit.id === reviewVisitId);
  const unfinishedUnits = (snapshot?.orderUnits || []).filter((unit: any) =>
    unit.visitId === reviewVisitId && !isFinishedOrderUnit(unit.fulfillmentStatus));
  const review: Summary = reviewVisit?.lifecycleSummary || unavailableSummary;
  const now = Date.parse(snapshot?.serverTime || new Date().toISOString());
  const availableTables = useMemo(() => (snapshot?.tables || []).filter((table: any) =>
    table.active && table.physicalState === 'AVAILABLE' && !(snapshot?.waitlistEntries || []).some((entry: any) =>
      entry.status === 'CALLED' && entry.heldTableId === table.id && Date.parse(entry.holdExpiresAt) > now)), [snapshot, now]);
  const fittingTables = availableTables.filter((table: any) => table.capacity >= Number(partySize));
  const selectedSeatingTable = fittingTables.find((table: any) => table.id === tableId);
  const rooms = snapshot?.rooms || [];
  const room = rooms.find((entry: any) => entry.id === roomId) || rooms[0];
  const roomTables = (snapshot?.tables || []).filter((table: any) => table.roomId === room?.id);
  const showMap = canTables && Boolean(room);
  const tableVisit = (table: any) => activeVisits.find((visit: any) => visit.primaryTableId === table.id ||
    (snapshot?.tableAssignments || []).some((assignment: any) => assignment.tableId === table.id && assignment.visitId === visit.id && !assignment.endedAt));
  const selectedTable = roomTables.find((table: any) => table.id === selectedTableId) || roomTables.find((table: any) => tableVisit(table)) || roomTables[0];
  const selectedVisit = selectedTable && tableVisit(selectedTable);
  const selectedState = selectedTable && tableAvailability(selectedTable, snapshot?.waitlistEntries, now);
  const heldEntry = selectedTable && (snapshot?.waitlistEntries || []).find((entry: any) => entry.heldTableId === selectedTable.id && entry.status === 'CALLED' && Date.parse(entry.holdExpiresAt) > now);
  const visibleVisits = showMap ? (selectedVisit ? [selectedVisit] : []) : activeVisits;
  const takeawayVisits = showMap ? activeVisits.filter((visit: any) => visit.mode !== 'DINE_IN' || !(snapshot?.tables || []).some((table: any) => table.id === visit.primaryTableId)) : [];
  const openSeating = (table = availableTables.find((entry: any) => entry.capacity >= 2) || availableTables[0]) => {
    setSeatingOpen(true); setSeatingKey(`seat_${crypto.randomUUID()}`); setName('');
    setPartySize(String(Math.min(2, table?.capacity || 2))); setTableId(table?.id || ''); setError('');
  };


  const run = async (payload: Record<string, any>, success: (result: any) => void, command = 'TABLE_OR_VISIT_ACTION') => {
    if (locked || readOnly) return;
    setPending(true); setError('');
    try { const response = await onCommand(command, payload); success(response?.result); }
    catch (caught) { setError(caught instanceof Error ? caught.message : tr("Kunjungan belum diperbarui.", "The visit was not updated.")); }
    finally { setPending(false); }
  };
  const openReview = (visitId: string) => {
    const visit = visits.find((entry: any) => entry.id === visitId);
    if (visit?.primaryTableId) setSelectedTableId(visit.primaryTableId);
    setReviewVisitId(visitId); setError('');
  };

  const tableDetails = <>
      {showMap && selectedTable && <div className={styles.tableHeading}>
        <div className={styles.headingLine}><h3>{tr('Meja', 'Table')} {selectedTable.label}</h3><StatusLabel label={tableAvailabilityLabel(selectedState, tr)} tone={selectedState === 'ready' ? 'success' : selectedState === 'occupied' ? 'info' : selectedState === 'inactive' ? 'neutral' : 'warning'} /></div>
        <p>{selectedTable.capacity} {tr('kursi', 'seats')}</p>
        {!selectedVisit && <div className={styles.emptyTable}>
          {selectedState === 'held' && heldEntry && <p>{heldEntry?.customerName} · {heldEntry?.partySize} {tr('orang', 'guests')}. {tr('Meja ditahan hingga', 'Table held until')} {new Date(heldEntry.holdExpiresAt).toLocaleTimeString(language, { timeZone: cafeConfig.timezone, hour: '2-digit', minute: '2-digit' })}.</p>}
          {selectedState === 'occupied' && <p>{tr('Detail kunjungan belum tersedia. Perbarui data.', 'Visit details unavailable. Refresh data.')}</p>}
          <div className={styles.actions}>
            {!readOnly && selectedState === 'held' && heldEntry && <>
              <Button size="sm" disabled={locked} onClick={() => run({ action: 'SEAT', waitlistId: heldEntry.id, tableId: selectedTable.id }, () => onNotice(tr('Tamu sudah ditempatkan.', 'Guests seated.')), 'WAITLIST_ACTION')}>{tr('Tempatkan di meja', 'Seat at table')}</Button>
              <Button size="sm" variant="secondary" disabled={locked} onClick={() => run({ action: 'SKIP', waitlistId: heldEntry.id }, () => onNotice(tr('Tamu ditandai tidak hadir. Meja tersedia kembali.', 'Guest marked absent. The table is available again.')), 'WAITLIST_ACTION')}>{tr('Tandai tidak hadir', 'Mark as no-show')}</Button>
            </>}
            {!readOnly && selectedState === 'ready' && <Button size="sm" disabled={locked} onClick={() => openSeating(selectedTable)}>{tr('Tempatkan tamu di sini', 'Seat guests here')}</Button>}
            {!readOnly && selectedState === 'dirty' && <Button size="sm" disabled={locked} onClick={() => run({ action: 'MARK_CLEAN', tableId: selectedTable.id }, () => onNotice(tr(`Meja ${selectedTable.label} bersih dan siap diisi.`, `Table ${selectedTable.label} is clean and ready to seat.`)))}>{tr('Tandai bersih & siap', 'Mark clean & ready')}</Button>}
            {!readOnly && selectedState === 'inactive' && <Button size="sm" variant="secondary" disabled={locked} onClick={() => run({ action: 'ENABLE_TABLE', tableId: selectedTable.id }, () => onNotice(tr('Meja diaktifkan. Periksa dan bersihkan sebelum ditempati.', 'Table reactivated. Check and clean it before seating guests.')))}>{tr('Aktifkan meja', 'Reactivate table')}</Button>}
          </div>
        </div>}
      </div>}
      {showMap && !selectedTable && <EmptyState title={tr('Belum ada meja di area ini', 'No tables in this area')} />}
    <div className="visit-list">{visibleVisits.map((visit: any) => {
      const summary: Summary = visit.lifecycleSummary || unavailableSummary;
      const moveTo = moveTargets[visit.id] || '';
      const validMove = availableTables.some((table: any) => table.id === moveTo && table.capacity >= visit.partySize);
      return <article key={visit.id} data-visit-id={visit.id} aria-label={tr(`Kunjungan ${visit.customerName}`, `Visit for ${visit.customerName}`)} className={`visit-row space-y-3 ${showMap ? styles.selectedVisit : ''}`}>
        <div className={styles.visitHeading}>
          <div><h3 className="font-semibold">{!showMap && <>{visit.mode === 'DINE_IN' ? tr(`Meja ${(visit.tableLabelsJson || []).join(', ')}`, `Table ${(visit.tableLabelsJson || []).join(', ')}`) : tr(`Bawa pulang ${visit.pickupNumber || ''}`, `Takeaway ${visit.pickupNumber || ''}`)} · </>}{visit.customerName}</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{visit.mode === 'DINE_IN' ? tr(`${visit.partySize} orang`, `${visit.partySize} guests`) : tr('Menunggu pengambilan', 'Awaiting pickup')}{summary.outstandingBalanceIdr > 0 && <> · {tr('Sisa tagihan', 'Balance due')} <Money amount={summary.outstandingBalanceIdr} /></>}</p>
            {visit.mode === 'DINE_IN' && visit.openedAt && <p className="mt-1 text-sm">{tr('Duduk sejak', 'Seated since')} <time dateTime={visit.openedAt}>{new Date(visit.openedAt).toLocaleTimeString(language, { timeZone: cafeConfig.timezone, hour: '2-digit', minute: '2-digit' })}</time></p>}
          </div>
          {(!showMap || summary.canDepart) && <StatusLabel label={summary.canDepart ? tr('Siap diselesaikan', 'Ready to complete') : tr('Masih berlangsung', 'In progress')} tone={summary.canDepart ? 'success' : 'info'} />}
        </div>
        {showMap && summary.unfinishedUnitCount > 0 && <p className="text-sm">{tr(`${summary.unfinishedUnitCount} item belum disajikan`, `${summary.unfinishedUnitCount} items not yet served`)}</p>}
        {showMap && summary.pendingRequestCount > 0 && <p className="text-sm">{tr(`${summary.pendingRequestCount} pesanan menunggu konfirmasi`, `${summary.pendingRequestCount} orders await confirmation`)}</p>}
        {summary.refundDueIdr > 0 && <p className="text-sm text-[var(--status-danger-fg)]">{tr('Pengembalian masih diperlukan:', 'Refund still due:')} <Money amount={summary.refundDueIdr} /></p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={summary.canDepart ? 'primary' : 'ghost'} className={summary.canDepart ? '' : 'text-[var(--primary-ink)]'} size="sm" disabled={locked} onClick={() => openReview(visit.id)}>{visit.mode === 'DINE_IN' ? tr('Tinjau kepulangan', 'Review departure') : tr('Selesaikan pengambilan', 'Complete pickup')}</Button>
          {onOpenBills && (snapshot?.bills || []).some((bill: any) => bill.visitId === visit.id && bill.lifecycle !== 'VOID') && <Button variant="ghost" size="sm" onClick={() => onOpenBills(visit.id)}>{showMap ? tr('Tagihan', 'Bills') : tr('Lihat tagihan kunjungan', 'View visit bills')}</Button>}
        </div>
        {!readOnly && canTables && visit.mode === 'DINE_IN' && <details className={`visit-details ${styles.disclosure}`}>
          <summary>{tr('Pindah meja atau buat kode gabung', 'Move table or create join code')}</summary>
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <SelectField aria-label={tr(`Meja tujuan untuk ${visit.customerName}`, `Destination table for ${visit.customerName}`)} wrapperClassName="w-auto min-w-[160px]" value={moveTo} onChange={event => setMoveTargets(current => ({ ...current, [visit.id]: event.target.value }))}><option value="">{tr('Pilih meja tujuan', 'Choose destination table')}</option>{availableTables.filter((table: any) => table.capacity >= visit.partySize).map((table: any) => <option key={table.id} value={table.id}>{tr('Meja', 'Table')} {table.label} · {table.capacity} {tr('orang', 'guests')}</option>)}</SelectField>
            {!availableTables.some((table: any) => table.capacity >= visit.partySize) && <p className="text-sm text-[var(--muted-foreground)]">{tr('Belum ada meja bersih dengan kursi yang cukup.', 'No clean table has enough seats yet.')}</p>}
            <Button variant="secondary" size="sm" disabled={locked || !validMove} onClick={() => run({ action: 'MOVE_TABLE', visitId: visit.id, fromTableId: visit.primaryTableId, toTableId: moveTo }, result => { onNotice(tr(`Tamu ${visit.customerName} dipindahkan ke Meja ${result?.newTableLabel}. Meja sebelumnya perlu dibersihkan.`, `${visit.customerName} moved to table ${result?.newTableLabel}. The previous table needs cleaning.`)); setSelectedTableId(moveTo); setRoomId(availableTables.find((table: any) => table.id === moveTo)?.roomId || ''); setMoveTargets(current => ({ ...current, [visit.id]: '' })); setJoinCodes(current => ({ ...current, [visit.id]: '' })); })}>{tr('Pindah meja', 'Move table')}</Button>
            <Button variant="ghost" size="sm" disabled={locked} onClick={() => run({ action: 'ISSUE_JOIN_CODE', visitId: visit.id }, result => { setJoinCodes(current => ({ ...current, [visit.id]: result?.code || '' })); onNotice(tr('Kode gabung meja dibuat.', 'Table join code created.')); })}>{tr('Kode gabung meja', 'Table join code')}</Button>
            {joinCodes[visit.id] && <p role="status" className="text-sm font-semibold">{tr('Kode gabung:', 'Join code:')} {joinCodes[visit.id]}</p>}
          </div>
        </details>}
      </article>;
    })}</div>
    {takeawayVisits.length > 0 && <details className={`visit-details ${styles.disclosure} ${styles.takeaway}`} open={takeawayExpanded} onToggle={event => setTakeawayExpanded(event.currentTarget.open)}><summary>{tr(`Bawa pulang (${takeawayVisits.length})`, `Takeaway (${takeawayVisits.length})`)}</summary><div className={styles.otherVisits}>{takeawayVisits.map((visit: any) => <article key={visit.id} data-visit-id={visit.id} aria-label={tr(`Kunjungan ${visit.customerName}`, `Visit for ${visit.customerName}`)}><div><h3>{visit.customerName}</h3><p>{visit.pickupNumber || (visit.tableLabelsJson || []).join(', ')} · {tr('Sisa tagihan', 'Balance due')} <Money amount={visit.lifecycleSummary?.outstandingBalanceIdr || 0} /></p></div><div className={styles.actions}><Button size="sm" variant="secondary" disabled={locked} onClick={() => openReview(visit.id)}>{tr('Selesaikan pengambilan', 'Complete pickup')}</Button>{onOpenBills && <Button size="sm" variant="ghost" onClick={() => onOpenBills(visit.id)}>{tr('Lihat tagihan', 'View bills')}</Button>}</div></article>)}</div></details>}
  </>;

  return <section className="space-y-2.5" aria-label={tr("Layanan kunjungan", "Visit service")}>
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {showMap && <SelectField aria-label={tr('Area kunjungan', 'Visit area')} value={room.id} wrapperClassName="min-w-0 flex-1 max-w-[220px]" onChange={event => { setRoomId(event.target.value); setSelectedTableId(''); setError(''); }}>
          {rooms.map((entry: any) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </SelectField>}
        <span className="hidden sm:inline text-xs text-[var(--muted-foreground)] tabular-nums shrink-0">{activeVisits.length} {tr('kunjungan aktif', 'active visits')}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {showMap && takeawayVisits.length > 0 && <Button className={styles.mobileOnly} size="sm" variant="ghost" onClick={() => { setTakeawayExpanded(true); setTableDetailOpen(true); }}>{tr(`Bawa pulang (${takeawayVisits.length})`, `Takeaway (${takeawayVisits.length})`)}</Button>}
        {!readOnly && canTables && <Button size="sm" disabled={locked || !availableTables.length} onClick={() => openSeating()}>{tr('Tempatkan tamu', 'Seat guests')}</Button>}
      </div>
    </div>
    {!seatingOpen && !reviewVisitId && !tableDetailOpen && <InlineError message={error} />}
    {!showMap && !activeVisits.length && <EmptyState title={tr("Belum ada kunjungan aktif", "No active visits")} />}
    <div className={showMap ? styles.layout : undefined}>
      {showMap && <div className={styles.plan}><FloorMap room={room} tables={roomTables} waitlistEntries={snapshot?.waitlistEntries} selectedTableId={selectedTable?.id} onSelect={id => { setSelectedTableId(id); setError(''); if (window.matchMedia('(max-width: 959px)').matches) setTableDetailOpen(true); }} now={now} detailId={detailId} /></div>}
      {!tableDetailOpen && <div id={detailId} className={showMap ? styles.inspector : undefined} aria-label={showMap ? tr('Detail meja terpilih', 'Selected table details') : undefined}>
        {tableDetails}
      </div>}
    </div>

    {followupVisits.length > 0 && <section className="space-y-3 border-t border-[var(--border)] pt-4" aria-label={tr("Tindak lanjut kunjungan", "Visit follow-up")}><h3 className="font-semibold">{tr("Tamu sudah pulang, masih perlu tindak lanjut", "Guest has left; follow-up needed")}</h3><div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">{followupVisits.map((visit: any) => <article key={visit.id} className="py-3 text-sm space-y-1.5"><p className="font-semibold">{visit.customerName}</p><p>{visit.financialIssueNote}</p><p className="text-[var(--muted-foreground)]">{tr("Sisa tagihan:", "Balance due:")} <Money amount={visit.lifecycleSummary?.outstandingBalanceIdr || 0} className="text-[var(--foreground)] font-medium" /> · {visit.lifecycleSummary?.unfinishedUnitCount || 0} {tr("item belum selesai", "unfinished items")}</p>{onOpenBills && (snapshot?.bills || []).some((bill: any) => bill.visitId === visit.id && bill.lifecycle !== 'VOID') && <div className="pt-1"><Button variant="secondary" size="sm" onClick={() => onOpenBills(visit.id)}>{tr("Lihat tagihan kunjungan", "View visit bills")}</Button></div>}</article>)}</div></section>}

    <DialogModal open={seatingOpen || Boolean(reviewVisit) || (showMap && tableDetailOpen)} onClose={() => {
      if (locked) return;
      if (seatingOpen) setSeatingOpen(false);
      else if (reviewVisitId) setReviewVisitId('');
      else setTableDetailOpen(false);
    }} title={seatingOpen ? tr('Tempatkan tamu', 'Seat guests') : reviewVisit ? tr('Selesaikan kunjungan', 'Complete visit') : tr('Detail meja', 'Table details')}>
      {seatingOpen ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (name.trim().length < 2 || !selectedSeatingTable || !Number.isSafeInteger(Number(partySize)) || Number(partySize) < 1) return; void run({ action: 'START_VISIT', tableId, customerName: name.trim(), partySize: Number(partySize), idempotencyKey: seatingKey }, () => { setSeatingOpen(false); setSelectedTableId(selectedSeatingTable.id); setRoomId(selectedSeatingTable.roomId); onNotice(tr(`Kunjungan ${name.trim()} dimulai. Meja ${selectedSeatingTable.label} kini terisi.`, `Visit started for ${name.trim()}. Table ${selectedSeatingTable.label} is now occupied.`)); }); }}>

        <div className="space-y-1.5"><Label htmlFor="visit-guest-name">{tr("Nama tamu", "Guest name")}</Label><Input id="visit-guest-name" value={name} minLength={2} maxLength={60} required onChange={event => setName(event.target.value)} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="visit-party-size">{tr("Jumlah tamu", "Number of guests")}</Label><Input id="visit-party-size" type="number" min={1} max={50} step={1} value={partySize} required onChange={event => { setPartySize(event.target.value); if (!availableTables.some((table: any) => table.id === tableId && table.capacity >= Number(event.target.value))) setTableId(''); }} /></div>
        <div className="space-y-1.5"><Label htmlFor="visit-table">{tr("Meja untuk tamu", "Guest table")}</Label><SelectField id="visit-table" value={selectedSeatingTable?.id || ''} required onChange={event => setTableId(event.target.value)}><option value="">{tr("Pilih meja bersih yang tersedia", "Choose an available clean table")}</option>{fittingTables.map((table: any) => <option key={table.id} value={table.id}>{tr("Meja", "Table")} {table.label} · {table.capacity} {tr('orang', 'guests')} · {table.areaName}</option>)}</SelectField>{!fittingTables.length && <p className="text-sm text-[var(--muted-foreground)]">{tr("Belum ada meja tersedia dengan kapasitas yang cukup. Bersihkan meja atau gunakan antrean tamu.", "No available table has enough seats. Clean a table or use the waitlist.")}</p>}</div>
        <InlineError message={error} />
        <div className="flex justify-end gap-2"><Button variant="secondary" type="button" disabled={locked} onClick={() => setSeatingOpen(false)}>{tr("Kembali", "Back")}</Button><Button type="submit" disabled={locked || name.trim().length < 2 || !selectedSeatingTable || !Number.isSafeInteger(Number(partySize)) || Number(partySize) < 1}>{pending ? tr("Menempatkan tamu…", "Seating guests…") : tr("Mulai kunjungan", "Start visit")}</Button></div>
      </form> : reviewVisit ? <div className="space-y-4">
        <div><p className="font-semibold">{reviewVisit.customerName}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{reviewVisit.mode === 'DINE_IN' ? (canTables ? tr("Meja perlu dibersihkan setelah tamu pulang.", "The table will need cleaning after departure.") : tr("Konfirmasi tamu sudah pulang.", "Confirm the guests have left.")) : tr("Konfirmasi semua pesanan sudah diambil.", "Confirm all items have been collected.")}</p></div>
        {unfinishedUnits.length > 0 && <ul className="space-y-2">{unfinishedUnits.map((unit: any) => {
          const takeaway = reviewVisit.mode === 'TAKEAWAY';
          const target = takeaway ? 'PICKED_UP' : 'DELIVERED';
          const actionable = !readOnly && canTransitionUnit(unit.fulfillmentStatus, target, !isModuleEnabled('kitchen'));
          const item = localizeSampleName(unit.menuItemId, unit.itemNameSnapshot, language, Boolean(snapshot?.runtime?.demo));
          const status = unit.fulfillmentStatus === 'READY' ? tr('Siap', 'Ready') : unit.fulfillmentStatus === 'HELD_FOR_PAYMENT' ? tr('Menunggu pembayaran', 'Awaiting payment') : unit.fulfillmentStatus === 'PREPARING' ? tr('Sedang dibuat', 'Preparing') : tr('Dalam antrean', 'Queued');
          return <li key={unit.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{item}</span>
            {actionable ? <Button size="sm" variant="secondary" disabled={locked} aria-label={takeaway ? tr(`Tandai sudah diambil: ${item}`, `Mark collected: ${item}`) : tr(`Tandai sudah disajikan: ${item}`, `Mark served: ${item}`)} onClick={() => run({ unitIds: [unit.id], targetStatus: target }, () => onNotice(tr('Penyerahan item tercatat.', 'Item handoff recorded.')), 'TRANSITION_UNITS')}>{takeaway ? tr('Tandai sudah diambil', 'Mark collected') : tr('Tandai sudah disajikan', 'Mark served')}</Button> : <span>{status}</span>}
          </li>;
        })}</ul>}
        {!review.canDepart && <div role="status" className="rounded-[var(--radius-control)] bg-[var(--status-warning-bg)] p-3 text-sm"><p className="font-semibold">{tr("Yang perlu diselesaikan", "Still to resolve")}</p><ul className="mt-2 list-disc pl-5 space-y-1">{review.blockers.map(blocker => <li key={blocker.code}>{language === 'en' ? englishBlockers[blocker.code] || blocker.message : blocker.message}</li>)}</ul></div>}

        <details className={styles.disclosure}>
          <summary>{tr('Rincian tagihan dan layanan', 'Bill and service details')}</summary>
          <dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
            <div className="py-3 flex justify-between gap-3"><dt>{tr("Sisa seluruh tagihan", "Total outstanding balance")}</dt><dd className="font-semibold"><Money amount={review.outstandingBalanceIdr} /></dd></div>
            <div className="py-3 flex justify-between gap-3"><dt>{tr("Pengembalian belum selesai", "Outstanding refunds")}</dt><dd><Money amount={review.refundDueIdr} /></dd></div>
            <div className="py-3 flex justify-between gap-3"><dt>{tr("Pembayaran dalam proses", "Payments in progress")}</dt><dd>{review.pendingPaymentCount}</dd></div>
            <div className="py-3 flex justify-between gap-3"><dt>{tr("Pesanan menunggu konfirmasi", "Orders awaiting confirmation")}</dt><dd>{review.pendingRequestCount}</dd></div>
            <div className="py-3 flex justify-between gap-3"><dt>{tr("Item belum disajikan / diambil", "Items not served / collected")}</dt><dd>{review.unfinishedUnitCount}</dd></div>
            <div className="py-3 flex justify-between gap-3"><dt>{tr("Panggilan tamu belum selesai", "Unresolved guest calls")}</dt><dd>{review.unresolvedServiceCount}</dd></div>
          </dl>
        </details>
        <InlineError message={error} />
        <div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={locked} onClick={() => setReviewVisitId('')}>{tr("Kembali", "Back")}</Button>{!readOnly && <Button disabled={locked || !review.canDepart} onClick={() => run({ action: 'DEPART_VISIT', visitId: reviewVisit.id }, () => { onNotice(reviewVisit.mode === 'DINE_IN' ? tr(`Kunjungan ${reviewVisit.customerName} selesai.${canTables ? ' Meja perlu dibersihkan sebelum tamu berikutnya.' : ''}`, `Visit for ${reviewVisit.customerName} completed.${canTables ? ' The table needs cleaning before the next guest.' : ''}`) : tr(`Pengambilan ${reviewVisit.customerName} selesai.`, `Pickup for ${reviewVisit.customerName} completed.`)); setReviewVisitId(''); })}>{reviewVisit.mode === 'DINE_IN' ? tr("Konfirmasi tamu pulang", "Confirm guest departure") : tr("Konfirmasi pengambilan selesai", "Confirm pickup complete")}</Button>}</div>

      </div> : <div id={detailId} className={styles.dialogDetails} aria-label={tr('Detail meja terpilih', 'Selected table details')}><InlineError message={error} />{tableDetails}</div>}
    </DialogModal>
  </section>;
}
