/**
 * The table a level draws from, enumerated.
 *
 * ## Why this family enumerates
 *
 * The same reason `numberFacts/facts.ts` gives, and one more.
 *
 * The reason it shares: "the tables to five" is **thirty-five problems in the
 * world** — not thirty-five this generator happens to reach. Enumerating them and
 * picking one uniformly makes the level's variant space a list a test can compare
 * against in both directions, rather than a number estimated from observed
 * collisions.
 *
 * The reason it does not share: a table is a *rectangle* with one corner missing,
 * so two independent draws would very nearly do. Very nearly is the problem. The
 * corner is `0 × 0`, and a rejection loop around it is a stream whose length
 * depends on what it rejected; the division set is a different rectangle again
 * (the divisor is never zero, whatever `includeTrivial` says, because dividing by
 * nothing is not a question with a wrong answer — it is not a question). One
 * enumeration states both shapes once, where they can be read.
 *
 * ## Which facts are in, and the two that are not
 *
 * `0 × 4`, `4 × 1`, `0 ÷ 4` and `4 ÷ 1` are all facts and all in, on any level
 * that asks for them. The zero property and the identity property are content —
 * CCSS 3.OA.B.5 — and they are also the rung a child who has slid all the way
 * down this strand lands on. Nothing about them is made harder to look more
 * respectable.
 *
 * Two draws are excluded and only two:
 *
 * - **`0 × 0`.** Both operands decided by the same rule, with nothing on either
 *   side to reason from. `numberFacts` excludes `0 + 0` for the same reason.
 * - **any divisor of zero.** `12 ÷ 0` has no answer and `0 ÷ 0` has every answer;
 *   an item whose answer does not exist is not a hard item, it is a broken one.
 *
 * Ordering is a plain nested loop and never a sort, so the list is byte-stable on
 * every platform (CG-16) without a comparator to get wrong.
 */

import type { TimesTableParams } from "./params.ts";

/**
 * One fact. `first op second`, with the result the child writes.
 *
 * For `div` the pair is the written problem — `first` is the dividend and
 * `second` the divisor — so that a `Fact` is always "what is on the card", and
 * the two ops can share every consumer.
 */
export type Fact = {
  readonly first: number;
  readonly second: number;
  readonly result: number;
};

/**
 * Every fact this parameter set admits, in a fixed order.
 *
 * Never memoised. A cache keyed on a parameter object is a key-order assumption
 * waiting to happen, and the largest list here is 169 entries.
 */
export function factSet(params: TimesTableParams): Fact[] {
  const { op, maxFactor, includeTrivial } = params;
  const out: Fact[] = [];
  const low = includeTrivial ? 0 : 2;

  if (op === "mul") {
    for (let first = low; first <= maxFactor; first++) {
      for (let second = low; second <= maxFactor; second++) {
        // The one excluded draw: nothing times nothing.
        if (first === 0 && second === 0) continue;
        out.push({ first, second, result: first * second });
      }
    }
    return out;
  }

  // The quotient runs over the level's factors and the divisor runs over the same
  // factors from one upward, so the dividend is a product of the table and never
  // an accident. `low` is 0 on a trivial level, which admits `0 ÷ n`; the divisor
  // starts at `max(low, 1)`, because dividing by nothing is not a question.
  const divisorLow = low < 1 ? 1 : low;
  for (let quotient = low; quotient <= maxFactor; quotient++) {
    for (let divisor = divisorLow; divisor <= maxFactor; divisor++) {
      out.push({ first: quotient * divisor, second: divisor, result: quotient });
    }
  }
  return out;
}

/** How many facts the level has. What a curriculum row declares and CG-10 checks. */
export function factSetSize(params: TimesTableParams): number {
  return factSet(params).length;
}
