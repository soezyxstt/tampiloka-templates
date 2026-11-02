import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { environment, client, create, orderInput, scopeFor } from './backend-harness.mjs';
import { cleanup } from '../worker/index.ts';
import { digest } from '../worker/security.ts';

function fixture(t,overrides) { const env=environment(overrides);t.after(()=>env.DB.close());return {env,c:client(env)}; }
const action=(c,id,action,extra={})=>c.post(`/api/staff/orders/${id}/actions`,{action,...extra});
const customerAction=(c,id,action,extra={})=>c.post(`/api/orders/${id}/actions`,{action,...extra});

test('demo session is durable, HttpOnly, secure, isolated and cannot spoof a scope',async t=>{
  const {env,c}=fixture(t);const first=await c.get('/api/bootstrap');assert.equal(first.status,200);assert.match(first.headers.get('set-cookie'),/HttpOnly/);assert.match(first.headers.get('set-cookie'),/Secure/);assert.equal(first.data.config.brand.whatsapp,'');assert.equal(first.data.products.length,8);
  const one=await create(c);assert.equal(one.status,200);assert.equal((await c.get('/api/orders/my')).data.orders.length,1);
  const other=client(env,'127.0.0.2');await other.get('/api/bootstrap');assert.equal((await other.get('/api/orders/my')).data.orders.length,0);assert.equal((await other.get(`/api/orders/${one.data.id}`,{'X-Demo-Scope':await scopeFor(env,c)})).status,404);
  const reload=client(env);reload.cookie=c.cookie;assert.equal((await reload.get('/api/orders/my')).data.orders.length,1);
});

test('server owns prices and coupon math; idempotent checkout consumes stock only once',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');const input=orderInput({couponCode:'RUPA10',total:1,items:[{variantId:'linen-shirt-m',quantity:1,price:1}]});
  const quote=await c.post('/api/quote',input);assert.equal(quote.data.subtotal,329000);assert.equal(quote.data.discount,32900);assert.equal(quote.data.total,314100);
  const first=await c.post('/api/orders',{...input,expectedTotal:314100});assert.equal(first.status,200);assert.equal(first.data.total,314100);
  const again=await c.post('/api/orders',{...input,expectedTotal:314100});assert.equal(again.data.id,first.data.id);
  assert.equal((await c.post('/api/orders',{...input,note:'Berbeda',expectedTotal:314100})).status,409);
  const stock=env.DB.db.prepare('SELECT stock FROM variants WHERE scope=? AND id=?').get(await scopeFor(env,c),'linen-shirt-m');assert.equal(stock.stock,17);
});

test('parallel customers cannot oversell the last stock',async t=>{
  const {env,c}=fixture(t,{DEMO_MODE:'false'});const other=client(env,'127.0.0.2');await Promise.all([c.get('/api/bootstrap'),other.get('/api/bootstrap')]);
  const a=orderInput({paymentMethod:'cod',items:[{variantId:'linen-shirt-m',quantity:10}]});const b={...a,idempotencyKey:crypto.randomUUID()};
  const results=await Promise.all([c.post('/api/orders',a),other.post('/api/orders',b)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(env.DB.db.prepare("SELECT stock FROM variants WHERE scope='store' AND id='linen-shirt-m'").get().stock,8);assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM orders').get().n,1);
});

test('multi-line checkout rolls back earlier reservations if a later line loses stock',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');const scope=await scopeFor(env,c);
  env.DB.beforeBatch=statements=>{if(statements.some(s=>s._sql.startsWith('INSERT INTO orders'))){env.DB.beforeBatch=null;env.DB.db.prepare('UPDATE variants SET stock=0 WHERE scope=? AND id=?').run(scope,'linen-shirt-m');}};
  const result=await c.post('/api/orders',orderInput({items:[{variantId:'everyday-tee-m',quantity:2},{variantId:'linen-shirt-m',quantity:1}]}));assert.equal(result.status,409);
  assert.equal(env.DB.db.prepare('SELECT stock FROM variants WHERE scope=? AND id=?').get(scope,'everyday-tee-m').stock,20);assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM orders').get().n,0);assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM inventory_movements').get().n,0);
});

test('level gates protect API actions, including hidden UI features',async t=>{
  const {c}=fixture(t);await c.get('/api/bootstrap');await c.post('/api/demo/config',{level:'catalog'});
  assert.equal((await c.post('/api/quote',orderInput())).status,403);assert.equal((await c.post('/api/orders',orderInput())).status,403);assert.equal((await c.post('/api/wishlist',{productId:'linen-shirt'})).status,403);assert.equal((await c.post('/api/staff/inventory',{variantId:'linen-shirt-m',delta:1,reason:'test'})).status,403);
  await c.post('/api/demo/config',{level:'whatsapp'});assert.equal((await c.post('/api/quote',orderInput())).status,200);assert.equal((await c.post('/api/orders',orderInput())).status,403);
  await c.post('/api/demo/config',{level:'store'});assert.equal((await c.post('/api/quote',orderInput({couponCode:'RUPA10'}))).status,200); // Promo is an add-on enabled independently of level.assert.equal((await create(c,{paymentMethod:'midtrans'})).status,422);
  await c.post('/api/demo/config',{level:'advanced'});assert.equal((await create(c,{paymentMethod:'midtrans'})).status,200);
});

