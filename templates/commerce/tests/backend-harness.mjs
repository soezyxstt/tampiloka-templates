import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.ts';

// Executes the actual D1 SQL and triggers, rather than mocking business results.
export class SQLiteD1 {
  constructor(path = ':memory:') { this.db = new DatabaseSync(path); this.db.exec(readFileSync(new URL('../migrations/0001_commerce.sql', import.meta.url), 'utf8')); this.db.exec(readFileSync(new URL('../migrations/0002_optional_modules.sql', import.meta.url), 'utf8')); this.db.exec(readFileSync(new URL('../migrations/0003_loyalty_eligibility.sql', import.meta.url), 'utf8')); this.db.exec(readFileSync(new URL('../migrations/0004_uploads.sql', import.meta.url), 'utf8')); }
  prepare(sql) {
    const make = (args = []) => ({
      bind: (...values) => make(values),
      first: async (column) => { const row = this.db.prepare(sql).get(...args); return column ? row?.[column] ?? null : row ?? null; },
      all: async () => ({ success: true, results: this.db.prepare(sql).all(...args), meta: {} }),
      run: async () => { const result = this.db.prepare(sql).run(...args); return {success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) }}; },
      _execute: () => { const statement = this.db.prepare(sql); if (/^(\s*SELECT|\s*WITH)/i.test(sql)) return {success:true, results: statement.all(...args), meta:{}}; const result=statement.run(...args); return {success:true, results:[],meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}; },
      _sql: sql,
    });
    return make();
  }
  async batch(statements) {
    if(this.beforeBatch) this.beforeBatch(statements);
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = statements.map(statement=>statement._execute());this.db.exec('COMMIT');return result; }
    catch(error) { this.db.exec('ROLLBACK');throw error; }
  }
  async exec(sql) { this.db.exec(sql); return {count:1,duration:0}; }
  close() { this.db.close(); }
}
export function environment(overrides = {}) { return {DB:new SQLiteD1(),DEMO_MODE:'true',...overrides}; }
export function client(env, ip = '127.0.0.1') {
  let cookie = '';
  return {
    get cookie() { return cookie; },
    set cookie(value) { cookie = value; },
    async request(path, method = 'GET', value, extras = {}) {
      const headers={'Origin':'https://commerce.test','CF-Connecting-IP':ip,...(cookie?{Cookie:cookie}:{}),...(value!==undefined?{'Content-Type':'application/json'}:{}),...extras};
      const response=await worker.fetch(new Request(`https://commerce.test${path}`,{method,headers,...(value!==undefined?{body:JSON.stringify(value)}:{})}),env);
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
