import type { Transfer } from '../domain/contract';
import { useOperations } from '../lib/store';
import { Button, Table } from './ui';

export function ShipmentDocument({transfer}:{transfer:Transfer}) {
 const {state,t}=useOperations();
 const location=(id:string)=>state?.locations.find(l=>l.id===id)?.name||state?.transferDestinations.find(l=>l.id===id)?.name||id;
 return <div className="op-stack">
  <strong>{state?.businessName}</strong>
  <h3>{t('Dokumen pengiriman','Shipment document')} · {transfer.id}</h3>
  <p>{t('Dibuat','Created')}: {transfer.createdAt}</p>
  <dl className="op-record">
   <dt>{t('Asal','Origin')}</dt><dd>{location(transfer.fromId)}</dd>
   <dt>{t('Tujuan','Destination')}</dt><dd>{location(transfer.toId)}</dd>
   <dt>{t('Tiba','Arrived')}</dt><dd>{transfer.arrivedAt||t('Belum ditandai','Not marked')}</dd>
  </dl>
  {transfer.status==='draft'&&<strong>{t('Draf — barang belum dikirim','Draft — dispatch has not been finalized')}</strong>}
  {transfer.status==='cancelled'&&<strong>{t('Dokumen dibatalkan','Document cancelled')}</strong>}
  <Table headers={[t('SKU / barang','SKU / item'),t('Rencana / satuan','Planned / unit'),t('Faktor saat kirim','Dispatch factor'),t('Dikirim (dasar)','Dispatched (base)'),t('Kondisi asal','Original condition')]}>
   {transfer.lines.map((line,i)=><tr key={`${line.productId}-${i}`}><td>{state?.products.find(p=>p.id===line.productId)?.sku||line.productId}<br/>{state?.products.find(p=>p.id===line.productId)?.name}</td><td>{line.quantity} {line.unit}</td><td>{line.factor}</td><td>{line.sent}</td><td>{line.condition==='held'?t('Ditahan','Held'):t('Layak jual','Sellable')}</td></tr>)}
  </Table>
  <p>{t('Penerima memeriksa jumlah dan kondisi, lalu membukukan penerimaan melalui sistem. Cetakan ini tidak menambah stok tujuan.','The receiver checks quantities and conditions, then posts receipt in the system. This printout does not increase destination stock.')}</p>
  <p>{t('Petugas pengirim','Dispatch officer')}: ____________________</p>
  <p>{t('Petugas penerima / waktu pemeriksaan','Receiving officer / inspection time')}: ____________________</p>
  <small>{t('Ringkasan dokumen pada revisi','Document summary at revision')} {state?.revision}. {t('Nama mengikuti data induk saat cetak; satuan dan faktor mengikuti dokumen.','Names follow master data at printing; units and factors follow the document.')}</small>
  <Button variant="outline" onClick={()=>window.print()}>{t('Cetak dokumen','Print document')}</Button>
 </div>;
}
