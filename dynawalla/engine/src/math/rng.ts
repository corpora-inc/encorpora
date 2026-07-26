/**
 * Deterministic draws, without `Math.random` and without a float.
 *
 * The engine is not allowed randomness (EG-1) and is required to produce
 * byte-identical transcripts from a seed (EG-2), so every "choice rather than a
 * computation" — which of two equally good candidates, which persona slips on
 * which card — is a pure function of `(seed, counter)`.
 *
 * The mixer is splitmix32's finaliser: five integer operations, no state, and
 * `Math.imul` rather than `*` so the multiply is the same 32-bit wrap on every
 * engine. It is not a cryptographic hash and does not need to be; what it needs
 * is to be the same everywhere and to have no visible structure in the low bits,
 * which a linear congruential generator does not.
 *
 * Draws come back as `Fix` — millionths — because a `number` in this package may
 * never hold a fractional value.
 */

import { FIX_SCALE } from "./fixed.ts";
import type { Fix } from "./fixed.ts";

/** splitmix32's finaliser. Returns an unsigned 32-bit integer. */
export function mix32(value: number): number {
  let x = value >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x21f0aaad) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x735a2d97) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  return x >>> 0;
}

/** A stream position mixed into a seed. Both are folded, so neither dominates. */
export function hash2(seed: number, counter: number): number {
  return mix32((mix32(seed >>> 0) ^ Math.imul(counter >>> 0, 0x9e3779b9)) >>> 0);
}

/** A draw in `[0, 1)`, as millionths. */
export function draw(seed: number, counter: number): Fix {
  return ((hash2(seed, counter) % FIX_SCALE) as Fix);
}

/** A draw in `[0, bound)`. `bound` must be a positive safe integer. */
export function drawInt(seed: number, counter: number, bound: number): number {
  if (!Number.isSafeInteger(bound) || bound <= 0) throw new RangeError("drawInt: bound must be positive");
  return hash2(seed, counter) % bound;
}

/**
 * Is a Bernoulli trial at probability `p` a hit?
 *
 * Written as a comparison against a draw rather than as a coin flip helper so
 * that a persona's slip rate and a scheduler's tie-break read the same way and
 * consume exactly one counter each.
 */
export function bernoulli(seed: number, counter: number, p: Fix): boolean {
  return draw(seed, counter) < p;
}

/**
 * A stable 32-bit fingerprint of a string.
 *
 * FNV-1a over UTF-16 code units. Used where the harness needs a per-item feature
 * the engine cannot observe, and where a trace needs a short id. It is never used
 * to key persisted state: two ids that collide here would silently merge two
 * children's skills, and 32 bits over 160 ids is a birthday collision waiting for
 * the wrong release.
 */
export function fingerprint(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = (hash ^ text.charCodeAt(i)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return mix32(hash);
}
