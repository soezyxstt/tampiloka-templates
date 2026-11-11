/* These effects synchronize browser resources, persisted operations, and remote lists with React state. */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCafeLanguage } from '@/lib/language';
import styles from './attendance.module.css';
import { AttendanceHistory } from './attendance-history';

type Location = { latitude: number; longitude: number; accuracyMeters: number; capturedAt: string };
type Status = { capabilities: { capture: boolean; review: boolean }; current: { kind: 'IN' | 'OUT'; occurredAt: string } | null; operation?: { id: string } | null };
type Pending = { action: 'record'; outletId: string; kind: 'IN' | 'OUT'; idempotencyKey: string; evidenceKey: string; location: Location };

export function AttendancePage({ tenantSlug, outletSlug }: { tenantSlug: string; outletSlug: string }) {
  const { t } = useCafeLanguage();
  const [access, setAccess] = useState<{ outletId: string; employee: boolean; capabilities: { capture: boolean; review: boolean } } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setAccess(null); setFailed(false);
    const query = new URLSearchParams({ resource: 'capabilities', tenantSlug, outletSlug });
    void fetch(`/api/attendance?${query}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (typeof data.outletId !== 'string' || !data.outletId || typeof data.employee !== 'boolean' || typeof data.supervisor !== 'boolean' || typeof data.tenantId !== 'string' || !data.tenantId || typeof data.capabilities?.capture !== 'boolean' || typeof data.capabilities?.review !== 'boolean' || (!data.employee && data.capabilities.capture) || (!data.supervisor && data.capabilities.review) || (!data.employee && !data.supervisor)) throw new Error();
      setAccess(data);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [tenantSlug, outletSlug]);
  if (!access) return <main className={styles.page}><h1>{t('Absensi', 'Attendance')}</h1><p role="status">{failed ? t('Absensi tidak tersedia atau akses ditolak.', 'Attendance is unavailable or access was denied.') : t('Memuat status…', 'Loading status…')}</p></main>;
  if (!access.employee) return <main className={styles.page}><h1>{t('Absensi', 'Attendance')}</h1>{access.capabilities.review && <AttendanceHistory outletId={access.outletId} review supervisorOnly />}</main>;
  return <AttendanceEmployee outletId={access.outletId} review={access.capabilities.review} captureAllowed={access.capabilities.capture} />;
}

function AttendanceEmployee({ outletId, review, captureAllowed }: { outletId: string; review: boolean; captureAllowed: boolean }) {
  const { t } = useCafeLanguage();
  const [status, setStatus] = useState<Status | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [camera, setCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingBlocked, setPendingBlocked] = useState(true);
  const [pending, setPending] = useState<Pending | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const stop = useCallback(() => { generation.current++; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setCamera(false); setCameraReady(false); }, []);
  useEffect(() => () => { generation.current++; stream.current?.getTracks().forEach(track => track.stop()); }, []);
  useEffect(() => { if (camera && video.current && stream.current) { const token = generation.current; video.current.srcObject = stream.current; void video.current.play().catch(() => { if (token === generation.current) { stop(); setMessage('camera-unavailable'); } }); } }, [camera, stop]);
  useEffect(() => { if (!photo) { setPreview(''); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  const endpoint = useCallback((resource: string, extra = '') => `/api/attendance?${new URLSearchParams({ resource, outletId })}${extra}`, [outletId]);
  const refresh = useCallback(async (key?: string) => {
    const response = await fetch(endpoint('status', key ? `&${new URLSearchParams({ idempotencyKey: key })}` : ''), { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json() as Status;
    if (!data.capabilities || typeof data.capabilities.capture !== 'boolean') throw new Error('contract');
    data.capabilities.capture = data.capabilities.capture && captureAllowed; data.capabilities.review = data.capabilities.review && review; setStatus(data); return data;
  }, [endpoint, captureAllowed, review]);
  useEffect(() => {
    let active = true;
    setPending(null); setPendingBlocked(true);
    void (async () => {
      try {
        const saved = sessionStorage.getItem(`attendance-pending:${outletId}`);
        if (saved) {
          const command = JSON.parse(saved) as Pending;
          if (command.outletId !== outletId || typeof command.evidenceKey !== 'string') throw new Error('pending');
          const response = await fetch(endpoint('status', `&${new URLSearchParams({ pendingEvidenceKey: command.evidenceKey })}`), { cache: 'no-store' });
          if (!response.ok || (await response.json()).pendingOwned !== true) throw new Error('pending');
          if (active) setPending(command);
        }
        if (active) setPendingBlocked(false);
      } catch { if (active) setMessage('pending-unavailable'); }
    })();
    void refresh().catch(() => { if (active) setMessage('unavailable'); });
    return () => { active = false; };
  }, [refresh, outletId, endpoint]);
  function savePending(value: Pending | null) {
    setPending(value);
    try { if (value) sessionStorage.setItem(`attendance-pending:${outletId}`, JSON.stringify(value)); else sessionStorage.removeItem(`attendance-pending:${outletId}`); } catch { /* The open page still retains the operation. */ }
  }
  async function openCamera() {
    stop(); setPhoto(null); setMessage('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setMessage('camera-unavailable'); return; }
    const token = generation.current;
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (token !== generation.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream.current = acquired; setCamera(true);
    } catch (error) {
      if (token !== generation.current) return;
      setMessage(error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError') ? 'camera-denied' : 'camera-unavailable');
    }
  }
  function capture() {
    const node = video.current;
    if (!node?.videoWidth || !node.videoHeight) { setMessage('camera-unavailable'); return; }
    const canvas = document.createElement('canvas'); canvas.width = node.videoWidth; canvas.height = node.videoHeight;
    canvas.getContext('2d')?.drawImage(node, 0, 0);
    stop();
    const token = generation.current;
    canvas.toBlob(blob => { if (token !== generation.current) return; if (!blob || blob.size > 5 * 1024 * 1024 || blob.type !== 'image/jpeg') setMessage('invalid-photo'); else setPhoto(blob); }, 'image/jpeg', 0.85);
  }
  function locate() {
    setLocation(null); setMessage('');
    if (!window.isSecureContext || !navigator.geolocation) { setMessage('location-unavailable'); return; }
    navigator.geolocation.getCurrentPosition(position => setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyMeters: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() }), error => setMessage(error.code === 1 ? 'location-denied' : error.code === 3 ? 'location-timeout' : 'location-unavailable'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  async function submit() {
    if (busy || !status?.capabilities.capture) return;
    setBusy(true); setMessage('');
    try {
      let command = pending;
      if (!command) {
        if (!photo || !location) return;
        const upload = await fetch(endpoint('evidence'), { method: 'POST', body: photo, headers: { 'Content-Type': 'image/jpeg' }, cache: 'no-store' });
        if (!upload.ok) { setMessage('upload'); return; }
        const { evidenceKey } = await upload.json();
        if (!mounted.current) return;
        command = { action: 'record', outletId, kind: status.current?.kind === 'IN' ? 'OUT' : 'IN', idempotencyKey: crypto.randomUUID(), evidenceKey, location };
        savePending(command);
      } else {
        const reconciled = await refresh(command.idempotencyKey);
        if (reconciled.operation) { savePending(null); setPhoto(null); setLocation(null); setMessage('saved'); setHistoryRevision(value => value + 1); return; }
      }
      const response = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command), cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 408 || response.status >= 500) { setMessage('unknown'); return; }
        if (!pending) setMessage(body.error || 'error');
        else setMessage('retry-blocked');
        return;
      }
      const result = await response.json().catch(() => null);
      if (!result || typeof result.id !== 'string' || !result.id) { setMessage('unknown'); return; }
      const confirmed = await refresh(command.idempotencyKey);
      if (!confirmed.operation || confirmed.operation.id !== result.id) { setMessage('unknown'); return; }
      savePending(null); setPhoto(null); setLocation(null); setMessage('saved'); setHistoryRevision(value => value + 1);
    } catch { setMessage('unknown'); } finally { setBusy(false); }
  }
  async function finalize() {
    if (!pending || busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pending, action: 'finalize' }), cache: 'no-store' });
      if (!response.ok) { setMessage('finalize-unknown'); return; }
      const result = await response.json();
      if (result.outcome === 'committed' && typeof result.event?.id === 'string') {
        savePending(null); setPhoto(null); setLocation(null); setMessage('saved'); setHistoryRevision(value => value + 1);
        void refresh().catch(() => {});
      } else if (result.outcome === 'canceled') {
        savePending(null); setPhoto(null); setLocation(null); setMessage('canceled');
        void refresh().catch(() => {});
      } else setMessage('finalize-unknown');
    } catch { setMessage('finalize-unknown'); } finally { setBusy(false); }
  }
  const messages: Record<string, [string, string]> = {
    'pending-unavailable': ['Percobaan tersimpan tidak dapat diverifikasi untuk sesi ini. Hubungi pengelola.', 'The saved attempt cannot be verified for this session. Contact your administrator.'],
    unavailable: ['Absensi belum tersedia. Hubungi pengelola untuk mengatur autentikasi dan kebijakan server.', 'Attendance is unavailable. Ask your administrator to configure server authentication and policy.'],
    'camera-unavailable': ['Kamera tidak tersedia. Gunakan koneksi aman dan periksa perangkat.', 'Camera unavailable. Use a secure connection and check your device.'],
    'camera-denied': ['Izin kamera ditolak. Aktifkan izin kamera lalu coba lagi.', 'Camera permission denied. Enable camera permission and try again.'],
    'location-unavailable': ['Lokasi tidak tersedia. Gunakan koneksi aman dan periksa perangkat.', 'Location unavailable. Use a secure connection and check your device.'],
    'location-denied': ['Izin lokasi ditolak. Aktifkan izin lalu coba lagi.', 'Location permission denied. Enable it and try again.'],
    'location-timeout': ['Permintaan lokasi habis waktu. Coba lagi di tempat terbuka.', 'Location request timed out. Try again outdoors.'],
    'invalid-photo': ['Foto tidak valid atau terlalu besar. Ambil ulang.', 'Photo invalid or too large. Retake it.'],
    upload: ['Foto gagal diunggah. Periksa koneksi dan coba lagi.', 'Photo upload failed. Check your connection and try again.'],
    'retry-blocked': ['Percobaan ulang ditolak. Status belum memastikan hasil; jangan buat absensi baru. Hubungi pengelola untuk memeriksa catatan.', 'The retry was rejected. The result is not confirmed; do not start a new attendance action. Ask an administrator to check the record.'],
    unknown: ['Hasil belum diketahui. Periksa koneksi dan coba periksa lagi; jangan memulai absensi baru.', 'The result is unknown. Check your connection and retry the check; do not start a new attendance action.'],
    'finalize-unknown': ['Pemulihan belum dipastikan. Data percobaan tetap disimpan; coba pulihkan lagi.', 'Recovery is not confirmed. The pending operation is retained; try recovery again.'],
    canceled: ['Percobaan sebelumnya dibatalkan dengan aman. Ambil lokasi dan foto baru untuk memulai lagi.', 'The previous attempt was safely canceled. Capture a new location and photo to start again.'],
    saved: ['Absensi tersimpan.', 'Attendance saved.'],
    LOW_ACCURACY: ['Akurasi lokasi kurang baik. Ambil lokasi ulang di tempat terbuka.', 'Location accuracy is too low. Retry outdoors.'],
    STALE_LOCATION: ['Lokasi sudah terlalu lama. Ambil lokasi ulang.', 'Location is too old. Capture it again.'],
    OUTSIDE_GEOFENCE: ['Anda di luar area absensi atau akurasi lokasi kurang baik. Dekati outlet dan ambil lokasi ulang setelah pemulihan percobaan selesai.', 'You are outside the attendance area or location accuracy is too low. Move closer to the outlet and refresh your location after recovering this attempt.'],
    INVALID_EVIDENCE: ['Foto tidak dapat digunakan. Pulihkan percobaan ini dahulu, lalu ambil foto diri baru.', 'The photo cannot be used. Recover this attempt first, then take a new selfie.'],
    BIOMETRIC_UNAVAILABLE: ['Verifikasi yang diwajibkan belum tersedia. Hubungi pengelola.', 'Required verification is unavailable. Contact your administrator.'],
  };
  const error = messages[message] || [ 'Absensi gagal. Periksa data atau hubungi pengelola.', 'Attendance failed. Check your details or contact your administrator.' ];
  return <main className={styles.page}>
    <h1>{t('Absensi', 'Attendance')}</h1>
    <p>{t('Identitas ditentukan oleh sesi server. Foto dan lokasi tidak membuktikan identitas.', 'Identity comes from the server session. A photo and location do not prove identity.')}</p>
    {message && <p role="status" className={styles.notice}>{t(error[0], error[1])}</p>}
    {!status && !message && <p>{t('Memuat status…', 'Loading status…')}</p>}
    {status && !status.capabilities.capture && <p>{t('Pencatatan absensi tidak tersedia untuk sesi ini.', 'Attendance capture is unavailable for this session.')}</p>}
    {status?.capabilities.capture && !pendingBlocked && <section className={styles.panel}>
      <h2>{t('Status saat ini', 'Current status')}</h2>
      <p>{status.current ? `${status.current.kind === 'IN' ? t('Sudah masuk', 'Checked in') : t('Sudah pulang', 'Checked out')} · ${new Date(status.current.occurredAt).toLocaleString()}` : t('Belum ada catatan', 'No attendance recorded')}</p>
      {!pending && <>
        <Button variant="secondary" onClick={locate}>{t('Ambil lokasi', 'Get location')}</Button>
        {location && <p>{t('Akurasi', 'Accuracy')}: {Math.round(location.accuracyMeters)} m · {new Date(location.capturedAt).toLocaleTimeString()}</p>}
        {!camera && <Button variant="secondary" onClick={openCamera}>{photo ? t('Ambil ulang foto', 'Retake photo') : t('Buka kamera', 'Open camera')}</Button>}
        {camera && <div><video ref={video} className={styles.media} playsInline muted onLoadedData={() => setCameraReady(true)} /><div className={styles.actions}><Button onClick={capture} disabled={!cameraReady}>{t('Ambil foto', 'Take photo')}</Button><Button variant="secondary" onClick={stop}>{t('Tutup kamera', 'Close camera')}</Button></div></div>}
        {preview && <img className={styles.media} src={preview} alt={t('Pratinjau foto absensi', 'Attendance photo preview')} />}
      </>}
      <Button onClick={submit} disabled={busy || (!pending && (!photo || !location))}>{busy ? t('Memproses…', 'Processing…') : pending ? t('Periksa dan coba lagi', 'Check and retry') : status.current?.kind === 'IN' ? t('Kirim absensi pulang', 'Submit check-out') : t('Kirim absensi masuk', 'Submit check-in')}</Button>
      {!pending && (!photo || !location) && <p>{t('Ambil lokasi dan foto sebelum mengirim.', 'Capture your location and photo before submitting.')}</p>}
    </section>}
    {status && pending && !pendingBlocked && <section className={styles.panel}><Button variant="secondary" onClick={finalize} disabled={busy}>{t('Pulihkan percobaan sebelumnya', 'Recover previous attempt')}</Button></section>}
    {status && <AttendanceHistory key={historyRevision} outletId={outletId} review={status.capabilities.review} />}
  </main>;
}
