import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';
import rawConfig from '../config/operations.json' with {type:'json'};
import { backupPolicy, pruneBackups, verifyBackup, BACKUP_MAX_COMMANDS } from '../worker/backup.ts';
const stub='data:text/javascript,'+encodeURIComponent('export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env}}');
const hook=registerHooks({resolve(s,c,next){return s==='cloudflare:workers'?{url:stub,shortCircuit:true}:next(s,c)}});
const {OperationsStore}=await import('../worker/store.ts');
const {default:worker}=await import('../worker/index.ts');
hook.deregister();
function bucket(){
 const objects=new Map();const deleted=[];let lists=0;
 return {objects,deleted,get lists(){return lists},
 async put(key,text){objects.set(key,{text,uploaded:new Date(),size:Buffer.byteLength(text)})},
 async get(key){const o=objects.get(key);return o?{size:o.size,text:async()=>o.text}:null},
 async list({prefix,limit,cursor}){lists++;const keys=[...objects.keys()].filter(k=>k.startsWith(prefix)&&(!cursor||k>cursor)).sort();const page=keys.slice(0,limit);return {objects:page.map(key=>({key,...objects.get(key)})),truncated:keys.length>limit,cursor:page.at(-1)}},
 async delete(keys){deleted.push(...keys);for(const k of keys)objects.delete(k)}
 };
}
function fixture(overrides={}){
 const db=new DatabaseSync(':memory:');const b=bucket();
 const env={DEMO_MODE:'false',BACKUP_ENABLED:'true',BACKUP_SECRET:'s'.repeat(40),BACKUP_RETENTION_DAYS:'7',BACKUP_CLEANUP_LIMIT:'10',BACKUPS:b};
 const ctx={storage:{sql:{exec(sql,...bindings){let rows;if(sql.startsWith('CREATE TABLE')){db.exec(sql);rows=[]}else rows=db.prepare(sql).all(...bindings);return {toArray:()=>rows,one:()=>rows[0]}}},transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}}};
 const store=new OperationsStore(ctx,env);
 const call=(action,input={},extra={})=>store.call({action,input,demo:false,tokenHash:'owner-token',csrf:'owner-csrf',...extra});
 const login=call('login',{}, {loginAllowed:true,userId:'owner',newTokenHash:'owner-token',newCsrf:'owner-csrf'});assert.equal(login.user.id,'owner');Object.assign(env,overrides);
 return {db,b,env,ctx,store,call,close:()=>db.close()};
}
const prefix=`operations-backups/v1/${rawConfig.business.id}/${rawConfig.preset}/`;
const filename=(date,n='a')=>`${prefix}${date}-${n.repeat(8)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(4)}-${n.repeat(12)}.json`;

test('cron disabled is a no-op, demo enabled rejects before routing; missing policy fails closed',async()=>{
 let calls=0;const env={OPERATIONS:{getByName(){calls++;throw Error('must not route')}},BACKUP_ENABLED:'false'};
 await worker.scheduled({},env,{waitUntil(){throw Error('must not start')}});assert.equal(calls,0);
 await assert.rejects(worker.scheduled({}, {...env,BACKUP_ENABLED:'true',DEMO_MODE:'true'},{}));assert.equal(calls,0);
 for(const overrides of [{BACKUP_ENABLED:'false'},{DEMO_MODE:'true'},{BACKUP_RETENTION_DAYS:undefined},{BACKUP_CLEANUP_LIMIT:'101'},{BACKUPS:undefined},{BACKUP_SECRET:undefined}]){
 const f=fixture(overrides);try{await assert.rejects(f.store.scheduledBackup());assert.equal(f.b.objects.size,0);assert.equal(f.b.lists,0)}finally{f.close()}
 }
});