test('production staff auth fails closed, rotates sessions, and enforces roles and origins',async t=>{
  const {env,c}=fixture(t,{DEMO_MODE:'false'});const boot=await c.get('/api/bootstrap');assert.equal(boot.data.session.role,'customer');assert.equal(boot.data.paymentMethods.find(p=>p.id==='manual').available,false);assert.equal(boot.data.paymentMethods.find(p=>p.id==='midtrans').available,false);
  assert.equal((await c.get('/api/staff/snapshot')).status,401);assert.equal((await c.post('/api/staff/login',{password:'anything'})).status,503);assert.equal((await c.post('/api/demo/config',{level:'advanced'})).status,403);
  env.STAFF_OWNER_PASSWORD='owner-secret-strong-123';env.STAFF_OPERATIONS_PASSWORD='ops-secret-strong-123';env.STAFF_VIEWER_PASSWORD='viewer-secret-strong-123';
  assert.equal((await c.post('/api/staff/login',{password:'wrong'})).status,401);const before=c.cookie;assert.equal((await c.post('/api/staff/login',{password:env.STAFF_OWNER_PASSWORD})).status,200);assert.notEqual(c.cookie,before);
  assert.equal((await c.get('/api/staff/snapshot')).status,200);assert.equal((await c.put('/api/staff/settings',{returnDays:8},{Origin:'https://evil.example'})).status,403);
  const ops=client(env,'127.0.0.2');await ops.post('/api/staff/login',{role:'operations',password:env.STAFF_OPERATIONS_PASSWORD});assert.equal((await ops.put('/api/staff/products/linen-shirt',{name:'No'})).status,403);assert.equal((await ops.post('/api/staff/inventory',{variantId:'linen-shirt-m',delta:1,reason:'Restock'})).status,200);
  const viewer=client(env,'127.0.0.3');await viewer.post('/api/staff/login',{role:'viewer',password:env.STAFF_VIEWER_PASSWORD});assert.equal((await viewer.get('/api/staff/snapshot')).status,200);assert.equal((await viewer.post('/api/staff/inventory',{variantId:'linen-shirt-m',delta:1,reason:'No'})).status,403);
});

test('customer order data remains private even within a shared production store',async t=>{
  const {env,c}=fixture(t,{DEMO_MODE:'false',STAFF_OWNER_PASSWORD:'owner-secret-strong-123'});await c.get('/api/bootstrap');const order=(await create(c,{paymentMethod:'cod'})).data;
  const other=client(env,'127.0.0.2');await other.get('/api/bootstrap');assert.equal((await other.get(`/api/orders/${order.id}`)).status,404);assert.equal((await other.get('/api/orders/my')).data.orders.length,0);assert.equal((await customerAction(other,order.id,'cancel')).status,404);
  await other.post('/api/staff/login',{password:env.STAFF_OWNER_PASSWORD});assert.equal((await other.get('/api/staff/snapshot')).data.orders.length,1);assert.equal((await other.get(`/api/orders/${order.id}`)).status,404);
});

test('manual purchase, delivery, review, return and refund complete with one stock restoration',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');const order=(await create(c)).data;const oid=order.id;
  assert.equal((await action(c,oid,'ship',{trackingNumber:'x',carrier:'Kurir'})).status,409);
  assert.equal((await customerAction(c,oid,'payment-evidence',{reference:'REF-DEMO-01'})).data.paymentStatus,'pending_verification');
  assert.equal((await action(c,oid,'confirm-payment')).data.paymentStatus,'paid');assert.equal((await action(c,oid,'process')).data.status,'processing');assert.equal((await action(c,oid,'ship')).status,422);
  assert.equal((await action(c,oid,'ship',{carrier:'Kurir contoh',trackingNumber:'DEMO123'})).data.status,'shipped');assert.equal((await customerAction(c,oid,'confirm-received')).data.status,'completed');
  const review={productId:'linen-shirt',orderId:oid,rating:5,comment:'Ulasan contoh setelah barang diterima.'};assert.equal((await c.post('/api/reviews',review)).status,200);assert.equal((await c.post('/api/reviews',review)).status,409);
  assert.equal((await customerAction(c,oid,'request-return',{reason:'Ukuran kurang sesuai'})).data.returnStatus,'requested');assert.equal((await action(c,oid,'approve-return')).data.returnStatus,'approved');assert.equal((await action(c,oid,'receive-return')).data.paymentStatus,'refund_due');assert.equal((await action(c,oid,'receive-return')).status,409);assert.equal((await action(c,oid,'refund')).data.paymentStatus,'refunded');assert.equal((await action(c,oid,'refund')).status,200);
  const scope=await scopeFor(env,c);assert.equal(env.DB.db.prepare('SELECT stock FROM variants WHERE scope=? AND id=?').get(scope,'linen-shirt-m').stock,18);assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM inventory_movements WHERE scope=? AND delta>0').get(scope).n,1);
  const snap=(await c.get('/api/staff/snapshot')).data;assert.equal(snap.metrics.revenue,0);assert.equal(snap.metrics.refunded,order.total);
});

test('COD requires recorded receipt before completion and pickup needs no address or carrier',async t=>{
  const {c}=fixture(t);await c.get('/api/bootstrap');const order=(await create(c,{paymentMethod:'cod',shippingMethodId:'pickup',customer:{name:'Pembeli',phone:'081234000002'}})).data;assert.equal(order.total,329000);
  await action(c,order.id,'process');assert.equal((await action(c,order.id,'ship')).data.status,'shipped');assert.equal((await customerAction(c,order.id,'confirm-received')).status,409);await action(c,order.id,'confirm-payment');assert.equal((await customerAction(c,order.id,'confirm-received')).data.status,'completed');
});

