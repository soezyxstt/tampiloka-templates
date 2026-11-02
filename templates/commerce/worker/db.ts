import configured from '../config/commerce.json' with { type: 'json' };
import { categories, defaultConfig, levels, seedCoupons, seedProducts, shippingMethods } from '../content/store.ts';
import type { Bootstrap, CommerceLevel, Coupon, Order, Product, Review, StoreConfig } from '../src/shared/contracts.ts';
import type { SqlStatement, Env, Row, Session } from './types.ts';
import { capabilities, digest, fail, id, isDemo, now, rateLimit, validateModules } from './security.ts';

export const q = (env: Env, sql: string, ...args: unknown[]) => env.DB.prepare(sql).bind(...args);
export const all = async <T = Row>(env: Env, sql: string, ...args: unknown[]) => (await q(env, sql, ...args).all<T>()).results;
export function getDefaultConfig(env: Env): StoreConfig {
  const cfg = configured as Partial<StoreConfig>;
  const level = env.COMMERCE_LEVEL || cfg.level || defaultConfig.level;
  if (!levels.includes(level as CommerceLevel)) fail(503, 'INVALID_CONFIG', 'Tingkat toko pada konfigurasi tidak valid.');
  const result:StoreConfig = { ...defaultConfig, ...cfg, level: level as CommerceLevel, currency: 'IDR', brand: { ...defaultConfig.brand, ...cfg.brand },
    bank: { ...defaultConfig.bank, ...cfg.bank }, shippingMethods:cfg.shippingMethods||shippingMethods,
    pricing:{...defaultConfig.pricing,...cfg.pricing} as NonNullable<StoreConfig['pricing']>,
    loyalty:{...defaultConfig.loyalty,...cfg.loyalty} as NonNullable<StoreConfig['loyalty']> };
  validateModules(result);
  return result;
}
function seedStatements(env: Env, scope: string, demo: boolean, config: StoreConfig): SqlStatement[] {
  const stmts: SqlStatement[] = [q(env, 'INSERT OR IGNORE INTO scopes(id,demo,level,preset,config_json,created_at) VALUES(?,?,?,?,?,?)', scope, Number(demo), config.level, config.preset, JSON.stringify(config), now())];
  for (const p of seedProducts) {
    stmts.push(q(env, 'INSERT OR IGNORE INTO products(scope,id,slug,name,description,category,price,compare_at_price,images_json,material,featured,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', scope,p.id,p.slug,p.name,p.description,p.category,p.price,p.compareAtPrice ?? null,JSON.stringify(p.images),p.material,Number(p.featured),Number(p.active),p.createdAt));
    for (const v of p.variants) stmts.push(q(env, 'INSERT OR IGNORE INTO variants(scope,id,product_id,name,sku,price,stock,options_json) VALUES(?,?,?,?,?,?,?,?)',scope,v.id,p.id,v.name,v.sku,v.price,v.stock,JSON.stringify(v.options)));
  }
  for (const c of seedCoupons) stmts.push(q(env, 'INSERT OR IGNORE INTO coupons(scope,code,kind,value,min_spend,max_discount,active,use_limit,used_count,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)',scope,c.code,c.kind,c.value,c.minSpend,c.maxDiscount,Number(c.active),c.useLimit,0,c.expiresAt));
  return stmts;
}
export async function sessionFor(request: Request, env: Env, forceNew = false): Promise<Session> {
  const demo = isDemo(env);
  const token = forceNew ? undefined : request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('tampiloka_session='))?.slice(18);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const tokenHash = await digest(token);
    const existing = await q(env, 'SELECT s.token_hash,s.scope,s.role,s.expires_at,s.member_id,c.demo FROM sessions s JOIN scopes c ON c.id=s.scope WHERE s.token_hash=?',tokenHash).first<Row>();
    if (existing && existing.expires_at > now() && Boolean(existing.demo) === demo) return { tokenHash, scope: existing.scope, role: existing.role, demo, memberId: existing.member_id||null };
  }
  await rateLimit(env,`session:${await digest(request.headers.get('CF-Connecting-IP')||'local')}`,120,3600);
  const rawToken = id() + id(); const tokenHash = await digest(rawToken); const scope = demo ? `demo_${id()}` : 'store'; const role = demo ? 'owner' : 'customer';
  const config = getDefaultConfig(env);
  const exists = await q(env, 'SELECT id FROM scopes WHERE id=?',scope).first();
  const statements = exists ? [] : seedStatements(env,scope,demo,config);
  const ttl = demo ? 7 : 30;
  statements.push(q(env, 'INSERT INTO sessions(token_hash,scope,role,created_at,expires_at) VALUES(?,?,?,?,?)', tokenHash,scope,role,now(),new Date(Date.now()+ttl*86400000).toISOString()));
  await env.DB.batch(statements);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return { tokenHash, scope, role, demo, memberId:null, cookie: `tampiloka_session=${rawToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl*86400}${secure}` };
}
export async function configFor(env: Env, session: Session): Promise<StoreConfig> {
  const row = await q(env, 'SELECT level,preset,config_json FROM scopes WHERE id=?',session.scope).first<Row>();
  if (!row) fail(401, 'SESSION_EXPIRED', 'Sesi sudah berakhir. Muat ulang halaman.');
  const config = JSON.parse(row.config_json) as StoreConfig;
  // Production capability level comes from deployment configuration, not a browser choice.
  const deployed=getDefaultConfig(env);
  const result:StoreConfig={...deployed,...config,brand:{...deployed.brand,...config.brand,...(session.demo?{whatsapp:''}:{})},
    level:session.demo?row.level:deployed.level,preset:row.preset,
    modules:session.demo?{...deployed.modules,...config.modules}:deployed.modules,
    pricing:{...deployed.pricing,...config.pricing} as NonNullable<StoreConfig['pricing']>,
    loyalty:{...deployed.loyalty,...config.loyalty} as NonNullable<StoreConfig['loyalty']>};
  validateModules(result);return result;
}
export async function productsFor(env: Env, scope: string, includeInactive = false): Promise<Product[]> {
  const rows = await all(env, `SELECT * FROM products WHERE scope=? ${includeInactive ? '' : 'AND active=1'} ORDER BY created_at,id`,scope);
  const variants = await all(env, 'SELECT * FROM variants WHERE scope=? ORDER BY rowid',scope);
  return rows.map(p => ({ id:p.id,slug:p.slug,name:p.name,description:p.description,category:p.category,price:p.price,...(p.compare_at_price === null ? {} : {compareAtPrice:p.compare_at_price}),images:JSON.parse(p.images_json),material:p.material,featured:Boolean(p.featured),active:Boolean(p.active),createdAt:p.created_at,variants:variants.filter(v=>v.product_id===p.id).map(v=>({id:v.id,productId:v.product_id,name:v.name,sku:v.sku,price:v.price,stock:v.stock,options:JSON.parse(v.options_json)})) }));
}
export function couponFrom(row: Row): Coupon { return {code:row.code,kind:row.kind,value:row.value,minSpend:row.min_spend,maxDiscount:row.max_discount,active:Boolean(row.active),useLimit:row.use_limit,usedCount:row.used_count,expiresAt:row.expires_at}; }
export function auditStatement(env: Env, session: Session, action: string, entityId: string, detail: string) { return q(env,'INSERT INTO audit_events(scope,id,action,entity_id,detail,actor,created_at) VALUES(?,?,?,?,?,?,?)',session.scope,id(),action,entityId,detail,session.role,now()); }
export function eventStatement(env: Env, session: Session, orderId: string, action: string, label: string, note = '', actor: string = session.role) { return q(env,'INSERT INTO order_events(scope,id,order_id,action,label,note,actor,created_at) VALUES(?,?,?,?,?,?,?,?)',session.scope,id(),orderId,action,label,note,actor,now()); }
export function versionGuard(env: Env, operationId: string): SqlStatement[] { return [q(env,'INSERT INTO mutation_guards(id,ok) VALUES(?,changes())',operationId),q(env,'DELETE FROM mutation_guards WHERE id=?',operationId)]; }
export async function orderFor(env: Env, session: Session, orderId: string, internal = false): Promise<Order> {
  const row = await q(env,`SELECT * FROM orders WHERE scope=? AND id=? ${internal ? '' : 'AND session_id=?'}`,session.scope,orderId,...(internal ? [] : [session.tokenHash])).first<Row>();
  if (!row) fail(404,'ORDER_NOT_FOUND','Pesanan tidak ditemukan.'); return orderFrom(env,row);
}
export async function orderFrom(env: Env, row: Row): Promise<Order> {
  const [items,events] = await Promise.all([all(env,'SELECT * FROM order_items WHERE scope=? AND order_id=?',row.scope,row.id),all(env,'SELECT * FROM order_events WHERE scope=? AND order_id=? ORDER BY created_at,rowid',row.scope,row.id)]);
  return mapOrder(row,items,events);
}
export async function ordersFrom(env:Env,rows:Row[]):Promise<Order[]> {
  if(!rows.length)return [];
  const scope=rows[0].scope;if(rows.some(r=>r.scope!==scope))throw new Error('Order list must have one scope');
  const ids=JSON.stringify(rows.map(r=>r.id));
  const [items,events]=await Promise.all([all(env,'SELECT * FROM order_items WHERE scope=? AND order_id IN (SELECT value FROM json_each(?))',scope,ids),all(env,'SELECT * FROM order_events WHERE scope=? AND order_id IN (SELECT value FROM json_each(?)) ORDER BY created_at,rowid',scope,ids)]);
  return rows.map(row=>mapOrder(row,items.filter(i=>i.order_id===row.id),events.filter(e=>e.order_id===row.id)));
}
function mapOrder(row:Row,items:Row[],events:Row[]):Order {
  return { id:row.id,number:row.number,status:row.status,paymentStatus:row.payment_status,paymentMethod:row.payment_method,returnStatus:row.return_status,customer:JSON.parse(row.customer_json),note:row.note,paymentReference:row.payment_reference,carrier:row.carrier,trackingNumber:row.tracking_number,returnReason:row.return_reason,createdAt:row.created_at,updatedAt:row.updated_at,expiresAt:row.expires_at,paymentUrl:row.payment_url,subtotal:row.subtotal,discount:row.discount-(row.points_discount||0),shippingFee:row.shipping_base_fee??row.shipping_fee,taxAmount:row.tax_amount||0,taxIncluded:Boolean(row.tax_included),serviceFee:row.service_fee||0,pointsRedeemed:row.points_redeemed||0,pointsDiscount:row.points_discount||0,total:row.total,couponCode:row.coupon_code,shippingMethod:JSON.parse(row.shipping_json),items:items.map(i=>({variantId:i.variant_id,productId:i.product_id,name:i.name,variantName:i.variant_name,image:i.image,unitPrice:i.unit_price,quantity:i.quantity,subtotal:i.subtotal})),timeline:events.map(e=>({id:e.id,action:e.action,label:e.label,note:e.note,actor:e.actor,createdAt:e.created_at})) };
}
export async function wishlistFor(env: Env, session: Session) { return (await all<{product_id:string}>(env,'SELECT product_id FROM wishlist WHERE scope=? AND session_id=?',session.scope,session.tokenHash)).map(r=>r.product_id); }
export async function reviewsFor(env: Env, scope: string): Promise<Review[]> { return (await all(env,'SELECT * FROM reviews WHERE scope=? ORDER BY created_at DESC LIMIT 200',scope)).map(r=>({id:r.id,productId:r.product_id,orderId:r.order_id,author:r.author,rating:r.rating,comment:r.comment,createdAt:r.created_at})); }
export async function bootstrap(env: Env, session: Session): Promise<Bootstrap> {
  const [config,products,wishlist,reviews] = await Promise.all([configFor(env,session),productsFor(env,session.scope),wishlistFor(env,session),reviewsFor(env,session.scope)]);
  const cap = capabilities(config);
  const manualReady = session.demo || (/^\d{5,30}$/.test(config.bank.accountNumber) && !/^0+$/.test(config.bank.accountNumber) && Boolean(config.bank.accountHolder.trim()));
  const actualCategories=[...categories];for(const product of products)if(!actualCategories.some(c=>c.id===product.category))actualCategories.push({id:product.category,name:product.category,description:''});
  const member = cap.customerAccounts && session.memberId ? await q(env,'SELECT id,email,name,points_balance,completed_spend FROM members WHERE scope=? AND id=?',session.scope,session.memberId).first<Row>() : null;
  const silver=config.loyalty?.silverSpendIdr??1_000_000;const gold=config.loyalty?.goldSpendIdr??5_000_000;
  const tier = cap.membershipTiers && member ? (member.completed_spend>=gold?'Gold':member.completed_spend>=silver?'Silver':'Member') : 'Member';
  const loyalty=member?{id:member.id,email:member.email,name:member.name,points:member.points_balance,tier: tier as 'Gold'|'Silver'|'Member',completedSpend:member.completed_spend,verificationRequired:false}:null;
  return { config,capabilities:cap,loyalty,products,categories:actualCategories,shippingMethods:config.shippingMethods||shippingMethods,paymentMethods:cap.checkout ? [
    {id:'manual',name:'Transfer bank',description:session.demo ? 'Simulasi transfer. Tidak ada uang yang dikirim.' : `${config.bank.name} · ${config.bank.accountHolder}`,available:manualReady,demo:session.demo},
    {id:'cod',name:'Bayar saat diterima',description:'Toko mencatat pembayaran setelah uang diterima.',available:true,demo:session.demo},
    ...(cap.gateway ? [{id:'midtrans' as const,name:session.demo ? 'Gateway demo' : 'Pembayaran online',description:session.demo ? 'Coba alur pembayaran berhasil atau gagal.' : 'Bayar di halaman Midtrans yang aman.',available:session.demo || Boolean(env.MIDTRANS_SERVER_KEY),demo:session.demo}] : []),
  ] : [],demo:session.demo,session:{role:session.role,authenticated:session.role!=='customer'},wishlist:cap.wishlist ? wishlist : [],reviews:cap.reviews ? reviews : [] };
}
