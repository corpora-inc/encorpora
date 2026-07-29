/**
 * The pairs a level draws from, enumerated.
 *
 * Same reasoning as `numberFacts/facts.ts` and `timesTable/facts.ts`: a level here
 * is bounded by a magnitude, so its problem space is a written-down list rather
 * than a number estimated from observed collisions, and a test can compare against
 * it in both directions. The largest list is four hundred entries.
 *
 * Two shapes, and the second is the reason this is a file and not two `nextInt`
 * calls:
 *
 * - **`first`, `second` and `both`** are the rectangle `1..m × 1..m` with the
 *   minus signs written on. A magnitude of zero is excluded everywhere, because a
 *   zero has no sign: `(−0) + 4` is a card with a lie on it, and `0 × (−7)` is an
 *   item whose answer is right whatever the child believes about signs.
 * - **`none`** — the on-ramp, `3 − 9` — is the *triangle* `a < b`, because the
 *   whole content of the level is that the answer lands below zero and an item
 *   where it does not is an item from another family. Two independent draws with a
 *   rejection would give a stream whose length depends on what it rejected, and
 *   drawing `b` first and then `a` under it would not be uniform: the pairs with a
 *   large `b` would be spread thin and the pairs with `b = 2` would come up as
 *   often as the whole of `b = 20`. `signedInt.test.ts` measures that with a χ².
 *
 * Ordering is a plain nested loop and never a sort, so the list is byte-stable on
 * every platform (CG-16) without a comparator to get wrong.
 */

import type { SignedIntParams } from "./params.ts";

/** One item: `first op second`, both signed as the level's placement says. */
export type Pair = {
  readonly first: number;
  readonly second: number;
};

/**
 * Every pair this parameter set admits, in a fixed order.
 *
 * Never memoised. A cache keyed on a parameter object is a key-order assumption
 * waiting to happen.
 */
export function pairSet(params: SignedIntParams): Pair[] {
  const { maxMagnitude: m, negatives } = params;
  const out: Pair[] = [];

  if (negatives === "none") {
    // `a − b` with `a < b`, so the answer is strictly below zero on every item.
    for (let first = 1; first < m; first++) {
      for (let second = first + 1; second <= m; second++) {
        out.push({ first, second });
      }
    }
    return out;
  }

  const firstSign = negatives === "first" || negatives === "both" ? -1 : 1;
  const secondSign = negatives === "second" || negatives === "both" ? -1 : 1;
  for (let a = 1; a <= m; a++) {
    for (let b = 1; b <= m; b++) {
      out.push({ first: firstSign * a, second: secondSign * b });
    }
  }
  return out;
}

/** How many problems the level has. What a curriculum row declares and CG-10 checks. */
export function pairSetSize(params: SignedIntParams): number {
  return pairSet(params).length;
}
