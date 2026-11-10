import { useOperations } from '../lib/store';
import { Disclosure, Empty, Notice, Table } from '../components/ui';
import { RouteLink } from '../components/Workspace';

type ReportData = ReturnType<typeof import('../domain/report').report>;

export function ReportDetails({data}:{data:ReportData}) {
 const {state,t}=useOperations();
 const location=(id:string)=>state?.locations.find(l=>l.id===id)?.name||state?.transferDestinations.find(l=>l.id===id)?.name||id;
 const product=(id:string)=>state?.products.find(p=>p.id===id);
 const empty=<Empty>{t('Tidak ada catatan sesuai filter.','No records match the filters.')}</Empty>;
 const statusLabels:Record<string,string>={confirmed:t('Terkonfirmasi','Confirmed'),review:t('Perlu diperiksa','Under review'),pending:t('Menunggu konfirmasi','Pending'),failed:t('Gagal','Failed'),not_required:t('Tidak diperlukan','Not required'),draft:t('Draf','Draft'),sent:t('Dalam perjalanan','In transit'),arrived:t('Tiba belum dibukukan','Arrived, unposted'),discrepancy:t('Selisih terbuka','Open discrepancy'),closed:t('Selesai','Closed'),cancelled:t('Dibatalkan','Cancelled'),counting:t('Sedang dihitung','Counting'),recorded:t('Tercatat','Recorded')};
 const status=(value:string)=>statusLabels[value]||value;
 return <>
  <Disclosure title={t('Saldo sampai akhir periode','Balances through period end')}>
   <p>{t('Saldo mengakumulasi mutasi sampai batas akhir, termasuk mutasi sebelum batas mulai. Barang dalam perjalanan ditampilkan di lokasi asal.','Balances accumulate movements through the end, including movements before the start. In-transit goods appear at the origin.')}</p>
   <Table headers={[t('SKU / lokasi','SKU / location'),t('Layak jual','Sellable'),t('Ditahan','Held'),t('Dalam perjalanan','In transit'),t('Satuan','Unit')]}>
    {data.balances.map(b=><tr key={`${b.locationId}-${b.productId}`}><td>{product(b.productId)?.sku||b.productId}<br/>{location(b.locationId)}</td><td>{b.sellable}{b.negative&&<small> · {t('Minus','Negative')}</small>}</td><td>{b.held}</td><td>{b.transit}</td><td>{product(b.productId)?.baseUnit}</td></tr>)}
   </Table>{!data.balances.length&&empty}
  </Disclosure>
  <Disclosure title={t('Penerimaan pembayaran','Payment receipts')}>
   <Table headers={[t('Sumber / waktu','Source / time'),t('Lokasi','Location'),t('Metode / status','Method / status'),t('Nilai teralokasi (IDR)','Allocated amount (IDR)')]}>
    {data.payments.map(p=><tr key={p.id}><td><RouteLink page="audit" document={p.id}>{p.id}</RouteLink><br/>{p.recordedAt}</td><td>{location(p.locationId)}</td><td>{p.method==='cash'?t('Tunai','Cash'):t('Nontunai','Noncash')} · {status(p.status)}</td><td>{p.selection.amount}</td></tr>)}
   </Table>{!data.payments.length&&empty}
  </Disclosure>
  <Disclosure title={t('Pengembalian dana','Refunds')}>
   <Table headers={[t('Dokumen / waktu','Document / time'),t('Lokasi','Location'),t('Sumber pembayaran','Payment source'),t('Nilai (IDR)','Amount (IDR)')]}>
    {data.refunds.map(r=><tr key={r.id}><td><RouteLink page="audit" document={r.id}>{r.id}</RouteLink><br/>{r.recordedAt}</td><td>{location(r.locationId)}</td><td>{r.paymentId}</td><td>{r.selection.amount}</td></tr>)}
   </Table>{!data.refunds.length&&empty}
  </Disclosure>
  {(data.unattributedPayments.length>0||data.unattributedRefunds.length>0)&&<Disclosure title={t('Uang tanpa alokasi SKU','Money without SKU allocation')}>
   <Notice>{t('Catatan ini mengikuti lokasi dan waktu, bukan SKU. Tanpa filter SKU, nilainya sudah termasuk total; jangan dijumlahkan kembali.','These records follow location and time, not SKU. Without a SKU filter their amounts are already included in totals; do not add them again.')}</Notice>
   <Table headers={[t('Sumber','Source'),t('Lokasi','Location'),t('Jenis / status','Kind / status'),t('Nilai (IDR)','Amount (IDR)')]}>
    {data.unattributedPayments.map(p=><tr key={`payment-${p.id}`}><td>{p.id}</td><td>{location(p.locationId)}</td><td>{t('Pembayaran','Payment')} · {status(p.status)}</td><td>{p.amount}</td></tr>)}
    {data.unattributedRefunds.map(r=><tr key={`refund-${r.id}`}><td>{r.id}</td><td>{location(r.locationId)}</td><td>{t('Refund tanpa alokasi','Unallocated refund')}</td><td>{r.amount}</td></tr>)}
   </Table>
  </Disclosure>}
  <p className="op-muted">{t('Status dokumen menunjukkan kondisi saat ini.','Document statuses show their current state.')}</p>
  <Disclosure title={t('Pengiriman','Shipments')}>
   <Table headers={[t('Dokumen','Document'),t('Asal / tujuan','Origin / destination'),t('Status terkini','Current status'),t('SKU terpilih','Selected SKUs')]}>
    {data.transfers.map(r=><tr key={r.id}><td><RouteLink page="shipments" document={r.id}>{r.id}</RouteLink></td><td>{location(r.fromId)}<br/>{location(r.toId)}</td><td>{status(r.status)}</td><td>{r.selection.lines.map(l=>product(l.productId)?.sku||l.productId).join(', ')}</td></tr>)}
   </Table>{!data.transfers.length&&empty}
  </Disclosure>
  <Disclosure title={t('Opname','Stock counts')}>
   <Table headers={[t('Dokumen / SKU','Document / SKU'),t('Lokasi','Location'),t('Batas hitung','Count cutoff'),t('Status / penyesuaian','Status / adjustment')]}>
    {data.counts.map(c=><tr key={c.id}><td><RouteLink page="counts" document={c.id}>{c.id}</RouteLink><br/>{product(c.productId)?.sku||c.productId}</td><td>{location(c.locationId)}</td><td>{c.cutoff}</td><td>{status(c.status)} · {c.adjustment??'—'}</td></tr>)}
   </Table>{!data.counts.length&&empty}
  </Disclosure>
  {!data.filters.productId&&<Disclosure title={t('Sif dan arus kas','Shifts and cash movements')}>
   <Table headers={[t('Sif / lokasi','Shift / location'),t('Dibuka / ditutup','Opened / closed'),t('Kas diharapkan','Expected cash'),t('Kas dihitung / selisih','Counted cash / variance')]}>
    {data.shifts.map(s=><tr key={s.id}><td>{s.id}<br/>{location(s.locationId)}</td><td>{s.openedAt}<br/>{s.closedAt||t('Masih terbuka','Still open')}</td><td>{s.expectedCash??'—'}</td><td>{s.countedCash??'—'} / {s.variance??'—'}</td></tr>)}
   </Table>{!data.shifts.length&&empty}
   <Table headers={[t('Sumber / sif','Source / shift'),t('Waktu pencatatan','Recorded at'),t('Alasan','Reason'),t('Nilai (IDR)','Amount (IDR)')]}>
    {data.cashEntries.map(e=><tr key={e.id}><td>{e.id}<br/>{e.shiftId}</td><td>{e.recordedAt}</td><td>{e.reason}</td><td>{e.amount}</td></tr>)}
   </Table>{!data.cashEntries.length&&empty}
  </Disclosure>}
  <Disclosure title={t('Perlu ditinjau','Current exceptions')}>
   <Table headers={[t('Sumber','Source'),t('Lokasi / SKU','Location / SKU'),t('Tindak lanjut','Follow-up'),t('Jumlah','Quantity')]}>
    {data.exceptions.map((e,i)=><tr key={`${e.documentId}-${e.productId}-${i}`}><td><RouteLink page="audit" document={e.documentId}>{e.documentId}</RouteLink></td><td>{location(e.locationId)}<br/>{e.productId?product(e.productId)?.sku||e.productId:'—'}</td><td>{({negative:t('Periksa stok minus','Review negative stock'),discrepancy:t('Selesaikan selisih','Resolve discrepancy'),awaiting_receipt:t('Bukukan barang tiba','Post arrived goods'),in_transit:t('Pantau penerimaan','Track receipt'),approval:t('Perlu persetujuan','Approval required')} as Record<string,string>)[e.type]||e.type}</td><td>{e.quantity??'—'}</td></tr>)}
   </Table>{!data.exceptions.length&&empty}
  </Disclosure>
  <Disclosure title={t('Dokumen pendukung','Supporting documents')}>
   <Table headers={[t('Dokumen','Document'),t('Sumber terkait','Related source'),t('Waktu kejadian / pencatatan','Occurred / recorded'),t('Alasan','Reason')]}>
    {data.documents.map(d=><tr key={d.id}><td><RouteLink page="audit" document={d.id}>{d.id}</RouteLink></td><td>{d.sourceId||'—'}</td><td>{d.occurredAt}<br/>{d.recordedAt}</td><td>{d.reason}</td></tr>)}
   </Table>{!data.documents.length&&empty}
  </Disclosure>
 </>;
}
