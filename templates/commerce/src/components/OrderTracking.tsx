import { Copy, Eye, EyeOff, KeyRound, RefreshCw, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Order } from '../shared/contracts';
import { request } from '../lib/api';
import { useCommerce } from '../lib/store';
import { Button, Field, InlineError, Input, Modal } from './ui';
import { OrderDetail } from './OrderDetail';

interface Access { id: string; number: string; code: string }
function getAccess(id: string): string { try { const stored = JSON.parse(sessionStorage.getItem(`tampiloka-tracking-${id}`) || 'null') as Access | null; return stored?.code || ''; } catch { return ''; } }
export function rememberOrderAccess(order: Order) { try { if (order.trackingCode) sessionStorage.setItem(`tampiloka-tracking-${order.id}`, JSON.stringify({ id: order.id, number: order.number, code: order.trackingCode })); } catch { /* An owner can regenerate the code later. */ } }

export function OrderAccess({ order }: { order: Order }) {
  const { notify } = useCommerce(); const [code, setCode] = useState(() => getAccess(order.id)); const [shown, setShown] = useState(false); const [busy, setBusy] = useState(false);
  const create = async () => { setBusy(true); try { const result = await request<{ number: string; code: string }>(`/orders/${encodeURIComponent(order.id)}/tracking-code`, { method: 'POST', body: '{}' }); setCode(result.code); sessionStorage.setItem(`tampiloka-tracking-${order.id}`, JSON.stringify({ id: order.id, ...result })); notify('Kode akses baru dibuat. Kode lama tidak berlaku lagi.'); } catch (cause) { notify(cause instanceof Error ? cause.message : 'Kode belum dapat dibuat.', 'error'); } finally { setBusy(false); } };
  const copy = () => void navigator.clipboard.writeText(`Nomor pesanan: ${order.number}\nKode akses: ${code}`).then(() => notify('Nomor pesanan dan kode akses disalin.')).catch(() => notify('Tampilkan lalu salin kode dari kolom di bawah.', 'error'));
  return <section className="order-access"><div><KeyRound size={20} /><h3>Akses dari perangkat lain</h3></div><p>Simpan nomor pesanan dan kode ini. Orang yang memegang kode dapat melihat rincian pesanan.</p>{code ? <div className="access-code"><Input type={shown ? 'text' : 'password'} aria-label="Kode akses pesanan" readOnly value={code} /><Button variant="quiet" compact onClick={() => setShown(!shown)} aria-label={shown ? 'Sembunyikan kode akses' : 'Tampilkan kode akses'}>{shown ? <EyeOff size={17} /> : <Eye size={17} />}</Button><Button variant="secondary" compact onClick={copy}><Copy size={15} />Salin</Button></div> : <Button variant="secondary" compact loading={busy} onClick={() => void create()}><KeyRound size={15} />Buat kode akses</Button>}<details><summary>Ganti kode akses</summary><p>Kode lama akan berhenti bekerja.</p><Button variant="secondary" compact loading={busy} onClick={() => void create()}><RefreshCw size={15} />Buat kode baru</Button></details></section>;
}

export function TrackOrder() {
  const [number, setNumber] = useState(''); const [code, setCode] = useState(''); const [order, setOrder] = useState<Order | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { setOrder(await request<Order>('/orders/track', { method: 'POST', body: JSON.stringify({ number: number.trim(), code: code.trim() }) })); setCode(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Pesanan belum ditemukan.'); } finally { setBusy(false); } };
  return <><details className="track-order"><summary>Lacak pesanan dengan kode akses</summary><p>Masukkan nomor pesanan dan kode akses yang disimpan saat membuat pesanan.</p><form onSubmit={submit}><Field label="Nomor pesanan"><Input required value={number} onChange={event => setNumber(event.target.value)} placeholder="RPA-..." autoComplete="off" /></Field><Field label="Kode akses"><Input type="password" required value={code} onChange={event => setCode(event.target.value)} autoComplete="off" /></Field><Button type="submit" loading={busy}><Search size={17} />Lacak</Button><InlineError>{error}</InlineError></form></details><Modal open={Boolean(order)} onClose={() => setOrder(null)} title={order?.number || 'Lacak pesanan'} size="wide">{order && <OrderDetail order={order} readOnly />}</Modal></>;
}
