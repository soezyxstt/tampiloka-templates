import { shippingMethods } from '../content/store.ts';
import type { Customer, Order, Quote, StoreConfig } from '../src/shared/contracts.ts';
import type { D1Statement, Env, Row, Session } from './types.ts';
import { all, auditStatement, bootstrap, configFor, eventStatement, orderFor, orderFrom, q, versionGuard } from './db.ts';
import { capabilities, digest, fail, id, integer, now, requireFeature, staff, text } from './security.ts';

function cartItems(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) fail(422,'INVALID_CART','Pilih 1 hingga 50 barang untuk melanjutkan.');
  const map = new Map<string,number>();
  for (const row of value) {
    if (!row || typeof row !== 'object') fail(422,'INVALID_CART','Isi keranjang tidak valid.');
    const variantId = text(row.variantId,'Varian',100,true); const quantity = integer(row.quantity,'Jumlah',1,99);
    const sum = (map.get(variantId)||0)+quantity; if (sum>99) fail(422,'INVALID_QUANTITY','Jumlah satu varian maksimal 99.'); map.set(variantId,sum);
  }
  return [...map].map(([variantId,quantity])=>({variantId,quantity})).sort((a,b)=>a.variantId.localeCompare(b.variantId));
}
export async function quoteFor(env: Env, session: Session, input: Row, config?: StoreConfig): Promise<Quote> {
  const cfg = config || await configFor(env,session); const cap = capabilities(cfg); requireFeature(cap,'cart');
  const items = cartItems(input.items); const shippingId = text(input.shippingMethodId || 'regular','Pengiriman',50,true);
  const shipping = (cfg.shippingMethods||shippingMethods).find(s=>s.id===shippingId); if (!shipping) fail(422,'INVALID_SHIPPING','Pilih layanan pengiriman yang tersedia.');
  const variants = await all(env,'SELECT v.*,p.name AS product_name,p.images_json,p.active FROM variants v JOIN products p ON p.scope=v.scope AND p.id=v.product_id WHERE v.scope=?',session.scope);
  const lines = items.map(item=>{
    const v = variants.find(v=>v.id===item.variantId);
    if (!v || !v.active) fail(422,'PRODUCT_UNAVAILABLE','Salah satu barang sudah tidak tersedia.');
    if (v.stock<item.quantity) fail(409,'OUT_OF_STOCK',`Stok ${v.product_name} (${v.name}) tidak cukup. Sisa ${v.stock}.`);
    return {variantId:v.id,productId:v.product_id,name:v.product_name,variantName:v.name,image:JSON.parse(v.images_json)[0]||'',unitPrice:v.price,quantity:item.quantity,subtotal:v.price*item.quantity};
  });
  const subtotal = lines.reduce((sum,i)=>sum+i.subtotal,0); integer(subtotal,'Total barang',0,2_000_000_000);
  const couponCode = text(input.couponCode,'Kode promo',30).toUpperCase() || null; let discount=0;
  if (couponCode) {
    requireFeature(cap,'coupons');
    const c = await q(env,'SELECT * FROM coupons WHERE scope=? AND code=?',session.scope,couponCode).first<Row>();
    if (!c || !c.active || (c.expires_at && c.expires_at<=now()) || (c.use_limit && c.used_count>=c.use_limit)) fail(422,'INVALID_COUPON','Kode promo tidak berlaku atau sudah habis.');
    if (subtotal<c.min_spend) fail(422,'COUPON_MIN_SPEND',`Belanja minimal Rp${c.min_spend.toLocaleString('id-ID')} untuk memakai promo ini.`);
    discount = c.kind==='percentage' ? Math.floor(subtotal*c.value/100) : c.value;
    if (c.max_discount) discount = Math.min(discount,c.max_discount); discount=Math.min(discount,subtotal);
  }
  let pointsRedeemed=0, pointsDiscount=0;
  if(input.redeemPoints!==undefined && input.redeemPoints!==0){
    requireFeature(cap,'loyaltyPoints');
    pointsRedeemed=integer(input.redeemPoints,'Poin yang ditukar',1,1_000_000_000);
    if(!session.memberId)fail(401,'MEMBER_REQUIRED','Masuk sebagai member untuk menukar poin.');
    const member=await q(env,'SELECT points_balance FROM members WHERE scope=? AND id=?',session.scope,session.memberId).first<{points_balance:number}>();
    const loyalty=cfg.loyalty;
    if(!member || pointsRedeemed>member.points_balance || pointsRedeemed<(loyalty?.minRedeemPoints??10))fail(422,'POINTS_UNAVAILABLE','Saldo poin tidak cukup atau jumlahnya belum mencapai minimum penukaran.');
    pointsDiscount=pointsRedeemed*(loyalty?.pointValueIdr??100);
    if(pointsDiscount>subtotal-discount)fail(422,'POINTS_EXCEED_PRICE','Nilai poin melebihi nilai barang setelah diskon.');
  }
  const goodsNet=subtotal-discount-pointsDiscount;
  const pricing=cfg.pricing||{taxBps:0,taxIncluded:false,serviceFeeBps:0};
  const taxIncluded=cap.taxes && Boolean(pricing.taxIncluded);
  const taxBps=cap.taxes?(pricing.taxBps||0):0;
  const taxAmount=taxIncluded?Math.round(goodsNet*taxBps/(10000+taxBps)):Math.round(goodsNet*taxBps/10000);
  const serviceFee=cap.serviceFees?Math.round(goodsNet*(pricing.serviceFeeBps||0)/10000):0;
  const total=goodsNet+shipping.fee+serviceFee+(taxIncluded?0:taxAmount);
  integer(total,'Total pesanan',0,2_000_000_000);
  return {items:lines,subtotal,discount,shippingFee:shipping.fee,taxAmount,taxIncluded,serviceFee,pointsRedeemed,pointsDiscount,total,couponCode,shippingMethod:shipping};
}
function customerFor(value: unknown, needsAddress: boolean): Customer {
  if (!value || typeof value!=='object' || Array.isArray(value)) fail(422,'INVALID_CUSTOMER','Isi data penerima.');
  const c=value as Row; const phone=text(c.phone,'Nomor telepon',25,true).replace(/[\s()-]/g,'');
  if (!/^\+?\d{8,16}$/.test(phone)) fail(422,'INVALID_PHONE','Masukkan nomor telepon yang valid.');
  const email=text(c.email,'Email',150); if (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(422,'INVALID_EMAIL','Masukkan alamat email yang valid.');
  return {name:text(c.name,'Nama penerima',100,true),phone,email,address:text(c.address,'Alamat',600,needsAddress),city:text(c.city,'Kota',100),postalCode:text(c.postalCode,'Kode pos',10)};
}
export async function createOrder(env: Env, session: Session, input: Row): Promise<Order> {
  const config = await configFor(env,session); requireFeature(capabilities(config),'checkout');
  const key=text(input.idempotencyKey,'Kunci permintaan',100,true); if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) fail(422,'INVALID_KEY','Kunci permintaan tidak valid.');
  const canonical={items:cartItems(input.items),shippingMethodId:input.shippingMethodId||'regular',couponCode:text(input.couponCode,'Kode promo',30).toUpperCase(),redeemPoints:input.redeemPoints??0,customer:input.customer,paymentMethod:input.paymentMethod,expectedTotal:input.expectedTotal,note:text(input.note,'Catatan',500)};
  const requestHash = await digest(JSON.stringify(canonical));
  const prior=await q(env,'SELECT * FROM orders WHERE scope=? AND session_id=? AND idempotency_key=?',session.scope,session.tokenHash,key).first<Row>();
  if (prior) { if (prior.request_hash!==requestHash) fail(409,'IDEMPOTENCY_CONFLICT','Kunci permintaan sudah dipakai untuk pesanan yang berbeda.'); return orderFrom(env,prior); }
  const quote=await quoteFor(env,session,canonical,config);
  if(input.expectedTotal!==undefined&&integer(input.expectedTotal,'Total yang disetujui',0,2_000_000_000)!==quote.total)fail(409,'PRICE_CHANGED','Total pesanan berubah. Periksa kembali ringkasan sebelum memesan.');
  const customer=customerFor(input.customer,quote.shippingMethod.requiresAddress);
  const payment=(await bootstrap(env,session)).paymentMethods.find(p=>p.id===input.paymentMethod);
  if (!payment || !payment.available) fail(422,'PAYMENT_UNAVAILABLE','Metode pembayaran ini belum tersedia.');
  const orderId=`ord_${id()}`; const stamp=now(); const number=`RPA-${stamp.slice(2,10).replaceAll('-','')}-${orderId.slice(-8).toUpperCase()}`;
  const trackingCode=id();const trackingHash=await digest(trackingCode);
  const status=payment.id==='cod'?'confirmed':'awaiting_payment'; const paymentStatus=payment.id==='midtrans'?'pending':'unpaid';
  const expiresAt=payment.id==='cod'?null:new Date(Date.now()+86400000).toISOString();
  const memberId=capabilities(config).customerAccounts?session.memberId:null;
  let pointsEarned=0;
  if(memberId && capabilities(config).loyaltyPoints){
    const loyalty=config.loyalty;
    const member=await q(env,'SELECT completed_spend FROM members WHERE scope=? AND id=?',session.scope,memberId).first<{completed_spend:number}>();
    const spent=member?.completed_spend||0;
    const multiplier=capabilities(config).membershipTiers ? (spent>=(loyalty?.goldSpendIdr??5_000_000)?3:spent>=(loyalty?.silverSpendIdr??1_000_000)?2:1):1;
    pointsEarned=Math.floor(Math.max(0,quote.subtotal-quote.discount-quote.pointsDiscount)/Math.max(1,loyalty?.earnSpendIdr??10_000))*multiplier;
  }
  const columns=['scope','id','session_id','idempotency_key','request_hash','number','tracking_code_hash','customer_json','shipping_json','subtotal','discount','shipping_fee','total','coupon_code','payment_method','status','payment_status','note','gateway_order_id','created_at','updated_at','expires_at','member_id','points_redeemed','points_discount','points_earned','shipping_base_fee','tax_amount','tax_included','service_fee','loyalty_eligible'];
  const values=[session.scope,orderId,session.tokenHash,key,requestHash,number,trackingHash,JSON.stringify(customer),JSON.stringify(quote.shippingMethod),quote.subtotal,quote.discount+quote.pointsDiscount,quote.shippingFee+quote.serviceFee+(quote.taxIncluded?0:quote.taxAmount),quote.total,quote.couponCode,payment.id,status,paymentStatus,canonical.note,payment.id==='midtrans'?orderId:null,stamp,stamp,expiresAt,memberId,quote.pointsRedeemed,quote.pointsDiscount,pointsEarned,quote.shippingFee,quote.taxAmount,Number(quote.taxIncluded),quote.serviceFee,Number(capabilities(config).loyaltyPoints)];
  const statements: D1Statement[]=[q(env,`INSERT INTO orders(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`,...values)];
  for (const i of quote.items) statements.push(q(env,'INSERT INTO order_items(scope,order_id,variant_id,product_id,name,variant_name,image,unit_price,quantity,subtotal) VALUES(?,?,?,?,?,?,?,?,?,?)',session.scope,orderId,i.variantId,i.productId,i.name,i.variantName,i.image,i.unitPrice,i.quantity,i.subtotal));
  statements.push(eventStatement(env,session,orderId,'created','Pesanan dibuat',session.demo?'Pesanan demo. Tidak ada transaksi uang nyata.':'','customer'),auditStatement(env,{...session,role:'customer'},'order.created',orderId,number));
  try { await env.DB.batch(statements); }
  catch (error) {
    // A retried request may reach D1 concurrently with the first request.
    const existing=await q(env,'SELECT * FROM orders WHERE scope=? AND session_id=? AND idempotency_key=?',session.scope,session.tokenHash,key).first<Row>();
    if (existing && existing.request_hash===requestHash) return orderFrom(env,existing);
    const message=String(error); if (/stock|CHECK|PRICE_CHANGED|UNAVAILABLE|EXPIRED|POINTS_/i.test(message)) fail(409,'CART_CHANGED','Stok, harga, atau promo berubah. Periksa keranjang dan coba lagi.'); throw error;
  }
  return {...await orderFor(env,session,orderId),trackingCode};
}
export async function rawOrder(env: Env,session: Session,orderId:string,internal=false) {
  const row=await q(env,`SELECT * FROM orders WHERE scope=? AND id=? ${internal?'':'AND session_id=?'}`,session.scope,orderId,...(internal?[]:[session.tokenHash])).first<Row>();
  if (!row) fail(404,'ORDER_NOT_FOUND','Pesanan tidak ditemukan.'); return row;
}
export async function mutateOrder(env:Env,session:Session,row:Row,changes:Row,action:string,label:string,note='',actor:string=session.role,extras:D1Statement[]=[]) {
  const allowed=new Set(['status','payment_status','return_status','payment_reference','carrier','tracking_number','return_reason','payment_url','stock_restored','coupon_released','gateway_refund_requested','expires_at']);
  for(const key of Object.keys(changes)) if(!allowed.has(key)) throw new Error(`Unknown internal order field ${key}`);
  const keys=Object.keys(changes); const operationId=id();
  await env.DB.batch([
    q(env,`UPDATE orders SET ${keys.map(k=>`${k}=?`).join(',')},updated_at=?,version=version+1 WHERE scope=? AND id=? AND version=?`,...keys.map(k=>changes[k]),now(),session.scope,row.id,row.version),
    ...versionGuard(env,operationId),eventStatement(env,session,row.id,action,label,note,actor),auditStatement(env,session,`order.${action}`,row.id,note||label),...extras,
  ]);
  return orderFor(env,session,row.id,true);
}
function cancelChanges(row:Row) { return {status:'cancelled',payment_status:row.payment_status==='paid'?'refund_due':row.payment_status,stock_restored:1,coupon_released:1,expires_at:null}; }
export async function customerAction(env:Env,session:Session,orderId:string,input:Row):Promise<Order> {
  const cfg=await configFor(env,session); const cap=capabilities(cfg.level); requireFeature(cap,'orders');
  const row=await rawOrder(env,session,orderId); const action=text(input.action,'Tindakan',40,true); const note=text(input.note,'Catatan',600);
  if(action==='cancel') {
    if(row.status==='cancelled') return orderFrom(env,row);
    if(!['awaiting_payment','confirmed'].includes(row.status)) fail(409,'INVALID_TRANSITION','Pesanan sudah diproses. Hubungi toko untuk pembatalan.');
    return mutateOrder(env,session,row,cancelChanges(row),action,'Pesanan dibatalkan',note,'customer');
  }
  if(action==='payment-evidence') {
    if(row.payment_method!=='manual'||row.status!=='awaiting_payment'||!['unpaid','pending_verification'].includes(row.payment_status)) fail(409,'INVALID_TRANSITION','Pesanan ini tidak menunggu bukti transfer.');
    const reference=text(input.reference,'Referensi transfer',250,true);
    return mutateOrder(env,session,row,{payment_reference:reference,payment_status:'pending_verification'},action,'Referensi transfer dikirim',reference,'customer');
  }
  if(action==='confirm-received') {
    if(row.status==='completed') return orderFrom(env,row);
    if(row.status!=='shipped') fail(409,'INVALID_TRANSITION','Pesanan belum dikirim atau siap diambil.');
    if(row.payment_status!=='paid') fail(409,'PAYMENT_REQUIRED','Toko perlu mencatat pembayaran sebelum pesanan selesai.');
    return mutateOrder(env,session,row,{status:'completed'},action,'Pesanan diterima',note,'customer');
  }
  if(action==='request-return') {
    requireFeature(cap,'returns');
    if(row.status!=='completed'||row.payment_status!=='paid'||!['none','rejected'].includes(row.return_status)) fail(409,'INVALID_TRANSITION','Retur tersedia untuk pesanan selesai yang sudah dibayar.');
    const completed=await q(env,"SELECT created_at FROM order_events WHERE scope=? AND order_id=? AND action IN ('complete','confirm-received') ORDER BY created_at LIMIT 1",session.scope,row.id).first<Row>();
    if(completed && Date.now()-Date.parse(completed.created_at)>cfg.returnDays*86400000) fail(409,'RETURN_EXPIRED','Batas waktu pengajuan retur sudah lewat.');
    const reason=text(input.reason||input.note,'Alasan retur',600,true);
    return mutateOrder(env,session,row,{return_status:'requested',return_reason:reason},action,'Retur diajukan',reason,'customer');
  }
  return fail(400,'UNKNOWN_ACTION','Tindakan tidak dikenal.');
}
export async function staffAction(env:Env,session:Session,orderId:string,input:Row):Promise<Order> {
  staff(session,true); const cfg=await configFor(env,session); const cap=capabilities(cfg.level); requireFeature(cap,'orders');
  const row=await rawOrder(env,session,orderId,true); const action=text(input.action,'Tindakan',40,true); const note=text(input.note,'Catatan',600);
  if(action==='cancel') {
    if(row.status==='cancelled') return orderFrom(env,row);
    if(!['awaiting_payment','confirmed','processing'].includes(row.status)) fail(409,'INVALID_TRANSITION','Pesanan yang sudah dikirim perlu memakai alur retur.');
    return mutateOrder(env,session,row,cancelChanges(row),action,'Pesanan dibatalkan oleh toko',note);
  }
  if(action==='confirm-payment') {
    if(row.payment_method==='midtrans') fail(403,'PROVIDER_VERIFICATION_REQUIRED','Gateway hanya boleh dikonfirmasi oleh penyedia pembayaran.');
    if(row.payment_status==='paid') return orderFrom(env,row);
    if(row.status==='cancelled'||!['unpaid','pending_verification'].includes(row.payment_status)) fail(409,'INVALID_TRANSITION','Pembayaran ini tidak bisa dikonfirmasi.');
    const reference=text(input.reference||row.payment_reference||note||(row.payment_method==='cod'?'Penerimaan COD dicatat staf':''),'Referensi pembayaran',250,true);
    return mutateOrder(env,session,row,{payment_status:'paid',payment_reference:reference,status:row.status==='awaiting_payment'?'confirmed':row.status,expires_at:null},action,'Pembayaran diterima',reference);
  }
  if(action==='process') {
    if(row.status==='processing') return orderFrom(env,row);
    if(row.status!=='confirmed'||(row.payment_status!=='paid'&&row.payment_method!=='cod')) fail(409,'INVALID_TRANSITION','Konfirmasi pembayaran sebelum memproses pesanan.');
    return mutateOrder(env,session,row,{status:'processing'},action,'Pesanan sedang disiapkan',note);
  }
  if(action==='ship') {
    if(row.status!=='processing') fail(409,'INVALID_TRANSITION','Siapkan pesanan sebelum mengirim.');
    if(row.payment_status!=='paid'&&row.payment_method!=='cod') fail(409,'PAYMENT_REQUIRED','Pesanan belum dibayar.');
    const shipping=JSON.parse(row.shipping_json); const tracking=text(input.trackingNumber,'Nomor resi',100,shipping.requiresAddress); const carrier=text(input.carrier||(shipping.requiresAddress?'':'Ambil di toko'),'Kurir',100,shipping.requiresAddress);
    return mutateOrder(env,session,row,{status:'shipped',tracking_number:tracking,carrier},action,shipping.requiresAddress?'Pesanan dikirim':'Pesanan siap diambil',note);
  }
  if(action==='complete') {
    if(row.status==='completed') return orderFrom(env,row);
    if(row.status!=='shipped'||row.payment_status!=='paid') fail(409,'INVALID_TRANSITION','Pesanan harus dikirim dan dibayar sebelum selesai.');
    return mutateOrder(env,session,row,{status:'completed'},action,'Pesanan selesai',note);
  }
  if(['approve-return','reject-return','receive-return'].includes(action)) {
    requireFeature(cap,'returns');
    if(action==='receive-return') {
      if(row.return_status!=='approved') fail(409,'INVALID_TRANSITION','Setujui retur sebelum menerima barang.');
      return mutateOrder(env,session,row,{return_status:'received',stock_restored:1,payment_status:'refund_due'},action,'Barang retur diterima',note);
    }
    if(row.return_status!=='requested') fail(409,'INVALID_TRANSITION','Pesanan tidak memiliki pengajuan retur yang perlu ditinjau.');
    if(action==='reject-return'&&!note) fail(422,'REASON_REQUIRED','Isi alasan penolakan retur.');
    return mutateOrder(env,session,row,{return_status:action==='approve-return'?'approved':'rejected'},action,action==='approve-return'?'Retur disetujui':'Retur ditolak',note);
  }
  if(action==='refund') {
    staff(session,true,true);
    if(row.payment_status==='refunded') return orderFrom(env,row);
    if(row.payment_status!=='refund_due') fail(409,'INVALID_TRANSITION','Pesanan ini belum menunggu pengembalian uang.');
    if(row.payment_method==='midtrans'&&!session.demo&&!input.manual) fail(409,'GATEWAY_REFUND_REQUIRED','Gunakan proses refund gateway untuk pesanan ini.');
    const reference=text(input.reference||note||(session.demo?'Simulasi refund demo':''),'Referensi pengembalian uang',250,true);
    return mutateOrder(env,session,row,{payment_status:'refunded',return_status:row.return_status==='received'?'refunded':row.return_status},action,session.demo?'Simulasi pengembalian uang selesai':'Pengembalian uang dicatat',reference);
  }
  return fail(400,'UNKNOWN_ACTION','Tindakan tidak dikenal.');
}
export async function expireManualOrders(env:Env,session?:Session) {
  const stamp=now();
  const condition=`${session?'scope=? AND ':''}status='awaiting_payment' AND payment_status IN ('unpaid','pending') AND expires_at<? AND (payment_method='manual' OR scope IN (SELECT id FROM scopes WHERE demo=1))`;
  const selection=`(scope,id) IN (SELECT scope,id FROM orders WHERE ${condition} ORDER BY created_at,id LIMIT 500)`;
  const args=session?[session.scope,stamp]:[stamp];
  // Batch expiry uses three queries even when many reservations expire together.
  await env.DB.batch([
    q(env,`INSERT INTO order_events(scope,id,order_id,action,label,note,actor,created_at) SELECT scope,lower(hex(randomblob(16))),id,'expired','Batas pembayaran berakhir','Stok pesanan kembali tersedia.','system',? FROM orders WHERE ${selection}`,stamp,...args),
    q(env,`INSERT INTO audit_events(scope,id,action,entity_id,detail,actor,created_at) SELECT scope,lower(hex(randomblob(16))),'order.expired',id,'Reservasi stok berakhir','system',? FROM orders WHERE ${selection}`,stamp,...args),
    q(env,`UPDATE orders SET status='cancelled',payment_status='failed',stock_restored=1,coupon_released=1,expires_at=NULL,updated_at=?,version=version+1 WHERE ${selection}`,stamp,...args),
  ]);
}
