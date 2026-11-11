import type { Attempt } from './api';

export const attemptStoragePrefix='tl-operations-attempt-v2:';
interface StorageLike {readonly length:number;key(index:number):string|null;getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void;}
const scopeKey=(scope:string)=>{
 if(!/^[a-f0-9]{64}$/.test(scope))throw new Error('recovery_scope_invalid');
 return `${attemptStoragePrefix}${scope}:`;
};
function validAttempt(value:unknown):value is Attempt {
 if(!value||typeof value!=='object')return false;
 const a=value as Attempt;
 return typeof a.id==='string'&&/^[a-zA-Z0-9_-]{1,120}$/.test(a.id)&&typeof a.type==='string'&&a.type.length>0
  &&typeof a.userId==='string'&&a.userId.length>0&&typeof a.createdAt==='string'&&Number.isFinite(Date.parse(a.createdAt))
  &&!!a.payload&&typeof a.payload==='object'&&!Array.isArray(a.payload);
}
/** Each identity owns one key: one tab cannot overwrite or remove another command. */
export function persistAttempt(scope:string,attempt:Attempt,storage:StorageLike=localStorage) {
 const prefix=scopeKey(scope);
 if(!validAttempt(attempt))throw new Error('invalid_response');
 const key=prefix+attempt.id,serialized=JSON.stringify(attempt);
 const previous=storage.getItem(key);
 if(previous!==null&&previous!==serialized)throw new Error('idempotency_mismatch');
 try {
  storage.setItem(key,serialized);
  if(storage.getItem(key)!==serialized)throw new Error('recovery_storage_unavailable');
 }catch{throw new Error('recovery_storage_unavailable');}
}
export function pendingAttempts(scope:string,storage:StorageLike=localStorage):Attempt[] {
 const prefix=scopeKey(scope),entries:Attempt[]=[];
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);if(!key?.startsWith(prefix))continue;
  let value:unknown;
  try{value=JSON.parse(storage.getItem(key)||'null');}catch{throw new Error('recovery_storage_invalid');}
  if(!validAttempt(value)||key!==prefix+value.id)throw new Error('recovery_storage_invalid');
  entries.push(value);
 }
 return entries.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
}
export function removeAttempt(scope:string,id:string,storage:StorageLike=localStorage) {
 const prefix=scopeKey(scope);
 if(!/^[a-zA-Z0-9_-]{1,120}$/.test(id))throw new Error('invalid_response');
 const key=prefix+id;storage.removeItem(key);
 if(storage.getItem(key)!==null)throw new Error('recovery_storage_unavailable');
}
