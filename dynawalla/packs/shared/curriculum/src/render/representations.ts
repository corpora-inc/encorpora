/**
 * The representation ids, and what each one is allowed to be handed.
 *
 * CURRICULUM.md fixes four for V1 — counting board, balance scale, gear train,
 * number line — and each carries one idea. Ids live here rather than beside
 * whichever module needed one first: a `RepId` is a string, and a typo is a
 * `RepSpec` no renderer matches and a blank space on a child's screen.
 *
 * `RepSpec.params` is `Record<string, number>`, and the rule this module adds is
 * that **every param is a safe integer**. A representation is drawing rather
 * than arithmetic, but the numbers it draws are the numbers the answer is made
 * of, and a `0.30000000000000004` tick label is ADR-0006's float bug wearing a
 * hat. Thirds are `{ from: 0, to: 1, denominator: 3, mark: 2 }` — exact — and the
 * renderer builds the `Rational` itself.
 *
 * `repSpecDefect` is the precondition, checked by the app before it draws and by
 * `representation.test.ts`, so a malformed spec is a red test rather than a
 * mis-drawn number.
 */

import type { RepId } from "../types/ids.ts";

/** Place value and regrouping. The LOCATE representation for borrow-across-zero. */
export const REP_COUNTING_BOARD: RepId = "counting-board";
/** Magnitude, fractions, comparison. */
export const REP_NUMBER_LINE: RepId = "number-line";
/** The equals sign as a relation, not an operator. */
export const REP_BALANCE_SCALE: RepId = "balance-scale";
/** Multiples, factors, LCM. Not built — see the renderer registry. */
export const REP_GEAR_TRAIN: RepId = "gear-train";

export const V1_REPRESENTATIONS: readonly RepId[] = [
  REP_COUNTING_BOARD,
  REP_NUMBER_LINE,
  REP_BALANCE_SCALE,
  REP_GEAR_TRAIN,
];

/**
 * Params each representation requires.
 *
 * `number-line`: the line runs `from`..`to` in whole units, each cut into
 * `denominator` parts, with the index `mark` parts from the left end.
 * `balance-scale`: what sits in each pan, in whole units — equal pans balance,
 * which is the idea. `counting-board` takes none: it is built from the item's
 * own digits by `contrast.ts`, which needs the exercise rather than a spec.
 */
export const REQUIRED_REP_PARAMS: Readonly<Record<string, readonly string[]>> = {
  [REP_NUMBER_LINE]: ["from", "to", "denominator", "mark"],
  [REP_BALANCE_SCALE]: ["left", "right"],
  [REP_COUNTING_BOARD]: [],
};

/** Why this spec cannot be drawn, or `null`. */
export function repSpecDefect(rep: RepId, params: Readonly<Record<string, number>>): string | null {
  const required = REQUIRED_REP_PARAMS[rep];
  if (required === undefined) return `no representation "${rep}"`;

  for (const [name, value] of Object.entries(params)) {
    if (!Number.isSafeInteger(value)) return `${rep}.${name} is not a safe integer: ${String(value)}`;
  }
  for (const name of required) {
    if (params[name] === undefined) return `${rep} is missing ${name}`;
  }

  if (rep === REP_NUMBER_LINE) {
    const from = params["from"] ?? 0;
    const to = params["to"] ?? 0;
    const denominator = params["denominator"] ?? 0;
    const mark = params["mark"] ?? 0;
    if (to <= from) return "number-line runs backwards or has no length";
    if (denominator < 1) return "number-line has no subdivision";
    if (mark < 0 || mark > (to - from) * denominator) return "number-line mark is off the line";
    // A line a child can read. Twelve ticks is a fraction wall; sixty is a hairbrush.
    if ((to - from) * denominator > 24) return "number-line has more than 24 intervals";
  }

  if (rep === REP_BALANCE_SCALE) {
    const left = params["left"] ?? 0;
    const right = params["right"] ?? 0;
    if (left < 0 || right < 0) return "balance-scale pans cannot hold a negative amount";
  }

  return null;
}