test('cancellation restores stock and coupon usage once, including concurrent repeated requests',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');const order=(await create(c,{couponCode:'RUPA10'})).data;await customerAction(c,order.id,'cancel');await customerAction(c,order.id,'cancel');
  const scope=await scopeFor(env,c);assert.equal(env.DB.db.prepare('SELECT used_count FROM coupons WHERE scope=? AND code=?').get(scope,'RUPA10').used_count,0);assert.equal(env.DB.db.prepare('SELECT stock FROM variants WHERE scope=? AND id=?').get(scope,'linen-shirt-m').stock,18);
});

test('coupon usage limit survives parallel checkout, then cancellation makes the use available',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');await c.post('/api/staff/coupons',{code:'LASTONE',kind:'fixed',value:10000,minSpend:0,maxDiscount:10000,useLimit:1,active:true});
  const results=await Promise.all([c.post('/api/orders',orderInput({couponCode:'LASTONE'})),c.post('/api/orders',orderInput({couponCode:'LASTONE'}))]);assert.equal(results.filter(r=>r.status===200).length,1);assert.ok(results.some(r=>[409,422].includes(r.status)));assert.equal(env.DB.db.prepare("SELECT used_count FROM coupons WHERE code='LASTONE'").get().used_count,1);
  await customerAction(c,results.find(r=>r.status===200).data.id,'cancel');assert.equal((await create(c,{couponCode:'LASTONE'})).status,200);
});

test('invalid quantities and a changed accepted total cannot create an order',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');for(const quantity of [-1,0,1.5,100])assert.equal((await c.post('/api/orders',orderInput({items:[{variantId:'linen-shirt-m',quantity}]}))).status,422);
  assert.equal((await c.post('/api/orders',orderInput({expectedTotal:1}))).data.error.code,'PRICE_CHANGED');assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM orders').get().n,0);
});

test('demo payment outcomes do not accept staff manual gateway confirmation or regress after success',async t=>{
  const {c}=fixture(t);await c.get('/api/bootstrap');const order=(await create(c,{paymentMethod:'midtrans'})).data;
  assert.equal((await action(c,order.id,'confirm-payment',{reference:'fake'})).status,403);assert.equal((await c.post('/api/demo/payment',{orderId:order.id,status:'paid'})).data.paymentStatus,'paid');assert.equal((await c.post('/api/demo/payment',{orderId:order.id,status:'failed'})).status,409);
});

test('Midtrans verifies provider state, amount and signature; replay and out-of-order events cannot double-settle',async t=>{
  const {env,c}=fixture(t,{DEMO_MODE:'false',MIDTRANS_SERVER_KEY:'test-server-key'});const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});let providerStatus='pending';let gross='347000.00';let providerOrder='';let statusFetches=0;
  globalThis.fetch=async(url,init)=>{if(String(url).includes('/snap/')){const input=JSON.parse(init.body);providerOrder=input.transaction_details.order_id;return Response.json({token:'test-token',redirect_url:'https://app.sandbox.midtrans.com/snap/v2/vtweb/test'});}statusFetches++;return Response.json({order_id:providerOrder,gross_amount:gross,status_code:providerStatus==='pending'?'201':'200',transaction_status:providerStatus,transaction_id:'provider-1',fraud_status:'accept'});};
  await c.get('/api/bootstrap');const created=await create(c,{paymentMethod:'midtrans'});assert.equal(created.status,200);const order=created.data;assert.match(order.paymentUrl,/sandbox.midtrans/);
  const payload={order_id:order.id,status_code:'200',gross_amount:'347000.00',transaction_status:'settlement',signature_key:await digest(`${order.id}200347000.00${env.MIDTRANS_SERVER_KEY}`,'SHA-512')};
  assert.equal((await c.post('/api/webhooks/midtrans',{...payload,signature_key:'0'.repeat(128)})).status,403);assert.equal(statusFetches,0);
  assert.equal((await c.post('/api/webhooks/midtrans',payload)).status,200);assert.equal((await c.get(`/api/orders/${order.id}`)).data.paymentStatus,'pending');
  providerStatus='settlement';gross='1.00';assert.equal((await c.post('/api/webhooks/midtrans',payload)).status,409);gross='347000.00';assert.equal((await c.post('/api/webhooks/midtrans',payload)).status,200);assert.equal((await c.get(`/api/orders/${order.id}`)).data.paymentStatus,'paid');
  assert.equal((await c.post('/api/webhooks/midtrans',payload)).data.duplicate,true);providerStatus='pending';await c.post('/api/webhooks/midtrans',payload);assert.equal((await c.get(`/api/orders/${order.id}`)).data.paymentStatus,'paid');
  assert.equal(env.DB.db.prepare('SELECT stock FROM variants WHERE id=?').get('linen-shirt-m').stock,17);
});

test('late verified payment on a cancelled order creates refund liability without restoring the order',async t=>{
  const {env,c}=fixture(t,{DEMO_MODE:'false',MIDTRANS_SERVER_KEY:'test-server-key'});const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});let oid='';
  globalThis.fetch=async(url,init)=>{if(String(url).includes('/snap/')){oid=JSON.parse(init.body).transaction_details.order_id;return Response.json({redirect_url:'https://app.sandbox.midtrans.com/snap/v2/vtweb/test'});}return Response.json({order_id:oid,gross_amount:'347000.00',status_code:'200',transaction_status:'settlement',transaction_id:'late-1'});};
  await c.get('/api/bootstrap');const order=(await create(c,{paymentMethod:'midtrans'})).data;await customerAction(c,order.id,'cancel');const payload={order_id:order.id,status_code:'200',gross_amount:'347000.00',signature_key:await digest(`${order.id}200347000.00${env.MIDTRANS_SERVER_KEY}`,'SHA-512')};await c.post('/api/webhooks/midtrans',payload);
  const latest=(await c.get(`/api/orders/${order.id}`)).data;assert.equal(latest.status,'cancelled');assert.equal(latest.paymentStatus,'refund_due');assert.equal(env.DB.db.prepare('SELECT stock FROM variants WHERE id=?').get('linen-shirt-m').stock,18);
});

