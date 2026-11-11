// Test-only loopback host. Never imported by the application or deployed.
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer as viteServer } from 'vite';
import react from '@vitejs/plugin-react';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from '../../src/plugins/attendance/schema.ts';
import { createAttendanceRuntime } from '../../src/plugins/attendance/runtime.ts';
import { createAttendanceRoute } from '../../src/plugins/attendance/route-handler.ts';
import { createLocalEvidenceStore } from '../../src/plugins/attendance/storage/index.mjs';
const root = process.cwd();
const directory = await mkdtemp('/data/workspace/attendance-test-');
const client = new PGlite(); const database = drizzle(client, { schema });
await (await pushSchema(schema, drizzle(client))).apply();
const secret = 'local-test-only-key';
const sign = role => createHmac('sha256', secret).update(role).digest('hex');
const origin = 'http://127.0.0.1:4189';
let locationMaxAge = 60000;
let requireBiometric = false;
const runtime = createAttendanceRuntime({ database, databaseKind: 'pglite', store: createLocalEvidenceStore({ directory, retentionSeconds: 3600 }), allowedOrigins: [origin], member: async (_t, _o, staff) => staff === 'staff', resolveOutlet: async (tenant, outlet) => tenant === 'cafe' && ['central', 'disabled'].includes(outlet) ? [{ tenantId: 'tenant', outletId: outlet === 'central' ? 'canonical-outlet' : 'disabled-outlet' }] : [], principal: { authenticate: async request => { const [role, signature] = (request.headers.get('cookie')?.match(/(?:^|;\s*)fixture=([^;]+)/)?.[1] || '').split('.'); if (!['staff', 'supervisor', 'lost', 'disabled', 'delayed', 'other'].includes(role) || !signature || signature.length !== 64 || !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(role)))) return null; return { tenantId: 'tenant', staffId: role === 'supervisor' ? 'boss' : role === 'other' ? 'other' : 'staff', outletIds: role === 'supervisor' ? [] : [role === 'disabled' ? 'disabled-outlet' : 'canonical-outlet'], supervisorOutletIds: role === 'supervisor' ? ['canonical-outlet'] : [] }; } }, policy: async (tenantId, outletId) => ({ tenantId, outletId, latitude: -6, longitude: 107, radiusMeters: 100, maxAccuracyMeters: 30, maxLocationAgeMs: locationMaxAge, timezone: 'Asia/Jakarta', businessCutoff: '04:00', requireFace: outletId === 'disabled-outlet' || requireBiometric, requireLiveness: false }) });
const handler = createAttendanceRoute(async () => runtime);
const vite = await viteServer({ configFile: false, root: resolve(root, 'tests/attendance-fixture'), plugins: [react()], resolve: { alias: { '@': root } }, server: { middlewareMode: true, host: '127.0.0.1', fs: { allow: [root] } }, appType: 'spa' });
let dropRecordResponse = true;
let delayedRequest;
let delayedResult;
const server = createServer(async (req, res) => {
 if (req.url === '/fixture/biometric-on' && req.method === 'POST') { requireBiometric = true; res.writeHead(204).end(); return; }
 if (req.url === '/fixture/biometric-off' && req.method === 'POST') { requireBiometric = false; res.writeHead(204).end(); return; }
 if (req.url === '/fixture/expire' && req.method === 'POST') { locationMaxAge = 1; await database.execute(sql`update attendance_evidence set expires_at = created_at + interval '1 second' where state = 'ready'`); await database.execute(sql`update attendance_evidence set created_at = created_at - interval '2 hours', expires_at = expires_at - interval '2 hours' where state = 'ready'`); res.writeHead(204).end(); return; }
 if (req.url === '/fixture/unexpire' && req.method === 'POST') { locationMaxAge = 60000; await database.execute(sql`update attendance_evidence set created_at = now(), expires_at = now() + interval '1 hour' where state = 'ready'`); res.writeHead(204).end(); return; }
 if (req.url === '/fixture/release' && req.method === 'POST') { delayedResult = await handler(delayedRequest); res.writeHead(delayedResult.status).end(); return; }
 if (req.url.startsWith('/api/attendance')) { try { const chunks = []; for await (const chunk of req) chunks.push(chunk); const request = new Request(origin + req.url, { method: req.method, headers: req.headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) }); if (req.headers.cookie?.includes('fixture=delayed.') && req.method === 'POST' && !req.url.includes('resource=') && JSON.parse(Buffer.concat(chunks).toString()).action === 'record') { delayedRequest = request; res.writeHead(408).end(); return; } const response = await handler(request); if (dropRecordResponse && req.headers.cookie?.includes('fixture=lost.') && req.method === 'POST' && !req.url.includes('resource=') && response.ok) { dropRecordResponse = false; res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'UNCERTAIN' })); return; } res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); } catch { res.writeHead(500).end(); } return; }
 vite.middlewares(req, res);
});
server.listen(4189, '127.0.0.1', () => console.log(`fixture ready ${['staff','supervisor'].map(role => `${role}=${role}.${sign(role)}`).join(' ')}`));
async function close() { server.close(); await vite.close(); await client.close(); await rm(directory, { recursive: true, force: true }); }
process.on('SIGTERM', () => void close().then(() => process.exit()));
