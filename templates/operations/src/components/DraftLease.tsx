import {useEffect,useState,type ReactNode} from 'react';
import {useOperations} from '../lib/store';
import {Button,Notice} from './ui';

/** Keep one mounted editor per durable cart. Browser releases the lock when its tab closes. */
export function DraftLease({name,children}:{name:string;children:ReactNode}) {
 const {t}=useOperations();const [status,setStatus]=useState<'loading'|'ready'|'busy'|'unsupported'|'failed'>('loading'),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true,release=()=>{};setStatus('loading');
  if(!navigator.locks){setStatus('unsupported');return;}
  void navigator.locks.request(name,{ifAvailable:true},async lock=>{
   if(!active)return;if(!lock){setStatus('busy');return;}
   await new Promise<void>(resolve=>{release=resolve;setStatus('ready');});
  }).catch(()=>{if(active)setStatus('failed');});
  return()=>{active=false;release();};
 },[name,retry]);
 if(status==='ready')return <>{children}</>;
 return <Notice kind={status==='loading'?'info':'warning'}>
  <p>{status==='loading'?t('Memeriksa draf lokal…','Checking local draft…'):status==='busy'?t('Draf akun dan lokasi ini sedang dibuka di tab lain. Tutup halaman kasir di tab tersebut sebelum melanjutkan di sini.','This account and location draft is open in another tab. Close that cashier view before continuing here.'):status==='unsupported'?t('Browser ini tidak menyediakan kunci penyuntingan draf. Buka aplikasi melalui HTTPS pada browser yang mendukung Web Locks.','This browser does not provide draft editing locks. Open the app over HTTPS in a browser supporting Web Locks.'):t('Draf belum dapat dikunci untuk penyuntingan. Coba lagi.','The draft could not be locked for editing. Try again.')}</p>
  {status!=='loading'&&<Button variant="outline" onClick={()=>setRetry(n=>n+1)}>{t('Periksa kembali','Check again')}</Button>}
 </Notice>;
}
