import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/shadcn/table';
import { Button as ShadcnButton } from '../components/shadcn/button';
import { Input, Select, Textarea } from '../components/ui';
import { ArrowRight, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Order, StaffSnapshot } from '../shared/contracts';
import { api, type StaffOrderPage } from '../lib/api';
import { useCommerce } from '../lib/store';
import { dateTime, money, orderLabels, paymentLabels } from '../lib/format';
import { OrderDetail } from '../components/OrderDetail';
import { Button, EmptyState, Field, InlineError, Modal } from '../components/ui';

const PAGE_SIZE = 50;

export function StaffOrders({ snapshot, reload }: { snapshot: StaffSnapshot; reload: () => Promise<void> }) {
  const { notify } = useCommerce();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<(StaffOrderPage & { key: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const requestKey = JSON.stringify([query.trim(), status, page]);
  const writable = snapshot.role !== 'viewer';
  const owner = snapshot.role === 'owner';

  useEffect(() => {
    const ticket = ++sequence.current;
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true);
    setListError('');
    api.staffOrders({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, q: query.trim(), status }, controller.signal)
      .then(response => {
        if (ticket !== sequence.current) return;
        if (page > 0 && response.offset >= response.total) {
          setPage(Math.max(0, Math.ceil(response.total / PAGE_SIZE) - 1));
          return;
        }
        setResult({ ...response, key: requestKey });
        setSelected(current => current ? response.orders.find(order => order.id === current.id) || current : null);
      })
      .catch(cause => {
        if (ticket !== sequence.current || controller.signal.aborted) return;
        setListError(cause instanceof Error ? cause.message : 'Daftar pesanan belum dapat dimuat.');
      })
      .finally(() => { if (ticket === sequence.current) setLoading(false); });
    return () => { controller.abort(); if (ticket === sequence.current) sequence.current++; };
  }, [page, query, status, requestKey, revision, snapshot]);

  const current = result?.key === requestKey && !loading && !listError ? result : null;
  const orders = current?.orders || [];
  const pages = current ? Math.max(1, Math.ceil(current.total / PAGE_SIZE)) : 1;
  const changeQuery = (value: string) => { setQuery(value); setPage(0); };
  const changeStatus = (value: string) => { setStatus(value); setPage(0); };
  const chooseAction = (value: string) => { setAction(value); setNote(''); setReference(''); setCarrier(selected?.carrier || ''); setTracking(selected?.trackingNumber || ''); setError(''); };
  const execute = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const updated = await api.staffAction(selected.id, action, { note, reference, carrier, trackingNumber: tracking });
      // A list response started before this action must not overwrite its newer detail.
      sequence.current++;
      requestController.current?.abort();
      setSelected(updated);
      setAction('');
      setRevision(value => value + 1);
      notify('Pesanan diperbarui.');
      void reload().catch(() => notify('Pesanan tersimpan. Ringkasan toko belum dapat dimuat ulang.', 'error'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Pesanan belum berubah.'); }
    finally { setBusy(false); }
  };
  const exportOrders = () => { const link = document.createElement('a'); link.href = '/api/staff/export/orders.csv'; link.download = 'pesanan-rupa.csv'; link.click(); };
  const actionLabels: Record<string, string> = { 'confirm-payment': 'Konfirmasi pembayaran', process: 'Mulai siapkan', ship: 'Kirim pesanan', complete: 'Selesaikan pesanan', cancel: 'Batalkan pesanan', 'approve-return': 'Setujui retur', 'reject-return': 'Tolak retur', 'receive-return': 'Terima barang retur', refund: 'Catat pengembalian dana' };
  return <><div className="workspace-section-heading"><div><h2>Pesanan</h2><p>Cari dan kelola seluruh pesanan toko.</p></div><Button variant="secondary" compact onClick={exportOrders}><Download size={16} />Ekspor CSV</Button></div><div className="workspace-filters"><label className="search-field"><Search size={17} /><Input aria-label="Cari pesanan" placeholder="Nomor, nama, atau telepon..." maxLength={100} value={query} onChange={event => changeQuery(event.target.value)} /></label><Select aria-label="Filter status pesanan" value={status} onChange={event => changeStatus(event.target.value)}><option value="all">Semua status</option><option value="verification">Perlu cek pembayaran</option>{Object.entries(orderLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}<option value="returns">Retur aktif</option></Select></div><div className="order-result-summary" role="status" aria-live="polite">{current ? current.total ? `Menampilkan ${current.offset + 1} sampai ${current.offset + orders.length} dari ${current.total} pesanan` : '0 pesanan ditemukan' : listError ? 'Daftar belum dapat dimuat' : 'Memuat pesanan...'}</div><InlineError>{listError}</InlineError>{listError ? <Button variant="secondary" compact onClick={() => setRevision(value => value + 1)}>Coba lagi</Button> : !current ? <div className="loading-state" aria-hidden="true">Menyiapkan daftar pesanan...</div> : orders.length ? <div className="table-scroll"><Table className="data-table order-table"><TableHeader><TableRow><TableHead>Pesanan</TableHead><TableHead>Pelanggan</TableHead><TableHead>Status</TableHead><TableHead>Pembayaran</TableHead><TableHead>Total</TableHead><TableHead><span className="sr-only">Aksi</span></TableHead></TableRow></TableHeader><TableBody>{orders.map(order => <TableRow key={order.id}><TableCell><ShadcnButton variant="unstyled" size="none" className="table-link" onClick={() => setSelected(order)}>{order.number}</ShadcnButton><small>{dateTime(order.createdAt)}</small></TableCell><TableCell><strong>{order.customer.name}</strong><small>{order.items.reduce((n, line) => n + line.quantity, 0)} produk</small></TableCell><TableCell><span className={`status status-${order.status}`}>{orderLabels[order.status]}</span></TableCell><TableCell><span className={`status status-payment-${order.paymentStatus}`}>{paymentLabels[order.paymentStatus]}</span></TableCell><TableCell className="numeric"><strong>{money(order.total)}</strong></TableCell><TableCell><Button variant="quiet" compact onClick={() => setSelected(order)} aria-label={`Lihat pesanan ${order.number}`}><ArrowRight size={17} /></Button></TableCell></TableRow>)}</TableBody></Table></div> : <EmptyState title="Belum ada pesanan yang sesuai" description={query || status !== 'all' ? 'Coba kata kunci atau status lain.' : 'Pesanan dari checkout pembeli akan muncul di sini.'} />}<nav className="order-pagination" aria-label="Halaman pesanan"><span>{current ? `Halaman ${page + 1} dari ${pages}` : '50 pesanan per halaman'}</span><div><Button variant="secondary" compact disabled={!current || page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft size={16} />Sebelumnya</Button><Button variant="secondary" compact disabled={!current || !current.hasMore} onClick={() => setPage(value => value + 1)}>Berikutnya<ChevronRight size={16} /></Button></div></nav>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.number || 'Detail pesanan'} size="wide">{selected && <OrderDetail order={selected}>{writable ? <div className="order-actions">{selected.paymentMethod !== 'midtrans' && ['unpaid', 'pending', 'pending_verification'].includes(selected.paymentStatus) && selected.status !== 'cancelled' && <Button onClick={() => chooseAction('confirm-payment')}>Konfirmasi pembayaran</Button>}{selected.status === 'confirmed' && <Button onClick={() => chooseAction('process')}>Mulai siapkan</Button>}{selected.status === 'processing' && <Button onClick={() => chooseAction('ship')}>{selected.shippingMethod.requiresAddress ? 'Kirim pesanan' : 'Siap diambil'}</Button>}{selected.status === 'shipped' && selected.paymentStatus === 'paid' && <Button onClick={() => chooseAction('complete')}>Selesaikan</Button>}{!['cancelled', 'completed', 'shipped'].includes(selected.status) && <Button variant="secondary" onClick={() => chooseAction('cancel')}>Batalkan</Button>}{snapshot.capabilities.returns && selected.returnStatus === 'requested' && <><Button onClick={() => chooseAction('approve-return')}>Setujui retur</Button><Button variant="secondary" onClick={() => chooseAction('reject-return')}>Tolak retur</Button></>}{selected.returnStatus === 'approved' && <Button onClick={() => chooseAction('receive-return')}>Barang retur diterima</Button>}{owner && (selected.paymentStatus === 'refund_due' || selected.returnStatus === 'received') && <Button variant="secondary" onClick={() => chooseAction('refund')}>Kembalikan dana</Button>}</div> : <p className="help-text">Akses pembaca hanya dapat melihat pesanan.</p>}</OrderDetail>}</Modal>
    <Modal open={Boolean(action)} onClose={() => setAction('')} title={action === 'ship' && !selected?.shippingMethod.requiresAddress ? 'Pesanan siap diambil' : actionLabels[action] || 'Perbarui pesanan'}><form onSubmit={execute} className="dialog-form">{action === 'ship' && selected?.shippingMethod.requiresAddress && <><Field label="Kurir"><Input required value={carrier} onChange={event => setCarrier(event.target.value)} placeholder="JNE, J&T, kurir toko, atau ambil langsung" maxLength={80} /></Field><Field label="Nomor resi / bukti serah terima"><Input required value={tracking} onChange={event => setTracking(event.target.value)} maxLength={100} /></Field></>}{['confirm-payment', 'refund'].includes(action) && <Field label="Referensi transaksi"><Input required value={reference} onChange={event => setReference(event.target.value)} placeholder="Nomor transaksi atau bukti pencatatan" maxLength={200} /></Field>}<Field label={['cancel', 'reject-return', 'refund'].includes(action) ? 'Alasan / catatan' : 'Catatan (opsional)'}><Textarea required={['cancel', 'reject-return', 'refund'].includes(action)} rows={3} value={note} onChange={event => setNote(event.target.value)} maxLength={1000} /></Field>{action === 'confirm-payment' && <p className="help-text">Pastikan pembayaran {selected && money(selected.total)} sudah diterima sebelum mengonfirmasi.</p>}{action === 'refund' && <p className="help-text">Pembayaran manual memerlukan pengembalian dana di luar aplikasi. Catat hanya setelah dana benar-benar dikirim. Gateway mengikuti status dari penyedia pembayaran.</p>}<InlineError>{error}</InlineError><div className="dialog-actions"><Button variant="secondary" onClick={() => setAction('')}>Kembali</Button><Button type="submit" variant={action === 'cancel' ? 'danger' : 'primary'} loading={busy}>{action === 'ship' && !selected?.shippingMethod.requiresAddress ? 'Tandai siap diambil' : actionLabels[action]}</Button></div></form></Modal></>;
}