test('cron passes dedicated RPC to ctx; snapshot/journal envelope verifies and restores unchanged schema',async()=>{
 const f=fixture();try{
 const state=f.call('state');const cmd={id:'backup-shift',type:'shift.open',payload:{locationId:state.locations.find(l=>l.kind==='outlet').id,openingCash:0}};
 assert.ok(f.call('command',cmd).result);
 let pending;let target;await worker.scheduled({}, {...f.env,OPERATIONS:{getByName(name){target=name;return f.store}}},{waitUntil(p){pending=p}});await pending;
 assert.equal(target,`real:${rawConfig.business.id}`);
 const status=f.call('backup-status');assert.equal(status.outcome,'success');assert.equal(status.lastSuccess.revision,f.call('state').revision);
 const obj=f.b.objects.get(status.lastSuccess.key);const backup=await verifyBackup(obj.text,f.env.BACKUP_SECRET);
 assert.equal(backup.commands.length,1);assert.equal(backup.state.demo,false);
 const manual=JSON.parse(JSON.stringify(f.call('backup')));assert.deepEqual(manual.commands,backup.commands);assert.deepEqual(manual.state,backup.state);
 const limited=f.call('backup',{}, {tokenHash:'invalid'});assert.equal(limited.__domainError.code,'UNAUTHENTICATED');
 assert.equal(obj.text.includes('owner-token'),false);assert.equal(obj.text.includes('owner-csrf'),false);assert.equal(obj.text.includes(f.env.BACKUP_SECRET),false);
 const restore=fixture();try{assert.equal(restore.call('restore',backup).restored,true);assert.equal(restore.db.prepare('SELECT COUNT(*) AS n FROM commands').get().n,1)}finally{restore.close()}
 const changed=JSON.parse(obj.text);changed.backup.state.revision++;await assert.rejects(verifyBackup(JSON.stringify(changed),f.env.BACKUP_SECRET));
 }finally{f.close()}
});

test('failed write/read verification never prunes or loses prior successful metadata',async()=>{
 const f=fixture();try{
 await f.store.scheduledBackup();const last=f.call('backup-status').lastSuccess;const lists=f.b.lists;
 f.b.put=async()=>{throw Error('provider secret must not escape')};
 await assert.rejects(f.store.scheduledBackup(),e=>!e.message.includes('provider secret'));
 assert.deepEqual(f.call('backup-status').lastSuccess,last);assert.equal(f.call('backup-status').errorCode,'BACKUP_IO_FAILED');assert.equal(f.b.lists,lists);assert.equal(f.b.deleted.length,0);
 f.b.put=async(key,text)=>f.b.objects.set(key,{text:text.replace('"version":1','"version":2'),uploaded:new Date(),size:Buffer.byteLength(text)});
 await assert.rejects(f.store.scheduledBackup());assert.equal(f.b.lists,lists);assert.deepEqual(f.call('backup-status').lastSuccess,last);
 }finally{f.close()}
});

test('retention excludes boundary, last-good keys, unrelated prefixes and non-writer files; pagination bounded',async()=>{
 const f=fixture();try{
 const now=Date.parse('2026-11-10T12:00:00.000Z'),cutoff=now-7*86400000;
 const old=filename('2026-10-01T00:00:00.000Z'),keep=filename('2026-10-02T00:00:00.000Z'),boundary=filename('2026-11-03T12:00:00.000Z');
 for(const [key,time] of [[old,cutoff-1],[keep,cutoff-1],[boundary,cutoff],[prefix+'nested/other.json',0],[prefix+'manual.json',0],['operations-backups/v1/another/food/'+old.split('/').at(-1),0]])f.b.objects.set(key,{uploaded:new Date(time),size:1,text:'x'});
 const policy=backupPolicy(f.env,rawConfig.business.id,rawConfig.preset);
 const result=await pruneBackups(policy,[keep],undefined,now);assert.equal(result.cleanupDeleted,1);assert.deepEqual(f.b.deleted,[old]);assert.ok(f.b.objects.has(keep));assert.ok(f.b.objects.has(boundary));
 const limited={...policy,cleanupLimit:1};const page=await pruneBackups(limited,[keep],undefined,now);assert.ok(page.cleanupCursor);assert.ok(page.cleanupDeleted<=1);
 }finally{f.close()}
});

