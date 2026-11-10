import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks } from 'node:module';
import { fixture, openShift, sell, pid, outlet, approval } from './domain-support.mjs';
import { assertIntegrity, validateJournal } from '../src/domain/core.ts';
import { execute } from '../src/domain/engine.ts';
const hook=registerHooks({resolve(s,c,next){return s==='cloudflare:workers'?{url:'data:text/javascript,export class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}',shortCircuit:true}:next(s,c);}});
const {OperationsStore}=await import('../worker/store.ts');
const {default:worker}=await import('../worker/index.ts');
hook.deregister();
function store(demo=true,preset='food'){
 const db=new DatabaseSync(':memory:');
 const ctx={storage:{sql:{exec(q,...args){let rows;if(q.startsWith('CREATE TABLE')){db.exec(q);rows=[];}else rows=db.prepare(q).all(...args);return {toArray:()=>rows};}},transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
 const object=new OperationsStore(ctx,{DEMO_MODE:String(demo)});
 const call=(action,input={},extra={})=>object.call({action,input,demo,preset,tokenHash:'token',csrf:'csrf',...extra});
 const login=call('login',demo?{persona:'owner'}:{},{userId:'owner',loginAllowed:!demo,newTokenHash:'token',newCsrf:'csrf'});assert.ok(login.user,JSON.stringify(login));
 return {object,call,db,close:()=>db.close()};
}
const code=(expected)=>({code:expected});
test('prototype identities cannot poison journals or unit conversion',()=>{
 const f=fixture(); const result=execute(f.state,'cashier',{id:'__proto__',type:'shift.open',payload:{locationId:outlet,openingCash:0}},{},'2026-11-10T01:00:00Z');assert.equal(result.result.commandId,'__proto__');
 const product=structuredClone(f.state.products[0]);product.units=JSON.parse('{"porsi":1,"__proto__":1}');assert.throws(()=>f.run('master.product',{product,...approval}),code('INVALID_ID'));
 assert.throws(()=>f.run('stock.receive',{locationId:'warehouse',lines:[{productId:pid,quantity:1,unit:'constructor'}],source:'external',proof:'reference'}),code('UNIT_INVALID'));
});
test('source IDs must exist, remain in scope and match proposal approval',()=>{
 const f=fixture();assert.throws(()=>f.run('transfer.draft',{fromId:'warehouse',toId:outlet,lines:[{productId:pid,quantity:1}],sourceId:'missing'},'inventory'),code('SOURCE_INVALID'));
 const proposal=f.run('stock.propose',{locationId:outlet,reason:'count discrepancy'},'receiver');
 assert.throws(()=>f.run('stock.adjust',{locationId:'warehouse',productId:pid,quantity:1,sourceId:proposal.documentId,...approval}),code('SOURCE_INVALID'));
 f.run('stock.adjust',{locationId:outlet,productId:pid,quantity:1,sourceId:proposal.documentId,...approval});
 assert.throws(()=>f.run('stock.adjust',{locationId:outlet,productId:pid,quantity:1,sourceId:proposal.documentId,...approval}),code('SOURCE_RESOLVED'));
});
test('refunded unallocated money cannot fund a new sale or be marked never received',()=>{
 const f=fixture(),shiftId=openShift(f);
 const p=f.run('payment.record',{locationId:outlet,shiftId,method:'cash',status:'review',amount:10000,reference:'received'},'cashier');
 f.run('payment.refund',{paymentId:p.documentId,amount:1000,shiftId,...approval});
 assert.throws(()=>f.run('payment.resolve',{paymentId:p.documentId,status:'failed',...approval}),code('PAYMENT_REFUNDED'));
 f.run('payment.resolve',{paymentId:p.documentId,status:'confirmed',...approval});
 const payload={locationId:outlet,shiftId,lines:[{productId:pid,quantity:1}],paymentId:p.documentId};const q=f.run('sale.quote',payload,'cashier').data.quote;
 assert.throws(()=>f.run('sale.complete',{...payload,quoteFingerprint:q.fingerprint},'cashier'),code('PAYMENT_REFUNDED'));
});
test('goods-only and money-only returns preserve all original rounding allocations',()=>{
 const f=fixture(),shiftId=openShift(f);f.run('price.save',{price:{id:'price-small',locationId:outlet,productId:pid,amount:1,startsAt:'2026-01-01T00:00:00Z'}});
 const sale=sell(f,shiftId,3),saleId=sale.documentId;
 f.run('payment.refund',{paymentId:f.state.sales[0].paymentId,amount:1,shiftId,...approval});
 f.run('sale.return',{saleId,lines:[{lineIndex:0,quantity:1,condition:'held'}],refund:false,...approval});
 f.run('sale.return',{saleId,lines:[{lineIndex:0,quantity:1}],shiftId,...approval});
 f.run('sale.return',{saleId,lines:[{lineIndex:0,quantity:1}],shiftId,...approval});
 const records=f.state.returns;assert.equal(records.reduce((n,r)=>n+r.amount,0),3);assert.equal(records.flatMap(r=>r.lines).reduce((n,l)=>n+l.allocation.total,0),3);assert.equal(f.balance(outlet,'held'),1);
});
test('new financial commands are gated; historical settlement survives mode changes',()=>{
 const f=fixture(),shiftId=openShift(f);const sale=sell(f,shiftId,1);f.run('master.business',{modules:{pos:false,commercial:false},...approval});
 assert.throws(()=>openShift(f,'owner'),code('MODULE_DISABLED'));
 assert.throws(()=>f.run('payment.record',{locationId:outlet,shiftId,method:'cash',status:'confirmed',amount:1,reference:'blocked'},'cashier'),code('MODULE_DISABLED'));
 assert.throws(()=>f.run('profile.save',{profile:{}}),code('MODULE_DISABLED'));
 f.run('sale.return',{saleId:sale.documentId,lines:[{lineIndex:0,quantity:1}],shiftId,...approval});
 f.run('shift.close',{shiftId,countedCash:100000},'cashier');
 assert.throws(()=>f.run('master.business',{modules:{pos:false,commercial:true},...approval}),code('MODULE_DEPENDENCY'));
});
test('restore validates source, quantities, document actor and journal evidence',()=>{
 const f=fixture();const shiftId=openShift(f);sell(f,shiftId,2);assertIntegrity(f.state);
 const journal=Object.entries(f.journal).map(([id,r])=>({id,actor_id:r.actorId,fingerprint:r.fingerprint,result_json:JSON.stringify(r.result)}));validateJournal(f.state,journal);
 const bad=structuredClone(f.state);bad.mutations[0].documentId='missing';assert.throws(()=>assertIntegrity(bad),code('SOURCE_INVALID'));
 const changed=structuredClone(journal);changed[0].actor_id='receiver';assert.throws(()=>validateJournal(f.state,changed),code('BACKUP_INVALID'));
 assert.throws(()=>validateJournal(f.state,journal.slice(1)),code('BACKUP_INVALID'));
});
test('sale rejection after receiving cash preserves review money once without completing sale',()=>{
 const f=store();try{
 const cmd=(id,type,payload)=>f.call('command',{id,type,payload});
 const shift=cmd('open','shift.open',{locationId:outlet,openingCash:0});const shiftId=shift.result.documentId;
 const p={locationId:outlet,shiftId,lines:[{productId:pid,quantity:1}]};const q=cmd('quote','sale.quote',p).result.data.quote;
 const failed=cmd('short','sale.complete',{...p,quoteFingerprint:q.fingerprint,payment:{method:'cash',amount:1000}});
 assert.equal(failed.__domainError.code,'PAYMENT_SHORT');assert.ok(failed.__domainError.details.paymentId);
 const retry=cmd('short','sale.complete',{...p,quoteFingerprint:q.fingerprint,payment:{method:'cash',amount:1000}});assert.equal(retry.__domainError.code,'PAYMENT_REVIEW_REQUIRED');
 const state=f.call('state');assert.equal(state.sales.length,0);assert.equal(state.payments.length,1);assert.equal(state.payments[0].amount,1000);assert.equal(state.payments[0].status,'review');
 assert.equal(cmd('close','shift.close',{shiftId,countedCash:1000}).__domainError.code,'UNRESOLVED_PAYMENT');
 }finally{f.close();}
});
test('recovery money survives blank, duplicate and colliding supplied references',()=>{
 const f=store();try{
 const cmd=(id,type,payload)=>f.call('command',{id,type,payload});
 const shiftId=cmd('open-references','shift.open',{locationId:outlet,openingCash:0}).result.documentId;
 const p={locationId:outlet,shiftId,lines:[{productId:pid,quantity:1}]};
 const q=cmd('quote-references','sale.quote',p).result.data.quote;
 cmd('existing-reference','payment.record',{locationId:outlet,shiftId,amount:1000,method:'cash',status:'review',reference:'sale-complete-collision'});
 for(const [id,reference] of [['empty-reference',''],['duplicate-reference','sale-complete-collision'],['collision','sale-complete-collision']]){
  const r=cmd(id,'sale.complete',{...p,quoteFingerprint:`stale-${q.fingerprint}`,payment:{method:'cash',amount:1000,reference}});
  assert.equal(r.__domainError.code,'QUOTE_CHANGED');assert.ok(r.__domainError.details.paymentId);
 }
 const state=f.call('state');assert.equal(state.payments.length,4);assert.equal(new Set(state.payments.map(p=>p.reference)).size,4);assert.equal(state.sales.length,0);
 const evidence=state.documents.find(d=>d.data.failedCommandId==='collision');assert.equal(evidence.data.suppliedReference,'sale-complete-collision');
 assert.equal(state.payments.find(p=>p.id===evidence.id).reference,'sale-complete-collision-1');
 }finally{f.close();}
});
test('real SQL restore accepts intact journal, rejects broken evidence atomically and invalidates sessions',()=>{
 const source=store(false),target=store(false);try{
 const posted=source.call('command',{id:'master-name',type:'master.business',payload:{name:'Restored',...approval}});assert.ok(posted.result);
 const backup=source.call('backup');const bad=structuredClone(backup);bad.commands[0].actor_id='ghost';
 assert.equal(target.call('restore',bad).__domainError.code,'BACKUP_INVALID');assert.equal(target.call('state').documents.length,0);
 assert.equal(target.call('restore',backup).restored,true);assert.equal(target.call('state').__domainError.code,'UNAUTHENTICATED');
 assert.equal(JSON.parse(target.db.prepare('SELECT state_json FROM installation').get().state_json).businessName,'Restored');
 }finally{source.close();target.close();}
});
test('real login throttle is committed before credential work and rejects the eleventh attempt',()=>{
 const f=store(false);try{for(let i=0;i<10;i++)assert.equal(f.call('login-attempt',{}, {bucket:'ip'}).allowed,true);assert.equal(f.call('login-attempt',{}, {bucket:'ip'}).__domainError.code,'RATE_LIMIT');}finally{f.close();}
});
test('Worker preset switch preserves legacy data and isolates journals through a round trip',async()=>{
 const rooms=new Map(),names=[];const env={DEMO_MODE:'true',OPERATIONS:{getByName(name){names.push(name);if(!rooms.has(name))rooms.set(name,store(true,name.endsWith(':retail')?'retail':name.endsWith(':supplies')?'supplies':'food'));return {call:async c=>rooms.get(name).object.call(c)};}}};
 const room='12345678-1234-1234-1234-123456789012';
 // Existing two-part cookie routes to the pre-preset Durable Object.
 const legacy=store();rooms.set(`demo:${room}`,legacy);
 const initial=legacy.call('command',{id:'saved-business',type:'master.business',payload:{name:'Prior history',...approval}});assert.ok(initial.result);
 let cookie=`operations=${room}.token0000000`;
 // Install a valid opaque cookie token hash for the pre-existing session.
 const tokenHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('token0000000'))).toString('hex');legacy.db.prepare('UPDATE sessions SET token_hash=?').run(tokenHash);
 const request=async(preset)=>{
 const r=await worker.fetch(new Request('http://example.test/api/demo/session',{method:'POST',headers:{Origin:'http://example.test','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':'csrf'},body:JSON.stringify({persona:'owner',preset,mode:'full'})}),env);
 assert.equal(r.status,200,JSON.stringify(await r.clone().json()));cookie=r.headers.get('Set-Cookie').split(';')[0];const payload=await r.json();return payload.csrfToken;
 };
 let csrf=await request('retail');const retail=rooms.get(`demo:${room}:retail`);assert.equal(retail.db.prepare('SELECT COUNT(*) n FROM commands').get().n,0);
 const response=await worker.fetch(new Request('http://example.test/api/demo/session',{method:'POST',headers:{Origin:'http://example.test','Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf},body:JSON.stringify({persona:'owner',preset:'food',mode:'full'})}),env);assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 assert.equal(JSON.parse(legacy.db.prepare('SELECT state_json FROM installation').get().state_json).businessName,'Prior history');assert.equal(legacy.db.prepare('SELECT COUNT(*) n FROM commands').get().n,1);
 for(const value of new Set(rooms.values()))value.close();
});
test('scheduled commercial profiles reject equal-priority overlap and select the boundary version',()=>{
 const f=fixture();const profile={id:'morning',locationId:outlet,taxBps:1000,taxInclusive:false,serviceBps:0,serviceFixed:0,serviceTaxable:false,lineDiscountBps:0,rounding:'half-up',startsAt:'2026-11-10T00:00:00Z',endsAt:'2026-11-10T12:00:00Z'};
 f.run('profile.save',{profile});
 assert.throws(()=>f.run('profile.save',{profile:{...profile,id:'overlap',startsAt:'2026-11-10T11:00:00Z'}}),code('PROFILE_DUPLICATE'));
 f.run('profile.save',{profile:{...profile,id:'afternoon',startsAt:'2026-11-10T12:00:00Z',endsAt:undefined,taxBps:2000}});
 const q=f.run('sale.quote',{locationId:outlet,lines:[{productId:pid,quantity:1}]},'cashier','boundary','2026-11-10T12:00:00.000Z');assert.equal(q.data.quote.tax,2000);assert.equal(q.data.quote.profile.id,'afternoon');
});
test('settlement shift permits historical refunds after disabling new sales',()=>{
 const f=fixture(),shiftId=openShift(f);const sale=sell(f,shiftId,1);f.run('shift.close',{shiftId,countedCash:110000},'cashier');f.run('master.business',{modules:{pos:false,commercial:false},...approval});
 const sh=f.run('shift.open',{locationId:outlet,openingCash:10000,settlement:true},'cashier');
 f.run('payment.refund',{paymentId:f.state.sales[0].paymentId,amount:10000,shiftId:sh.documentId,...approval});
 assert.equal(f.state.shifts[0].expectedCash,110000);assert.equal(f.state.returns[0].amount,10000);assert.equal(f.state.sales[0].id,sale.documentId);
});
test('Worker rate-limited login does not invoke PBKDF2',async()=>{
 let hashes=0;const original=crypto.subtle.deriveBits;crypto.subtle.deriveBits=async()=>{hashes++;throw Error('Should not hash');};
 try{const response=await worker.fetch(new Request('http://example.test/api/login',{method:'POST',headers:{Origin:'http://example.test','Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'secret'})}),{DEMO_MODE:'false',OPERATIONS_AUTH:'[]',OPERATIONS:{getByName(){return {call:async()=>({__domainError:{status:429,code:'RATE_LIMIT',message:'Wait'}})};}}});assert.equal(response.status,429);assert.equal(hashes,0);}finally{crypto.subtle.deriveBits=original;}
});
test('password KDF uses three bounded native passes and explicit credential version',async()=>{
 const {passwordHash}=await import('../worker/password.ts');const iterations=[],original=crypto.subtle.deriveBits;crypto.subtle.deriveBits=async(params)=>{iterations.push(params.iterations);return new Uint8Array(32).buffer;};
 try{await passwordHash('test-only',new Uint8Array(16),100000,3);assert.deepEqual(iterations,[100000,100000,100000]);await assert.rejects(passwordHash('test-only',new Uint8Array(16),210000,1),code('CREDENTIAL_CONFIG'));}finally{crypto.subtle.deriveBits=original;}
});
test('return rounding reconciles every historical component after catalog and tax changes',()=>{
 const f=fixture(),shiftId=openShift(f);
 f.run('profile.save',{profile:{id:'tax',locationId:outlet,taxBps:1000,taxInclusive:true,serviceBps:500,serviceFixed:1,serviceTaxable:true,lineDiscountBps:333,rounding:'half-up'}});
 const sale=sell(f,shiftId,3),original=structuredClone(f.state.sales[0].quote.lines[0]);
 f.run('profile.save',{profile:{id:'tax',locationId:outlet,taxBps:9000,taxInclusive:false,serviceBps:0,serviceFixed:0,serviceTaxable:false,lineDiscountBps:0,rounding:'half-up'}});
 for(let i=0;i<3;i++)f.run('sale.return',{saleId:sale.documentId,lines:[{lineIndex:0,quantity:1}],shiftId,...approval});
 for(const key of ['gross','discount','net','taxBase','tax','service','serviceTax','total'])assert.equal(f.state.returns.flatMap(r=>r.lines).reduce((n,l)=>n+l.allocation[key],0),original[key]);
 assert.equal(f.state.returns.reduce((n,r)=>n+r.amount,0),original.total);
});
test('import backups retain raw row evidence separately from derived row counts',()=>{
 const f=fixture(false);const payload={importId:'initial',rows:[{kind:'opening',locationId:'warehouse',productId:pid,quantity:1,source:'supplier',proof:'paper-1'}],...approval};
 f.run('import.apply',payload);assert.equal(f.state.documents[0].data.rows,1);assert.equal(f.state.documents[0].input.rows.length,1);
 const rows=Object.entries(f.journal).map(([id,r])=>({id,actor_id:r.actorId,fingerprint:r.fingerprint,result_json:JSON.stringify(r.result)}));validateJournal(f.state,rows);
 assert.throws(()=>f.run('stock.receive',{locationId:'warehouse',lines:[{productId:pid,quantity:1}],source:' supplier ',proof:' paper-1 '},'owner'),code('SOURCE_DUPLICATE'));
});

test('login preserves exact password bytes including surrounding whitespace',async()=>{
 const imported=[],originalImport=crypto.subtle.importKey,originalDerive=crypto.subtle.deriveBits;
 crypto.subtle.importKey=async function(format,bytes,algorithm,...rest){if(algorithm==='PBKDF2')imported.push(new TextDecoder().decode(bytes));return originalImport.call(this,format,bytes,algorithm,...rest)};
 crypto.subtle.deriveBits=async()=>new Uint8Array(32).buffer;
 try {
 const calls=[];
 const response=await worker.fetch(new Request('http://example.test/api/login',{method:'POST',headers:{Origin:'http://example.test','Content-Type':'application/json'},body:JSON.stringify({username:'owner',password:'  secret-é \t'})}),{DEMO_MODE:'false',OPERATIONS_AUTH:JSON.stringify([{username:'owner',userId:'owner',salt:'ab'.repeat(16),hash:'00'.repeat(32),kdf:'pbkdf2-sha256-chain-v1',iterations:100000,passes:3}]),OPERATIONS:{getByName(){return {call:async c=>{calls.push(c);return c.action==='login'?{user:{id:'owner'}}:{}}}}}});
 assert.equal(response.status,200);assert.equal(imported[0],'  secret-é \t');assert.equal(imported.length,3);assert.equal(calls.at(-1).loginAllowed,true);
 } finally {crypto.subtle.importKey=originalImport;crypto.subtle.deriveBits=originalDerive;}
});


test('recovery scope stays stable across tokens, separates demo datasets and rejects mismatched writes before dispatch',async()=>{
 const room='11111111-1111-1111-1111-111111111111';let calls=0;
 const env={DEMO_MODE:'true',OPERATIONS:{getByName(){return {call:async()=>{calls++;return {user:null,csrfToken:'',demo:true}}}}}};
 async function session(cookie){return (await worker.fetch(new Request('http://example.test/api/session',{headers:{Cookie:`operations=${cookie}`}}),env)).json()}
 const first=await session(`${room}.token0000000.food`),renewed=await session(`${room}.token1111111.food`),retail=await session(`${room}.token0000000.retail`);
 assert.match(first.recoveryScope,/^[a-f0-9]{64}$/);assert.equal(first.recoveryScope,renewed.recoveryScope);assert.notEqual(first.recoveryScope,retail.recoveryScope);
 const before=calls;
 const response=await worker.fetch(new Request('http://example.test/api/commands',{method:'POST',headers:{Cookie:`operations=${room}.token0000000.retail`,Origin:'http://example.test','Content-Type':'application/json','X-Operations-Scope':first.recoveryScope},body:JSON.stringify({id:'must-not-run',type:'shift.open',payload:{}})}),env);
 assert.equal((await response.json()).error.code,'RECOVERY_SCOPE_INVALID');assert.equal(calls,before);
});
