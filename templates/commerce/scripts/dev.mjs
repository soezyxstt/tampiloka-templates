import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LocalDatabase } from './local-database.mjs';
import { handleRequest } from '../worker/index.ts';

export async function startLocalCommerce(mode) {
  process.chdir(fileURLToPath(new URL('..', import.meta.url)));
  mkdirSync('.data', { recursive: true });
  const db = new LocalDatabase('.data/commerce.sqlite');
  if (mode === 'migrate') {
    db.close();
    return;
  }
  const env = { DB: db, DEMO_MODE: 'true' };
  const api = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (!url.pathname.startsWith('/api/')) {
        res.writeHead(404).end();
        return;
      }
      const request = new Request(url, {
        method: req.method, headers: req.headers,
        ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: req, duplex: 'half' }),
      });
      const response = await handleRequest(request, env);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500).end();
    }
  });
  let web;
  const finish = async () => {
    await web?.close();
    api.close(() => db.close());
  };
  try {
    await new Promise((resolve, reject) => {
      api.once('error', reject);
      api.listen(Number(process.env.COMMERCE_API_PORT ?? (mode === 'preview' ? 0 : 8787)), '127.0.0.1', resolve);
    });
    const target = `http://127.0.0.1:${api.address().port}`;
    console.log(`Commerce API: ${target}`);
    if (mode !== 'api') {
      const { createServer, preview } = await import('vite');
      const proxy = { '/api': { target, changeOrigin: false } };
      if (mode === 'preview') {
        web = await preview({ preview: { proxy } });
      } else {
        web = await createServer({ server: { proxy } });
        await web.listen();
      }
      web.printUrls();
    }
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, finish);
  } catch (error) {
    await finish();
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await startLocalCommerce(process.argv[2] || 'dev');
