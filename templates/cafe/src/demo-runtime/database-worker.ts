import { PGlite } from '@electric-sql/pglite';
import { worker } from '@electric-sql/pglite/worker';
import { BROWSER_SCHEMA_REVISION, BROWSER_SCHEMA_SQL } from './schema.generated.ts';
import { attachBrowserWorkerDatabase } from './worker-database.ts';
import { validateConfig, type CafeConfig } from '../config/catalog.mjs';
import type { BrowserOperation } from './types.ts';
import { createDurableOperationBatch } from './durable-batch.ts';
import { attachOperationServer } from './operation-protocol.ts';

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
      const updates = new BroadcastChannel(`${scope}:refresh`);
      const detach = attachOperationServer(channel, async rawOperation => {
        const operation = rawOperation as BrowserOperation;
        let newOrder: { id: string; customerName: string; tableLabel: string | null } | undefined;
        const result = await runDurably(async () => {
          const input = operation.kind === 'command' ? operation.input : undefined;
          const key = input?.command === 'SUBMIT_ORDER_REQUEST' && input.surface !== 'staff' && typeof input.payload?.idempotencyKey === 'string'
            ? input.payload.idempotencyKey : undefined;
          // Checking before the serialized command distinguishes a real insert
          // from an idempotent replay, including replays on another tab.
          const previous = key ? await client.query<{ id: string }>(
            'SELECT id FROM order_requests WHERE idempotency_key = $1 AND outlet_id = (SELECT id FROM outlets WHERE slug = $2 LIMIT 1) LIMIT 1',
            [key, config.venue.outletSlug],
          ) : undefined;
          const value = await handleBrowserOperation(operation);
          if (key && !previous?.rows.length && value && typeof value === 'object' && 'result' in value && 'snapshot' in value) {
            const response = value as { result: { orderRequestId?: string }; snapshot: { orderRequests?: Array<{ id: string; customerName: string; tableLabel: string | null }> } };
            const order = response.snapshot.orderRequests?.find(entry => entry.id === response.result?.orderRequestId);
            if (order) newOrder = { id: order.id, customerName: order.customerName, tableLabel: order.tableLabel };
          }
          return value;
        });
        if (operation.kind === 'command') {
          // Publish from the owner, after the strict flush, even if the tab
          // which submitted the command has already gone away.
          try { updates.postMessage({ type: 'cafe-data-changed', order: newOrder }); } catch { /* Polling and visibility refresh remain fallbacks. */ }
        }
        return result;
      });
      const close = client.close.bind(client);
      client.close = async () => { detach(); channel.close(); updates.close(); await close(); };
      return client;
    } catch (error) {
      await client.close();
      throw error;
    }
  },
});
