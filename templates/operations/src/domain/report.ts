import type { OperationsState, QuoteLine } from './contract.ts';
import { snapshot, check, instant, canonical, stockLookup } from './core.ts';

const moneyKeys = ['gross','discount','net','taxBase','tax','service','serviceTax','total'] as const;
function selectedLines(lines: QuoteLine[]) {
 return {lines, ...Object.fromEntries(moneyKeys.map(key=>[key,lines.reduce((sum,line)=>sum+line[key],0)]))} as {lines: QuoteLine[]} & Record<typeof moneyKeys[number],number>;
}
/** A report is a detached, permission-filtered revision, suitable for exporting without rereading state. */
export function report(s: OperationsState, userId: string, query: URLSearchParams) {
 const view=snapshot(s,userId);
 const requestedRevision=query.get('revision');
 if(requestedRevision!==null)check(requestedRevision===String(view.revision),'REPORT_REVISION','Report revision changed; refresh before export');
 const locationId=query.get('locationId')||null,city=query.get('city')||null,productId=query.get('productId')||null,status=query.get('status')||null;
 if(locationId)check(view.locations.some(l=>l.id===locationId),'FORBIDDEN','Location outside your scope');
 const allowed=new Set(view.locations.filter(l=>(!locationId||l.id===locationId)&&(!city||l.city===city)).map(l=>l.id));
 const basis=query.get('basis')??'recorded';check(basis==='recorded'||basis==='occurred','REPORT_BASIS','Use recorded or occurred basis');
 const from=query.get('from')?instant(query.get('from')):undefined,to=query.get('to')?instant(query.get('to')):undefined;
 check(!from||!to||from<=to,'REPORT_RANGE','Invalid report interval');
 const time=(x:{recordedAt:string;occurredAt?:string})=>basis==='occurred'?(x.occurredAt??x.recordedAt):x.recordedAt;
 const inTime=(x:{recordedAt:string;occurredAt?:string})=>(!from||time(x)>=from)&&(!to||time(x)<=to);
 const beforeEnd=(x:{recordedAt:string;occurredAt?:string})=>!to||time(x)<=to;
 const hasStatus=(value:string)=>!status||status===value;
 const sku=(id:string|undefined)=>!productId||id===productId;
 // Original quotes remain intact; consumers must render selection for SKU totals.
 const sales=view.sales.filter(x=>allowed.has(x.locationId)&&inTime(x)&&x.quote.lines.some(l=>sku(l.productId))&&hasStatus('completed')).map(x=>({...x,selection:selectedLines(x.quote.lines.filter(l=>sku(l.productId)))}));
 const saleById=new Map(view.sales.map(x=>[x.id,x]));
 const paymentCandidates=view.payments.filter(x=>allowed.has(x.locationId)&&inTime(x)).map(p=>{
  const cutoff=basis==='recorded'?to:undefined;
  const history=p.statusHistory?.filter(h=>!cutoff||h.recordedAt<=cutoff).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt));
  const knownStatus=history?.at(-1)?.status??(p.statusHistory?.length?'pending':p.status);
  const allocated=!cutoff||(p.allocatedAt??saleById.get(p.saleId??'')?.recordedAt??p.recordedAt)<=cutoff;
  const sale=allocated?saleById.get(p.saleId??''):undefined;
  const selection=sale?selectedLines(sale.quote.lines.filter(l=>sku(l.productId))):undefined;
  const selectedAmount=productId?(selection?.total??0):(sale?.quote.total??p.amount);
  return {...p,status:knownStatus,saleId:allocated?p.saleId:undefined,selection:{amount:selectedAmount,attribution:sale?'sale_lines' as const:'unattributed' as const},statusBasis:'recorded' as const,statusCutoff:cutoff??view.updatedAt};
 }).filter(p=>hasStatus(p.status));
 const payments=paymentCandidates.filter(p=>!productId||p.selection.attribution==='sale_lines'&&saleById.get(p.saleId??'')?.quote.lines.some(l=>sku(l.productId)));
 const unattributedPayments=paymentCandidates.filter(p=>p.selection.attribution==='unattributed').map(p=>({...p,scope:'location_time_without_sku' as const}));
 const refundCandidates=view.returns.filter(r=>allowed.has(r.locationId)&&inTime(r)&&hasStatus('refunded'));
 const refunds=refundCandidates.map(r=>{
  const sale=saleById.get(r.saleId??'');
  const lines=r.lines.filter(l=>!productId||!!sale&&sku(sale.quote.lines[l.lineIndex]?.productId));
  const attributed=r.lines.reduce((sum,l)=>sum+l.amount,0);
  return {...r,selection:{lines,amount:productId?lines.reduce((sum,l)=>sum+l.amount,0):r.amount,unattributedAmount:r.amount-attributed}};
 }).filter(r=>!productId||r.selection.lines.length>0);
 // Money-only refunds have no honest SKU attribution. Retain them explicitly outside SKU totals.
 const unattributedRefunds=refundCandidates.filter(r=>r.amount!==r.lines.reduce((sum,l)=>sum+l.amount,0)).map(r=>({id:r.id,paymentId:r.paymentId,locationId:r.locationId,recordedAt:r.recordedAt,amount:r.amount-r.lines.reduce((sum,l)=>sum+l.amount,0),scope:'location_time_without_sku' as const}));
 const lines=sales.flatMap(x=>x.selection.lines),sum=selectedLines(lines);
 const refundAmount=refunds.reduce((a,r)=>a+r.selection.amount,0);
 const confirmedReceipts=payments.filter(p=>p.status==='confirmed').reduce((a,p)=>a+p.selection.amount,0);
 const totals={gross:sum.gross,discount:sum.discount,netGoods:sum.net,taxBase:sum.taxBase,goodsTax:sum.tax,service:sum.service,serviceTax:sum.serviceTax,bill:sum.total,refund:refundAmount,confirmedReceipts,reviewReceipts:payments.filter(p=>p.status==='review').reduce((a,p)=>a+p.selection.amount,0),netReceipts:confirmedReceipts-refundAmount,unattributedRefund:unattributedRefunds.reduce((a,r)=>a+r.amount,0),unattributedConfirmedReceipts:unattributedPayments.filter(p=>p.status==='confirmed').reduce((a,p)=>a+p.amount,0),unattributedReviewReceipts:unattributedPayments.filter(p=>p.status==='review').reduce((a,p)=>a+p.amount,0)};
 const mutations=view.mutations.filter(m=>allowed.has(m.locationId)&&inTime(m)&&sku(m.productId)&&hasStatus('posted')).map(m=>({...m,late:m.occurredAt<m.recordedAt}));
 const metadata={temporalKind:'current_metadata' as const,asOfRevision:view.revision,asOf:view.updatedAt};
 const transfers=view.transfers.filter(t=>(allowed.has(t.fromId)||allowed.has(t.toId))&&inTime({recordedAt:t.createdAt})&&t.lines.some(l=>sku(l.productId))&&hasStatus(t.status)).map(t=>({...t,selection:{lines:t.lines.filter(l=>sku(l.productId))},...metadata}));
 const shifts=view.shifts.filter(sh=>allowed.has(sh.locationId)&&inTime({recordedAt:sh.openedAt})&&!productId&&hasStatus(sh.closedAt?'closed':'open')).map(sh=>({...sh,...metadata}));
 const cashEntries=view.cashEntries.filter(e=>view.shifts.some(sh=>sh.id===e.shiftId&&allowed.has(sh.locationId))&&inTime(e)&&!productId&&hasStatus('posted'));
 const counts=view.counts.filter(c=>allowed.has(c.locationId)&&sku(c.productId)&&inTime({recordedAt:c.cutoff})&&hasStatus(c.status)).map(c=>({...c,...metadata}));
 const historicalMutations=view.mutations.filter(beforeEnd),quantityAt=stockLookup(historicalMutations);
 const origins=new Map(view.transfers.map(t=>[t.id,t.fromId]));
 const outbound=stockLookup(historicalMutations.filter(m=>m.condition==='transit'&&origins.has(m.locationId)).map(m=>({...m,locationId:origins.get(m.locationId)!})));
 const balances=view.balances.filter(b=>allowed.has(b.locationId)&&sku(b.productId)).map(b=>{
  const sellable=quantityAt(b.locationId,b.productId);return {...b,sellable,held:quantityAt(b.locationId,b.productId,'held'),transit:outbound(b.locationId,b.productId,'transit'),negative:sellable<0};
 }).filter(b=>hasStatus(b.negative?'negative':'nonnegative'));
 const refs=new Set([...sales,...refunds,...payments,...mutations,...transfers,...counts,...shifts,...cashEntries].flatMap(x=>[x.id,...('documentId' in x?[x.documentId]:[])]));
 const containsSku=(v:unknown):boolean=>!!v&&typeof v==='object'&&(Array.isArray(v)?v.some(containsSku):Object.entries(v).some(([k,x])=>k==='productId'?x===productId:containsSku(x)));
 // All locations must be allowed: a broad document must never leak unrelated financial data.
 const documents=view.documents.filter(d=>d.locationIds.length>0&&d.locationIds.every(l=>allowed.has(l))&&inTime(d)&&(!productId||containsSku(d.data)||refs.has(d.id)||!!d.sourceId&&refs.has(d.sourceId))&&(!status||refs.has(d.id)||!!d.sourceId&&refs.has(d.sourceId)));
 const exceptions=view.exceptions.filter(e=>allowed.has(e.locationId)&&(!productId||e.productId===productId)&&hasStatus(e.type)).map(e=>({...e,...metadata}));
 return structuredClone({schemaVersion:1,businessId:view.businessId,revision:view.revision,generatedAt:view.updatedAt,basis,filters:{locationId,city,productId,status,from,to},temporalContract:{balances:'cumulative_through_to',events:'inclusive_from_to',workflow:'current_metadata_filtered_by_creation_or_count_cutoff',status:'section_status; sales=completed, refunds=refunded, ledger/cash=posted, balances=negative|nonnegative',skuUnattributed:'cash/shifts excluded under SKU; unattributedRefunds remain location/time scoped',knowledge:basis==='recorded'?'known_by_to':'current_revision_by_occurred_time'},totals,sales,refunds,unattributedRefunds,unattributedPayments,payments,mutations,transfers,shifts,cashEntries,counts,balances,documents,exceptions});
}
export function csvReport(value: ReturnType<typeof report>, requestedRevision?: number|string) {
 if(requestedRevision!==undefined)check(String(requestedRevision)===String(value.revision),'REPORT_REVISION','CSV must use the displayed report revision');
 const esc=(v:unknown)=>{if(typeof v==='number')return String(v);let t=typeof v==='object'?canonical(v):String(v??'');if(/^[\s\u0000-\u001f]*[=+@-]|^[\t\r\n]/.test(t))t=`'${t}`;return `"${t.replaceAll('"','""')}"`;};
 const rows:unknown[][]=[['report'],['businessId','revision','generatedAt','basis','filters','temporalContract'],[value.businessId,value.revision,value.generatedAt,value.basis,value.filters,value.temporalContract],['totals'],['metric','IDR'],...Object.entries(value.totals)];
 for(const section of ['balances','mutations','transfers','sales','refunds','unattributedRefunds','unattributedPayments','payments','shifts','cashEntries','counts','documents','exceptions'] as const){
  rows.push([section]);const records=value[section];const keys=[...new Set(records.flatMap(row=>Object.keys(row)))];
  if(keys.length){rows.push(keys);for(const row of records)rows.push(keys.map(key=>(row as unknown as Record<string,unknown>)[key]));}
 }
 // Explicit line sections make taxes/discounts/fees inspectable without parsing receipt JSON.
 rows.push(['saleLines'],['saleId','productId','gross','discount','net','taxBase','tax','service','serviceTax','total']);
 for(const sale of value.sales)for(const line of sale.selection.lines)rows.push([sale.id,line.productId,...moneyKeys.map(k=>line[k])]);
 return '\uFEFF'+rows.map(r=>r.map(esc).join(',')).join('\r\n');
}