test('wishlist persists, catalog changes and inventory adjustments remain auditable',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');assert.deepEqual((await c.post('/api/wishlist',{productId:'linen-shirt'})).data.wishlist,['linen-shirt']);assert.deepEqual((await c.get('/api/wishlist')).data.wishlist,['linen-shirt']);
  assert.equal((await c.put('/api/staff/products/linen-shirt',{name:'Kemeja Baru'})).status,200);assert.equal((await c.post('/api/staff/inventory',{variantId:'linen-shirt-m',delta:-999,reason:'Tidak cukup'})).status,409);assert.equal((await c.post('/api/staff/inventory',{variantId:'linen-shirt-m',delta:5,reason:'Stok datang'})).status,200);
  const snap=(await c.get('/api/staff/snapshot')).data;assert.equal(snap.products.find(p=>p.id==='linen-shirt').name,'Kemeja Baru');assert.equal(snap.inventory[0].delta,5);assert.ok(snap.audit.some(a=>a.action==='product.updated'));
});

test('cleanup expires unpaid reservations and removes expired isolated demo scopes',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');const order=(await create(c,{couponCode:'RUPA10'})).data;env.DB.db.prepare("UPDATE orders SET expires_at='2020-01-01T00:00:00.000Z' WHERE id=?").run(order.id);await cleanup(env);
  assert.equal((await c.get(`/api/orders/${order.id}`)).data.status,'cancelled');assert.equal(env.DB.db.prepare('SELECT stock FROM variants WHERE id=?').get('linen-shirt-m').stock,18);
  env.DB.db.prepare("UPDATE sessions SET expires_at='2020-01-01T00:00:00.000Z'").run();await cleanup(env);assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM scopes').get().n,0);assert.equal(env.DB.db.prepare('SELECT count(*) AS n FROM orders').get().n,0);
});

test('CSV protects spreadsheet formula injection while retaining order details',async t=>{
  const {c}=fixture(t);await c.get('/api/bootstrap');await create(c,{customer:{name:'=IMPORTXML("x")',phone:'081234000001',address:'Contoh'}});const csv=await c.get('/api/staff/export/orders.csv');assert.equal(csv.status,200);assert.match(csv.data,/'=IMPORTXML/);assert.match(csv.headers.get('Content-Disposition'),/attachment/);
});

test('cross-device tracking requires the full secret, stores only its hash, and grants read access only',async t=>{
  const {env,c}=fixture(t,{DEMO_MODE:'false'});await c.get('/api/bootstrap');const created=await create(c,{paymentMethod:'cod'});assert.equal(created.status,200);const order=created.data;assert.match(order.trackingCode,/^[a-f0-9]{32}$/);
  const stored=env.DB.db.prepare('SELECT tracking_code_hash FROM orders WHERE id=?').get(order.id);assert.equal(stored.tracking_code_hash,await digest(order.trackingCode));assert.notEqual(stored.tracking_code_hash,order.trackingCode);
  const other=client(env,'127.0.0.2');await other.get('/api/bootstrap');assert.equal((await other.post('/api/orders/track',{number:order.number,code:'wrong'})).status,404);
  const tracked=await other.post('/api/orders/track',{number:order.number,code:order.trackingCode});assert.equal(tracked.status,200);assert.equal(tracked.data.id,order.id);assert.equal(tracked.data.trackingCode,undefined);assert.equal((await customerAction(other,order.id,'cancel')).status,404);assert.equal((await other.post(`/api/orders/${order.id}/tracking-code`,{})).status,404);
  const rotated=(await c.post(`/api/orders/${order.id}/tracking-code`,{})).data;assert.notEqual(rotated.code,order.trackingCode);assert.equal((await other.post('/api/orders/track',{number:order.number,code:order.trackingCode})).status,404);assert.equal((await other.post('/api/orders/track',rotated)).status,200);
});

test('tracking rejects guesses with a strict per-IP request limit',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');for(let i=0;i<10;i++)assert.equal((await c.post('/api/orders/track',{number:'RPA-NOT-REAL',code:'a'.repeat(32)})).status,404);assert.equal((await c.post('/api/orders/track',{number:'RPA-NOT-REAL',code:'a'.repeat(32)})).status,429);
});

test('revenue, customer totals and pagination include more than the recent 250 orders',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');const order=(await create(c,{paymentMethod:'cod'})).data;await action(c,order.id,'confirm-payment');
  const source=env.DB.db.prepare('SELECT * FROM orders WHERE id=?').get(order.id);const keys=Object.keys(source);const statement=env.DB.db.prepare(`INSERT INTO orders(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`);
  // Historical fixture rows test aggregate correctness independently of page size.
  for(let i=0;i<300;i++){const row={...source,id:`history-${i}`,number:`HISTORY-${i}`,idempotency_key:`history-key-${i}`,status:'completed',customer_json:JSON.stringify({name:`Customer ${i}`,phone:`081200${String(i).padStart(6,'0')}`})};statement.run(...keys.map(k=>row[k]));}
  const snap=(await c.get('/api/staff/snapshot')).data;assert.equal(snap.orders.length,250);assert.equal(snap.pagination.total,301);assert.equal(snap.pagination.hasMore,true);assert.equal(snap.metrics.orders,301);assert.equal(snap.metrics.revenue,301*order.total);assert.equal(snap.metrics.customers,301);assert.equal(snap.customers.length,301);
  const page=(await c.get('/api/staff/orders?limit=100&offset=250')).data;assert.equal(page.orders.length,51);assert.equal(page.total,301);assert.equal(page.hasMore,false);
});

