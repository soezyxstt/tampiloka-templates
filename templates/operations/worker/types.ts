import type { BackupBucket } from './backup.ts';
import type { StoreCall } from './store.ts';
export interface Env {
 OPERATIONS: {getByName(name:string):{call(input:StoreCall):Promise<unknown>;scheduledBackup():Promise<void>}};
 ASSETS?:{fetch(request:Request):Promise<Response>};
 DEMO_MODE?:string;
 /** JSON array of {username,userId,salt,hash,iterations,kdf,passes}; pbkdf2-sha256-chain-v1, 100000 iterations, 3+ passes. */
 OPERATIONS_AUTH?:string;
 BACKUP_SECRET?:string;
 BACKUPS?:BackupBucket;
 BACKUP_ENABLED?:string;
 BACKUP_RETENTION_DAYS?:string;
 BACKUP_CLEANUP_LIMIT?:string;
}
