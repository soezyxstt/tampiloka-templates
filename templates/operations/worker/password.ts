import { check } from '../src/domain/core.ts';
/** Versioned, Worker-compatible KDF. Each pass stays within workerd's PBKDF2 cap. */
export async function passwordHash(password: string, salt: Uint8Array, iterations: number, passes: number): Promise<ArrayBuffer> {
 check(Number.isSafeInteger(iterations)&&iterations>=100000&&iterations<=100000&&Number.isSafeInteger(passes)&&passes>=3&&passes<=10,'CREDENTIAL_CONFIG','Use pbkdf2-sha256-chain-v1: 100000 iterations and 3–10 passes');
 let bytes: Uint8Array = new TextEncoder().encode(password);
 for(let i=0;i<passes;i++){
  const key=await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveBits']);
  bytes=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations,hash:'SHA-256'},key,256));
 }
 return bytes.buffer as ArrayBuffer;
}
