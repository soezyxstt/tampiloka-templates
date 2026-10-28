/** Local-only API adapter for the public static demo site. No network mutations. */
import { CapabilityError } from '../domain/capabilities.ts';
import { requestBrowserOperation } from './database.ts';
import { browserDemoScope, withBrowserDemoLock } from './scope.ts';
import type { BrowserCommand, BrowserSnapshotContext } from './types.ts';

export type { BrowserCommand, BrowserSnapshotContext } from './types.ts';
type Snapshot = Awaited<ReturnType<typeof import('./worker-service.ts')['getBrowserSnapshot']>>;
type CommandResult = Awaited<ReturnType<typeof import('./worker-service.ts')['executeBrowserCommand']>>;

export function initializeBrowserDemo(): Promise<void> {
  return withBrowserDemoLock(() => requestBrowserOperation<void>({ kind: 'initialize' }));
}

export function getBrowserSnapshot(context: BrowserSnapshotContext = {}, signal?: AbortSignal): Promise<Snapshot> {
  return withBrowserDemoLock(() => requestBrowserOperation<Snapshot>({ kind: 'snapshot', context }), signal);
}

export function executeBrowserCommand(input: BrowserCommand, signal?: AbortSignal): Promise<CommandResult> {
  return withBrowserDemoLock(() => requestBrowserOperation<CommandResult>({ kind: 'command', input }), signal);
}

export async function resetBrowserDemo() {
  return executeBrowserCommand({ command: 'RESET_DEMO_DATA', payload: {}, surface: 'staff' });
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}

function errorResponse(error: unknown, requestId: string, defaultStatus = 422) {
  if (error instanceof DOMException && error.name === 'AbortError') throw error;
  const failure = error as { status?: number; code?: string; message?: string };
  const status = failure?.status || (failure?.code === 'IDEMPOTENCY_CONFLICT' || failure?.code === 'QUOTE_CHANGED' ? 409 : defaultStatus);
  return jsonResponse({ error: { code: failure?.code || 'BROWSER_DEMO_ERROR', message: failure?.message || 'Tindakan demo belum berhasil. Coba lagi.', retryable: false }, meta: { requestId } }, status);
}

let uninstallFetch: (() => void) | undefined;

/** Preserve the existing UI's API contract while keeping every demo write local. */
export function installBrowserDemoFetch(): () => void {
  if (uninstallFetch) return uninstallFetch;
  const original = globalThis.fetch;
  const localFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), globalThis.location.href);
    if (url.origin !== globalThis.location.origin || !url.pathname.startsWith('/api/v1/')) return original.call(globalThis, input, init);
    const request = input instanceof Request ? new Request(input, init) : new Request(url, init);
    if (request.signal.aborted) throw new DOMException('The request was aborted.', 'AbortError');
    const requestId = `browser_${crypto.randomUUID()}`;
    const meta = () => ({ requestId, serverTime: new Date().toISOString(), localOnly: true });
    try {
      if (url.pathname.startsWith('/api/v1/webhooks/')) throw new CapabilityError('LOCAL_DEMO_ONLY', 'Demo browser tidak menerima webhook atau pembayaran nyata.', 503);
      if (!['/api/v1/snapshot', '/api/v1/quotes', '/api/v1/order-requests'].includes(url.pathname)) throw new CapabilityError('UNKNOWN_ENDPOINT', 'Layanan ini tidak tersedia dalam demo browser.', 404);
      if (url.pathname === '/api/v1/snapshot' && request.method === 'GET') {
        const data = await getBrowserSnapshot({
          surface: url.searchParams.get('surface') === 'staff' ? 'staff' : 'customer',
          outlet: url.searchParams.get('outlet') || undefined,
          tableId: url.searchParams.get('table') || undefined,
          principalId: url.searchParams.get('principal') || undefined,
        }, request.signal);
        return jsonResponse({ data, meta: meta() });
      }
      if (request.method !== 'POST') return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode permintaan tidak didukung.', retryable: false }, meta: meta() }, 405, { Allow: url.pathname === '/api/v1/snapshot' ? 'GET, POST' : 'POST' });
      let body;
      try { body = await request.json(); } catch { throw new CapabilityError('INVALID_REQUEST', 'Isi permintaan harus berupa JSON yang valid.', 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CapabilityError('INVALID_REQUEST', 'Data permintaan harus berupa objek.', 400);
      if (url.pathname === '/api/v1/snapshot') return jsonResponse({ data: await executeBrowserCommand(body, request.signal), meta: meta() });
      const command = url.pathname === '/api/v1/quotes' ? 'CREATE_QUOTE' : 'SUBMIT_ORDER_REQUEST';
      if (command === 'SUBMIT_ORDER_REQUEST') {
        body.idempotencyKey = request.headers.get('idempotency-key') || body.idempotencyKey;
        if (!body.idempotencyKey) throw new CapabilityError('IDEMPOTENCY_KEY_REQUIRED', 'Sertakan kunci pengiriman agar percobaan ulang tidak menggandakan pesanan.', 400);
      }
      const data = await executeBrowserCommand({ command, payload: body, surface: 'customer' }, request.signal);
      return jsonResponse({ data: data.result, meta: meta() });
    } catch (error) {
      return errorResponse(error, requestId, request.method === 'GET' ? 500 : 422);
    }
  };
  globalThis.fetch = localFetch;
  uninstallFetch = () => {
    if (globalThis.fetch === localFetch) globalThis.fetch = original;
    uninstallFetch = undefined;
  };
  return uninstallFetch;
}

export { browserDemoScope };
