import { resolveDatabase, resolveObjectStorage } from '@tampiloka/storage';
import type { CommerceLevel, StaffRole } from '../src/shared/contracts.ts';
import type { Bindings, Env, Row, Session } from './types.ts';
import { levels } from '../content/store.ts';
import { all, auditStatement, bootstrap, configFor, orderFor, orderFrom, ordersFrom, q, reviewsFor, sessionFor, wishlistFor } from './db.ts';
import { createOrder, customerAction, expireManualOrders, quoteFor, rawOrder, staffAction } from './orders.ts';
import { gatewayRefund, paymentWebhook, reconcilePayment, simulatePayment, startPayment } from './payments.ts';
import { adjustInventory, exportOrders, saveCoupon, saveProduct, saveSettings, snapshot, staffOrders, submitReview, toggleWishlist } from './staff.ts';
import { beginMemberLogin, verifyMemberLogin, signOutMember } from './loyalty.ts';
import { rotateTrackingCode, trackOrder } from './tracking.ts';
import { body, capabilities, digest, fail, HttpError, id, isDemo, now, rateLimit, requireFeature, safeEqual, sameOrigin, staff, text } from './security.ts';
export type { Bindings, Env } from './types.ts';

const apiHeaders = { 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin' };
function json(value:unknown,status=200,cookie?:string) { const headers:Record<string,string>={...apiHeaders,'Content-Type':'application/json; charset=utf-8'};if(cookie)headers['Set-Cookie']=cookie;return new Response(JSON.stringify(value),{status,headers}); }
async function login(request:Request,env:Env,session:Session,input:Row) {
  const role=(input.role||'owner') as StaffRole;if(!['owner','operations','viewer'].includes(role))fail(422,'INVALID_ROLE','Peran staf tidak valid.');
  await rateLimit(env,`login:${await digest(request.headers.get('CF-Connecting-IP')||'local')}`,10,900);
  const secrets={owner:env.STAFF_OWNER_PASSWORD,operations:env.STAFF_OPERATIONS_PASSWORD,viewer:env.STAFF_VIEWER_PASSWORD};const secret=secrets[role];
  if(!secret||secret.length<12)fail(503,'STAFF_NOT_CONFIGURED','Akses peran ini belum diatur di server.');
  const password=text(input.password,'Kata sandi',200,true);
  if(!safeEqual(await digest(password),await digest(secret)))fail(401,'INVALID_CREDENTIALS','Kata sandi atau peran tidak sesuai.');
  const raw=id()+id();const hash=await digest(raw);const stamp=now();const old=session.tokenHash;
  await env.DB.batch([
    q(env,'UPDATE sessions SET token_hash=?,role=?,created_at=?,expires_at=? WHERE token_hash=?',hash,role,stamp,new Date(Date.now()+8*3600000).toISOString(),old),
    q(env,'UPDATE orders SET session_id=? WHERE scope=? AND session_id=?',hash,session.scope,old),q(env,'UPDATE wishlist SET session_id=? WHERE scope=? AND session_id=?',hash,session.scope,old),q(env,'UPDATE reviews SET session_id=? WHERE scope=? AND session_id=?',hash,session.scope,old),
    auditStatement(env,{...session,role},'staff.login',role,'Staf masuk'),
  ]);
  const secure=new URL(request.url).protocol==='https:'?'; Secure':'';session.tokenHash=hash;session.role=role;session.cookie=`tampiloka_session=${raw}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${secure}`;return bootstrap(env,session);
}
async function route(request:Request,env:Env,session:Session,path:string) {
  const method=request.method;
  if(path==='/api/staff/uploads'&&method==='POST') {
    staff(session,true);
    const length=Number(request.headers.get('content-length') || 0);
    if(length>5_242_880)fail(413,'BODY_TOO_LARGE','Berkas terlalu besar.');
    const type=(request.headers.get('content-type')||'').split(';')[0];
    if(!['image/jpeg','image/png','image/webp'].includes(type))fail(422,'INVALID_FILE','Format gambar tidak didukung.');
    const reader=request.body?.getReader();
    const chunks:Uint8Array[]=[];let size=0;
    if(reader){
      try {
        while(true){
          const {done,value}=await reader.read();if(done)break;
          size+=value.byteLength;
          if(size>5_242_880){await reader.cancel().catch(()=>{});fail(413,'BODY_TOO_LARGE','Ukuran berkas tidak valid.');}
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
    }
    const data=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
    if(!data.length||data.length>5_242_880)fail(413,'BODY_TOO_LARGE','Ukuran berkas tidak valid.');
    const valid=type==='image/jpeg'?data[0]===255&&data[1]===216&&data[2]===255:type==='image/png'?data.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>data[i]===n):data.length>=12&&String.fromCharCode(...data.slice(0,4))==='RIFF'&&String.fromCharCode(...data.slice(8,12))==='WEBP';
    if(!valid)fail(422,'INVALID_FILE','Isi gambar tidak valid.');
    const uploadId=id();const storage=resolveObjectStorage(env as unknown as Parameters<typeof resolveObjectStorage>[0]);const stored=await storage.put(`${session.scope}/${uploadId}`,data,{contentType:type});
    try { await q(env,'INSERT INTO uploads(scope,id,object_key,content_type) VALUES(?,?,?,?)',session.scope,uploadId,stored.key,type).run(); }
    catch(error) { await storage.delete(stored.key); throw error; }
    return {id:uploadId,url:`/api/staff/uploads/${uploadId}`};
  }
  const upload=path.match(/^\/api\/staff\/uploads\/([a-f0-9]{32})$/);
  if(upload&&(method==='GET'||method==='DELETE')) {
    staff(session,method==='DELETE');
    const record=await q(env,'SELECT object_key,content_type FROM uploads WHERE scope=? AND id=?',session.scope,upload[1]).first<Row>();
    if(!record)fail(404,'NOT_FOUND','Berkas tidak ditemukan.');
    const storage=resolveObjectStorage(env as unknown as Parameters<typeof resolveObjectStorage>[0]);
    if(method==='DELETE'){await storage.delete(record.object_key);await q(env,'DELETE FROM uploads WHERE scope=? AND id=?',session.scope,upload[1]).run();return {ok:true};}
    const object=await storage.get(record.object_key);if(!object)fail(404,'NOT_FOUND','Berkas tidak ditemukan.');
    return new Response(object.body.slice().buffer as ArrayBuffer,{headers:{...apiHeaders,'Content-Type':record.content_type,'Content-Disposition':'inline'}});
  }
  if(path==='/api/bootstrap'&&method==='GET'){await expireManualOrders(env,session);return bootstrap(env,session);}
  if(path==='/api/session/demo'&&method==='POST') {
    if(!session.demo)fail(403,'DEMO_ONLY','Sesi demo tidak tersedia pada toko ini.');
    const input=await body(request);
    if(input.reset===true){await q(env,'DELETE FROM scopes WHERE id=? AND demo=1',session.scope).run();const fresh=await sessionFor(request,env,true);Object.assign(session,fresh);}
    return bootstrap(env,session);
  }
  if(path==='/api/demo/config'&&method==='POST') {
    if(!session.demo)fail(403,'DEMO_ONLY','Pilihan tingkat demo tidak tersedia pada toko ini.');const input=await body(request);const cfg=await configFor(env,session);
    if(input.level!==undefined&&!levels.includes(input.level))fail(422,'INVALID_LEVEL','Tingkat toko tidak valid.');
    const preset=input.preset===undefined?cfg.preset:text(input.preset,'Preset',40,true);if(!['editorial','market','atelier','compact'].includes(preset))fail(422,'INVALID_PRESET','Preset tidak tersedia.');
    await q(env,'UPDATE scopes SET level=?,preset=? WHERE id=?',input.level||cfg.level,preset,session.scope).run();return bootstrap(env,session);
  }
  if(path==='/api/demo/role'&&method==='POST') {
    if(!session.demo)fail(403,'DEMO_ONLY','Simulasi peran hanya tersedia di demo.');const input=await body(request);if(!['owner','operations','viewer'].includes(input.role))fail(422,'INVALID_ROLE','Peran tidak valid.');
    session.role=input.role;await q(env,'UPDATE sessions SET role=? WHERE token_hash=?',session.role,session.tokenHash).run();return bootstrap(env,session);
  }
  if(path==='/api/staff/login'&&method==='POST')return login(request,env,session,await body(request));
  if(path==='/api/logout'&&method==='POST'){await q(env,'DELETE FROM sessions WHERE token_hash=?',session.tokenHash).run();Object.assign(session,await sessionFor(request,env,true));return bootstrap(env,session);}
  if(path==='/api/member/start'&&method==='POST')return beginMemberLogin(request,env,session,await body(request));
  if(path==='/api/member/verify'&&method==='POST')return verifyMemberLogin(env,session,await body(request));
  if(path==='/api/member/logout'&&method==='POST')return signOutMember(env,session);
  if(path==='/api/products'&&method==='GET'){const b=await bootstrap(env,session);return {products:b.products,categories:b.categories};}
  if(path==='/api/quote'&&method==='POST')return quoteFor(env,session,await body(request));
  if(path==='/api/orders'&&method==='POST'){
    await rateLimit(env,`orders:${session.tokenHash}`,50,3600);const order=await createOrder(env,session,await body(request));
    if(order.paymentMethod==='midtrans'&&!session.demo&&!order.paymentUrl&&order.status==='awaiting_payment')return {...await startPayment(env,session,order.id),...(order.trackingCode?{trackingCode:order.trackingCode}:{})};return order;
  }
  if(path==='/api/orders/track'&&method==='POST')return trackOrder(request,env,await body(request));
  const attemptMatch=path.match(/^\/api\/orders\/attempt\/([A-Za-z0-9_-]{8,100})$/);
  if(attemptMatch&&method==='GET'){
    requireFeature(capabilities(await configFor(env,session)),'orders');
    const row=await q(env,'SELECT * FROM orders WHERE scope=? AND session_id=? AND idempotency_key=?',session.scope,session.tokenHash,attemptMatch[1]).first<Row>();
    return {order:row?await orderFrom(env,row):null};
  }
  if(path==='/api/orders/my'&&method==='GET') {
    requireFeature(capabilities(await configFor(env,session)),'orders');await expireManualOrders(env,session);
    const rows=await all(env,'SELECT * FROM orders WHERE scope=? AND session_id=? ORDER BY created_at DESC LIMIT 100',session.scope,session.tokenHash);return {orders:await ordersFrom(env,rows)};
  }
  let match=path.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)$/);if(match&&method==='GET'){requireFeature(capabilities(await configFor(env,session)),'orders');return orderFor(env,session,match[1]);}
  match=path.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)\/actions$/);if(match&&method==='POST')return customerAction(env,session,match[1],await body(request));
  match=path.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)\/tracking-code$/);if(match&&method==='POST'){requireFeature(capabilities(await configFor(env,session)),'orders');return rotateTrackingCode(env,session,match[1]);}
  match=path.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)\/payment$/);if(match&&method==='POST')return startPayment(env,session,match[1]);
  match=path.match(/^\/api\/orders\/([a-zA-Z0-9_-]+)\/reconcile$/);if(match&&method==='POST'){requireFeature(capabilities(await configFor(env,session)),'gateway');return reconcilePayment(env,session,match[1]);}
  if(path==='/api/demo/payment'&&method==='POST')return simulatePayment(env,session,await body(request));
  if(path==='/api/wishlist'&&method==='GET'){requireFeature(capabilities(await configFor(env,session)),'wishlist');return {wishlist:await wishlistFor(env,session)};}
  if(path==='/api/wishlist'&&method==='POST')return toggleWishlist(env,session,await body(request));
  if(path==='/api/reviews'&&method==='GET'){requireFeature(capabilities(await configFor(env,session)),'reviews');return {reviews:await reviewsFor(env,session.scope)};}
  if(path==='/api/reviews'&&method==='POST')return submitReview(env,session,await body(request));
  if(path==='/api/staff/snapshot'&&method==='GET'){staff(session);await expireManualOrders(env,session);return snapshot(env,session);}
  if(path==='/api/staff/orders'&&method==='GET'){const query=new URL(request.url).searchParams;return staffOrders(env,session,Number(query.get('limit')||50),Number(query.get('offset')||0),query.get('q')||'',query.get('status')||'all');}
  match=path.match(/^\/api\/staff\/orders\/([a-zA-Z0-9_-]+)\/actions$/);
  if(match&&method==='POST'){
    const input=await body(request);
    if(input.action==='refund'&&!session.demo&&!input.manual){staff(session,true,true);requireFeature(capabilities(await configFor(env,session)),'orders');const row=await rawOrder(env,session,match[1],true);if(row.payment_method==='midtrans')return gatewayRefund(env,session,match[1],input);}
    return staffAction(env,session,match[1],input);
  }
  if(path==='/api/staff/products'&&method==='POST')return saveProduct(env,session,null,await body(request));
  match=path.match(/^\/api\/staff\/products\/([a-zA-Z0-9_-]+)$/);if(match&&method==='PUT')return saveProduct(env,session,match[1],await body(request));
  if(path==='/api/staff/inventory'&&method==='POST')return adjustInventory(env,session,await body(request));
  if(path==='/api/staff/coupons'&&method==='POST')return saveCoupon(env,session,await body(request));
  if(path==='/api/staff/settings'&&method==='PUT')return saveSettings(env,session,await body(request));
  if(['/api/staff/export','/api/staff/export/orders.csv'].includes(path)&&method==='GET')return new Response(await exportOrders(env,session),{headers:{...apiHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="pesanan-rupa.csv"'}});
  return fail(404,'NOT_FOUND','Halaman API tidak ditemukan.');
}
export async function handleRequest(request:Request,env:Env):Promise<Response> {
  const url=new URL(request.url);
  const requestId=id();let session:Session|undefined;
  try{
    if(url.pathname==='/api/health'&&request.method==='GET'){await q(env,'SELECT 1 AS ready').first();return json({ok:true,service:'tampiloka-commerce',demo:isDemo(env)});}
    if(url.pathname==='/api/webhooks/midtrans'&&request.method==='POST')return json(await paymentWebhook(env,await body(request)));
    sameOrigin(request,env);session=await sessionFor(request,env);
    const result=await route(request,env,session,url.pathname);
    if(result instanceof Response){if(session.cookie)result.headers.set('Set-Cookie',session.cookie);return result;}
    return json(result,200,session.cookie);
  }catch(error){
    let status=500,code='INTERNAL_ERROR',message='Permintaan belum dapat diproses. Coba lagi.';
    if(error instanceof HttpError){status=error.status;code=error.code;message=error.message;}
    else if((typeof error==='object' && error!==null && 'code' in error && ['23505','23503','23514'].includes(String(error.code))) || /CHECK constraint|mutation_guards|UNIQUE constraint|FOREIGN KEY|PRICE_CHANGED|COUPON_(?:CHANGED|UNAVAILABLE|EXPIRED)|PRODUCT_UNAVAILABLE|INVALID_DISCOUNT|POINTS_UNAVAILABLE/i.test(String(error))){status=409;code='CONFLICT';message='Data berubah atau stok tidak cukup. Muat ulang dan coba lagi.';}
    // Log only identifiers and error classes; never customer input, cookies or credentials.
    if(status===500)console.error(JSON.stringify({requestId,code,name:error instanceof Error?error.name:'Error'}));
    return json({error:{code,message},requestId},status,session?.cookie);
  }
}
export async function cleanup(env:Env) {
  await expireManualOrders(env);
  // A real gateway reservation is released only after a verified provider status.
  if(env.MIDTRANS_SERVER_KEY){const due=await all(env,"SELECT o.scope,o.id FROM orders o JOIN scopes s ON s.id=o.scope WHERE s.demo=0 AND o.payment_method='midtrans' AND o.status='awaiting_payment' AND o.expires_at<? LIMIT 25",now());for(const row of due){try{await reconcilePayment(env,{scope:row.scope,demo:false,role:'owner',tokenHash:'scheduled'},row.id);}catch{/* Next schedule or a staff reconcile retries provider failures. */}}}
  await env.DB.batch([q(env,'DELETE FROM sessions WHERE expires_at<=?',now()),q(env,'DELETE FROM rate_limits WHERE expires_at<=?',now()),q(env,"DELETE FROM scopes WHERE demo=1 AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.scope=scopes.id AND s.expires_at>?)",now())]);
}
function connect(bindings: Bindings): Env {
  return { ...bindings, DB: resolveDatabase(bindings) as Env['DB'] };
}

export default {
  fetch(request: Request, bindings: Bindings) {
    if (!new URL(request.url).pathname.startsWith('/api/')) {
      return bindings.ASSETS?.fetch(request) ?? new Response('Commerce API.', { status: 404 });
    }
    let env: Env;
    try { env = connect(bindings); }
    catch { return json({ error: { code: 'DATABASE_NOT_CONFIGURED', message: 'Basis data belum terpasang.' } }, 503); }
    return handleRequest(request, env);
  },
  async scheduled(_controller: unknown, bindings: Bindings) {
    await cleanup(connect(bindings));
  },
};
