/** Only the Node crypto operations used by the demo domain service. */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

class RandomBytes extends Uint8Array {
  override toString(encoding?: string): string {
    if (encoding !== 'hex') throw new Error('The browser demo only supports hexadecimal random bytes.');
    return bytesToHex(this);
  }
}

export function randomBytes(size: number): RandomBytes {
  if (!Number.isSafeInteger(size) || size < 0 || size > 65536) throw new RangeError('Invalid random byte count.');
  return globalThis.crypto.getRandomValues(new RandomBytes(size));
}

export function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

export function createHash(algorithm: string) {
  if (algorithm.toLowerCase() !== 'sha256') throw new Error('The browser demo only supports SHA-256.');
  const hash = sha256.create();
  let finished = false;
  return {
    update(value: string | Uint8Array) {
      if (finished) throw new Error('Hash has already been finalized.');
      hash.update(typeof value === 'string' ? utf8ToBytes(value) : value);
      return this;
    },
    digest(encoding: string) {
      if (encoding !== 'hex') throw new Error('The browser demo only supports hexadecimal hashes.');
      if (finished) throw new Error('Hash has already been finalized.');
      finished = true;
      return bytesToHex(hash.digest());
    },
  };
}

const browserCrypto = { randomBytes, randomUUID, createHash };
export default browserCrypto;
