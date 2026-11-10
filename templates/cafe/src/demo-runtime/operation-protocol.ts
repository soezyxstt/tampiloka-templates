/** The elected worker is the only process allowed to execute database operations. */
export type OperationChannel = {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
};

type Response = { type?: string; requestId?: string; result?: unknown; error?: { message?: string; code?: string; status?: number } };

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> };

const leaderChanged = () => Object.assign(new Error('Tab penyimpanan demo berubah. Perbarui data sebelum mengulangi tindakan.'), { code: 'DEMO_LEADER_CHANGED', status: 409 });

/**
 * Probe until the elected worker has opened the database and attached its RPC
 * listener. Never replay a dispatched operation: a lost response can mean its
 * transaction already committed. In that case callers must refresh first.
 */
export function createOperationClient(channel: OperationChannel, options: { id: () => string; readyTimeoutMs?: number; operationTimeoutMs?: number; probeIntervalMs?: number }) {
  const pending = new Map<string, Pending>();
  const probes = new Map<string, () => void>();
  let closed = false;
  const listener = (event: MessageEvent) => {
    const message = event.data as Response;
    if (message?.type === 'cafe-ready' && typeof message.requestId === 'string') {
      probes.get(message.requestId)?.();
      return;
    }
    if (message?.type !== 'cafe-response' || typeof message.requestId !== 'string') return;
    const request = pending.get(message.requestId);
    if (!request) return;
    pending.delete(message.requestId);
    clearTimeout(request.timeout);
    if (message.error) request.reject(Object.assign(new Error(message.error.message || 'Tindakan demo belum berhasil.'), { code: message.error.code, status: message.error.status }));
    else request.resolve(message.result);
  };
  channel.addEventListener('message', listener);

  const failPending = (error: Error) => {
    for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(error); }
    pending.clear();
  };
  const waitForWorker = (signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    if (closed) { reject(new Error('Koneksi demo ditutup.')); return; }
    if (signal?.aborted) { reject(new DOMException('The request was aborted.', 'AbortError')); return; }
    const requestId = options.id();
    const abort = () => { cleanup(); reject(new DOMException('The request was aborted.', 'AbortError')); };
    const cleanup = () => { clearInterval(interval); clearTimeout(timeout); probes.delete(requestId); signal?.removeEventListener('abort', abort); };
    const probe = () => {
      try { channel.postMessage({ type: 'cafe-probe', requestId }); }
      catch (error) { cleanup(); reject(error); }
    };
    const interval = setInterval(probe, options.probeIntervalMs ?? 500);
    const timeout = setTimeout(() => {
      cleanup();
      reject(Object.assign(new Error('Penyimpanan demo belum siap. Muat ulang halaman dan periksa tab demo lainnya.'), { code: 'DEMO_WORKER_TIMEOUT', status: 504 }));
    }, options.readyTimeoutMs ?? 90000);
    probes.set(requestId, () => { cleanup(); resolve(); });
    signal?.addEventListener('abort', abort, { once: true });
    probe();
  });
  return {
    async request<T>(operation: unknown, signal?: AbortSignal): Promise<T> {
      await waitForWorker(signal);
      if (closed) throw new Error('Koneksi demo ditutup.');
      if (signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');
      const requestId = options.id();
      return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          reject(Object.assign(new Error('Hasil tindakan demo belum diketahui. Perbarui data sebelum mencoba lagi.'), { code: 'DEMO_OPERATION_TIMEOUT', status: 504 }));
        }, options.operationTimeoutMs ?? 45000);
        pending.set(requestId, { resolve: value => resolve(value as T), reject, timeout });
        try { channel.postMessage({ type: 'cafe-request', requestId, operation }); }
        catch (error) { clearTimeout(timeout); pending.delete(requestId); reject(error); }
      });
    },
    leaderChanged() { failPending(leaderChanged()); },
    close() {
      closed = true;
      failPending(new Error('Koneksi demo ditutup.'));
      // Resolve probes so their requests can observe `closed` and reject promptly.
      for (const finish of [...probes.values()]) finish();
      channel.removeEventListener('message', listener);
    },
  };
}

/** Serializes entire domain operations, even when callers time out or close. */
export function attachOperationServer(channel: OperationChannel, execute: (operation: unknown) => Promise<unknown>) {
  let queue: Promise<void> = Promise.resolve();
  const listener = (event: MessageEvent) => {
    const message = event.data as { type?: string; requestId?: string; operation?: unknown };
    if (typeof message?.requestId !== 'string') return;
    if (message.type === 'cafe-probe') {
      channel.postMessage({ type: 'cafe-ready', requestId: message.requestId });
      return;
    }
    if (message.type !== 'cafe-request' || !message.operation) return;
    const requestId = message.requestId;
    queue = queue.then(async () => {
      try {
        const result = await execute(message.operation);
        channel.postMessage({ type: 'cafe-response', requestId, result });
      } catch (error) {
        const failure = error as { code?: string; status?: number; message?: string };
        channel.postMessage({ type: 'cafe-response', requestId, error: { code: failure?.code, status: failure?.status, message: failure?.message || 'Tindakan demo belum berhasil.' } });
      }
    }).catch(() => { /* A closed channel must not leave the queue rejected. */ });
  };
  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}
