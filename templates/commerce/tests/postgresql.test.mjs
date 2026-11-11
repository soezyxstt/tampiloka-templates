import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresDatabase, resolveDatabase, runMigrations } from '@tampiloka/storage';
import { splitPostgresMigration } from '../scripts/postgresql-migrations.mjs';
import { client, orderInput } from './backend-harness.mjs';

test('PostgreSQL migrations and Worker checkout, payment, inventory and stale changes', async () => {
  const pg = new PGlite();
  try {
    const pool = { async connect() { return { async query(q) { const r = await (typeof q === 'string' ? pg.query(q) : pg.query(q.text,q.values)); return {...r, rowCount:r.affectedRows}; }, release() {} }; } };
    const db = createPostgresDatabase(pool);
    const migrations=['0001_schema.sql','0002_triggers.sql'].map(file => ({id:file,statements:splitPostgresMigration(readFileSync(new URL(`../migrations-postgresql/${file}`, import.meta.url),'utf8'),file)}));
    await runMigrations(db,migrations);
    await runMigrations(db,migrations);
    assert.equal(resolveDatabase({DB:db}),db);
    assert.throws(() => resolveDatabase({DATABASE_PROVIDER:'postgresql',DB:db}), /DATABASE_URL/);
    assert.notEqual(resolveDatabase({DATABASE_PROVIDER:'postgresql',DATABASE_URL:'postgresql://localhost/test',DB:db}),db);
    await assert.rejects(db.batch([db.prepare('INSERT INTO mutation_guards(id,ok) VALUES(?,?)').bind('rollback',1),db.prepare('INSERT INTO mutation_guards(id,ok) VALUES(?,?)').bind('rollback',1)]), e=>e.code==='23505');
    assert.equal(await db.prepare('SELECT id FROM mutation_guards WHERE id=?').bind('rollback').first(),null);
    const c = client({ DB:db, DEMO_MODE:'true' });
    const boot=await c.get('/api/bootstrap'); assert.equal(boot.status,200,JSON.stringify(boot.data)); assert.equal(boot.data.products.length,8);
    const input=orderInput({paymentMethod:'midtrans'}); const quote=await c.post('/api/quote',input); assert.equal(quote.status,200,JSON.stringify(quote.data));
    const order=await c.post('/api/orders',{...input,expectedTotal:quote.data.total}); assert.equal(order.status,200,JSON.stringify(order.data));
    const repeat=await c.post('/api/orders',{...input,expectedTotal:quote.data.total}); assert.equal(repeat.data.id,order.data.id);
    assert.equal((await db.prepare('SELECT stock FROM variants WHERE id=?').bind('linen-shirt-m').first()).stock,17);
    const paid=await c.post('/api/demo/payment',{orderId:order.data.id,status:'paid'}); assert.equal(paid.status,200,JSON.stringify(paid.data)); assert.equal(paid.data.paymentStatus,'paid');
    let injectStale=true; const batch=db.batch.bind(db); db.batch=async statements=>{ if(injectStale && statements.some(s=>s.sql.includes('version=version+1 WHERE scope='))) { injectStale=false; await pg.query('UPDATE orders SET version=version+1 WHERE id=$1',[order.data.id]); } return batch(statements); };
    const staleMutation=await c.post(`/api/staff/orders/${order.data.id}/actions`,{action:'process'}); assert.equal(staleMutation.status,409,JSON.stringify(staleMutation.data));
    assert.equal((await c.get(`/api/orders/${order.data.id}`)).data.status,'confirmed');
    const stale=await c.post('/api/demo/payment',{orderId:order.data.id,status:'failed'}); assert.equal(stale.status,409,JSON.stringify(stale.data));
    const adjust=await c.post('/api/staff/inventory',{variantId:'linen-shirt-m',delta:-999,reason:'test'}); assert.equal(adjust.status,409,JSON.stringify(adjust.data));
    const restock=await c.post('/api/staff/inventory',{variantId:'linen-shirt-m',delta:2,reason:'Restock'}); assert.equal(restock.status,200,JSON.stringify(restock.data));
    assert.equal((await db.prepare('SELECT stock FROM variants WHERE id=?').bind('linen-shirt-m').first()).stock,19);
    const snapshot=await c.get('/api/staff/snapshot'); assert.equal(snapshot.status,200,JSON.stringify(snapshot.data));
    assert.equal(snapshot.data.metrics.orders,1);
    // SQLite INTEGER is 64-bit; accumulated lifetime spend must exceed int32.
    const savedOrder=await db.prepare('SELECT scope FROM orders WHERE id=?').bind(order.data.id).first();
    await db.prepare('INSERT INTO members(scope,id,email,name,completed_spend,created_at) VALUES(?,?,?,?,?,?)').bind(savedOrder.scope,'member-big','big@example.test','Member',2_147_483_640,'2026-01-01').run();
    await db.prepare("UPDATE orders SET member_id=?, loyalty_eligible=1, status='completed' WHERE id=?").bind('member-big',order.data.id).run();
    const member=await db.prepare('SELECT completed_spend FROM members WHERE scope=? AND id=?').bind(savedOrder.scope,'member-big').first();
    assert.ok(Number(member.completed_spend)>2_147_483_647);
  } finally { await pg.close(); }
});
