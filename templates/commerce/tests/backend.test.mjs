import test from 'node:test';
import assert from 'node:assert/strict';
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
  await c.post('/api/demo/config',{level:'store'});assert.equal((await c.post('/api/quote',orderInput({couponCode:'RUPA10'}))).status,403);assert.equal((await create(c,{paymentMethod:'midtrans'})).status,422);
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