test('shipping fee changes require the buyer to accept a new total',async t=>{
  const {c}=fixture(t);const config=(await c.get('/api/bootstrap')).data.config;const input=orderInput();const quote=(await c.post('/api/quote',input)).data;
  const methods=config.shippingMethods.map(m=>m.id==='regular'?{...m,fee:25000}:m);assert.equal((await c.put('/api/staff/settings',{shippingMethods:methods})).status,200);
  const rejected=await c.post('/api/orders',{...input,expectedTotal:quote.total});assert.equal(rejected.status,409);assert.equal(rejected.data.error.code,'PRICE_CHANGED');assert.equal((await create(c)).data.shippingFee,25000);
});

test('gateway refund remains pending until the payment provider confirms the full return',async t=>{
  const {env,c}=fixture(t,{DEMO_MODE:'false',MIDTRANS_SERVER_KEY:'test-server-key',STAFF_OWNER_PASSWORD:'owner-secret-strong-123'});const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});let oid='';let state='settlement';let confirmed=false;let refundCalls=0;
  globalThis.fetch=async(url,init)=>{if(String(url).includes('/snap/')){oid=JSON.parse(init.body).transaction_details.order_id;return Response.json({redirect_url:'https://app.sandbox.midtrans.com/snap/v2/vtweb/test'});}if(String(url).endsWith('/refund')){refundCalls++;assert.equal(JSON.parse(init.body).refund_key,`refund-${oid}`);return Response.json({status_code:'200',transaction_status:'refund'});}return Response.json({order_id:oid,gross_amount:'347000.00',status_code:'200',transaction_status:state,transaction_id:'refund-1',...(state==='refund'?{refund_amount:'347000.00',...(confirmed?{bank_confirmed_at:'2026-10-29T12:00:00'}:{})}:{})});};
  await c.get('/api/bootstrap');const order=(await create(c,{paymentMethod:'midtrans'})).data;const payload={order_id:order.id,status_code:'200',gross_amount:'347000.00',signature_key:await digest(`${order.id}200347000.00${env.MIDTRANS_SERVER_KEY}`,'SHA-512')};await c.post('/api/webhooks/midtrans',payload);await customerAction(c,order.id,'cancel');await c.post('/api/staff/login',{password:env.STAFF_OWNER_PASSWORD});
  assert.equal((await action(c,order.id,'refund',{note:'Pembatalan pembeli'})).data.paymentStatus,'refund_due');await action(c,order.id,'refund');assert.equal(refundCalls,1);
  state='refund';await c.post('/api/webhooks/midtrans',payload);assert.equal((await c.get('/api/staff/snapshot')).data.orders[0].paymentStatus,'refund_due');confirmed=true;await c.post('/api/webhooks/midtrans',payload);assert.equal((await c.get('/api/staff/snapshot')).data.orders[0].paymentStatus,'refunded');
});

test('unreachable gateway preserves an unpaid recoverable order and never records a false payment',async t=>{
  const {env,c}=fixture(t,{DEMO_MODE:'false',MIDTRANS_SERVER_KEY:'test-server-key'});const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});globalThis.fetch=async()=>{throw new Error('Simulated provider outage');};
  await c.get('/api/bootstrap');assert.equal((await create(c,{paymentMethod:'midtrans'})).status,502);const orders=(await c.get('/api/orders/my')).data.orders;assert.equal(orders.length,1);assert.equal(orders[0].paymentStatus,'pending');assert.equal(orders[0].paymentUrl,null);assert.equal(orders[0].status,'awaiting_payment');
});

test('checkout recovery lookup returns only the current session attempt and respects feature gates',async t=>{
  const {env,c}=fixture(t,{DEMO_MODE:'false'});await c.get('/api/bootstrap');const key=crypto.randomUUID();const order=(await create(c,{paymentMethod:'cod',idempotencyKey:key})).data;
  assert.equal((await c.get(`/api/orders/attempt/${key}`)).data.order.id,order.id);assert.equal((await c.get(`/api/orders/attempt/${crypto.randomUUID()}`)).data.order,null);
  const other=client(env,'127.0.0.2');await other.get('/api/bootstrap');assert.equal((await other.get(`/api/orders/attempt/${key}`)).data.order,null);
  env.COMMERCE_LEVEL='catalog';assert.equal((await c.get(`/api/orders/attempt/${key}`)).status,403);
});

