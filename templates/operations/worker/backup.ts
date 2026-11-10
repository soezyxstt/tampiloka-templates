import { check, canonical } from '../src/domain/core.ts';
import type { Env } from './types.ts';

export const BACKUP_MAX_BYTES = 10 * 1024 * 1024;
export const BACKUP_MAX_COMMANDS = 10000;
const encoder = new TextEncoder();
export interface BackupObject { key:string; uploaded:Date; size:number; }
export interface BackupBucket {
 put(key:string,value:string,options?:{httpMetadata:{contentType:string}}):Promise<unknown>;
 get(key:string):Promise<{size:number;text():Promise<string>}|null>;
 list(options:{prefix:string;limit:number;cursor?:string}):Promise<{objects:BackupObject[];truncated:boolean;cursor?:string}>;
 delete(keys:string[]):Promise<void>;
}
export interface BackupStatus {
 lastAttemptAt?:string; outcome?:'success'|'failed'; errorCode?:string;
 lastSuccess?:{key:string;createdAt:string;verifiedAt:string;bytes:number;revision:number};
 cleanupCursor?:string; cleanupDeleted?:number;
}
export function backupPolicy(env:Env,businessId:string,preset:string) {
 check(env.DEMO_MODE==='false','BACKUP_REAL_ONLY','Scheduled backups require explicit real installation mode');
 check(env.BACKUP_ENABLED==='true','BACKUP_DISABLED','Scheduled backups are disabled');
 check(env.BACKUPS&&env.BACKUP_SECRET&&env.BACKUP_SECRET.length>=32,'BACKUP_NOT_CONFIGURED','Backup bucket and signing secret required');
 const integer=(v:string|undefined,min:number,max:number)=>{check(v&&/^\d+$/.test(v)&&Number(v)>=min&&Number(v)<=max,'BACKUP_POLICY','Explicit bounded backup policy required');return Number(v);};
 const retentionDays=integer(env.BACKUP_RETENTION_DAYS,1,3650),cleanupLimit=integer(env.BACKUP_CLEANUP_LIMIT,1,100);
 check(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(businessId)&&['food','retail','supplies'].includes(preset),'BACKUP_IDENTITY','Invalid backup scope');
 return {bucket:env.BACKUPS!,secret:env.BACKUP_SECRET!,retentionDays,cleanupLimit,prefix:`operations-backups/v1/${businessId}/${preset}/`};
}
async function key(secret:string) {return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function signBackup(backup:unknown,secret:string) {
 const signature=await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(canonical(backup)));
 return {backup,signature:Array.from(new Uint8Array(signature),n=>n.toString(16).padStart(2,'0')).join('')};
}
export async function verifyBackup(text:string,secret:string) {
 check(encoder.encode(text).byteLength<=BACKUP_MAX_BYTES,'BACKUP_TOO_LARGE','Backup exceeds restore body limit');
 const envelope=JSON.parse(text);
 check(envelope&&typeof envelope.signature==='string'&&/^[a-f0-9]{64}$/.test(envelope.signature),'BACKUP_SIGNATURE','Invalid signed envelope');
 const signature=Uint8Array.from(envelope.signature.match(/../g) as string[],v=>parseInt(v,16));
 check(await crypto.subtle.verify('HMAC',await key(secret),signature,encoder.encode(canonical(envelope.backup))),'BACKUP_SIGNATURE','Backup integrity check failed');
 return envelope.backup;
}
/** No cleanup until a complete signed envelope has been written and read back. */
export async function writeBackup(policy:ReturnType<typeof backupPolicy>,backup:{createdAt:string;state:{revision:number}},now:string) {
 const text=JSON.stringify(await signBackup(backup,policy.secret)),bytes=encoder.encode(text).byteLength;
 check(bytes<=BACKUP_MAX_BYTES,'BACKUP_TOO_LARGE','Backup exceeds restore body limit');
 const objectKey=`${policy.prefix}${backup.createdAt}-${crypto.randomUUID()}.json`;
 await policy.bucket.put(objectKey,text,{httpMetadata:{contentType:'application/json'}});
 const stored=await policy.bucket.get(objectKey);
 check(stored&&stored.size===bytes&&stored.size<=BACKUP_MAX_BYTES,'BACKUP_VERIFY','Stored backup length mismatch');
 const copy=await stored!.text();
 await verifyBackup(copy,policy.secret);
 check(copy===text,'BACKUP_VERIFY','Stored backup differs from captured snapshot');
 return {key:objectKey,createdAt:backup.createdAt,verifiedAt:now,bytes,revision:backup.state.revision};
}
export async function pruneBackups(policy:ReturnType<typeof backupPolicy>,keep:string[],cursor:string|undefined,now:number) {
 const page=await policy.bucket.list({prefix:policy.prefix,limit:policy.cleanupLimit,...(cursor?{cursor}:{})});
 check(page.objects.length<=policy.cleanupLimit,'BACKUP_CLEANUP','Bucket exceeded cleanup bound');
 const cutoff=now-policy.retentionDays*86400000;
 const expired=page.objects.filter(object=>{
 if(!object.key.startsWith(policy.prefix)||keep.includes(object.key))return false;
 const suffix=object.key.slice(policy.prefix.length);
 // Only this writer's exact file format; never delete another directory or a caller-supplied prefix.
 return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z-[a-f0-9-]{36}\.json$/.test(suffix)&&object.uploaded.getTime()<cutoff;
 }).map(object=>object.key);
 if(expired.length)await policy.bucket.delete(expired);
 return {cleanupDeleted:expired.length,cleanupCursor:page.truncated?page.cursor:undefined};
}
