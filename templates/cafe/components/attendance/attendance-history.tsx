/* These effects synchronize browser resources, persisted operations, and remote lists with React state. */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useCafeLanguage } from '@/lib/language';
import styles from './attendance.module.css';

type Event = { id: string; staffId: string; kind: 'IN' | 'OUT'; occurredAt: string; effectiveAt: string; corrections: { id: string; reason: string; correctedAt: string; supervisorId: string }[]; correctionsTruncated: boolean; evidence: { readUrl: string } | null };
export function AttendanceHistory({ outletId, review, supervisorOnly = false }: { outletId: string; review: boolean; supervisorOnly?: boolean }) {
  const { t } = useCafeLanguage();
  const [mode, setMode] = useState<'history' | 'review'>(supervisorOnly ? 'review' : 'history');
  const [events, setEvents] = useState<Event[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(''); const [filter, setFilter] = useState(''); const [activeFilter, setActiveFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [image, setImage] = useState(''); const [selected, setSelected] = useState<Event | null>(null);
  const correctionTrigger = useRef<HTMLButtonElement | null>(null);
  const imageRequest = useRef(0);
  const [when, setWhen] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);
  useEffect(() => () => { imageRequest.current++; }, []);
  const load = useCallback(async (next?: string) => {
    setLoading(true);
    const query = new URLSearchParams({ resource: mode, outletId, limit: '20' });
    if (next) query.set('cursor', next); if (mode === 'review' && activeFilter) query.set('staffId', activeFilter);
    try { const response = await fetch(`/api/attendance?${query}`, { cache: 'no-store' }); if (!response.ok) throw new Error(); const data = await response.json(); setEvents(previous => next ? [...previous, ...data.events] : data.events); setCursor(data.nextCursor); setError(''); }
    catch { setError(t('Riwayat tidak tersedia atau akses ditolak.', 'History is unavailable or access was denied.')); }
    finally { setLoading(false); }
  }, [mode, outletId, activeFilter, t]);
  useEffect(() => { setEvents([]); setCursor(null); void load(); }, [load]);
  async function showImage(event: Event) {
    if (!event.evidence) return;
    const request = ++imageRequest.current;
    try { const url = new URL(event.evidence.readUrl, window.location.origin + '/api/attendance'); if (url.origin !== window.location.origin || url.pathname !== '/api/attendance') throw new Error(); const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) throw new Error(); const blob = await response.blob(); if (request === imageRequest.current) setImage(URL.createObjectURL(blob)); }
    catch { if (request === imageRequest.current) setError(t('Foto tidak tersedia atau sudah kedaluwarsa.', 'Photo unavailable or expired.')); }
  }
  async function correct() {
    if (!selected || reason.trim().length < 5 || !when || busy) return;
    setBusy(true);
    try { const response = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'correct', outletId, eventId: selected.id, correctedAt: new Date(when).toISOString(), reason: reason.trim() }), cache: 'no-store' }); if (!response.ok) throw new Error(); setSelected(null); setReason(''); setWhen(''); await load(); }
    catch { setError(t('Koreksi gagal atau hasil belum diketahui. Muat ulang riwayat sebelum mencoba lagi.', 'Correction failed or its result is unknown. Reload history before retrying.')); setSelected(null); }
    finally { setBusy(false); }
  }
  return <section className={styles.panel}>
    <h2>{t('Riwayat absensi', 'Attendance history')}</h2>
    {review && !supervisorOnly && <div className={styles.actions}><Button variant={mode === 'history' ? 'default' : 'secondary'} onClick={() => setMode('history')}>{t('Riwayat saya', 'My history')}</Button><Button variant={mode === 'review' ? 'default' : 'secondary'} onClick={() => setMode('review')}>{t('Tinjauan pengawas', 'Supervisor review')}</Button></div>}
    {mode === 'review' && <form className={styles.actions} onSubmit={e => { e.preventDefault(); setActiveFilter(filter.trim()); }}><label>{t('ID staf (opsional)', 'Staff ID (optional)')}<Input value={filter} onChange={e => setFilter(e.target.value)} /></label><Button type="submit" variant="secondary">{t('Terapkan filter', 'Apply filter')}</Button></form>}
    {error && <p role="status">{error}</p>}
    {loading && <p role="status">{t('Memuat riwayat…', 'Loading history…')}</p>}
    {!loading && !events.length && !error && <p>{t('Tidak ada catatan.', 'No records.')}</p>}
    {events.map(event => <article key={event.id} className={styles.record}>
      <p><strong>{event.kind === 'IN' ? t('Masuk', 'Check-in') : t('Pulang', 'Check-out')}</strong>{mode === 'review' && ` · ${event.staffId}`}</p>
      <p>{t('Waktu asli', 'Original time')}: {new Date(event.occurredAt).toLocaleString()}</p>
      <p>{t('Waktu berlaku', 'Effective time')}: {new Date(event.effectiveAt).toLocaleString()}</p>
      {event.corrections.map(c => <p key={c.id}>{t('Koreksi', 'Correction')}: {new Date(c.correctedAt).toLocaleString()} · {c.reason} · {c.supervisorId}</p>)}
      {event.correctionsTruncated && <p>{t('Sebagian koreksi lama tidak ditampilkan.', 'Some older corrections are omitted.')}</p>}
      {mode === 'review' && <div className={styles.actions}>{event.evidence && <Button variant="secondary" onClick={() => void showImage(event)}>{t('Lihat foto', 'View photo')}</Button>}<Button variant="secondary" onClick={e => { correctionTrigger.current = e.currentTarget; setSelected(event); }}>{t('Koreksi waktu', 'Correct time')}</Button></div>}
    </article>)}
    {cursor && <Button variant="secondary" onClick={() => void load(cursor)}>{t('Muat berikutnya', 'Load more')}</Button>}
    {image && <div><img className={styles.media} src={image} alt={t('Foto absensi pribadi', 'Private attendance photo')} /><Button variant="secondary" onClick={() => { imageRequest.current++; setImage(''); }}>{t('Tutup foto', 'Close photo')}</Button></div>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open && !busy) { setSelected(null); setReason(''); setWhen(''); } }}><DialogContent className={styles.dialog} onCloseAutoFocus={e => { e.preventDefault(); correctionTrigger.current?.focus(); }}><DialogTitle>{t('Konfirmasi koreksi', 'Confirm correction')}</DialogTitle><DialogDescription>{t('Waktu asli tetap tersimpan.', 'The original time remains recorded.')}</DialogDescription><form onSubmit={e => { e.preventDefault(); void correct(); }} className={styles.record}><label>{t('Waktu yang benar', 'Correct time')}<Input type="datetime-local" required value={when} onChange={e => setWhen(e.target.value)} /></label><label>{t('Alasan (minimal 5 karakter)', 'Reason (at least 5 characters)')}<Input required minLength={5} value={reason} onChange={e => setReason(e.target.value)} /></label><div className={styles.actions}><Button type="submit" disabled={busy}>{t('Konfirmasi koreksi', 'Confirm correction')}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => { setSelected(null); setReason(''); setWhen(''); }}>{t('Batal', 'Cancel')}</Button></div></form></DialogContent></Dialog>
  </section>;
}
