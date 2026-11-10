import { PGliteWorker } from '@electric-sql/pglite/worker';
import { cafeConfig } from '../config/cafe.ts';
import { assertBrowserDemoSupport, browserDemoDataDir, browserDemoScope } from './scope.ts';
import { createOperationClient } from './operation-protocol.ts';
import type { BrowserOperation } from './types.ts';

let client: PGliteWorker | undefined;
let channel: BroadcastChannel | undefined;
let operations: ReturnType<typeof createOperationClient> | undefined;
let initialization: Promise<void> | undefined;

export function initializeBrowserDatabase(): Promise<void> {
  if (!initialization) initialization = (async () => {
    assertBrowserDemoSupport();
    channel = new BroadcastChannel(`${browserDemoScope}:operations`);
    operations = createOperationClient(channel, { id: () => crypto.randomUUID() });
    const worker = new Worker(new URL('./database-worker.ts', import.meta.url), { type: 'module', name: browserDemoScope });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let onError: ((event: ErrorEvent) => void) | undefined;
    try {
      const ready = (async () => {
        client = await PGliteWorker.create(worker, { id: browserDemoScope, dataDir: browserDemoDataDir, meta: { cafeConfig, scope: browserDemoScope } });
        await client.waitReady;
      })();
      await Promise.race([ready, new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Penyimpanan demo belum selesai dimuat. Periksa koneksi, lalu muat ulang halaman.')), 90000);
        onError = event => reject(new Error(event.message || 'Worker demo gagal dimuat. Muat ulang halaman.'));
        worker.addEventListener('error', onError, { once: true });
      })]);
      client!.onLeaderChange(() => operations?.leaderChanged());
    } catch (error) {
      worker.terminate(); operations?.close(); operations = undefined; channel?.close(); channel = undefined; client = undefined;
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
      if (onError) worker.removeEventListener('error', onError);
    }
  })().catch(error => { initialization = undefined; throw error; });
  return initialization;
}

/** One RPC per whole domain operation, avoiding per-query SQL protocol traffic. */
export async function requestBrowserOperation<T>(operation: BrowserOperation, signal?: AbortSignal): Promise<T> {
  await initializeBrowserDatabase();
  return operations!.request<T>(operation, signal);
}

/** Closes this tab only. PGlite elects a new owner when another tab remains. */
export async function closeBrowserDatabase(): Promise<void> {
  await initialization;
  operations?.close(); operations = undefined;
  channel?.close(); channel = undefined;
  await client?.close(); client = undefined;
  initialization = undefined;
}
