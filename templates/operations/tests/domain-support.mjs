import { createInitialState } from '../src/domain/seed.ts';
import { execute } from '../src/domain/engine.ts';
import { stock } from '../src/domain/core.ts';
export const pid='cimol-ori',outlet='outlet-a';
export function fixture(demo=true){let state=createInitialState(demo,'2026-11-10T00:00:00.000Z'),journal=Object.create(null),sequence=0;
 return {get state(){return state},get journal(){return journal},run(type,payload={},actor='owner',id=`cmd-${++sequence}`,now=new Date(Date.parse('2026-11-10T01:00:00Z')+sequence*1000).toISOString()){const result=execute(state,actor,{id,type,payload},journal,now);state=result.state;journal[id]=result.stored;return result.result;},balance(l=outlet,c='sellable'){return stock(state,l,pid,c);}};
}
export function shipment(f,quantity=200){const r=f.run('transfer.draft',{fromId:'warehouse',toId:outlet,lines:[{productId:pid,quantity}]},'inventory');f.run('transfer.send',{transferId:r.documentId},'inventory');return r.documentId;}
export function openShift(f,actor='cashier',openingCash=100000){return f.run('shift.open',{locationId:outlet,openingCash},actor).documentId;}
export function sell(f,shiftId,quantity=5,extra={},actor='cashier',id){const p={locationId:outlet,shiftId,lines:[{productId:pid,quantity}],...extra};const q=f.run('sale.quote',p,actor).data.quote;return f.run('sale.complete',{...p,quoteFingerprint:q.fingerprint,...(q.total?{payment:{method:'cash',amount:q.total}}:{})},actor,id);}
export const approval={reason:'Verified physical evidence',exceptionReason:'Owner validates evidence in small-team configuration'};
