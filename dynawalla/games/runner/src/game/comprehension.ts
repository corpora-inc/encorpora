/**
 * How long a child should have with a question, as a function of the question.
 *
 * **The defect this file exists to remove.** VOLTA derived the child's thinking
 * time from a motion constant, and the motion constant was also the escalation
 * knob — so every step that made the run more exciting took thinking time away,
 * and the hardest arithmetic in the pack arrived with the least time to do it.
 * Measured through the real scheduler before this file existed: 8.0s of
 * comprehension on the opening gate, where the content is `5 − 2`, falling to
 * 4.0s at terminal velocity on the smallest quality tier, where the content is
 * four- and five-digit column arithmetic. The founder put it exactly:
 *
 *   > "you have 5 seconds to do 2x1 and then 2 seconds to do 84302+4186"
 *
 * `docs/PACING_AUDIT_2026-07.md` names it as one design error replicated across
 * seventeen games, and states the invariant:
 *
 *   > `window(d)` must be MONOTONE NON-DECREASING in item difficulty. A harder
 *   > question may never get less time than an easier one.
 *
 * **So this function may not see the world.** No speed, no elapsed time, no
 * travel, no draw distance, no tier, no surge — nothing that a run can change is
 * in scope here, and there is nothing in this module's imports that could supply
 * one. It reads the item and returns seconds. `pacing.ts` then buys those seconds
 * the only way VOLTA can afford them: **runway.** Not deceleration — the vehicle
 * keeps racing, and the road in front of the gate gets longer.
 *
 * **Where the numbers come from.** `docs/EXPERIENCE_DESIGN.md` instruments a
 * cadence table, p50/p90, which is the product's own measured account of how long
 * these things take:
 *
 *   - single-digit fact                 2.8s / 6s
 *   - two-digit with regrouping         6s   / 14s
 *   - the `5,001 − 2,798` class         16s  / 40s
 *
 * The three anchors below are the p50 column, placed on the shapes the table
 * names, and the rows between them are interpolated monotonically. p50 and not
 * p90 because this is a *recognition* task — the answer is one of three numerals
 * already on screen — and picking a shown candidate is cheaper than producing an
 * answer cold. It is not four times cheaper, which is what the old 3.2s window
 * was implicitly claiming.
 */

/** Which operation a prompt is asking for. `other` gets the cautious branch. */
export type Op = "add" | "sub" | "mul" | "div" | "other";

export type Shape = {
  /**
   * Digits in the longest operand.
   *
   * The operands and not the answer: `7 + 8` is a single-digit fact whose answer
   * has two digits, and the cadence table calls that 2.8s, not 6.
   */
  digits: number;
  /** Does a column carry or borrow? */
  regroup: boolean;
  op: Op;
};

const DIGIT_RUN = /\d+/g;

/** Every run of digits in `s`, longest-first order not guaranteed. */
function runs(s: string): string[] {
  DIGIT_RUN.lastIndex = 0;
  return s.match(DIGIT_RUN) ?? [];
}

/**
 * The operator, from the first operator glyph in the prompt.
 *
 * `−` is the typographic minus the atlas uses and `-` is what a host writes;
 * both are here. A prompt with no operator at all — a word problem, a
 * fill-in-the-blank — is `other`, which is treated as the *harder* branch, for
 * the same reason an unparseable operand pair is: this function's failure mode
 * must be "the child got more time than they needed".
 */
export function opOf(prompt: string): Op {
  for (const ch of prompt) {
    if (ch === "+") return "add";
    if (ch === "-" || ch === "−" || ch === "–" || ch === "—") return "sub";
    if (ch === "×" || ch === "*" || ch === "·") return "mul";
    if (ch === "÷" || ch === "/" || ch === ":") return "div";
  }
  return "other";
}

/** Does adding these two decimal strings carry out of any column? */
function addCarries(a: string, b: string): boolean {
  let carry = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const da = Number(a[a.length - 1 - i] ?? "0");
    const db = Number(b[b.length - 1 - i] ?? "0");
    const sum = da + db + carry;
    if (sum > 9) return true;
    carry = 0;
  }
  return false;
}

/** Does subtracting the smaller from the larger borrow out of any column? */
function subBorrows(a: string, b: string): boolean {
  const [big, small] = a.length > b.length || (a.length === b.length && a >= b) ? [a, b] : [b, a];
  let borrow = 0;
  for (let i = 0; i < big.length; i++) {
    const db = Number(big[big.length - 1 - i] ?? "0");
    const ds = Number(small[small.length - 1 - i] ?? "0");
    if (db - borrow < ds) {
      return true;
    }
    borrow = 0;
  }
  return false;
}

/**
 * What kind of arithmetic this is, from the item's own text.
 *
 * A host can write anything — `3/4`, a word problem, an equation with the unknown
 * on the left — so every branch that cannot read the item falls to the *slower*
 * classification. Being generous with time to a question that did not need it
 * costs a few seconds of runway; being stingy is the defect.
 */
export function itemShape(item: { prompt: string; answer: string }): Shape {
  const operands = runs(item.prompt);
  const op = opOf(item.prompt);
  const widest = operands.length > 0 ? operands : runs(item.answer);
  const digits = widest.reduce((m, r) => Math.max(m, r.length), 1);

  let regroup: boolean;
  if (operands.length !== 2) {
    // One operand (or three: an equation, a chained expression) is not a column
    // sum this function can reason about. Assume the work is there.
    regroup = true;
  } else if (op === "add") {
    regroup = addCarries(operands[0] ?? "", operands[1] ?? "");
  } else if (op === "sub") {
    regroup = subBorrows(operands[0] ?? "", operands[1] ?? "");
  } else {
    // Multiplication and division past a single digit are partial products and
    // trial quotients all the way down; there is no column that does not carry.
    regroup = digits > 1;
  }

  return { digits, regroup, op };
}

/**
 * The cadence table, p50 seconds, by operand width and whether a column carries.
 *
 * Index 0 is unused so the row index reads as the digit count. Rows 1, 2 and 4
 * are the three anchors `EXPERIENCE_DESIGN.md` instruments; 3 and 5 are
 * interpolated. Every column is non-decreasing down the table and the regrouping
 * row is never below the plain one, which is the invariant, and it is asserted
 * over the whole cross product rather than left to inspection.
 *
 * A single-digit fact is 2.8s whether or not it carries: `7 + 8` is the thing the
 * table calls a single-digit fact, and a child who knows their facts is not doing
 * columns at all.
 */
const PLAIN = [0, 2.8, 4.2, 7.0, 11.0, 14.0] as const;
const REGROUP = [0, 2.8, 6.0, 10.0, 16.0, 20.0] as const;

/** The widest content the table describes. Beyond it, the last row stands. */
export const MAX_DIGITS = 5;

/** The most any item can ask for, in seconds. */
export const MAX_TARGET = REGROUP[MAX_DIGITS];

/**
 * Seconds a child should have with `item`, before it must be answered.
 *
 * Pure in the item. Nothing about the run reaches this function, and that is the
 * property the fleet invariant needs — see the module note.
 */
export function comprehensionTarget(item: { prompt: string; answer: string }): number {
  const { digits, regroup, op } = itemShape(item);
  // Multi-digit multiplication and division are a row harder than their width:
  // `12 × 34` is four single-digit products and a two-column sum, not a
  // two-column anything.
  const heavy = (op === "mul" || op === "div" || op === "other") && digits > 1 ? 1 : 0;
  const row = Math.min(MAX_DIGITS, Math.max(1, digits + heavy));
  return regroup ? REGROUP[row] : PLAIN[row];
}
