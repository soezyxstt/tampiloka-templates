import { PGliteWorker } from '@electric-sql/pglite/worker';
import { cafeConfig } from '../config/cafe.ts';
import { assertBrowserDemoSupport, browserDemoDataDir, browserDemoScope } from './scope.ts';
import type { BrowserOperation } from './types.ts';

let client: PGliteWorker | undefined;
let channel: BroadcastChannel | undefined;
let initialization: Promise<void> | undefined;
type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> };
const pending = new Map<string, Pending>();

function rejectPending(error: Error): void {
  for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(error); }
  pending.clear();
}

export function initializeBrowserDatabase(): Promise<void> {
  if (!initialization) initialization = (async () => {
    assertBrowserDemoSupport();
    channel = new BroadcastChannel(`${browserDemoScope}:operations`);
    channel.onmessage = event => {
      const message = event.data;
      if (message?.type !== 'cafe-response' || typeof message.requestId !== 'string') return;
      const request = pending.get(message.requestId);
      if (!request) return;
      pending.delete(message.requestId);
      clearTimeout(request.timeout);
      if (message.error) request.reject(Object.assign(new Error(message.error.message), { code: message.error.code, status: message.error.status }));
      else request.resolve(message.result);
    };
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
      client!.onLeaderChange(() => rejectPending(Object.assign(new Error('Tab penyimpanan demo berubah. Perbarui data sebelum mengulangi tindakan.'), { code: 'DEMO_LEADER_CHANGED', status: 409 })));
    } catch (error) {
      worker.terminate(); channel?.close(); channel = undefined; client = undefined;
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
      if (onError) worker.removeEventListener('error', onError);
    }
  })().catch(error => { initialization = undefined; throw error; });
  return initialization;
}

/** One RPC per whole domain operation, avoiding per-query SQL protocol traffic. */
export async function requestBrowserOperation<T>(operation: BrowserOperation): Promise<T> {
  await initializeBrowserDatabase();
  await client!.waitReady;
  const requestId = crypto.randomUUID();
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      reject(Object.assign(new Error('Tindakan demo belum selesai. Perbarui data sebelum mencoba lagi.'), { code: 'DEMO_OPERATION_TIMEOUT', status: 504 }));
    }, 45000);
    pending.set(requestId, { resolve: result => resolve(result as T), reject, timeout });
    channel!.postMessage({ type: 'cafe-request', requestId, operation });
  });
}

/** Closes this tab only. PGlite elects a new owner when another tab remains. */
export async function closeBrowserDatabase(): Promise<void> {
  await initialization;
  rejectPending(new Error('Koneksi demo ditutup.'));
  channel?.close(); channel = undefined;
  await client?.close(); client = undefined;
  initialization = undefined;
}
