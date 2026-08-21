/**
 * The **correct** column algorithms, subtract and add, in one implementation.
 *
 * Two callers need this procedure and they used to run their own copies: the
 * generator, which needs the difference digits, the regrouping marks and the value
 * each column is actually worked with; and the mal-rules, which need to know which
 * columns regroup. The copies drifted, in the way `params.ts` predicted they would.
 * The generator recorded a regrouping only on the column that *triggered* a borrow
 * chain, so the walkthrough it emitted for `4007 − 2888` announced the 7 becoming
 * 17 and then silently asserted that the two zeros were 9s and the 4 was a 3 —
 * which is `mis.add.borrow-across-zero` being demonstrated by the worked example
 * that exists to repair it.
 *
 * So there is one procedure, stated column by column, and both callers read it.
 *
 * Digit arrays are **little-endian**: index 0 is the units column, which is the
 * order the algorithm is performed in.
 */

import { digitAt } from "./digits.ts";

export type SubtractColumn = {
  /** This column has to take ten from the column to its left. */
  readonly borrowed: boolean;
  /**
   * What the column holds once the column to its **right** has taken its ten — the
   * digit a child crosses out and rewrites. Equal to the written digit when nothing
   * was taken from it, and 9 when it is a zero a borrow chain travelled through.
   */
  readonly restated: number;
  /** The value actually subtracted from: `restated`, plus ten when `borrowed`. */
  readonly effective: number;
  /** The difference digit for this column. */
  readonly digit: number;
};

export type SubtractTrace = {
  readonly columns: readonly SubtractColumn[];
  /**
   * False when the borrow runs off the top of the number — the subtrahend is the
   * larger number and the difference would be negative.
   */
  readonly defined: boolean;
};

export type AddColumn = {
  /** This column carries one into the column to its left. */
  readonly carried: boolean;
  /** The value actually added: the top digit plus any carry into this column. */
  readonly effective: number;
  /** The sum digit for this column. */
  readonly digit: number;
};

export type AddTrace = {
  readonly columns: readonly AddColumn[];
  /** The carry out of the top column: one more digit, or zero when there is none. */
  readonly carryOut: number;
};

/**
 * Column subtraction as it is taught: each column takes ten from its left when it
 * cannot subtract, and the column that gives it up is one smaller. A zero that a
 * borrow travels through goes to −1 here and comes back as 9, which is exactly the
 * digit a child writes above it.
 */
export function subtractColumns(
  top: readonly number[],
  bottom: readonly number[],
  cols: number,
): SubtractTrace {
  const columns: SubtractColumn[] = [];
  let taken = 0;

  for (let i = 0; i < cols; i++) {
    const raw = digitAt(top, i) - taken;
    const subtrahend = digitAt(bottom, i);
    const borrowed = raw < subtrahend;
    const restated = raw < 0 ? raw + 10 : raw;
    const effective = borrowed ? raw + 10 : raw;
    columns.push({ borrowed, restated, effective, digit: effective - subtrahend });
    taken = borrowed ? 1 : 0;
  }

  return { columns, defined: taken === 0 };
}

/** Column addition. The carry out of the top column is a further digit. */
export function addColumns(top: readonly number[], bottom: readonly number[], cols: number): AddTrace {
  const columns: AddColumn[] = [];
  let carry = 0;

  for (let i = 0; i < cols; i++) {
    const effective = digitAt(top, i) + carry;
    const sum = effective + digitAt(bottom, i);
    carry = sum >= 10 ? 1 : 0;
    columns.push({ carried: carry === 1, effective, digit: sum % 10 });
  }

  return { columns, carryOut: carry };
}
