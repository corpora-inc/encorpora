/**
 * FNV-1a, 64-bit, over BigInt. Used for the CG-16 committed output hashes.
 *
 * Deliberately not `node:crypto`: the same hash has to be computable from the app
 * bundle (a WebView) as from the validator, and a curriculum module may not depend
 * on Node built-ins.
 */

const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

export function fnv1a64(text: string): bigint {
  let hash = OFFSET;
  // Hash UTF-8 bytes, not UTF-16 code units, so the value does not depend on the
  // JS string encoding of any character above U+007F.
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) {
    hash = (hash ^ BigInt(byte)) & MASK;
    hash = (hash * PRIME) & MASK;
  }
  return hash;
}

export function fnv1a64Hex(text: string): string {
  return fnv1a64(text).toString(16).padStart(16, "0");
}
