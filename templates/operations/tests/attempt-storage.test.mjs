import test from 'node:test';
import assert from 'node:assert/strict';
import {persistAttempt,pendingAttempts,removeAttempt,attemptStoragePrefix} from '../src/lib/attempt-storage.ts';
function storage(){const map=new Map();return {get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}}
const scope='a'.repeat(64),otherScope='b'.repeat(64);
const attempt=(id,userId='cashier')=>({id,userId,type:'sale.complete',payload:{locationId:'a',lines:[{productId:'sku',quantity:1}]},createdAt:'2026-11-10T00:00:00Z'});
test('pending identities survive reopening, remain scoped and are removed individually',()=>{
 const disk=storage();persistAttempt(scope,attempt('one'),disk);persistAttempt(scope,attempt('two','other-user'),disk);persistAttempt(otherScope,attempt('one'),disk);
 // A new reader has no in-memory/tab state; durable keys remain authoritative.
 assert.deepEqual(pendingAttempts(scope,disk).map(a=>a.id),['one','two']);
 removeAttempt(scope,'one',disk);assert.deepEqual(pendingAttempts(scope,disk).map(a=>a.id),['two']);
 assert.equal(pendingAttempts(otherScope,disk).length,1);
 persistAttempt(scope,attempt('two','other-user'),disk);
 assert.throws(()=>persistAttempt(scope,{...attempt('two'),payload:{changed:true}},disk),/idempotency_mismatch/);
});
test('storage failure or corrupt command blocks recovery instead of silently losing evidence',()=>{
 const disk=storage();disk.setItem=()=>{throw new Error('quota')};assert.throws(()=>persistAttempt(scope,attempt('one'),disk),/recovery_storage_unavailable/);
 const corrupt=storage();corrupt.setItem(`${attemptStoragePrefix}${scope}:one`,'broken');assert.throws(()=>pendingAttempts(scope,corrupt),/recovery_storage_invalid/);
 assert.throws(()=>pendingAttempts('untrusted',corrupt),/recovery_scope_invalid/);
});
