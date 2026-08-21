/**
 * The fact set a level draws from, enumerated.
 *
 * ## Why this family enumerates instead of drawing digits
 *
 * Every other generator in this package draws a structure and then fills digits
 * into the ranges that structure forces, because the space it draws from is far
 * too large to write down: four-digit subtraction borrowing through two zeros has
 * millions of instances.
 *
 * A number fact has the opposite problem. "Addition within ten" is **forty-five
 * problems in the world**, or sixty-five once `n + 0` and `0 + n` are admitted —
 * not forty-five that this generator happens to reach, forty-five that exist.
 * Enumerating them and picking one uniformly is therefore both simpler and
 * stronger than rejection sampling: the level's variant space stops being a number
 * estimated from observed collisions and becomes a list that a test can compare
 * against, in both directions. `numberFacts.test.ts` asserts that the generator
 * reaches every fact in the list and never emits one outside it, which no amount
 * of sampling could establish, and that the draw over the list is flat.
 *
 * It is also what makes `GeneratorBinding.closedFactSet` honest: the number a
 * curriculum row declares is `factSet(params).length`, and CG-10 checks the
 * measured draw against it rather than against a floor derived from a model of
 * generators that do not close.
 *
 * ## The trivial facts are in the set, and they are not the set
 *
 * `0 + 1`, `1 + 0`, `n − 0` and `n − n` are facts, and a child who has slid down
 * after struggling should arrive at a guaranteed win. `includeZero` admits them,
 * and the bottom rung of the shipped ladder sets it.
 *
 * What that must not become is the whole floor. The graph's level 0 was once a
 * `maxTotal` of three, which is this enumeration's nine smallest entries and
 * nothing else, and a child served it for an hour met `2 + 0` over and over. The
 * bound `includeZero` carries is a *share*: on a level whose ceiling is ten, twenty
 * of the sixty-five entries have a zero in them. That is one question in three, and
 * it is a proportion of a set rather than a set. `graph/domains/add.ts` rev 2 is
 * the level table that says so and `promotionBlockers.ts`'s `MIN_RUNG_VARIANTS` is
 * the bound that keeps it said.
 *
 * One pair is excluded and only one: **both operands zero**. An empty frame added
 * to an empty frame is not a question a child can be asked — there is nothing on
 * the screen to count — and `0 + 0` and `0 − 0` are the only two draws with that
 * property.
 *
 * Ordering is a plain nested loop and never a sort, so the list is byte-stable on
 * every platform (CG-16) without a comparator to get wrong.
 */

import type { NumberFactsParams } from "./params.ts";

/** One fact: `first op second`, with the result the child writes. */
export type Fact = {
  readonly first: number;
  readonly second: number;
  readonly result: number;
};

/** Largest single-digit operand. A fact crossing ten still has both below ten. */
const MAX_OPERAND = 9;

/**
 * Every fact this parameter set admits, in a fixed order.
 *
 * Never memoised. A cache keyed on a parameter object is a key-order assumption
 * waiting to happen, and the largest list here is sixty-five entries.
 */
export function factSet(params: NumberFactsParams): Fact[] {
  const { op, maxTotal, crossesTen, includeZero } = params;
  const out: Fact[] = [];
  const low = includeZero ? 0 : 1;

  if (op === "add") {
    if (crossesTen) {
      // Both addends below ten and a sum above it: the crossing is the content, so
      // an addend of ten or more would be a different skill wearing this level's
      // name, and a zero addend cannot cross anything.
      for (let first = 1; first <= MAX_OPERAND; first++) {
        for (let second = 1; second <= MAX_OPERAND; second++) {
          const sum = first + second;
          if (sum <= 10 || sum > maxTotal) continue;
          out.push({ first, second, result: sum });
        }
      }
      return out;
    }
    for (let first = low; first <= maxTotal; first++) {
      for (let second = low; second <= maxTotal; second++) {
        const sum = first + second;
        // `sum >= 1` is the both-operands-zero exclusion, and the only one.
        if (sum < 1 || sum > maxTotal) continue;
        out.push({ first, second, result: sum });
      }
    }
    return out;
  }

  if (crossesTen) {
    // A teen whole, a single-digit part, and a difference back below ten. Both
    // ends of the subtraction sit on opposite sides of ten, which is what makes
    // it the crossing fact rather than `18 − 3`.
    for (let first = 11; first <= maxTotal; first++) {
      for (let second = 1; second <= MAX_OPERAND; second++) {
        const difference = first - second;
        if (difference < 1 || difference > 9) continue;
        out.push({ first, second, result: difference });
      }
    }
    return out;
  }

  for (let first = 1; first <= maxTotal; first++) {
    for (let second = low; second <= first; second++) {
      const difference = first - second;
      // `first >= 1` above is the both-operands-zero exclusion. `n − 0 = n` and
      // `n − n = 0` are both in, deliberately: they are the identity facts.
      if (!includeZero && difference < 1) continue;
      out.push({ first, second, result: difference });
    }
  }
  return out;
}

/** How many facts the level has. What a curriculum row declares and CG-10 checks. */
export function factSetSize(params: NumberFactsParams): number {
  return factSet(params).length;
}
