import type { Coupon, Product, StaffSnapshot, StoreConfig } from '../src/shared/contracts.ts';
import type { D1Statement, Env, Row, Session } from './types.ts';
import { all, auditStatement, configFor, couponFrom, ordersFrom, productsFor, q, reviewsFor, wishlistFor } from './db.ts';
import { capabilities, fail, id, integer, now, requireFeature, staff, text } from './security.ts';

export async function snapshot(env:Env,session:Session):Promise<StaffSnapshot> {
  const role=staff(session); const config=await configFor(env,session); const cap=capabilities(config.level);
  const [products,rows,coupons,inventory,audit,totals,customerRows]=await Promise.all([
    productsFor(env,session.scope,true),cap.orders?all(env,'SELECT * FROM orders WHERE scope=? ORDER BY created_at DESC LIMIT 250',session.scope):Promise.resolve([]),
    cap.coupons?all(env,'SELECT * FROM coupons WHERE scope=? ORDER BY code',session.scope):Promise.resolve([]),
    cap.inventory?all(env,'SELECT m.*,v.name AS variant_name,p.name AS product_name FROM inventory_movements m JOIN variants v ON v.scope=m.scope AND v.id=m.variant_id JOIN products p ON p.scope=v.scope AND p.id=v.product_id WHERE m.scope=? ORDER BY m.created_at DESC,m.rowid DESC LIMIT 250',session.scope):Promise.resolve([]),
    all(env,'SELECT * FROM audit_events WHERE scope=? ORDER BY created_at DESC,rowid DESC LIMIT 250',session.scope),
    cap.orders?q(env,"SELECT COUNT(*) AS orders,COALESCE(SUM(CASE WHEN status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END),0) AS pending,COALESCE(SUM(CASE WHEN payment_status='paid' THEN total ELSE 0 END),0) AS revenue,COALESCE(AVG(CASE WHEN payment_status='paid' THEN total END),0) AS average,COALESCE(SUM(CASE WHEN payment_status='refunded' THEN total ELSE 0 END),0) AS refunded,COUNT(DISTINCT json_extract(customer_json,'$.phone')) AS customers FROM orders WHERE scope=?",session.scope).first<Row>():Promise.resolve(null),
    cap.orders?all(env,"SELECT customer_json,COUNT(*) AS order_count,COALESCE(SUM(CASE WHEN payment_status='paid' THEN total ELSE 0 END),0) AS total_spent,MAX(created_at) AS last_order_at FROM orders WHERE scope=? GROUP BY json_extract(customer_json,'$.phone') ORDER BY last_order_at DESC",session.scope):Promise.resolve([]),
  ]);
  const orders=await ordersFrom(env,rows);
  const customers=customerRows.map(r=>({...JSON.parse(r.customer_json),orderCount:r.order_count,totalSpent:r.total_spent,lastOrderAt:r.last_order_at}));
  return {orders,pagination:{limit:250,total:totals?.orders||0,hasMore:(totals?.orders||0)>orders.length},products,customers,coupons:coupons.map(couponFrom),inventory:inventory.map(m=>({id:m.id,variantId:m.variant_id,productName:m.product_name,variantName:m.variant_name,delta:m.delta,reason:m.reason,orderId:m.order_id,createdAt:m.created_at})),audit:audit.map(a=>({id:a.id,action:a.action,entityId:a.entity_id,detail:a.detail,actor:a.actor,createdAt:a.created_at})),metrics:{revenue:totals?.revenue||0,orders:totals?.orders||0,pendingOrders:totals?.pending||0,lowStock:products.filter(p=>p.active).flatMap(p=>p.variants).filter(v=>v.stock<5).length,customers:totals?.customers||0,averageOrderValue:Math.round(totals?.average||0),refunded:totals?.refunded||0},role,config,capabilities:cap};
}
export async function staffOrders(env:Env,session:Session,limit=50,offset=0,search='',status='all') {
  staff(session);requireFeature(capabilities((await configFor(env,session)).level),'orders');integer(limit,'Jumlah baris',1,250);integer(offset,'Posisi baris',0,10_000_000);
  const query=text(search,'Pencarian',100).toLowerCase();const filter=text(status,'Status',40)||'all';
  if(!['all','awaiting_payment','confirmed','processing','shipped','completed','cancelled','verification','returns'].includes(filter))fail(422,'INVALID_STATUS_FILTER','Filter status pesanan tidak valid.');
  const conditions=['scope=?'];const params:unknown[]=[session.scope];
  if(query){conditions.push("(instr(lower(number),?)>0 OR instr(lower(json_extract(customer_json,'$.name')),?)>0 OR instr(lower(json_extract(customer_json,'$.phone')),?)>0)");params.push(query,query,query);}
  if(filter==='verification')conditions.push("payment_status='pending_verification'");
  else if(filter==='returns')conditions.push("return_status NOT IN ('none','rejected','refunded')");
  else if(filter!=='all'){conditions.push('status=?');params.push(filter);}
  const where=conditions.join(' AND ');
  const [page,count]=await env.DB.batch<Row>([
    q(env,`SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,...params,limit,offset),
    q(env,`SELECT COUNT(*) AS total FROM orders WHERE ${where}`,...params),
  ]);
  const total=count.results[0].total;
  return {orders:await ordersFrom(env,page.results),total,hasMore:offset+page.results.length<total,limit,offset};
}
function imageUrls(value:unknown):string[] {
  if(!Array.isArray(value)||value.length>8) fail(422,'INVALID_IMAGES','Gunakan maksimal delapan alamat gambar.');
  return value.map(item=>{const url=text(item,'Alamat gambar',2000,true);if(!/^https:\/\//.test(url)&&!/^\/(?!\/)/.test(url)) fail(422,'INVALID_IMAGE','Alamat gambar harus memakai HTTPS atau berkas lokal.');return url;});
}
export async function saveProduct(env:Env,session:Session,productId:string|null,input:Row) {
  staff(session,true,true);
  const allProducts=await productsFor(env,session.scope,true); const existing=allProducts.find(p=>p.id===productId);
  if(productId&&!existing) fail(404,'PRODUCT_NOT_FOUND','Produk tidak ditemukan.');
  if(!existing&&allProducts.length>=200) fail(422,'PRODUCT_LIMIT','Batas contoh 200 produk tercapai.');
  const candidate={...(existing||{}),...input}; const pid=productId||text(input.id||`product-${id().slice(0,12)}`,'ID produk',80,true);
  if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(pid)) fail(422,'INVALID_PRODUCT_ID','ID produk hanya boleh berisi huruf kecil, angka, garis bawah, atau tanda hubung.');
  const slug=text(candidate.slug||pid,'Slug',100,true); if(!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail(422,'INVALID_SLUG','Slug produk tidak valid.');
  const price=integer(candidate.price,'Harga',0,100_000_000); const name=text(candidate.name,'Nama produk',150,true);
  const description=text(candidate.description,'Deskripsi',3000); const category=text(candidate.category||'lainnya','Kategori',100,true);const material=text(candidate.material,'Bahan',200);
  const images=imageUrls(candidate.images||[]);const featured=Boolean(candidate.featured);const active=candidate.active!==false;
  const compareAt=candidate.compareAtPrice==null?null:integer(candidate.compareAtPrice,'Harga pembanding',price,100_000_000);
  const variants=candidate.variants||[{id:`${pid}-default`,name:'Standar',sku:pid.toUpperCase(),price,stock:0,options:{}}];
  if(!Array.isArray(variants)||variants.length<1||variants.length>30) fail(422,'INVALID_VARIANTS','Gunakan 1 hingga 30 varian.');
  const ids=new Set<string>(); const stmts:D1Statement[]=[];
  const normalized=variants.map((v:Row)=>{
    const vid=text(v.id||`${pid}-${id().slice(0,6)}`,'ID varian',100,true);if(!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(vid)||ids.has(vid)) fail(422,'INVALID_VARIANT','ID varian tidak valid atau berulang.');ids.add(vid);
    const old=existing?.variants.find(x=>x.id===vid); const stock=integer(v.stock??old?.stock??0,'Stok',0,1_000_000);
    if(old&&stock!==old.stock) fail(422,'USE_INVENTORY','Ubah stok melalui penyesuaian stok agar pergerakannya tercatat.');
    const options:Record<string,string>={}; if(v.options&&typeof v.options==='object'&&!Array.isArray(v.options)) for(const [key,value] of Object.entries(v.options).slice(0,5)) options[text(key,'Nama opsi',50,true)]=text(value,'Nilai opsi',100,true);
    return {id:vid,old,name:text(v.name,'Nama varian',100,true),sku:text(v.sku||vid.toUpperCase(),'SKU',100,true),price:integer(v.price??price,'Harga varian',0,100_000_000),stock,options};
  });
  // Existing order lines retain immutable variant IDs. Removing variants would break history.
  if(existing?.variants.some(v=>!ids.has(v.id))) fail(422,'VARIANT_HISTORY','Varian lama harus tetap ada. Nonaktifkan produk jika sudah tidak dijual.');
  const displayedPrice=Math.min(...normalized.map(v=>v.price));
  if(existing) stmts.push(q(env,'UPDATE products SET slug=?,name=?,description=?,category=?,price=?,compare_at_price=?,images_json=?,material=?,featured=?,active=? WHERE scope=? AND id=?',slug,name,description,category,displayedPrice,compareAt,JSON.stringify(images),material,Number(featured),Number(active),session.scope,pid));
  else stmts.push(q(env,'INSERT INTO products(scope,id,slug,name,description,category,price,compare_at_price,images_json,material,featured,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',session.scope,pid,slug,name,description,category,displayedPrice,compareAt,JSON.stringify(images),material,Number(featured),Number(active),now()));
  for(const v of normalized) {
    if(v.old) stmts.push(q(env,'UPDATE variants SET name=?,sku=?,price=?,options_json=? WHERE scope=? AND id=? AND product_id=?',v.name,v.sku,v.price,JSON.stringify(v.options),session.scope,v.id,pid));
    else {
      stmts.push(q(env,'INSERT INTO variants(scope,id,product_id,name,sku,price,stock,options_json) VALUES(?,?,?,?,?,?,?,?)',session.scope,v.id,pid,v.name,v.sku,v.price,v.stock,JSON.stringify(v.options)));
      if(v.stock) stmts.push(q(env,'INSERT INTO inventory_movements(scope,id,variant_id,delta,reason,created_at) VALUES(?,?,?,?,?,?)',session.scope,id(),v.id,v.stock,'Stok awal',now()));
    }
  }
  stmts.push(auditStatement(env,session,existing?'product.updated':'product.created',pid,name));await env.DB.batch(stmts);
  return {product:(await productsFor(env,session.scope,true)).find(p=>p.id===pid)!};
}
export async function adjustInventory(env:Env,session:Session,input:Row) {
  staff(session,true);requireFeature(capabilities((await configFor(env,session)).level),'inventory');
  const variantId=text(input.variantId,'Varian',100,true);const delta=integer(input.delta,'Perubahan stok',-1_000_000,1_000_000);if(!delta)fail(422,'INVALID_DELTA','Perubahan stok tidak boleh nol.');const reason=text(input.reason,'Alasan',300,true);
  const row=await q(env,'SELECT id FROM variants WHERE scope=? AND id=?',session.scope,variantId).first();if(!row)fail(404,'VARIANT_NOT_FOUND','Varian tidak ditemukan.');
  await env.DB.batch([q(env,'UPDATE variants SET stock=stock+? WHERE scope=? AND id=?',delta,session.scope,variantId),q(env,'INSERT INTO inventory_movements(scope,id,variant_id,delta,reason,created_at) VALUES(?,?,?,?,?,?)',session.scope,id(),variantId,delta,reason,now()),auditStatement(env,session,'inventory.adjusted',variantId,`${delta>0?'+':''}${delta}: ${reason}`)]);
  const products=await productsFor(env,session.scope,true);return {variant:products.flatMap(p=>p.variants).find(v=>v.id===variantId)!};
}
export async function saveCoupon(env:Env,session:Session,input:Row) {
  staff(session,true,true);requireFeature(capabilities((await configFor(env,session)).level),'coupons');
  const code=text(input.code,'Kode promo',30,true).toUpperCase();if(!/^[A-Z0-9_-]{3,30}$/.test(code)) fail(422,'INVALID_COUPON','Kode promo memakai 3 hingga 30 huruf atau angka.');
  if(!['fixed','percentage'].includes(input.kind)) fail(422,'INVALID_COUPON','Jenis promo tidak valid.');
  const value=integer(input.value,'Nilai promo',1,input.kind==='percentage'?100:100_000_000);const min=integer(input.minSpend??0,'Minimal belanja',0,1_000_000_000);const max=integer(input.maxDiscount??0,'Batas potongan',0,1_000_000_000);const limit=integer(input.useLimit??0,'Batas penggunaan',0,1_000_000);
  const expires=input.expiresAt?text(input.expiresAt,'Tanggal berakhir',40,true):null;
  if(expires&&(!Number.isFinite(Date.parse(expires))||Date.parse(expires)<=Date.now()))fail(422,'INVALID_EXPIRY','Tanggal berakhir harus berada di masa depan.');
  const old=await q(env,'SELECT used_count FROM coupons WHERE scope=? AND code=?',session.scope,code).first<Row>();if(limit&&old&&limit<old.used_count)fail(422,'INVALID_LIMIT','Batas penggunaan lebih kecil dari jumlah yang sudah dipakai.');
  await env.DB.batch([q(env,'INSERT INTO coupons(scope,code,kind,value,min_spend,max_discount,active,use_limit,used_count,expires_at) VALUES(?,?,?,?,?,?,?,?,0,?) ON CONFLICT(scope,code) DO UPDATE SET kind=excluded.kind,value=excluded.value,min_spend=excluded.min_spend,max_discount=excluded.max_discount,active=excluded.active,use_limit=excluded.use_limit,expires_at=excluded.expires_at',session.scope,code,input.kind,value,min,max,Number(input.active!==false),limit,expires?new Date(expires).toISOString():null),auditStatement(env,session,'coupon.saved',code,code)]);
  const coupon=await q(env,'SELECT * FROM coupons WHERE scope=? AND code=?',session.scope,code).first<Row>();return {coupon:couponFrom(coupon!)};
}
export async function saveSettings(env:Env,session:Session,input:Row) {
  staff(session,true,true);const current=await configFor(env,session);const updated:StoreConfig={...current,brand:{...current.brand},bank:{...current.bank}};
  for(const key of ['name','tagline','description','whatsapp','email','address'] as const) if(input.brand?.[key]!==undefined) updated.brand[key]=text(input.brand[key],key,key==='description'?1000:300,key==='name');
  if(updated.brand.whatsapp&&!/^\+?\d{8,16}$/.test(updated.brand.whatsapp))fail(422,'INVALID_PHONE','Nomor WhatsApp harus berupa angka dengan kode negara.');
  if(updated.brand.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updated.brand.email))fail(422,'INVALID_EMAIL','Email toko tidak valid.');
  for(const key of ['name','accountNumber','accountHolder'] as const) if(input.bank?.[key]!==undefined) updated.bank[key]=text(input.bank[key],key,150);
  if(updated.bank.accountNumber&&!/^\d{5,30}$/.test(updated.bank.accountNumber))fail(422,'INVALID_ACCOUNT','Nomor rekening hanya boleh berisi angka.');
  if(input.shippingNote!==undefined)updated.shippingNote=text(input.shippingNote,'Catatan pengiriman',1000);
  if(input.returnDays!==undefined)updated.returnDays=integer(input.returnDays,'Batas retur',1,30);
  if(input.shippingMethods!==undefined){
    if(!Array.isArray(input.shippingMethods)||input.shippingMethods.length<1||input.shippingMethods.length>10)fail(422,'INVALID_SHIPPING','Sediakan 1 hingga 10 metode pengiriman.');const ids=new Set<string>();
    updated.shippingMethods=input.shippingMethods.map((method:Row)=>{const methodId=text(method.id,'ID pengiriman',40,true);if(!/^[a-z0-9_-]+$/.test(methodId)||ids.has(methodId))fail(422,'INVALID_SHIPPING','ID metode pengiriman tidak valid atau berulang.');ids.add(methodId);if(typeof method.requiresAddress!=='boolean')fail(422,'INVALID_SHIPPING','Syarat alamat pengiriman harus berupa benar atau salah.');return {id:methodId,name:text(method.name,'Nama layanan',100,true),description:text(method.description,'Keterangan layanan',250),fee:integer(method.fee,'Ongkir',0,1_000_000),estimatedDays:text(method.estimatedDays,'Waktu pengiriman',100),requiresAddress:method.requiresAddress};});
  }
  await env.DB.batch([q(env,'UPDATE scopes SET config_json=? WHERE id=?',JSON.stringify(updated),session.scope),auditStatement(env,session,'settings.updated',session.scope,'Pengaturan toko diperbarui')]);return {config:updated};
}
export async function toggleWishlist(env:Env,session:Session,input:Row) {
  requireFeature(capabilities((await configFor(env,session)).level),'wishlist');const productId=text(input.productId,'Produk',100,true);
  if(!await q(env,'SELECT id FROM products WHERE scope=? AND id=? AND active=1',session.scope,productId).first())fail(404,'PRODUCT_NOT_FOUND','Produk tidak ditemukan.');
  const exists=await q(env,'SELECT product_id FROM wishlist WHERE scope=? AND session_id=? AND product_id=?',session.scope,session.tokenHash,productId).first();
  if(exists)await q(env,'DELETE FROM wishlist WHERE scope=? AND session_id=? AND product_id=?',session.scope,session.tokenHash,productId).run();
  else await q(env,'INSERT OR IGNORE INTO wishlist(scope,session_id,product_id) VALUES(?,?,?)',session.scope,session.tokenHash,productId).run();
  return {wishlist:await wishlistFor(env,session)};
}
export async function submitReview(env:Env,session:Session,input:Row) {
  requireFeature(capabilities((await configFor(env,session)).level),'reviews');const productId=text(input.productId,'Produk',100,true);const orderId=text(input.orderId,'Pesanan',100,true);const rating=integer(input.rating,'Penilaian',1,5);const comment=text(input.comment,'Ulasan',1000,true);
  const order=await q(env,"SELECT customer_json FROM orders WHERE scope=? AND id=? AND session_id=? AND status='completed' AND payment_status='paid'",session.scope,orderId,session.tokenHash).first<Row>();
  if(!order||!await q(env,'SELECT product_id FROM order_items WHERE scope=? AND order_id=? AND product_id=?',session.scope,orderId,productId).first())fail(403,'REVIEW_NOT_ELIGIBLE','Ulasan tersedia setelah pesanan barang ini selesai dan dibayar.');
  const reviewId=id();const author=JSON.parse(order.customer_json).name.split(' ')[0];
  try{await q(env,'INSERT INTO reviews(scope,id,session_id,product_id,order_id,author,rating,comment,created_at) VALUES(?,?,?,?,?,?,?,?,?)',session.scope,reviewId,session.tokenHash,productId,orderId,author,rating,comment,now()).run();}catch(error){if(/UNIQUE/.test(String(error)))fail(409,'REVIEW_EXISTS','Ulasan untuk barang dalam pesanan ini sudah ada.');throw error;}
  return {review:(await reviewsFor(env,session.scope)).find(r=>r.id===reviewId)!};
}
export async function exportOrders(env:Env,session:Session) {
  staff(session);requireFeature(capabilities((await configFor(env,session)).level),'reports');
  const rows=await all(env,'SELECT * FROM orders WHERE scope=? ORDER BY created_at DESC LIMIT 10000',session.scope);
  const cell=(value:unknown)=>{let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s=`'${s}`;return `"${s.replaceAll('"','""')}"`;};
  const data=[['Nomor','Tanggal','Nama','Telepon','Status','Pembayaran','Metode','Subtotal','Diskon','Ongkir','Total'],...rows.map(r=>{const c=JSON.parse(r.customer_json);return[r.number,r.created_at,c.name,c.phone,r.status,r.payment_status,r.payment_method,r.subtotal,r.discount,r.shipping_fee,r.total];})];
  return '\uFEFF'+data.map(row=>row.map(cell).join(',')).join('\r\n');
}
