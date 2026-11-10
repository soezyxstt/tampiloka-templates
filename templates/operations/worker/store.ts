import { BACKUP_MAX_BYTES, BACKUP_MAX_COMMANDS, backupPolicy, writeBackup, pruneBackups, type BackupStatus } from './backup.ts';
import rawConfig from '../config/operations.json' with { type: 'json' };
import { validateInstallation } from '../config/validate.ts';
import { DurableObject } from 'cloudflare:workers';
import type { Command, OperationsState, User } from '../src/domain/contract.ts';
import { createInitialState, personas } from '../src/domain/seed.ts';
import { currentUser, owner, snapshot, check, record, str, canonical, assertIntegrity, validateJournal, requireRole, DomainError } from '../src/domain/core.ts';
import { execute, type CommandJournal, type StoredCommand } from '../src/domain/engine.ts';
import { report, csvReport } from '../src/domain/report.ts';
import type { Env } from './types.ts';
const SESSION_LIFETIME_MS=12*60*60*1000;
const RESTORE_AUTH_WINDOW_MS=15*60*1000;
const schema = `CREATE TABLE IF NOT EXISTS backup_status (singleton INTEGER PRIMARY KEY CHECK(singleton=1), status_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS installation (singleton INTEGER PRIMARY KEY CHECK(singleton=1), state_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS commands (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, fingerprint TEXT NOT NULL, result_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS immutable_documents (id TEXT PRIMARY KEY, document_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS immutable_mutations (id TEXT PRIMARY KEY, mutation_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS immutable_audit (id TEXT PRIMARY KEY, audit_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_attempts (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);`;
export interface StoreCall {action:string; tokenHash:string; csrf?:string; input?:unknown; demo:boolean; userId?:string; newTokenHash?:string; newCsrf?:string; loginAllowed?:boolean; bucket?:string; preset?:'food'|'retail'|'supplies';}
export class OperationsStore extends DurableObject<Env> {
 constructor(ctx: OperationsObjectContext, env: Env) { super(ctx,env); ctx.storage.sql.exec(schema); }
 private backupRunning = false;
 private backupStatus(): BackupStatus {const rows=this.ctx.storage.sql.exec<{status_json:string}>('SELECT status_json FROM backup_status WHERE singleton=1').toArray();return rows.length?JSON.parse(rows[0].status_json):{};}
 private saveBackupStatus(status:BackupStatus) {this.ctx.storage.sql.exec('INSERT INTO backup_status(singleton,status_json) VALUES(1,?) ON CONFLICT(singleton) DO UPDATE SET status_json=excluded.status_json',JSON.stringify(status));}
 private checkBackupSize() {
 const sql=this.ctx.storage.sql;
 const sizes=sql.exec<{bytes:number}>('SELECT length(CAST(state_json AS BLOB)) AS bytes FROM installation WHERE singleton=1').toArray();
 check(sizes.length,'BACKUP_EMPTY','Initialize the real installation before backing up');
 check(sizes[0].bytes<=BACKUP_MAX_BYTES,'BACKUP_TOO_LARGE','Projection exceeds backup bound');
 // Inspect bounded journal sizes before materializing payloads (no unbounded journal scan).
 const rows=sql.exec<{bytes:number}>('SELECT length(CAST(id AS BLOB))+length(CAST(actor_id AS BLOB))+length(CAST(fingerprint AS BLOB))+length(CAST(result_json AS BLOB)) AS bytes FROM commands ORDER BY id LIMIT ?',BACKUP_MAX_COMMANDS+1).toArray();
 check(rows.length<=BACKUP_MAX_COMMANDS&&rows.reduce((total,r)=>total+r.bytes+256,sizes[0].bytes)<=BACKUP_MAX_BYTES,'BACKUP_TOO_LARGE','Journal exceeds backup bound');
 }
 /** Dedicated internal RPC. Never dispatched by call() or by an HTTP action name. */
 async scheduledBackup(): Promise<void> {
 if(this.backupRunning)return;
 this.backupRunning=true;
 const now=new Date().toISOString();let status=this.backupStatus();
 try {
 const config=validateInstallation(rawConfig),policy=backupPolicy(this.env,config.business.id,config.preset);
 status={...status,lastAttemptAt:now};this.saveBackupStatus(status);
 const backup=this.ctx.storage.transactionSync(()=>{
 const sql=this.ctx.storage.sql;
 this.checkBackupSize();
 const state=this.load(false,config.preset);
 check(state.businessId===config.business.id&&state.preset===config.preset&&!state.demo,'BACKUP_IDENTITY','Backup installation mismatch');
 assertIntegrity(state);
 const commands=sql.exec<{id:string;actor_id:string;fingerprint:string;result_json:string}>('SELECT id,actor_id,fingerprint,result_json FROM commands ORDER BY id LIMIT ?',BACKUP_MAX_COMMANDS).toArray();
 validateJournal(state,commands);
 return {version:1,businessId:state.businessId,demo:false,createdAt:now,state,commands};
 });
 const previous=status.lastSuccess;
 const success=await writeBackup(policy,backup,new Date().toISOString());
 // Commit last-good metadata before any optional cleanup; failure never erases it.
 status={...status,lastSuccess:success,outcome:'success',errorCode:undefined};this.saveBackupStatus(status);
 const cleanup=await pruneBackups(policy,[success.key,...(previous?[previous.key]:[])],status.cleanupCursor,Date.now());
 status={...status,...cleanup};this.saveBackupStatus(status);
 } catch(error) {
 status={...status,lastAttemptAt:now,outcome:'failed',errorCode:error instanceof DomainError?error.code:'BACKUP_IO_FAILED'};
 this.saveBackupStatus(status);
 // Fixed error only: never log bucket payloads, credentials, signatures, or provider errors.
 throw new Error('Scheduled backup failed; owner should inspect backup status');
 } finally {this.backupRunning=false;}
 }
 private load(demo: boolean,preset?:'food'|'retail'|'supplies') {const rows=this.ctx.storage.sql.exec<{state_json:string}>('SELECT state_json FROM installation WHERE singleton=1').toArray();if(rows.length){const state=JSON.parse(rows[0].state_json) as OperationsState;check(state.demo===demo,'INSTALLATION_MODE','Demo and production cannot share data');return state;}return createInitialState(demo,new Date().toISOString(),preset);}
 private save(s: OperationsState, previous?: OperationsState) {
 const sql=this.ctx.storage.sql;sql.exec('INSERT INTO installation(singleton,state_json) VALUES(1,?) ON CONFLICT(singleton) DO UPDATE SET state_json=excluded.state_json',JSON.stringify(s));
 for(const d of s.documents.slice(previous?.documents.length??0))sql.exec('INSERT OR IGNORE INTO immutable_documents(id,document_json) VALUES(?,?)',d.id,JSON.stringify(d));
 for(const m of s.mutations.slice(previous?.mutations.length??0))sql.exec('INSERT OR IGNORE INTO immutable_mutations(id,mutation_json) VALUES(?,?)',m.id,JSON.stringify(m));
 for(const a of s.audit.slice(previous?.audit.length??0))sql.exec('INSERT OR IGNORE INTO immutable_audit(id,audit_json) VALUES(?,?)',a.id,JSON.stringify(a));
 }
 /** No await in this coordination atom: fresh permissions + reducer + ledger + result commit together. */
 call(c: StoreCall): unknown {try { return this.ctx.storage.transactionSync(()=>{
 const sql=this.ctx.storage.sql,now=new Date().toISOString();let s=this.load(c.demo,c.preset);
 const sessions=sql.exec<{user_id:string;csrf:string;expires_at:number}>('SELECT user_id,csrf,expires_at FROM sessions WHERE token_hash=?',c.tokenHash).toArray();
 const session=sessions[0]?.expires_at>Date.now()?sessions[0]:undefined;
 if(c.action==='login-attempt'){
 check(!c.demo,'FORBIDDEN','Production login only');const bucket=str(c.bucket),rows=sql.exec<{attempts:number;expires_at:number}>('SELECT attempts,expires_at FROM login_attempts WHERE bucket=?',bucket).toArray();const active=rows[0]?.expires_at>Date.now(),attempts=active?rows[0].attempts:0;check(attempts<10,'RATE_LIMIT','Too many login attempts; wait 15 minutes');sql.exec('DELETE FROM login_attempts WHERE expires_at<=?',Date.now());sql.exec('INSERT INTO login_attempts(bucket,attempts,expires_at) VALUES(?,?,?) ON CONFLICT(bucket) DO UPDATE SET attempts=excluded.attempts,expires_at=excluded.expires_at',bucket,attempts+1,active?rows[0].expires_at:Date.now()+15*60*1000);return {allowed:true};
 }
 if(c.action==='login') {
 if(c.demo&&!c.loginAllowed&&sql.exec('SELECT singleton FROM installation').toArray().length)check(session,'UNAUTHENTICATED','Existing demo installation requires its valid session; create a new demo session to restart');
 check(c.demo=== (this.env.DEMO_MODE==='true'),'INSTALLATION_MODE','Worker mode mismatch');
 if(!c.demo&&!c.loginAllowed)return {loginFailed:true};
 const input=record(c.input);const userId=c.demo?str(input.persona):str(c.userId);
 if(c.demo)check(personas.includes(userId as typeof personas[number]),'PERSONA_INVALID','Unknown demo persona');
 const u=currentUser(s,userId);check(c.newTokenHash&&c.newCsrf,'SESSION_INVALID','Session credentials required');
 if(session)sql.exec('DELETE FROM sessions WHERE token_hash=?',c.tokenHash);
 sql.exec('DELETE FROM sessions WHERE expires_at<=?',Date.now());sql.exec('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)',c.newTokenHash,u.id,c.newCsrf,Date.now()+SESSION_LIFETIME_MS);
 const auditId=`login-${crypto.randomUUID()}`;s.audit.push({id:auditId,actorId:u.id,type:'session.login',documentId:auditId,locationIds:[],recordedAt:now,reason:c.demo?'Demo persona selected':'Authenticated login'});s.updatedAt=now;
 if(c.demo&&input.mode){check(['inventory','retail','full'].includes(String(input.mode)),'MODE_INVALID','Unknown demo mode');s.modules={pos:input.mode!=='inventory',commercial:input.mode==='full'};}
 if(c.demo&&input.preset)check(input.preset===s.preset,'PRESET_MISMATCH','Demo preset must match its isolated installation');
 this.save(s);return {user:u,csrfToken:c.newCsrf,demo:c.demo};
 }
 if(c.action==='session'){if(!session)return {user:null,csrfToken:'',demo:c.demo};return {user:currentUser(s,session.user_id),csrfToken:session.csrf,demo:c.demo};}
 check(session,'UNAUTHENTICATED','Login required');const u=currentUser(s,session.user_id);
 if(['command','logout','restore','authorize-switch'].includes(c.action))check(c.csrf&&c.csrf===session.csrf,'FORBIDDEN','Invalid CSRF token');
 if(c.action==='authorize-switch'){check(c.demo,'FORBIDDEN','Preset switch is demo only');return {authorized:true};}
 if(c.action==='logout'){sql.exec('DELETE FROM sessions WHERE token_hash=?',c.tokenHash);const aid=`logout-${crypto.randomUUID()}`;s.audit.push({id:aid,actorId:u.id,type:'session.logout',documentId:aid,locationIds:[],recordedAt:now,reason:'Logout'});this.save(s);return {loggedOut:true};}
 if(c.action==='state')return snapshot(s,u.id);
 if(c.action==='command') {const cmd=record(c.input) as unknown as Command;check(str(cmd.id).length<=120&&!str(cmd.id).startsWith('collected-'),'INVALID_ID','Reserved recovery identity');const rows=sql.exec<{actor_id:string;fingerprint:string;result_json:string}>('SELECT actor_id,fingerprint,result_json FROM commands WHERE id=?',str(cmd.id)).toArray();const journal:CommandJournal=Object.create(null);if(rows[0])journal[cmd.id]={actorId:rows[0].actor_id,fingerprint:rows[0].fingerprint,result:JSON.parse(rows[0].result_json)};
 if(cmd.type==='sale.complete'&&!rows.length){const collected=sql.exec<{result_json:string}>('SELECT result_json FROM commands WHERE id=?',`collected-${cmd.id}`).toArray();if(collected[0]){const evidence=s.documents.find(d=>d.id===JSON.parse(collected[0].result_json).documentId);check(evidence?.actorId===u.id,'FORBIDDEN','Command belongs to another account');requireRole(u,'cashier',String(evidence?.data.locationId));check(evidence?.data.failedCommandFingerprint===canonical(cmd),'IDEMPOTENCY_MISMATCH','Failed collection identity already used with different payload');return {__domainError:{status:409,code:'PAYMENT_REVIEW_REQUIRED',message:'Money from this attempt is already recorded; reconcile it before completing with paymentId',details:{paymentId:JSON.parse(collected[0].result_json).data.paymentId}}};}}
 let outcome:ReturnType<typeof execute>;
 try{outcome=execute(s,u.id,cmd,journal,now);}catch(error){
 // Inline payment means the cashier asserts money was collected. Retain it even
 // when price/stock validation rejects the sale; never manufacture stock or a sale.
 if(error instanceof DomainError&&['PAYMENT_SHORT','NONCASH_AMOUNT','INSUFFICIENT_STOCK','QUOTE_CHANGED','COUNT_FROZEN','VOUCHER_EXHAUSTED','CUSTOMER_QUOTA','VOUCHER_INVALID'].includes(error.code)&&cmd.type==='sale.complete'&&!cmd.payload.paymentId&&cmd.payload.payment){
 const p=record(cmd.payload),pay=record(p.payment),sh=s.shifts.find(sh=>sh.id===p.shiftId&&!sh.closedAt&&sh.locationId===p.locationId&&(sh.actorId===u.id||owner(u)));
 if(sh&&typeof pay.amount==='number'&&pay.amount>0&&['cash','noncash'].includes(String(pay.method))){
 const captureId=`collected-${cmd.id}`;check(captureId.length<=140,'INVALID_ID','Payment recovery identity too long');
 const existing=sql.exec<{result_json:string}>('SELECT result_json FROM commands WHERE id=?',captureId).toArray();
 if(existing[0])return {__domainError:{status:error.status,code:error.code,message:error.message,details:{paymentId:JSON.parse(existing[0].result_json).data.paymentId,requiresReview:true}}};
 let recoveryReference=`sale-complete-${cmd.id}`;let recoverySuffix=0;while(s.payments.some(payment=>payment.reference===recoveryReference))recoveryReference=`sale-complete-${cmd.id}-${++recoverySuffix}`;
 const captured=execute(s,u.id,{id:captureId,type:'payment.record',payload:{locationId:sh.locationId,shiftId:sh.id,method:pay.method,amount:pay.amount,status:'review',reference:recoveryReference,suppliedReference:typeof pay.reference==='string'?pay.reference:'',failedCommandId:cmd.id,failedCommandFingerprint:canonical(cmd)}},Object.create(null),now);
 this.save(captured.state,s);sql.exec('INSERT INTO commands(id,actor_id,fingerprint,result_json) VALUES(?,?,?,?)',captureId,u.id,captured.stored.fingerprint,JSON.stringify(captured.result));
 return {__domainError:{status:error.status,code:error.code,message:error.message,details:{paymentId:captured.result.data.paymentId,requiresReview:true}}};
 }}throw error;}
if(!rows.length){this.save(outcome.state,s);sql.exec('INSERT INTO commands(id,actor_id,fingerprint,result_json) VALUES(?,?,?,?)',cmd.id,u.id,outcome.stored.fingerprint,JSON.stringify(outcome.result));}return {result:outcome.result,state:snapshot(outcome.state,u.id)};}
 if(c.action==='result'){const id=str(record(c.input).id),rows=sql.exec<{actor_id:string;fingerprint:string;result_json:string}>('SELECT actor_id,fingerprint,result_json FROM commands WHERE id=?',id).toArray();check(rows[0],'COMMAND_UNKNOWN','No committed result for this identity');check(rows[0].actor_id===u.id,'FORBIDDEN','Command belongs to another account');const command=JSON.parse(rows[0].fingerprint) as Command;const journal={[id]:{actorId:u.id,fingerprint:rows[0].fingerprint,result:JSON.parse(rows[0].result_json)}};const recovered=execute(s,u.id,command,journal,now);return {result:recovered.result,state:snapshot(recovered.state,u.id)};}
 if(c.action==='report'){const query=new URLSearchParams(str(record(c.input).query||'basis=recorded'));const result=report(s,u.id,query);return query.get('format')==='csv'?{csv:csvReport(result)}:result;}
 if(c.action==='search'){const q=str(record(c.input).q).toLocaleLowerCase();const docs=snapshot(s,u.id).documents.filter(d=>canonical(d).toLocaleLowerCase().includes(q));return {revision:s.revision,total:docs.length,documents:docs.slice(0,100)};}
 if(c.action==='document'){const doc=snapshot(s,u.id).documents.find(d=>d.id===str(record(c.input).id));check(doc,'FORBIDDEN','Document unavailable or outside your scope');return doc;}
 if(c.action==='backup-status'){check(owner(u),'FORBIDDEN','Owner access required');const status=this.backupStatus();const {cleanupCursor,...visible}=status;return {enabled:this.env.BACKUP_ENABLED==='true'&&this.env.DEMO_MODE==='false',retentionDays:this.env.BACKUP_RETENTION_DAYS??null,...visible};}
 if(c.action==='backup'){check(owner(u),'FORBIDDEN','Owner access required');this.checkBackupSize();const commands=sql.exec<{id:string;actor_id:string;fingerprint:string;result_json:string}>('SELECT id,actor_id,fingerprint,result_json FROM commands ORDER BY id LIMIT ?',BACKUP_MAX_COMMANDS).toArray();return {version:1,businessId:s.businessId,demo:s.demo,createdAt:now,state:s,commands};}
 if(c.action==='restore'){check(owner(u)&&!c.demo,'FORBIDDEN','Restore allowed only in real installation');check(session.expires_at-SESSION_LIFETIME_MS>=Date.now()-RESTORE_AUTH_WINDOW_MS,'RESTORE_REAUTH_REQUIRED','Sign in again before restoring; authentication must be within 15 minutes');check(!s.mutations.length&&!s.sales.length&&!s.documents.length,'RESTORE_NONEMPTY','Restore only into an empty installation');const backup=record(c.input);check(backup.version===1&&backup.businessId===s.businessId&&backup.demo===false,'BACKUP_IDENTITY','Backup installation mismatch');const restored=record(backup.state) as unknown as OperationsState;check(restored.schemaVersion===1&&restored.businessId===s.businessId&&restored.preset===s.preset&&!restored.demo,'BACKUP_IDENTITY','State installation mismatch');check(Array.isArray(backup.commands),'BACKUP_INVALID','Command journal required');assertIntegrity(restored);validateJournal(restored,backup.commands);
 for(const raw of backup.commands){const row=record(raw);sql.exec('INSERT INTO commands(id,actor_id,fingerprint,result_json) VALUES(?,?,?,?)',str(row.id),str(row.actor_id),String(row.fingerprint),String(row.result_json));}
 const aid=`restore-${crypto.randomUUID()}`;restored.audit.push({id:aid,actorId:u.id,type:'backup.restore',documentId:aid,locationIds:[],recordedAt:now,reason:'Verified signed backup restored into empty installation'});this.save(restored);sql.exec('DELETE FROM sessions');return {restored:true,revision:restored.revision,reauthenticate:true};}
 check(false,'NOT_FOUND','Unknown operation');
 });} catch(e) {if(e instanceof DomainError)return {__domainError:{status:e.status,code:e.code,message:e.message,details:e.details}};throw e;} }
}
