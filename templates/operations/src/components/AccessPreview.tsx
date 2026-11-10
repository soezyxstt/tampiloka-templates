import type { Location, Role, User } from '../domain/contract';
import { can, owner } from '../domain/core';
import { useOperations } from '../lib/store';
import { Empty, Notice, Table } from './ui';

const roles: [Role, string, string][] = [
 ['owner','Pengelola','Owner'],['inventory','Persediaan','Inventory'],
 ['receiver','Penerima','Receiver'],['cashier','Kasir','Cashier'],
 ['pricing','Pengelola harga','Pricing'],['auditor','Pemeriksa','Auditor'],
];
/** Uses the domain permission predicate, never a Cartesian product of assignments. */
export function AccessPreview({user,locations}:{user:User;locations:Location[]}) {
 const {t}=useOperations();
 if(!user.active)return <Notice>{t('Akun nonaktif tidak memiliki hak efektif dan tidak dapat masuk.','An inactive account has no effective permissions and cannot sign in.')}</Notice>;
 const scope=[{id:'*',name:t('Seluruh usaha','Entire business'),active:true},...locations];
 const rows=scope.map(location=>({location,allowed:roles.filter(([role])=>can(user,role,location.id))})).filter(row=>row.allowed.length);
 return <div className="op-stack">
  <h3>{t('Pratinjau hak efektif','Effective permissions preview')}</h3>
  {owner(user)&&<Notice>{t('Pengelola memiliki seluruh peran di semua lokasi, termasuk lokasi yang ditambahkan kemudian.','An owner has every role at all locations, including locations added later.')}</Notice>}
  {rows.length?<Table headers={[t('Cakupan','Scope'),t('Peran yang berlaku','Effective roles')]}>{rows.map(({location,allowed})=><tr key={location.id}><td>{location.name}{!location.active&&<><br/><small>{t('Lokasi nonaktif: transaksi baru tetap dibatasi','Inactive location: new transactions remain restricted')}</small></>}</td><td>{allowed.map(([,id,en])=>t(id,en)).join(', ')}</td></tr>)}</Table>:<Empty>{t('Belum ada hak efektif. Tambahkan pasangan peran dan lokasi.','No effective permissions yet. Add role and location pairs.')}</Empty>}
  <small>{t('Pratinjau menunjukkan penugasan yang akan disimpan. Setiap transaksi tetap memeriksa fitur aktif, status dokumen, persetujuan dan aturan usaha.','This preview shows the assignments to be saved. Each transaction still checks enabled features, document status, approval and business rules.')}</small>
 </div>;
}
