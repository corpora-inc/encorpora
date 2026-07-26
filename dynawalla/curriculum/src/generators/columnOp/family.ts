/**
 * `gen.arith.column-op` — the column algorithm, add and subtract, with exact
 * regrouping control including regrouping across zeros.
 *
 * How generation works, and why it works this way.
 *
 * The naive approach is to draw two numbers and hope the requested number of
 * regroupings falls out. It does not: "4-digit subtraction borrowing through two
 * zeros" is rare under uniform draws, so a rejection-sampling generator either runs
 * for a long time or quietly serves items that miss the thing the skill is about.
 *
 * So the *regrouping pattern is drawn first* and the digits are then chosen column
 * by column from the ranges that pattern forces. Every item therefore has exactly
 * the requested structure by construction, a difference is never negative (the top
 * column never borrows out), and the only rejection is the degenerate `a − a = 0`
 * draw.
 *
 * All arithmetic is BigInt and `Rational`. The digit-wise result is cross-checked
 * against `Rational` addition/subtraction on every single call — a mismatch throws
 * rather than serving a wrong answer.
 */

import { eq as rationalEq, mul, add as ratAdd, sub as ratSub, rational } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { Rng } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue, ColumnMark } from "../../types/answer.ts";
import { answerEquals } from "../../types/answer.ts";
import type { Distractor, Exercise, PromptSlot, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { FormId } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { classify, malRulesForFamily } from "../../malrules/registry.ts";
import { answerValueFor } from "./answerValue.ts";
import {
  COEFF_DECIMAL_PLACE,
  COEFF_DIGIT_OVER_TWO,
  COEFF_REGROUPING,
  COEFF_ZERO_BORROW_THROUGH,
  COLUMN_OP_FAMILY,
  COLUMN_OP_FAMILY_REV,
  COLUMN_OP_FORMS,
  FORM_COLUMN,
  FORM_OFFSET_COLUMN,
  FORM_OFFSET_FREE_ENTRY,
  MAX_GENERATE_ATTEMPTS,
  PROMPT_KEY_ADD,
  PROMPT_KEY_SUB,
  SLOT_ANSWER,
  SLOT_BOTTOM,
  SLOT_COLUMN,
  SLOT_DIGIT,
  SLOT_TOP,
  SLOT_VALUE,
  SOLUTION_KEY_CARRY,
  SOLUTION_KEY_COLUMN,
  SOLUTION_KEY_REGROUP,
  SOLUTION_KEY_RESULT,
  SOLUTION_KEY_SETUP,
} from "./constants.ts";
import { digitsToRational, fromDigits } from "./digits.ts";
import { chainRegroupings, columnOpParamSchema, extraRegroupColumns } from "./params.ts";
import type { ColumnOpParams } from "./params.ts";

/** Thrown when a parameter set reaches generation that no digit assignment satisfies. */
export class InfeasibleParamsError extends Error {}

type Draw = {
  readonly top: number[];
  readonly bottom: number[];
  readonly result: number[];
  /** Did column `i` regroup (borrow out for `sub`, carry out for `add`)? */
  readonly regrouped: boolean[];
  /** The value actually worked with in column `i` (10..18 after a borrow). */
  readonly effectiveTop: number[];
  readonly marks: ColumnMark[];
};

function at(digits: readonly number[], index: number): number {
  return digits[index] ?? 0;
}

function pickInt(rng: Rng, lo: number, hi: number, what: string): number {
  if (lo > hi) {
    throw new InfeasibleParamsError(`${what}: empty digit range ${String(lo)}..${String(hi)}`);
  }
  return rng.nextInt(lo, hi);
}

/** Choose which columns regroup: the across-zero chain first, then extra columns. */
function regroupPattern(params: ColumnOpParams, rng: Rng): { regroup: boolean[]; zeroCols: Set<number> } {
  const regroup = new Array<boolean>(params.digits).fill(false);
  const zeroCols = new Set<number>();

  if (params.op === "sub" && params.acrossZero > 0) {
    // Columns 0..acrossZero all borrow out; columns 1..acrossZero are zeros in the
    // minuend, so the borrow travels through them to the digit above the run.
    for (let i = 0; i <= params.acrossZero; i++) regroup[i] = true;
    for (let i = 1; i <= params.acrossZero; i++) zeroCols.add(i);
  }

  const extra = params.regroupings - chainRegroupings(params);
  if (extra > 0) {
    const candidates = extraRegroupColumns(params);
    if (extra > candidates.length) {
      throw new InfeasibleParamsError(
        `cannot place ${String(extra)} further regrouping(s) in ${String(candidates.length)} column(s)`,
      );
    }
    for (const column of rng.sample(candidates, extra)) regroup[column] = true;
  }
  return { regroup, zeroCols };
}

function drawSub(params: ColumnOpParams, rng: Rng): Draw {
  const { digits: cols, operandDigits } = params;
  const { regroup, zeroCols } = regroupPattern(params, rng);

  const top: number[] = [];
  const bottom: number[] = [];

  for (let i = 0; i < cols; i++) {
    const incoming = i > 0 && regroup[i - 1] === true ? 1 : 0;
    const outgoing = regroup[i] === true ? 1 : 0;
    const isTopColumn = i === cols - 1;
    const hasBottom = i < operandDigits;
    const isBottomLead = i === operandDigits - 1;
    const forcedZero = zeroCols.has(i);

    let mLo = isTopColumn ? 1 : 0;
    let mHi = 9;
    if (outgoing === 1) {
      // Borrowing needs bottom > top − incoming, and a bottom digit is at most 9.
      mHi = Math.min(mHi, 8 + incoming);
      if (!hasBottom) {
        // Nothing to subtract here, so the only way this column borrows is as part
        // of a zero run: the digit is 0 and the borrow came in from the right.
        if (incoming !== 1) {
          throw new InfeasibleParamsError(`column ${String(i)} cannot borrow with no bottom digit`);
        }
        mLo = 0;
        mHi = 0;
      }
    } else {
      mLo = Math.max(mLo, incoming + (isBottomLead ? 1 : 0));
    }
    if (forcedZero) {
      mLo = 0;
      mHi = 0;
    }
    const m = pickInt(rng, mLo, mHi, `sub top digit ${String(i)}`);

    let s: number;
    if (!hasBottom) {
      s = 0;
    } else if (outgoing === 1) {
      s = pickInt(rng, Math.max(m - incoming + 1, isBottomLead ? 1 : 0), 9, `sub bottom digit ${String(i)}`);
    } else {
      s = pickInt(rng, isBottomLead ? 1 : 0, m - incoming, `sub bottom digit ${String(i)}`);
    }

    top.push(m);
    bottom.push(s);
  }

  // Run the *correct* procedure for the result digits and the regrouping marks.
  const work = [...top];
  const result: number[] = [];
  const regrouped: boolean[] = [];
  const effectiveTop: number[] = [];
  const marks: ColumnMark[] = [];

  for (let i = 0; i < cols; i++) {
    let t = at(work, i);
    const s = at(bottom, i);
    if (t < s) {
      let j = i + 1;
      while (j < cols && at(work, j) === 0) {
        work[j] = 9;
        j += 1;
      }
      if (j >= cols) throw new InfeasibleParamsError(`column ${String(i)} has nothing to borrow from`);
      work[j] = at(work, j) - 1;
      t += 10;
      regrouped.push(true);
    } else {
      regrouped.push(false);
    }
    effectiveTop.push(t);
    result.push(t - s);
  }
  for (let j = 0; j < cols; j++) {
    if (at(work, j) !== at(top, j)) marks.push({ column: j, kind: "borrow", value: at(work, j) });
  }

  return { top, bottom, result, regrouped, effectiveTop, marks };
}

function drawAdd(params: ColumnOpParams, rng: Rng): Draw {
  const { digits: cols, operandDigits } = params;
  const { regroup } = regroupPattern(params, rng);

  const top: number[] = [];
  const bottom: number[] = [];

  for (let i = 0; i < cols; i++) {
    const incoming = i > 0 && regroup[i - 1] === true ? 1 : 0;
    const outgoing = regroup[i] === true ? 1 : 0;
    const isTopColumn = i === cols - 1;
    const hasBottom = i < operandDigits;
    const isBottomLead = i === operandDigits - 1;

    let mLo = isTopColumn ? 1 : 0;
    let mHi = 9;
    if (outgoing === 1) {
      mLo = Math.max(mLo, 1 - incoming);
      // With no bottom digit the only way to carry is 9 + an incoming carry.
      if (!hasBottom) mLo = Math.max(mLo, 10 - incoming);
    } else {
      mHi = Math.min(mHi, 9 - incoming - (isBottomLead ? 1 : 0));
    }
    const m = pickInt(rng, mLo, mHi, `add top digit ${String(i)}`);

    let s: number;
    if (!hasBottom) {
      s = 0;
    } else if (outgoing === 1) {
      s = pickInt(rng, Math.max(10 - incoming - m, isBottomLead ? 1 : 0), 9, `add bottom digit ${String(i)}`);
    } else {
      s = pickInt(rng, isBottomLead ? 1 : 0, 9 - incoming - m, `add bottom digit ${String(i)}`);
    }

    top.push(m);
    bottom.push(s);
  }

  const result: number[] = [];
  const regrouped: boolean[] = [];
  const effectiveTop: number[] = [];
  const marks: ColumnMark[] = [];
  let carry = 0;

  for (let i = 0; i < cols; i++) {
    const sum = at(top, i) + at(bottom, i) + carry;
    effectiveTop.push(at(top, i) + carry);
    result.push(sum % 10);
    carry = sum >= 10 ? 1 : 0;
    regrouped.push(carry === 1);
    if (carry === 1) marks.push({ column: i + 1, kind: "carry", value: 1 });
  }
  // The final carry occupies one more column; it is 0 when there was none.
  result.push(carry);

  return { top, bottom, result, regrouped, effectiveTop, marks };
}

function answerDigitCapacity(params: ColumnOpParams): number {
  // The *field* width, never the width of this item's answer. Sizing the field to
  // the answer would tell a child how many digits it has (ARCHITECTURE L3).
  return params.op === "add" ? params.digits + 1 : params.digits;
}

function schemaFor(params: ColumnOpParams, form: FormId): AnswerSchema {
  if (form === FORM_COLUMN) {
    return {
      kind: "columnAlgorithm",
      cols: answerDigitCapacity(params),
      marks: params.op === "sub" ? "borrow" : "carry",
      decimalPlaces: params.decimalPlaces,
    };
  }
  return { kind: "integer", digits: answerDigitCapacity(params), decimalPlaces: params.decimalPlaces };
}

function numberSlot(value: Rational, decimalPlaces: number): PromptSlot {
  return { kind: "number", value, decimalPlaces };
}

function countSlot(value: number): PromptSlot {
  return { kind: "count", value };
}

function solutionFor(
  params: ColumnOpParams,
  draw: Draw,
  topValue: Rational,
  bottomValue: Rational,
  answer: Rational,
): SolutionStep[] {
  const dp = params.decimalPlaces;
  const steps: SolutionStep[] = [
    {
      key: SOLUTION_KEY_SETUP,
      slots: { [SLOT_TOP]: numberSlot(topValue, dp), [SLOT_BOTTOM]: numberSlot(bottomValue, dp) },
    },
  ];

  for (let i = 0; i < params.digits; i++) {
    const regrouped = draw.regrouped[i] === true;
    if (params.op === "sub" && regrouped) {
      steps.push({
        key: SOLUTION_KEY_REGROUP,
        slots: { [SLOT_COLUMN]: countSlot(i), [SLOT_VALUE]: countSlot(at(draw.effectiveTop, i)) },
        focusColumn: i,
      });
    }
    steps.push({
      key: SOLUTION_KEY_COLUMN,
      slots: {
        [SLOT_COLUMN]: countSlot(i),
        [SLOT_TOP]: countSlot(at(draw.effectiveTop, i)),
        [SLOT_BOTTOM]: countSlot(at(draw.bottom, i)),
        [SLOT_DIGIT]: countSlot(at(draw.result, i)),
      },
      focusColumn: i,
    });
    if (params.op === "add" && regrouped) {
      steps.push({
        key: SOLUTION_KEY_CARRY,
        slots: { [SLOT_COLUMN]: countSlot(i + 1), [SLOT_VALUE]: countSlot(1) },
        focusColumn: i + 1,
      });
    }
  }

  steps.push({ key: SOLUTION_KEY_RESULT, slots: { [SLOT_ANSWER]: numberSlot(answer, dp) } });
  return steps;
}

function distractorsFor(exercise: Exercise): Distractor[] {
  const canonical = exercise.answer.canonical;
  const out: Distractor[] = [];
  for (const rule of malRulesForFamily(COLUMN_OP_FAMILY)) {
    if (!rule.applies(exercise)) continue;
    const produced = rule.apply(exercise);
    if (produced === null) continue;
    // A buggy procedure that lands on the right answer for this item is not a
    // distractor, and neither is a duplicate of one already offered.
    if (answerEquals(produced, canonical)) continue;
    if (out.some((d) => answerEquals(d.value, produced))) continue;
    out.push({ value: produced, misconception: rule.id });
  }
  return out;
}

function pickForm(forms: readonly FormId[], rng: Rng): FormId {
  const first = forms[0];
  if (first === undefined) throw new InfeasibleParamsError("binding declares no forms");
  for (const form of forms) {
    if (!(COLUMN_OP_FORMS as readonly string[]).includes(form)) {
      throw new InfeasibleParamsError(`unknown form ${JSON.stringify(form)}`);
    }
  }
  return forms.length === 1 ? first : rng.pick(forms);
}

export const columnOpFamily: GeneratorFamily<ColumnOpParams> = {
  family: COLUMN_OP_FAMILY,
  familyRev: COLUMN_OP_FAMILY_REV,
  paramSchema: columnOpParamSchema,
  forms: COLUMN_OP_FORMS,
  choiceOnly: false,
  representations: [],

  answerSchema(params: ColumnOpParams, form: FormId): AnswerSchema {
    return schemaFor(params, form);
  },

  difficultyOffset(params: ColumnOpParams): Rational {
    let b = mul(COEFF_REGROUPING, rational(BigInt(params.regroupings)));
    b = ratAdd(b, mul(COEFF_DIGIT_OVER_TWO, rational(BigInt(params.digits - 2))));
    b = ratAdd(b, mul(COEFF_ZERO_BORROW_THROUGH, rational(BigInt(params.acrossZero))));
    b = ratAdd(b, mul(COEFF_DECIMAL_PLACE, rational(BigInt(params.decimalPlaces))));
    return b;
  },

  formOffset(form: FormId): Rational {
    return form === FORM_COLUMN ? FORM_OFFSET_COLUMN : FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<ColumnOpParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(COLUMN_OP_FAMILY, COLUMN_OP_FAMILY_REV, skillId, level, seed);

    for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
      const rng = createRng(seedFrom(exerciseId, String(attempt)));
      const form = pickForm(forms, rng);
      const draw = params.op === "sub" ? drawSub(params, rng) : drawAdd(params, rng);

      const dp = params.decimalPlaces;
      const topValue = digitsToRational(draw.top, dp);
      const bottomValue = digitsToRational(draw.bottom, dp);
      const answer = digitsToRational(draw.result, dp);

      // The whole point of the family, asserted on every call: the digit-wise
      // column algorithm and exact rational arithmetic agree.
      const exact = params.op === "sub" ? ratSub(topValue, bottomValue) : ratAdd(topValue, bottomValue);
      if (!rationalEq(exact, answer)) {
        throw new Error(`column algorithm disagreed with exact arithmetic on ${exerciseId}`);
      }
      if (fromDigits(draw.result) === 0n && !params.allowZeroResult) continue;

      const schema = schemaFor(params, form);
      const canonical = answerValueFor(schema, answer, draw.marks);
      const alsoAccept: AnswerValue[] =
        schema.kind === "columnAlgorithm"
          ? // A child who regroups mentally and writes only the digits is right.
            [answerValueFor(schema, answer, [])]
          : [];

      const base: Exercise = {
        exerciseId,
        skillId,
        level,
        seed,
        family: COLUMN_OP_FAMILY,
        familyRev: COLUMN_OP_FAMILY_REV,
        form,
        prompt: {
          key: params.op === "sub" ? PROMPT_KEY_SUB : PROMPT_KEY_ADD,
          slots: {
            [SLOT_TOP]: numberSlot(topValue, dp),
            [SLOT_BOTTOM]: numberSlot(bottomValue, dp),
          },
        },
        schema,
        answer: { canonical, alsoAccept },
        distractors: [],
        check: { kind: "exact" },
        solution: solutionFor(params, draw, topValue, bottomValue, answer),
      };

      return { ...base, distractors: distractorsFor(base) };
    }

    throw new InfeasibleParamsError(
      `every draw for ${exerciseId} was degenerate after ${String(MAX_GENERATE_ATTEMPTS)} attempts`,
    );
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    if (answerEquals(submitted, exercise.answer.canonical)) return { correct: true };
    for (const accepted of exercise.answer.alsoAccept) {
      if (answerEquals(submitted, accepted)) return { correct: true };
    }
    const misconception = classify(exercise, submitted);
    return misconception === null ? { correct: false } : { correct: false, misconception };
  },
};
