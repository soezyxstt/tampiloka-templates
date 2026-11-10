import { cafeConfig } from '../config/cafe.ts';
import { createHash } from './crypto.ts';
import { BROWSER_SCHEMA_REVISION } from './schema.generated.ts';
import { browserDemoIdentity } from './scope-identity.ts';

// IndexedDB is already origin-scoped. The extra identity separates presets
// hosted on one origin and prevents a changed schema from reusing old demo data.
// Bump the runtime epoch when worker commands/semantics change: an already-open
// old tab must not become the database leader for a newly deployed interface.
const identity = browserDemoIdentity(cafeConfig);

export const browserDemoScope = `cafe-demo-rpc3-${BROWSER_SCHEMA_REVISION}-${createHash('sha256').update(identity).digest('hex').slice(0, 16)}`;
export const browserDemoDataDir = `idb://${browserDemoScope}`;

export function assertBrowserDemoSupport(): void {
  if (!globalThis.isSecureContext || !globalThis.indexedDB || !globalThis.Worker || !globalThis.navigator?.locks || !globalThis.BroadcastChannel) {
    throw new Error('Demo interaktif memerlukan browser terbaru dengan penyimpanan lokal, Web Worker, dan koneksi HTTPS. Buka tautan ini di Chrome, Edge, Firefox, atau Safari terbaru.');
  }
}
