import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename, join } from 'node:path';
import { createServer } from 'vite';
import { database } from './sqlite.mjs';
import { handle } from '../worker/api.ts';
import { localEnv, localObjectStorageProvider } from './env.mjs';
const root = new URL('../', import.meta.url);
const vars = await localEnv(root);
// Tests use a temporary directory; ordinary client development keeps its own .data.
const dataDir = resolve(process.env.SCHOOL_DATA_DIR || '.data');
const filesDir = join(dataDir, 'files');
await mkdir(filesDir, { recursive: true });
const demo = process.argv.includes('--demo') || vars.DEMO_MODE === 'true';
const db = await database(join(dataDir, 'school.sqlite'));
// Only explicit, server-controlled configuration can enable local demo identities.
const env = { ...vars, OBJECT_STORAGE_PROVIDER: await localObjectStorageProvider(root, vars, demo), DB: db, DEMO_MODE: String(demo), MEDIA: { async put(key, bytes) { await writeFile(resolve(filesDir, basename(key)), new Uint8Array(bytes)); }, async get(key) { try {
            const b = await readFile(resolve(filesDir, basename(key)));
            return { async arrayBuffer() { return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } };
        }
        catch {
            return null;
        } } } };
const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
const server = http.createServer(async (req, res) => {
    if (!req.url.startsWith('/api/'))
        return vite.middlewares(req, res);
    try {
        let chunks = [], size = 0;
        for await (const chunk of req) {
            size += chunk.length;
            if (size > 5100000) {
                res.writeHead(413);
                res.end();
                return;
            }
            chunks.push(chunk);
        }
        const response = await handle(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
    }
    catch {
        res.writeHead(500);
        res.end('Server error');
    }
});
server.listen(Number(process.env.PORT ?? 5176), '127.0.0.1', () => console.log(`School ${env.DEMO_MODE === 'true' ? 'demo' : 'client'} http://127.0.0.1:${process.env.PORT ?? 5176}`));
for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => { server.close(); vite.close(); db?.raw.close(); process.exit(0); });