test('staff searches and status pages find orders beyond 250 without crossing store scopes',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');const created=(await create(c,{paymentMethod:'cod'})).data;const source=env.DB.db.prepare('SELECT * FROM orders WHERE id=?').get(created.id);const keys=Object.keys(source);const insert=env.DB.db.prepare(`INSERT INTO orders(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`);
  for(let i=0;i<300;i++){
    const status=['completed','awaiting_payment','processing','cancelled'][i%4];const row={...source,id:`archive-${i}`,number:`ARCHIVE-${String(i).padStart(4,'0')}`,idempotency_key:`archive-key-${i}`,status,payment_status:i%4===1?'pending_verification':i%4===3?'unpaid':i===8?'refunded':'paid',return_status:i===0?'requested':i===4?'rejected':i===8?'refunded':i===12?'approved':i===16?'received':'none',created_at:new Date(Date.UTC(2026,0,1,0,0,i)).toISOString(),customer_json:JSON.stringify({name:i===0?'Pelanggan Arsip 100%_nyata':`Kelompok ${i%3} Pembeli ${i}`,phone:`081200${String(i).padStart(6,'0')}`})};insert.run(...keys.map(key=>row[key]));
  }
  assert.equal((await c.get('/api/staff/snapshot')).data.orders.some(o=>o.id==='archive-0'),false);
  const old=(await c.get('/api/staff/orders?limit=50&offset=0&q=ARCHIVE-0000&status=all')).data;assert.equal(old.total,1);assert.equal(old.orders[0].id,'archive-0');assert.equal(old.hasMore,false);
  assert.equal((await c.get('/api/staff/orders?q=100%25_nyata')).data.orders[0].id,'archive-0');assert.equal((await c.get('/api/staff/orders?q=081200000000')).data.orders[0].id,'archive-0');
  const first=(await c.get('/api/staff/orders?limit=3&offset=0&q=ARCHIVE&status=verification')).data;const second=(await c.get('/api/staff/orders?limit=3&offset=3&q=ARCHIVE&status=verification')).data;assert.equal(first.total,75);assert.equal(second.total,75);assert.equal(first.hasMore,true);assert.equal(second.offset,3);assert.ok(first.orders.every(o=>o.paymentStatus==='pending_verification'));assert.equal(first.orders.some(a=>second.orders.some(b=>a.id===b.id)),false);
  const returns=(await c.get('/api/staff/orders?status=returns&q=ARCHIVE')).data;assert.equal(returns.total,3);assert.deepEqual(returns.orders.map(o=>o.id),['archive-16','archive-12','archive-0']);assert.equal((await c.get('/api/staff/orders?status=completed&q=ARCHIVE')).data.total,75);
  const end=(await c.get('/api/staff/orders?limit=20&offset=70&q=ARCHIVE&status=verification')).data;assert.equal(end.orders.length,5);assert.equal(end.hasMore,false);
  const other=client(env,'127.0.0.2');await other.get('/api/bootstrap');const otherScope=await scopeFor(env,other);const otherSession=env.DB.db.prepare('SELECT token_hash FROM sessions WHERE scope=?').get(otherScope).token_hash;const privateRow={...source,scope:otherScope,id:'other-scope-order',number:'ARCHIVE-0000',session_id:otherSession,customer_json:JSON.stringify({name:'Nama khusus toko lain',phone:'081277777777'})};insert.run(...keys.map(key=>privateRow[key]));
  assert.equal((await other.get('/api/staff/orders?q=ARCHIVE-0000')).data.orders[0].id,'other-scope-order');assert.equal((await c.get('/api/staff/orders?q=ARCHIVE-0000')).data.orders[0].id,'archive-0');assert.equal((await c.get('/api/staff/orders?q=Nama%20khusus%20toko%20lain',{'X-Demo-Scope':otherScope})).data.total,0);
});

test('staff pagination rejects invalid filters and still requires staff and an orders-capable level',async t=>{
  const {env,c}=fixture(t,{DEMO_MODE:'false',STAFF_VIEWER_PASSWORD:'viewer-test-password-123'});await c.get('/api/bootstrap');assert.equal((await c.get('/api/staff/orders?q=test&status=all')).status,401);
  await c.post('/api/staff/login',{role:'viewer',password:env.STAFF_VIEWER_PASSWORD});assert.equal((await c.get('/api/staff/orders?limit=50&offset=0')).status,200);
  for(const query of ['status=unknown','limit=0','limit=251','offset=-1',`q=${'a'.repeat(101)}`])assert.equal((await c.get(`/api/staff/orders?${query}`)).status,422);
  assert.equal((await c.get('/api/staff/orders?q=%27%20OR%201%3D1')).data.total,0);env.COMMERCE_LEVEL='whatsapp';assert.equal((await c.get('/api/staff/orders')).status,403);
});

