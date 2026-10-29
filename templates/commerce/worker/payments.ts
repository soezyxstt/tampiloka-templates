import type { Env, Row, Session } from './types.ts';
import { configFor, orderFor, orderFrom, q } from './db.ts';
import { mutateOrder, rawOrder } from './orders.ts';
import { capabilities, digest, fail, now, requireFeature, safeEqual, staff, text } from './security.ts';

function credentials(env:Env) {
  if(!env.MIDTRANS_SERVER_KEY) fail(503,'GATEWAY_NOT_CONFIGURED','Kunci Midtrans belum dipasang di server.');
  const production=env.MIDTRANS_ENVIRONMENT==='production';
  return { snap:production?'https://app.midtrans.com':'https://app.sandbox.midtrans.com',api:production?'https://api.midtrans.com':'https://api.sandbox.midtrans.com',headers:{Authorization:`Basic ${btoa(`${env.MIDTRANS_SERVER_KEY}:`)}`,'Content-Type':'application/json',Accept:'application/json'} };
}
async function providerFetch(url:string,init:RequestInit):Promise<Row> {
  let response:Response; try { response=await fetch(url,{...init,signal:AbortSignal.timeout(15000)}); } catch { return fail(502,'GATEWAY_UNREACHABLE','Penyedia pembayaran belum memberi jawaban. Pesanan tetap tersimpan. Coba lagi.'); }
  let data:Row; try { data=await response.json() as Row; } catch { return fail(502,'GATEWAY_ERROR','Jawaban penyedia pembayaran tidak valid.'); }
  if(!response.ok) fail(502,'GATEWAY_ERROR','Penyedia pembayaran belum dapat memproses permintaan. Pesanan tetap tersimpan.'); return data;
}
export async function startPayment(env:Env,session:Session,orderId:string) {
  const cfg=await configFor(env,session); requireFeature(capabilities(cfg.level),'gateway');
  const row=await rawOrder(env,session,orderId);
  if(row.payment_method!=='midtrans'||row.status!=='awaiting_payment'||!['pending','unpaid'].includes(row.payment_status)) fail(409,'INVALID_TRANSITION','Pesanan ini tidak menunggu pembayaran gateway.');
  if(session.demo||row.payment_url) return orderFrom(env,row);
  const c=credentials(env); const customer=JSON.parse(row.customer_json);
  if(row.total<1) fail(422,'INVALID_TOTAL','Jumlah pembayaran online harus lebih dari nol.');
  const data=await providerFetch(`${c.snap}/snap/v1/transactions`,{method:'POST',headers:{...c.headers,'Idempotency-Key':row.id},body:JSON.stringify({transaction_details:{order_id:row.gateway_order_id,gross_amount:row.total},customer_details:{first_name:customer.name,email:customer.email||undefined,phone:customer.phone},expiry:{unit:'hours',duration:24},credit_card:{secure:true}})});
  let url:URL; try{url=new URL(data.redirect_url);}catch{return fail(502,'GATEWAY_ERROR','Tautan pembayaran tidak tersedia.');}
  if(url.origin!==c.snap) fail(502,'GATEWAY_ERROR','Tautan pembayaran dari penyedia tidak valid.');
  return mutateOrder(env,session,row,{payment_url:url.href},'payment-created','Tautan pembayaran siap','','provider');
}
export async function simulatePayment(env:Env,session:Session,input:Row) {
  if(!session.demo) fail(403,'DEMO_ONLY','Simulasi hanya tersedia pada demo.');
  const cfg=await configFor(env,session); requireFeature(capabilities(cfg.level),'gateway');
  const orderId=text(input.orderId,'Pesanan',100,true); const row=await rawOrder(env,session,orderId,true);
  if(row.payment_method!=='midtrans') fail(409,'INVALID_PAYMENT','Simulasi ini hanya untuk pembayaran gateway demo.');
  if(!['paid','failed'].includes(input.status)) fail(422,'INVALID_STATUS','Pilih hasil simulasi pembayaran.');
  if(row.payment_status===input.status) return orderFrom(env,row);
  if(row.status!=='awaiting_payment'||!['pending','unpaid'].includes(row.payment_status)) fail(409,'INVALID_TRANSITION','Pembayaran sudah diproses.');
  return mutateOrder(env,session,row,input.status==='paid'?{payment_status:'paid',status:'confirmed',expires_at:null}:{payment_status:'failed',status:'cancelled',stock_restored:1,coupon_released:1,expires_at:null},`demo-payment-${input.status}`,input.status==='paid'?'Simulasi pembayaran berhasil':'Simulasi pembayaran gagal','Tidak ada uang yang dipindahkan.','demo');
}
function amount(value:unknown) { if(typeof value!=='string'&&typeof value!=='number') return NaN; if(!/^\d+(?:\.0{1,2})?$/.test(String(value))) return NaN; return Number(value); }
function successful(data:Row) { return String(data.status_code)==='200'&&['settlement','capture'].includes(data.transaction_status)&&(!data.fraud_status||data.fraud_status==='accept'); }
async function applyProviderStatus(env:Env,row:Row,data:Row,eventKey:string) {
  if(data.order_id!==row.gateway_order_id||amount(data.gross_amount)!==row.total) fail(409,'PAYMENT_MISMATCH','Nilai pembayaran tidak sesuai dengan pesanan.');
  const session:Session={scope:row.scope,tokenHash:'provider',role:'owner',demo:false};
  const event=q(env,'INSERT INTO payment_events(event_key,order_id,status,created_at) VALUES(?,?,?,?)',eventKey,row.id,String(data.transaction_status),now());
  if(await q(env,'SELECT event_key FROM payment_events WHERE event_key=?',eventKey).first()) return {ok:true,duplicate:true};
  let changes:Row|null=null; let label='Status pembayaran diterima';
  if(successful(data)&&!['paid','refunded'].includes(row.payment_status)) {
    changes=row.status==='cancelled'?{payment_status:'refund_due'}:{payment_status:'paid',status:row.status==='awaiting_payment'?'confirmed':row.status,expires_at:null};
    label=row.status==='cancelled'?'Pembayaran masuk setelah pembatalan; perlu refund':'Pembayaran dikonfirmasi Midtrans';
  } else if(['deny','cancel','expire','failure'].includes(data.transaction_status)&&['unpaid','pending','failed'].includes(row.payment_status)&&row.status==='awaiting_payment') {
    changes={payment_status:'failed',status:'cancelled',stock_restored:1,coupon_released:1,expires_at:null}; label='Pembayaran tidak selesai; pesanan dibatalkan';
  } else if(data.transaction_status==='refund'&&['paid','refund_due'].includes(row.payment_status)) {
    const confirmed=Boolean(data.bank_confirmed_at)||(Array.isArray(data.refunds)&&data.refunds.length>0&&data.refunds.every((r:Row)=>Boolean(r.bank_confirmed_at)));
    const refunded=amount(data.refund_amount ?? row.total);
    if(confirmed&&refunded===row.total) {changes={payment_status:'refunded',return_status:row.return_status==='received'?'refunded':row.return_status};label='Pengembalian uang dikonfirmasi penyedia';}
    else {changes={payment_status:'refund_due'};label='Pengembalian uang menunggu konfirmasi penyedia';}
  }
  try {
    if(changes) await mutateOrder(env,session,row,changes,'payment-webhook',label,'','provider',[event]);
    else await event.run();
  } catch(error) { if(await q(env,'SELECT event_key FROM payment_events WHERE event_key=?',eventKey).first()) return {ok:true,duplicate:true};throw error; }
  return {ok:true};
}
export async function paymentWebhook(env:Env,input:Row) {
  const c=credentials(env); const orderId=text(input.order_id,'order_id',50,true); const signature=text(input.signature_key,'signature_key',128,true);
  const expected=await digest(`${orderId}${input.status_code}${input.gross_amount}${env.MIDTRANS_SERVER_KEY}`,'SHA-512');
  if(!/^[a-f0-9]{128}$/i.test(signature)||!safeEqual(signature.toLowerCase(),expected)) fail(403,'INVALID_SIGNATURE','Tanda tangan pembayaran tidak valid.');
  const row=await q(env,'SELECT o.* FROM orders o JOIN scopes s ON s.id=o.scope WHERE o.gateway_order_id=? AND s.demo=0',orderId).first<Row>();
  if(!row) fail(404,'ORDER_NOT_FOUND','Pesanan tidak ditemukan.');
  // The legacy signature does not include transaction_status. Re-query Midtrans.
  const canonical=await providerFetch(`${c.api}/v2/${encodeURIComponent(orderId)}/status`,{method:'GET',headers:c.headers});
  const eventKey=await digest(JSON.stringify([orderId,canonical.transaction_id,canonical.transaction_status,canonical.gross_amount,canonical.refund_amount,canonical.bank_confirmed_at,canonical.refunds]));
  return applyProviderStatus(env,row,canonical,eventKey);
}
export async function reconcilePayment(env:Env,session:Session,orderId:string) {
  const row=await rawOrder(env,session,orderId,session.role!=='customer');
  if(row.payment_method!=='midtrans') fail(422,'INVALID_PAYMENT','Pesanan tidak memakai Midtrans.');
  if(session.demo) return orderFrom(env,row);
  const c=credentials(env); const canonical=await providerFetch(`${c.api}/v2/${encodeURIComponent(row.gateway_order_id)}/status`,{method:'GET',headers:c.headers});
  const eventKey=await digest(JSON.stringify([row.gateway_order_id,canonical.transaction_id,canonical.transaction_status,canonical.gross_amount,canonical.refund_amount,canonical.bank_confirmed_at,canonical.refunds]));
  await applyProviderStatus(env,row,canonical,eventKey); return orderFor(env,session,orderId,true);
}
export async function gatewayRefund(env:Env,session:Session,orderId:string,input:Row) {
  staff(session,true,true); const row=await rawOrder(env,session,orderId,true);
  if(row.payment_method!=='midtrans'||session.demo) fail(422,'INVALID_PAYMENT','Gunakan alur pengembalian uang pesanan ini.');
  if(row.payment_status==='refunded'||row.gateway_refund_requested) return orderFrom(env,row);
  if(row.payment_status!=='refund_due') fail(409,'INVALID_TRANSITION','Pesanan belum menunggu pengembalian uang.');
  const c=credentials(env);const reason=text(input.note||'Pengembalian pesanan','Alasan refund',250,true);
  const result=await providerFetch(`${c.api}/v2/${encodeURIComponent(row.gateway_order_id)}/refund`,{method:'POST',headers:c.headers,body:JSON.stringify({refund_key:`refund-${row.id}`,amount:row.total,reason})});
  if(!['200','201'].includes(String(result.status_code))) fail(409,'REFUND_REJECTED','Penyedia belum menerima refund. Periksa dukungan metode bayar di Midtrans.');
  // Approval of a request is distinct from confirmed receipt by the payer's bank.
  return mutateOrder(env,session,row,{gateway_refund_requested:1},'refund-requested','Refund diajukan ke Midtrans',reason,'owner');
}
