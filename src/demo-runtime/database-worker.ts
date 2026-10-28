import { PGlite } from '@electric-sql/pglite';
import { worker } from '@electric-sql/pglite/worker';
import { BROWSER_SCHEMA_REVISION, BROWSER_SCHEMA_SQL } from './schema.generated.ts';
import { attachBrowserWorkerDatabase } from './worker-database.ts';
import { validateConfig, type CafeConfig } from '../config/catalog.mjs';
import type { BrowserOperation } from './types.ts';
import { createDurableOperationBatch } from './durable-batch.ts';

// PGlite's worker wrapper elects one database owner for all tabs with the same id.
// Only that owner opens IndexedDB and applies schema DDL.
void worker({
  async init(options) {
    if (!options.dataDir?.startsWith('idb://cafe-demo-')) throw new Error('Invalid local demo database.');
    const config = validateConfig(options.meta?.cafeConfig);
    const scope = options.meta?.scope;
    if (typeof scope !== 'string' || options.dataDir !== `idb://${scope}`) throw new Error('Invalid local demo scope.');
    // A worker URL points to its asset, not the cafe page. The demo config alias
    // reads this override before deriving the preset from location.
    (globalThis as typeof globalThis & { __CAFE_DEMO_CONFIG__?: CafeConfig }).__CAFE_DEMO_CONFIG__ = config;
    const client = new PGlite({ dataDir: options.dataDir, relaxedDurability: false });
    await client.waitReady;
    try {
      const existing = await client.query<{ revision: string }>(
        "SELECT table_name AS revision FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '__cafe_browser_schema'",
      );
      if (!existing.rows.length) {
        await client.transaction(async tx => {
          await tx.exec(BROWSER_SCHEMA_SQL);
          await tx.exec('CREATE TABLE __cafe_browser_schema (revision text PRIMARY KEY NOT NULL);');
          await tx.query('INSERT INTO __cafe_browser_schema (revision) VALUES ($1)', [BROWSER_SCHEMA_REVISION]);
        });
      } else {
        const revision = await client.query<{ revision: string }>('SELECT revision FROM __cafe_browser_schema');
        if (revision.rows[0]?.revision !== BROWSER_SCHEMA_REVISION) throw new Error('Versi data demo tidak cocok. Muat ulang demo untuk membuat penyimpanan yang sesuai.');
      }
      attachBrowserWorkerDatabase(client);
      if (!client.fs) throw new Error('Penyimpanan lokal demo belum berhasil disiapkan.');
      const runDurably = createDurableOperationBatch(client.fs);
      const { handleBrowserOperation } = await import('./worker-service.ts');
      const channel = new BroadcastChannel(`${scope}:operations`);
      let queue: Promise<void> = Promise.resolve();
      channel.onmessage = event => {
        const message = event.data as { type?: string; requestId?: string; operation?: BrowserOperation };
        if (message?.type !== 'cafe-request' || typeof message.requestId !== 'string' || !message.operation) return;
        queue = queue.then(async () => {
          try {
            const result = await runDurably(() => handleBrowserOperation(message.operation!));
            channel.postMessage({ type: 'cafe-response', requestId: message.requestId, result });
          } catch (error) {
            const failure = error as { code?: string; status?: number; message?: string };
            channel.postMessage({ type: 'cafe-response', requestId: message.requestId, error: { code: failure.code, status: failure.status, message: failure.message || 'Tindakan demo belum berhasil.' } });
          }
        });
      };
      const close = client.close.bind(client);
      client.close = async () => { channel.close(); await close(); };
      return client;
    } catch (error) {
      await client.close();
      throw error;
    }
  },
});
