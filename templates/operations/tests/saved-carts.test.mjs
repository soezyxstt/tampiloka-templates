import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,openShift,pid,outlet} from './domain-support.mjs';

test('saved carts preserve input, remain cashier scoped, and close when replaced or cancelled',()=>{
 const f=fixture(),payload={locationId:outlet,lines:[{productId:pid,quantity:2}],customerId:'customer',voucherCode:''};
 const first=f.run('cart.save',payload,'cashier');
 assert.equal(f.balance(),0);
 assert.deepEqual(f.state.documents.find(d=>d.id===first.documentId).data.lines,payload.lines);
 assert.throws(()=>f.run('cart.save',{...payload,sourceId:first.documentId},'owner'),{code:'SOURCE_INVALID'});
 const second=f.run('cart.save',{...payload,sourceId:first.documentId},'cashier');
 assert.throws(()=>f.run('sale.quote',{...payload,sourceId:first.documentId},'cashier'),{code:'CART_CLOSED'});
 f.run('cart.cancel',{locationId:outlet,sourceId:second.documentId},'cashier');
 assert.throws(()=>f.run('cart.save',{...payload,sourceId:second.documentId},'cashier'),{code:'CART_CLOSED'});
 assert.equal(f.balance(),0);
});

test('quote leaves saved cart open; a completed sale consumes it exactly once',()=>{
 const f=fixture(),shiftId=openShift(f),payload={locationId:outlet,shiftId,lines:[{productId:pid,quantity:2}]};
 const saved=f.run('cart.save',payload,'cashier');
 const linked={...payload,sourceId:saved.documentId};
 const quote=f.run('sale.quote',linked,'cashier').data.quote;
 const command={...linked,quoteFingerprint:quote.fingerprint,payment:{method:'cash',amount:quote.total}};
 const sale=f.run('sale.complete',command,'cashier','finalize-saved');
 assert.equal(f.balance(),-2);
 assert.deepEqual(f.run('sale.complete',command,'cashier','finalize-saved'),sale);
 assert.throws(()=>f.run('sale.complete',command,'cashier','duplicate-saved'),{code:'CART_CLOSED'});
 assert.equal(f.state.sales.length,1);
});
