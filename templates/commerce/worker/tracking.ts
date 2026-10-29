import type { Env, Row, Session } from './types.ts';
import { auditStatement, orderFrom, q } from './db.ts';
import { rawOrder } from './orders.ts';
import { digest, fail, id, isDemo, rateLimit, text } from './security.ts';

export async function rotateTrackingCode(env:Env,session:Session,orderId:string) {
  const order=await rawOrder(env,session,orderId);const code=id();const hash=await digest(code);
  await env.DB.batch([q(env,'UPDATE orders SET tracking_code_hash=? WHERE scope=? AND id=?',hash,session.scope,orderId),auditStatement(env,session,'order.tracking-code-rotated',orderId,'Kode akses lama tidak lagi berlaku')]);
  return {number:order.number,code};
}
export async function trackOrder(request:Request,env:Env,input:Row) {
  const key=await digest(request.headers.get('CF-Connecting-IP')||'local');await rateLimit(env,`tracking:${key}`,10,900);
  const number=text(input.number,'Nomor pesanan',50,true).toUpperCase();const code=text(input.code,'Kode akses',100,true).replace(/[-\s]/g,'').toLowerCase();
  if(!/^[a-f0-9]{32}$/.test(code))fail(404,'TRACKING_NOT_FOUND','Nomor pesanan atau kode akses tidak sesuai.');
  const hash=await digest(code);
  const order=await q(env,'SELECT o.* FROM orders o JOIN scopes s ON s.id=o.scope WHERE o.number=? AND o.tracking_code_hash=? AND s.demo=?',number,hash,Number(isDemo(env))).first<Row>();
  if(!order)fail(404,'TRACKING_NOT_FOUND','Nomor pesanan atau kode akses tidak sesuai.');
  // The code grants read access to one order only. It never changes session ownership.
  return orderFrom(env,order);
}
