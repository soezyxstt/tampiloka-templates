type DurableFilesystem = { syncToFs(relaxedDurability?: boolean): Promise<void> };

/**
 * PGlite normally scans IndexedDB after every query, including SELECT. A domain
 * action often makes dozens of queries. Batch those scans while one serialized
 * action runs, then await a strict flush before acknowledging the action.
 * SQL transactions retain their normal semantics; this changes the browser
 * persistence boundary from each query to the complete local API operation.
 */
export function createDurableOperationBatch(filesystem: DurableFilesystem) {
  const original = filesystem.syncToFs.bind(filesystem);
  let active = false;
  let needsFlush = false;
  let flushQueue: Promise<void> = Promise.resolve();
  const flush = (relaxedDurability?: boolean) => {
    const result = flushQueue.then(() => original(relaxedDurability));
    flushQueue = result.catch(() => {});
    return result;
  };
  filesystem.syncToFs = async relaxedDurability => {
    if (active) { needsFlush = true; return; }
    await flush(relaxedDurability);
  };
  return async function runDurably<T>(action: () => Promise<T>): Promise<T> {
    if (active) throw new Error('Browser demo operations must be serialized.');
    active = true;
    try {
      return await action();
    } finally {
      active = false;
      if (needsFlush) { needsFlush = false; await flush(false); }
    }
  };
}
