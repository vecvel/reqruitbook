/**
 * Prefixed, time-sortable identifiers, byte-compatible with
 * `packages/goshared/idgen`.
 *
 * The format is duplicated rather than imported because nestshared does not
 * export it yet. The properties that matter are the ones the Go implementation
 * documents: Crockford base32 (no I, L, O or U, so an id read aloud over the
 * phone to support cannot be mistyped) and a millisecond timestamp in the high
 * bits, which makes a primary key double as a creation order without a separate
 * index.
 */
import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastMillis = 0;
let lastEntropy = randomBytes(10);

export function newId(prefix: string): string {
  return `${prefix}_${newUlid()}`;
}

function newUlid(): string {
  const now = Date.now();

  if (now === lastMillis) {
    // Same millisecond: increment rather than re-randomise, so two ids minted
    // in the same tick still sort in the order they were created.
    increment(lastEntropy);
  } else {
    lastMillis = now;
    lastEntropy = randomBytes(10);
  }

  const raw = Buffer.alloc(16);
  // Matches the Go layout: the timestamp occupies the first 48 bits, written as
  // a 64-bit big-endian value shifted left by 16, then the last 10 bytes are
  // overwritten with entropy.
  raw.writeBigUInt64BE(BigInt(now) << 16n, 0);
  lastEntropy.copy(raw, 6);

  return encode(raw);
}

function increment(entropy: Buffer): void {
  for (let i = entropy.length - 1; i >= 0; i -= 1) {
    const next = (entropy[i]! + 1) & 0xff;
    entropy[i] = next;
    if (next !== 0) return;
  }
}

function encode(raw: Buffer): string {
  let out = '';
  let bits = 0;
  let value = 0;

  for (const byte of raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 0x1f];
    }
    // Keep `value` inside the 31 bits a JS bitwise operator can hold.
    value &= (1 << bits) - 1;
  }

  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return out;
}