test('optional tax and service fee are quoted by the server and persisted as separate order components',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');
  assert.equal((await c.put('/api/staff/settings',{modules:{taxes:true,serviceFees:true},pricing:{taxBps:1100,taxIncluded:false,serviceFeeBps:500}})).status,200);
  const input=orderInput({couponCode:'RUPA10'});
  const quoted=await c.post('/api/quote',input);
  assert.equal(quoted.status,200,JSON.stringify(quoted.data));assert.equal(quoted.data.subtotal,329000);
  assert.equal(quoted.data.discount,32900);assert.equal(quoted.data.serviceFee,14805);assert.equal(quoted.data.taxAmount,32571);
  assert.equal(quoted.data.total,361476);
  const created=await c.post('/api/orders',{...input,expectedTotal:quoted.data.total});
  assert.equal(created.status,200,JSON.stringify(created.data));assert.equal(created.data.taxAmount,32571);assert.equal(created.data.serviceFee,14805);
  assert.equal(created.data.shippingFee,18000);
  const scope=await scopeFor(env,c);const stored=env.DB.db.prepare('SELECT * FROM orders WHERE scope=? AND id=?').get(scope,created.data.id);
  assert.equal(stored.shipping_base_fee,18000);assert.equal(stored.shipping_fee,18000+32571+14805);
  assert.equal(stored.total,stored.subtotal-stored.discount+stored.shipping_fee);
  const exported=await c.get('/api/staff/export/orders.csv');
  assert.equal(exported.status,200);assert.match(exported.data,/"Diskon poin","Poin ditukar","Ongkir","Pajak","Pajak termasuk harga","Biaya layanan","Total"/);
  assert.ok(exported.data.includes('"18000","32571","Tidak","14805","361476"'),'CSV separates fees from shipping and preserves the price snapshot');
  await c.put('/api/staff/settings',{pricing:{taxIncluded:true}});
  const inclusive=await c.post('/api/quote',input);
  assert.equal(inclusive.data.total,328905);assert.equal(inclusive.data.taxAmount,Math.round(296100*1100/11100));
  assert.equal(inclusive.data.taxIncluded,true);
  // Saved totals do not change when settings change.
  assert.equal((await c.get('/api/orders/'+created.data.id)).data.total,361476);
});
test('demo email verification owns one member, points earn on completed paid orders and refund only once',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');
  const requested=await c.post('/api/member/start',{email:'member@example.com',name:'Pembeli Uji'});
  assert.equal(requested.status,200,JSON.stringify(requested.data));assert.match(requested.data.demoCode,/^\d{6}$/);
  assert.equal((await c.post('/api/member/verify',{code:'x'})).status,422);
  const verified=await c.post('/api/member/verify',{code:requested.data.demoCode});
  assert.equal(verified.status,200,JSON.stringify(verified.data));assert.equal(verified.data.email,'member@example.com');
  const order=(await create(c)).data;
  assert.equal((await action(c,order.id,'confirm-payment',{reference:'TRANSFER-MEMBER'})).status,200);
  assert.equal((await action(c,order.id,'process')).status,200);
  assert.equal((await action(c,order.id,'ship',{carrier:'Kurir demo',trackingNumber:'RESI-MEMBER'})).status,200);
  assert.equal((await action(c,order.id,'complete')).status,200);
  const earned=(await c.get('/api/bootstrap')).data.loyalty.points;assert.equal(earned,32);
  assert.equal((await action(c,order.id,'complete')).status,200);assert.equal((await c.get('/api/bootstrap')).data.loyalty.points,earned);
  const redeemInput=orderInput({redeemPoints:10});
  const quote=await c.post('/api/quote',redeemInput);assert.equal(quote.status,200,JSON.stringify(quote.data));
  assert.equal(quote.data.pointsDiscount,1000);assert.equal(quote.data.total,346000);
  const redeemed=await c.post('/api/orders',{...redeemInput,expectedTotal:quote.data.total});
  assert.equal(redeemed.status,200,JSON.stringify(redeemed.data));assert.equal((await c.get('/api/bootstrap')).data.loyalty.points,22);
  assert.equal((await customerAction(c,redeemed.data.id,'cancel')).status,200);
  assert.equal((await customerAction(c,redeemed.data.id,'cancel')).status,200);
  assert.equal((await c.get('/api/bootstrap')).data.loyalty.points,32);
  const secondDevice=client(env,'127.0.0.75');await secondDevice.get('/api/bootstrap');
  const secondRequest=await secondDevice.post('/api/member/start',{email:'MEMBER@example.com',name:'Pembeli Uji'});
  assert.equal(secondRequest.status,200);
  const secondLogin=await secondDevice.post('/api/member/verify',{code:secondRequest.data.demoCode});
  assert.equal(secondLogin.status,200);assert.equal(secondLogin.data.points,0,'different demo visitors get separate store scopes');
  assert.notEqual(secondLogin.data.id,verified.data.id);
  assert.equal((await secondDevice.get('/api/orders/my')).data.orders.length,0,'separate demo visitors cannot see orders');
  const scope=await scopeFor(env,c);
  assert.deepEqual(env.DB.db.prepare('SELECT kind,delta FROM loyalty_entries WHERE scope=? AND order_id=? ORDER BY kind').all(scope,redeemed.data.id).map(row=>({...row})),[{kind:'redeem',delta:-10},{kind:'restore',delta:10}]);
});
test('member sessions cannot use points without verified ownership; production email requires a provider',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');
  assert.equal((await c.post('/api/quote',orderInput({redeemPoints:10}))).status,401);
  await c.put('/api/staff/settings',{modules:{customerAccounts:false,loyaltyPoints:false,membershipTiers:false,promotions:false}});
  assert.equal((await c.post('/api/member/start',{email:'any@example.com'})).status,403);
  assert.equal((await c.post('/api/quote',orderInput({couponCode:'RUPA10'}))).status,403);
  const live=environment({DEMO_MODE:'false',COMMERCE_LEVEL:'store'});
  t.after(()=>live.DB.close());const visitor=client(live);
  await visitor.get('/api/bootstrap');
  assert.equal((await visitor.post('/api/member/start',{email:'any@example.com',name:'Any'})).status,503);
});

test('loyalty eligibility is fixed at checkout when modules are toggled',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');
  const challenge=await c.post('/api/member/start',{email:'toggle@example.com',name:'Pembeli'});
  assert.equal((await c.post('/api/member/verify',{code:challenge.data.demoCode})).status,200);
  const eligible=await create(c);assert.equal(eligible.status,200);
  assert.equal((await c.put('/api/staff/settings',{modules:{loyaltyPoints:false,membershipTiers:false}})).status,200);
  const ineligible=await create(c);assert.equal(ineligible.status,200);
  async function complete(id) {
    assert.equal((await action(c,id,'confirm-payment',{reference:'TRANSFER'})).status,200);
    assert.equal((await action(c,id,'process')).status,200);
    assert.equal((await action(c,id,'ship',{carrier:'Kurir',trackingNumber:'RESI'})).status,200);
    assert.equal((await action(c,id,'complete')).status,200);
  }
  await complete(eligible.data.id);
  assert.equal((await c.put('/api/staff/settings',{modules:{loyaltyPoints:true,membershipTiers:true}})).status,200);
  await complete(ineligible.data.id);
  const summary=(await c.get('/api/bootstrap')).data.loyalty;
  assert.equal(summary.points,32);assert.equal(summary.completedSpend,329000);
  const scope=await scopeFor(env,c);
  assert.deepEqual(env.DB.db.prepare('SELECT loyalty_eligible FROM orders WHERE scope=? AND id IN (?,?) ORDER BY loyalty_eligible').all(scope,eligible.data.id,ineligible.data.id).map(row=>row.loyalty_eligible),[0,1]);
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS count FROM loyalty_entries WHERE scope=? AND order_id=?').get(scope,ineligible.data.id).count,0);
});

