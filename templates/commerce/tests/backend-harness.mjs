import { LocalDatabase } from '../scripts/local-database.mjs';
import { handleRequest } from '../worker/index.ts';

class TestDatabase extends LocalDatabase {
  async batch(statements) {
    this.beforeBatch?.(statements);
    return super.batch(statements);
  }
}
export function environment(overrides = {}) { return {DB:new TestDatabase(':memory:'),DEMO_MODE:'true',...overrides}; }
export function client(env, ip = '127.0.0.1') {
  let cookie = '';
  return {
    get cookie() { return cookie; },
    set cookie(value) { cookie = value; },
    async request(path, method = 'GET', value, extras = {}) {
      const headers={'Origin':'https://commerce.test','CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{}),...(value!==undefined?{'Content-Type':'application/json'}:{}),...extras};
      const response=await handleRequest(new Request(`https://commerce.test${path}`,{method,headers,...(value!==undefined?{body:JSON.stringify(value)}:{})}),env);
      const nextCookie=response.headers.get('Set-Cookie');if(nextCookie)cookie=nextCookie.split(';')[0];
      const data=response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text();
      return {status:response.status,data,headers:response.headers};
    },
    get(path,extras){return this.request(path,'GET',undefined,extras);},
    post(path,value,extras){return this.request(path,'POST',value,extras);},
    put(path,value,extras){return this.request(path,'PUT',value,extras);},
  };
}
export const orderInput = (overrides={})=>({items:[{variantId:'linen-shirt-m',quantity:1}],shippingMethodId:'regular',customer:{name:'Pembeli Demo',phone:'081234000001',address:'Jalan Contoh 12',city:'Bandung',postalCode:'40111'},paymentMethod:'manual',idempotencyKey:crypto.randomUUID(),...overrides});
export async function create(c,overrides={}) { const input=orderInput(overrides);const quote=await c.post('/api/quote',input); if(quote.status!==200)throw new Error(JSON.stringify(quote));return c.post('/api/orders',{...input,expectedTotal:quote.data.total}); }
export function scopeFor(env,c) { const raw=c.cookie.split('=')[1];return crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)).then(hash=>{const key=Buffer.from(hash).toString('hex');return env.DB.db.prepare('SELECT scope FROM sessions WHERE token_hash=?').get(key)?.scope;}); }
