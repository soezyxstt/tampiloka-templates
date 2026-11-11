import { useEffect, useState } from 'react';
import type { BackupStatus } from '../../worker/backup';
import { request } from '../lib/api';
import { useErrorText, useOperations } from '../lib/store';
import { Button, Notice, Panel } from './ui';

type Status = Omit<BackupStatus,'cleanupCursor'> & {enabled:boolean;retentionDays:string|null};
export function BackupStatusPanel(){
 const {state,session,t}=useOperations(),errorText=useErrorText();
 const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState<unknown>(null),[loading,setLoading]=useState(false),[reload,setReload]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setStatus(null);setError(null);
  request<Status>('/api/backup/status').then(value=>{if(active)setStatus(value);}).catch(e=>{if(active)setError(e);}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[state?.businessId,session?.user?.id,reload]);
 return <Panel title={t('Cadangan terjadwal','Scheduled backups')} action={<Button variant="outline" disabled={loading} onClick={()=>setReload(v=>v+1)}>{t('Periksa status','Check status')}</Button>}>
  <div className="op-stack">
   {loading&&<Notice>{t('Memuat status cadangan…','Loading backup status…')}</Notice>}
   {error?<Notice kind="danger">{errorText(error)}</Notice>:typeof error==='number'||typeof error==='bigint'?error:null}
   {status&&<>
    <p>{status.enabled?t('Pencadangan otomatis aktif.','Automatic backups enabled.'):t('Pencadangan otomatis belum aktif.','Automatic backups are not enabled.')}</p>
    {status.outcome==='failed'&&<Notice kind="warning">{t('Percobaan cadangan atau pembersihan terakhir gagal. Periksa konfigurasi dan penyimpanan; cadangan berhasil sebelumnya tetap tercatat.','The latest backup or cleanup attempt failed. Check configuration and storage; the previous successful backup remains recorded.')} · {status.errorCode}</Notice>}
    <dl className="op-record">
     <dt>{t('Percobaan terakhir','Last attempt')}</dt><dd>{status.lastAttemptAt||t('Belum tercatat','Not recorded')}</dd>
     <dt>{t('Cadangan terakhir','Last backup')}</dt><dd>{status.lastSuccess?.verifiedAt||t('Belum tersedia','Not available yet')}</dd>
     <dt>{t('Revisi yang dicadangkan','Backed-up revision')}</dt><dd>{status.lastSuccess?.revision??'—'}</dd>
     <dt>{t('Masa penyimpanan','Retention period')}</dt><dd>{status.retentionDays?`${status.retentionDays} ${t('hari','days')}`:t('Belum ditetapkan','Not configured')}</dd>
    </dl>
    
   </>}
  </div>
 </Panel>;
}