test('cleanup failure retains the newly verified backup and a later run recovers',async()=>{
 const f=fixture();try{
 await f.store.scheduledBackup();const previous=f.call('backup-status').lastSuccess;
 const list=f.b.list;f.b.list=async()=>{throw Error('private provider details')};
 await assert.rejects(f.store.scheduledBackup(),e=>!e.message.includes('private provider'));
 const failed=f.call('backup-status');assert.equal(failed.outcome,'failed');
 assert.notEqual(failed.lastSuccess.key,previous.key);
 assert.ok(f.b.objects.has(previous.key));assert.ok(f.b.objects.has(failed.lastSuccess.key));
 assert.equal(f.b.deleted.length,0);
 await verifyBackup(f.b.objects.get(failed.lastSuccess.key).text,f.env.BACKUP_SECRET);
 f.b.list=list;await f.store.scheduledBackup();
 const recovered=f.call('backup-status');assert.equal(recovered.outcome,'success');assert.equal(recovered.errorCode,undefined);
 }finally{f.close()}
});

test('status owner-only, internal RPC cannot be invoked as call action, and journal export is bounded',async()=>{
 const f=fixture();try{
 assert.equal(f.call('backup-status',{}, {tokenHash:'invalid'}).__domainError.code,'UNAUTHENTICATED');
 const stored=JSON.parse(f.db.prepare('SELECT state_json FROM installation').get().state_json);
 stored.users.push({id:'limited',businessId:stored.businessId,name:'Limited',active:true,assignments:[{role:'cashier',locationIds:[stored.locations.find(l=>l.kind==='outlet').id]}]});
 f.db.prepare('UPDATE installation SET state_json=?').run(JSON.stringify(stored));
 f.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run('limited-token','limited','limited-csrf',Date.now()+60000);
 assert.equal(f.call('backup-status',{}, {tokenHash:'limited-token'}).__domainError.code,'FORBIDDEN');
 assert.equal(f.call('scheduledBackup').__domainError.code,'NOT_FOUND');
 const insert=f.db.prepare('INSERT INTO commands VALUES(?,?,?,?)');f.db.exec('BEGIN');for(let i=0;i<=BACKUP_MAX_COMMANDS;i++)insert.run(`id-${i}`,'owner','{}','{}');f.db.exec('COMMIT');
 await assert.rejects(f.store.scheduledBackup());assert.equal(f.call('backup-status').errorCode,'BACKUP_TOO_LARGE');assert.equal(f.b.objects.size,0);
 assert.equal(f.call('backup').__domainError.code,'BACKUP_TOO_LARGE');
 }finally{f.close()}
});


test('restore requires recent owner login even while the ordinary session remains valid',()=>{
 const source=fixture(),target=fixture();try{
 const backup=JSON.parse(JSON.stringify(source.call('backup')));
 const wrongPreset=structuredClone(backup);wrongPreset.state.preset=backup.state.preset==='retail'?'food':'retail';
 assert.equal(target.call('restore',wrongPreset).__domainError.code,'BACKUP_IDENTITY');
 target.db.prepare('UPDATE sessions SET expires_at=?').run(Date.now()+12*60*60*1000-16*60*1000);
 assert.equal(target.call('state').viewerId,'owner');
 const before=target.db.prepare('SELECT state_json FROM installation').get().state_json;
 assert.equal(target.call('restore',backup).__domainError.code,'RESTORE_REAUTH_REQUIRED');
 assert.equal(target.db.prepare('SELECT state_json FROM installation').get().state_json,before);
 assert.equal(target.db.prepare('SELECT COUNT(*) AS n FROM commands').get().n,0);
 target.call('login',{}, {loginAllowed:true,userId:'owner',newTokenHash:'owner-token',newCsrf:'owner-csrf'});
 assert.equal(target.call('restore',backup).restored,true);
 assert.equal(target.call('state').__domainError.code,'UNAUTHENTICATED');
 }finally{source.close();target.close()}
});
