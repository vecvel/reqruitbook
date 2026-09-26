/**
 * Prefixed, time-sortable identifiers.
 *
 * LOCAL WORKAROUND: `packages/goshared/idgen` has no counterpart in
 * `packages/nestshared` — the only id generator there is private to events.ts.
 * This is a straight port of the Go implementation so ids minted by a Node
 * service sort and read identically to ids minted by a Go one; it belongs in
 * nestshared and should move there once a second Node service needs it.
 */
import { randomBytes } from 'node:crypto';

/** Crockford base32: no I, L, O, or U, so an id cannot be misread aloud. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastMillis = 0;
let lastEntropy = randomBytes(10);

/** Returns a prefixed, time-sortable identifier such as "tkt_01HQ8…". */
export function newId(prefix: string): string {
  return `${prefix}_${newUlid()}`;
}

function newUlid(): string {
  const now = Date.now();

  if (now === lastMillis) {
    // Same millisecond: increment the previous entropy so ordering still holds
    // within the millisecond. Two ids minted back to back must not compare
    // equal or out of order, because the keyset cursor breaks ties on the id.
    increment(lastEntropy);
  } else {
    lastMillis = now;
    lastEntropy = randomBytes(10);
  }

  const raw = Buffer.alloc(16);
  raw.writeUIntBE(now, 0, 6);
  lastEntropy.copy(raw, 6);

  return encode(raw);
}

function increment(entropy: Buffer): void {
  for (let i = entropy.length - 1; i >= 0; i -= 1) {
    const next = (entropy[i] ?? 0) + 1;
    entropy[i] = next & 0xff;
    if (next <= 0xff) return;
  }
}

/** 128 bits as 26 base32 characters, high bits first. */
function encode(raw: Buffer): string {
  let bits = 0n;
  for (const byte of raw) {
    bits = (bits << 8n) | BigInt(byte);
  }

  const out: string[] = new Array(26);
  for (let i = 25; i >= 0; i -= 1) {
    out[i] = ALPHABET[Number(bits & 31n)]!;
    bits >>= 5n;
  }
  return out.join('');
}
