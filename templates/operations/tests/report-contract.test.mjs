import assert from 'node:assert/strict';
import test from 'node:test';
import { report, csvReport } from '../src/domain/report.ts';
const t=n=>`2026-11-${String(n).padStart(2,'0')}T00:00:00.000Z`;
function fixture(){
 const line=(productId,total)=>({productId,sku:productId,name:productId,unit:'pcs',factor:1,quantity:1,baseQuantity:1,unitPrice:total,gross:total,discount:0,lineDiscount:0,net:total,taxBase:total,tax:0,service:0,serviceTax:0,total});
 const lines=[line('a',60),line('b',40)];
 const sale={id:'sale',locationId:'L',actorId:'owner',shiftId:'shift',quote:{lines,gross:100,discount:0,net:100,taxBase:100,tax:0,service:0,serviceTax:0,total:100},paymentId:'pay',tendered:120,change:20,recordedAt:t(2),occurredAt:t(1)};
 const mutation=(id,quantity,recordedAt,occurredAt=recordedAt)=>({id,documentId:id,locationId:'L',productId:'a',condition:'sellable',quantity,recordedAt,occurredAt});
 return {schemaVersion:1,businessId:'biz',revision:9,updatedAt:t(5),users:[{id:'owner',businessId:'biz',active:true,assignments:[{role:'owner',locationIds:['*']}]},{id:'local',businessId:'biz',active:true,assignments:[{role:'auditor',locationIds:['L']}]}],locations:[{id:'L',city:'one'},{id:'X',city:'two'}],products:[{id:'a'},{id:'b'}],sales:[sale],payments:[{id:'pay',locationId:'L',shiftId:'shift',actorId:'owner',amount:120,status:'confirmed',saleId:'sale',allocatedAt:t(2),recordedAt:t(2),statusHistory:[{status:'confirmed',recordedAt:t(2)}]},{id:'review',locationId:'L',actorId:'owner',amount:20,status:'failed',recordedAt:t(1),statusHistory:[{status:'review',recordedAt:t(1)},{status:'failed',recordedAt:t(4)}]}],returns:[{id:'ret',saleId:'sale',paymentId:'pay',locationId:'L',actorId:'owner',lines:[{lineIndex:0,quantity:1,amount:60}],amount:60,recordedAt:t(3)},{id:'money',paymentId:'pay',locationId:'L',actorId:'owner',lines:[],amount:10,recordedAt:t(3)}],mutations:[mutation('negative',-5,t(1)),mutation('late',10,t(4),t(2))],transfers:[{id:'tr',fromId:'L',toId:'X',createdAt:t(1),status:'closed',lines:[{productId:'a',sent:50}],findings:[]}],shifts:[{id:'shift',locationId:'L',actorId:'owner',openedAt:t(1),closedAt:t(4),openingCash:10,expectedCash:100},{id:'other',locationId:'X',actorId:'owner',openedAt:t(1)}],cashEntries:[{id:'cash',shiftId:'shift',amount:-7,recordedAt:t(2),reason:'=formula'},{id:'secret',shiftId:'other',amount:9999,recordedAt:t(2)}],counts:[{id:'count',locationId:'L',productId:'a',cutoff:t(1),status:'closed',physical:5}],documents:[{id:'negative',type:'stock.adjust',actorId:'owner',locationIds:['L'],recordedAt:t(1),occurredAt:t(1),data:{productId:'a'}},{id:'secret-doc',type:'stock.adjust',actorId:'owner',locationIds:['X'],recordedAt:t(1),occurredAt:t(1),data:{productId:'a'}}],audit:[],prices:[],promotions:[],profiles:[]};
}
const run=(s,query='')=>report(s,'owner',new URLSearchParams(query));
test('mixed basket preserves original receipt and selects matching line, receipt and refund money',()=>{
 const s=fixture(),r=run(s,'productId=a');
 assert.equal(r.sales[0].quote.total,100);assert.equal(r.sales[0].quote.lines.length,2);assert.equal(r.sales[0].selection.total,60);assert.equal(r.totals.bill,60);
 assert.equal(r.payments.length,1);assert.equal(r.payments[0].amount,120);assert.equal(r.payments[0].selection.amount,60);assert.equal(r.totals.confirmedReceipts,60);assert.equal(r.totals.refund,60);
 assert.equal(r.totals.unattributedRefund,10);assert.equal(r.unattributedRefunds[0].amount,10);assert.equal(r.shifts.length,0);assert.equal(r.cashEntries.length,0);
 assert.equal(run(s).totals.confirmedReceipts,100);assert.equal(run(s).totals.refund,70);
 r.sales[0].quote.total=999;assert.equal(s.sales[0].quote.total,100);
});
test('recorded balance cutoff recomputes negative; occurred analysis includes late knowledge',()=>{
 const s=fixture(),q=`to=${t(3)}`;
 const known=run(s,q),occurred=run(s,q+'&basis=occurred');
 assert.equal(known.balances[0].sellable,-5);assert.equal(known.balances[0].negative,true);
 assert.equal(occurred.balances[0].sellable,5);assert.equal(occurred.balances[0].negative,false);assert.equal(occurred.mutations.find(m=>m.id==='late').late,true);
 assert.equal(known.payments.find(p=>p.id==='review').status,'review');assert.equal(known.totals.reviewReceipts,20);
 assert.equal(occurred.payments.find(p=>p.id==='review').status,'failed');
 assert.equal(known.transfers[0].temporalKind,'current_metadata');assert.equal(known.transfers[0].status,'closed');assert.equal(known.shifts[0].temporalKind,'current_metadata');assert.equal(known.counts[0].temporalKind,'current_metadata');
 assert.equal(run(s,`from=${t(3)}`).sales.length,0);assert.equal(run(s,`from=${t(3)}`).transfers.length,0);assert.equal(run(s,`from=${t(3)}`).counts.length,0);
 assert.equal(run(s,`from=${t(3)}`).balances[0].sellable,5);
});
test('allocation after recorded cutoff cannot turn earlier receipt into a SKU payment',()=>{
 const s=fixture();s.payments[0].recordedAt=t(1);s.payments[0].allocatedAt=t(4);
 const old=run(s,`to=${t(3)}`);assert.equal(old.payments[0].saleId,undefined);assert.equal(old.payments[0].selection.amount,120);
 assert.equal(run(s,`to=${t(3)}&productId=a`).payments.length,0);
});
test('location, city and permissions scope cash and documents; internal transfer never contributes sales',()=>{
 const s=fixture(),r=run(s,'city=one');assert.deepEqual(r.cashEntries.map(e=>e.id),['cash']);assert.deepEqual(r.documents.map(e=>e.id),['negative']);
 s.sales=[];assert.equal(run(s).totals.bill,0);assert.equal(run(s).transfers.length,1);
 assert.throws(()=>report(s,'local',new URLSearchParams('locationId=X')),e=>e.code==='FORBIDDEN');
 const local=report(s,'local',new URLSearchParams());assert.equal(local.balances.some(b=>b.locationId==='X'),false);assert.equal(local.documents.some(d=>d.id==='secret-doc'),false);
 assert.equal(run(s,'locationId=L&city=two').cashEntries.length,0);
});
test('CSV contains all sections and exact report revision/filters; guards text formulas, retains numeric negatives',()=>{
 const s=fixture(),r=run(s,'locationId=L'),csv=csvReport(r,9);
 for(const section of ['balances','mutations','transfers','sales','saleLines','refunds','unattributedRefunds','unattributedPayments','payments','shifts','cashEntries','counts','documents','exceptions'])assert.ok(csv.includes(`\r\n"${section}"\r\n`),section);
 assert.ok(csv.includes('"gross","discount","net","taxBase","tax","service","serviceTax","total"'));
 assert.ok(csv.includes('"\'=formula"'));assert.ok(csv.includes(',-7,'));assert.ok(!csv.includes('"secret"'));assert.ok(csv.includes('locationId'));
 assert.throws(()=>csvReport(r,8),e=>e.code==='REPORT_REVISION');assert.throws(()=>run(s,'revision=8'),e=>e.code==='REPORT_REVISION');
 s.revision=10;s.cashEntries=[];assert.equal(csvReport(r),csv);assert.equal(run(s).revision,10);
});
test('status filters have explicit per-section semantics and validate report range',()=>{
 const s=fixture(),r=run(s,'status=negative&to='+t(3));assert.equal(r.balances.length,1);assert.equal(r.sales.length,0);assert.equal(r.payments.length,0);
 assert.throws(()=>run(s,'basis=invalid'),e=>e.code==='REPORT_BASIS');assert.throws(()=>run(s,`from=${t(4)}&to=${t(1)}`),e=>e.code==='REPORT_RANGE');
});

test('historical outbound transit uses transfer ledger cutoff and selected source location',()=>{
 const s=fixture();s.mutations.push({id:'sent',documentId:'tr',locationId:'tr',productId:'a',condition:'transit',quantity:50,occurredAt:t(1),recordedAt:t(1)},{id:'received',documentId:'tr',locationId:'tr',productId:'a',condition:'transit',quantity:-50,occurredAt:t(2),recordedAt:t(4)});
 assert.equal(run(s,`locationId=L&productId=a&to=${t(3)}`).balances[0].transit,50);
 assert.equal(run(s,`locationId=L&productId=a&to=${t(3)}&basis=occurred`).balances[0].transit,0);
 assert.equal(run(s,'locationId=X&productId=a').balances[0].transit,0);
 assert.equal(run(s,'productId=a').unattributedPayments.find(p=>p.id==='review').selection.attribution,'unattributed');
});