test('loyalty eligibility migration preserves outstanding legacy member orders',async t=>{
  const {env,c}=fixture(t);await c.get('/api/bootstrap');
  const challenge=await c.post('/api/member/start',{email:'legacy@example.com',name:'Pembeli'});
  assert.equal((await c.post('/api/member/verify',{code:challenge.data.demoCode})).status,200);
  const order=await create(c);assert.equal(order.status,200);
  // Reconstruct the pre-0003 schema with an existing order, then upgrade it.
  env.DB.db.exec('DROP TRIGGER earn_member_points; ALTER TABLE orders DROP COLUMN loyalty_eligible');
  env.DB.db.exec(readFileSync(new URL('../migrations/0003_loyalty_eligibility.sql',import.meta.url),'utf8'));
  const id=order.data.id;
  assert.equal((await action(c,id,'confirm-payment',{reference:'TRANSFER'})).status,200);
  assert.equal((await action(c,id,'process')).status,200);
  assert.equal((await action(c,id,'ship',{carrier:'Kurir',trackingNumber:'RESI'})).status,200);
  assert.equal((await action(c,id,'complete')).status,200);
  assert.equal((await c.get('/api/bootstrap')).data.loyalty.points,32);
  assert.equal((await customerAction(c,id,'request-return',{reason:'Rusak'})).status,200);
  assert.equal((await action(c,id,'approve-return')).status,200);
  assert.equal((await action(c,id,'receive-return')).status,200);
  const member=(await c.get('/api/bootstrap')).data.loyalty;
  assert.equal(member.points,0);assert.equal(member.completedSpend,0);
});

test('returning demos adopt untouched photo sets once and keep staff edits and store data', async t => {
  const { env, c } = fixture(t);
  await c.get('/api/bootstrap');
  const db = env.DB.db;
  const scope = await scopeFor(env, c);
  const stockShot = JSON.stringify(['/images/canvas-tote.webp']);
  const ownShots = JSON.stringify(['/images/my-studio.webp']);
  const reset = db.prepare("UPDATE scopes SET config_json=json_remove(config_json,'$.sampleGalleryVersion') WHERE id=?");
  const setPhotos = db.prepare('UPDATE products SET images_json=? WHERE scope=? AND id=?');
  const getPhotos = id => db.prepare('SELECT images_json AS photos FROM products WHERE scope=? AND id=?').get(scope, id).photos;
  const sku = 'RPA-003-NATURAL';
  const pouchId = 'canvas-tote-natural';
  const seedVariant = db.prepare('SELECT name,sku FROM variants WHERE scope=? AND id=?').get(scope, pouchId);
  assert.equal(seedVariant.name, 'Khaki');
  assert.equal(seedVariant.sku, sku);
  const oldColors = db.prepare('UPDATE variants SET name=?,options_json=? WHERE scope=? AND id=?');
  oldColors.run('Natural', '{"Warna":"Natural"}', scope, pouchId);
  oldColors.run('Cokelat', '{"Warna":"Cokelat"}', scope, 'leather-sling-cokelat');
  const historical = await create(c, { items: [{ variantId: pouchId, quantity: 1 }] });
  assert.equal(historical.status, 200);
  reset.run(scope);
  setPhotos.run(stockShot, scope, 'canvas-tote');
  setPhotos.run(ownShots, scope, 'ceramic-cup');
  setPhotos.run('["/images/leather-sling.webp"]', scope, 'leather-sling');
  db.prepare("INSERT INTO audit_events(scope,id,action,entity_id,detail,actor,created_at) VALUES(?,'edited-gallery','product.updated','leather-sling','','owner','2026-10-30')").run(scope);
  assert.equal((await c.get('/api/bootstrap')).status, 200);
  assert.equal(JSON.parse(getPhotos('canvas-tote')).length, 2);
  const currentVariant = db.prepare('SELECT name,sku,options_json FROM variants WHERE scope=? AND id=?').get(scope, pouchId);
  assert.equal(currentVariant.name, 'Khaki');
  assert.equal(currentVariant.sku, sku);
  assert.deepEqual(JSON.parse(currentVariant.options_json), { Warna: 'Khaki' });
  const receipt = (await c.get(`/api/orders/${historical.data.id}`)).data;
  assert.equal(receipt.items[0].variantName, 'Natural');
  assert.equal(db.prepare('SELECT name FROM variants WHERE scope=? AND id=?').get(scope, 'leather-sling-cokelat').name, 'Cokelat');
  assert.equal(getPhotos('ceramic-cup'), ownShots);
  assert.equal(JSON.parse(getPhotos('leather-sling')).length, 1);
  setPhotos.run(stockShot, scope, 'canvas-tote');
  await c.get('/api/bootstrap');
  assert.equal(getPhotos('canvas-tote'), stockShot);

  env.DEMO_MODE = 'false';
  const store = client(env);
  await store.get('/api/bootstrap');
  setPhotos.run(stockShot, 'store', 'canvas-tote');
  await store.get('/api/bootstrap');
  assert.equal(db.prepare("SELECT images_json AS photos FROM products WHERE scope='store' AND id='canvas-tote'").get().photos, stockShot);
});
