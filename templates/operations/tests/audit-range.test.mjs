import test from 'node:test';
import assert from 'node:assert/strict';
import {auditRange} from '../src/lib/audit-range.ts';

test('audit UTC date range includes the final day and compares instants across offsets',()=>{
 const range=auditRange('2026-11-01','2026-11-02');
 assert.equal(range.valid,true);
 for(const date of ['2026-11-01T00:00:00.000Z','2026-11-02T23:59:59.999Z','2026-11-03T06:59:59.999+07:00'])assert.equal(range.includes(date),true,date);
 for(const date of ['2026-10-31T23:59:59.999Z','2026-11-03T00:00:00Z','invalid'])assert.equal(range.includes(date),false,date);
});
test('audit rejects reversed or impossible dates and supports open-ended periods',()=>{
 for(const [from,to] of [['2026-11-03','2026-11-01'],['2026-02-30',''],['','2026-13-01'],['bad','']]){
 const range=auditRange(from,to);assert.equal(range.valid,false);assert.equal(range.includes('2026-11-01T00:00:00Z'),false);
 }
 assert.equal(auditRange('','').includes('2020-01-01T00:00:00Z'),true);
 assert.equal(auditRange('2026-11-01','').includes('2026-12-31T00:00:00Z'),true);
 assert.equal(auditRange('','2026-11-01').includes('2026-11-02T00:00:00Z'),false);
 assert.equal(auditRange('2024-02-29','2024-02-29').valid,true);
});
