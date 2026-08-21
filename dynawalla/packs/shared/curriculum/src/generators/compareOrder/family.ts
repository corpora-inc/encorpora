/**
 * `gen.number.compare-order` — which of two numbers is the greater, over whole
 * numbers, fractions and decimals.
 *
 * One family across three number types because comparison is one idea and the
 * three types differ only in what "line them up" means: place columns for whole
 * numbers, place columns after a point for decimals, a common denominator for
 * fractions. CURRICULUM.md asks for exactly this shape.
 *
 * **The answer is the number, not a symbol.** "Type < or >" would be a closed list
 * of three, which is the choice laundering CG-13 exists to stop. Writing the
 * greater number down is also the stronger task: it requires deciding *and*
 * transcribing, and it never has a 33% floor.
 *
 * Two items are never equal in value. An equal pair has no greater member, so the
 * question would have no answer, and it is the one draw on which the whole-number
 * bias rule cannot be wrong.
 */

import { cmp, mul, pow10, rational, add as ratAdd, toScaled } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { Rng } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue } from "../../types/answer.ts";
import type { Exercise, PromptSlot, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { chooseForm, distractorsFor, judge } from "../shared/build.ts";
import { decimalSlot, fractionSlot, numberSlot, termSlot } from "../shared/slots.ts";
import { drawBetween, drawBetweenExcluding, drawWithDigits } from "../shared/draw.ts";
import { InfeasibleLevelError } from "../shared/errors.ts";
import { lcm, PROPER_PARTS, fractionSchema } from "../shared/fractions.ts";
import { placeTerm } from "../shared/placeTerms.ts";
import {
  COEFF_DECIMAL_PLACE,
  COEFF_DENOMINATOR,
  COEFF_DIGIT_OVER_TWO,
  COEFF_SAME_NUMERATOR,
  COEFF_SHARED_PREFIX,
  COMPARE_ORDER_FAMILY,
  COMPARE_ORDER_FAMILY_REV,
  COMPARE_ORDER_FORMS,
  FORM_OFFSET_FREE_ENTRY,
  PROMPT_KEY_GREATER,
  PROMPT_KEY_LESSER,
  SLOT_ANSWER,
  SLOT_DENOMINATOR,
  SLOT_LEFT,
  SLOT_LEFT_SCALED,
  SLOT_PLACE,
  SLOT_RIGHT,
  SLOT_RIGHT_SCALED,
  SOLUTION_KEY_COMMON_DENOMINATOR,
  SOLUTION_KEY_FIRST_DIFFERENCE,
  SOLUTION_KEY_LINE_UP,
  SOLUTION_KEY_RESULT,
  SOLUTION_KEY_SAME_NUMERATOR,
} from "./constants.ts";
import { compareOrderParamSchema } from "./params.ts";
import type { CompareOrderParams } from "./params.ts";
import { operandAnswer, operandValue } from "./read.ts";
import type { CompareOperand } from "./read.ts";

type Pair = { readonly left: CompareOperand; readonly right: CompareOperand };

/** An operand, written the way it is written — a decimal, or a fraction. */
function operandSlot(operand: CompareOperand): PromptSlot {
  return operand.kind === "number"
    ? decimalSlot(operand.value, operand.decimalPlaces)
    : fractionSlot(operand.num, operand.den);
}

function numberOperand(value: bigint, decimalPlaces: number): CompareOperand {
  return { kind: "number", value: rational(value, pow10(decimalPlaces)), decimalPlaces };
}

/**
 * Two whole numbers of the same written width, agreeing on `sharedPrefix` leading
 * digits and differing somewhere after that.
 *
 * Same width on purpose: with different widths the comparison is decided by
 * counting digits, which is a different (and much easier) skill, and it would also
 * make "the longer number is the bigger one" *correct* — the misconception this
 * family exists to confront survives only where it is wrong.
 */
function drawWhole(digits: number, sharedPrefix: number, rng: Rng): Pair {
  const left = drawWithDigits(rng, digits);
  const tailLength = digits - sharedPrefix;
  const unit = pow10(tailLength);

  // With no shared prefix the "tail" is the whole number, so it keeps the
  // leading-digit rule; otherwise the tail may start with any digit.
  const tailLo = sharedPrefix === 0 ? pow10(digits - 1) : 0n;
  const tailHi = sharedPrefix === 0 ? pow10(digits) - 1n : unit - 1n;
  const rightTail = drawBetweenExcluding(rng, tailLo, tailHi, left % unit);
  const right = sharedPrefix === 0 ? rightTail : (left / unit) * unit + rightTail;

  return { left: numberOperand(left, 0), right: numberOperand(right, 0) };
}

/**
 * Two decimals with the same whole part, one written to more places than the
 * other, and the **longer one is the smaller number**.
 *
 * That is a declared content decision, not a filter. `0.5` against `0.125` is the
 * item that tells you whether a child is reading the digits after the point as a
 * whole number; `0.5` against `0.625` is an item they can get right while holding
 * exactly that belief. A diagnostic level poses the discriminating item, which is
 * also what makes `mis.dec.longer-is-bigger` wrong on every item of the level
 * without the rule ever inspecting the answer.
 */
function drawDecimal(digits: number, shortPlaces: number, gap: number, rng: Rng): Pair {
  const longPlaces = shortPlaces + gap;
  const whole = drawWithDigits(rng, digits);

  const shortFraction = drawBetween(rng, 1n, pow10(shortPlaces) - 1n);
  // Strictly less, as an exact comparison at the finer grid: the long number's
  // fractional part is worth less than the short one's.
  const longCeiling = shortFraction * pow10(gap) - 1n;
  if (longCeiling < 1n) throw new InfeasibleLevelError("no decimal is strictly between zero and this one");
  const longFraction = drawBetween(rng, 1n, longCeiling);

  return {
    left: numberOperand(whole * pow10(shortPlaces) + shortFraction, shortPlaces),
    right: numberOperand(whole * pow10(longPlaces) + longFraction, longPlaces),
  };
}

/** Two proper fractions with the same numerator and different denominators. */
function drawSameNumerator(maxDenominator: number, rng: Rng): Pair {
  const num = BigInt(rng.nextInt(1, maxDenominator - 2));
  const lo = num + 1n;
  const hi = BigInt(maxDenominator);
  const first = drawBetween(rng, lo, hi);
  const second = drawBetweenExcluding(rng, lo, hi, first);
  return {
    left: { kind: "fraction", num, den: first },
    right: { kind: "fraction", num, den: second },
  };
}

/**
 * Two proper fractions of different value.
 *
 * A value has at most one writing with a given denominator, so the right operand's
 * numerator is drawn from its range with that one writing removed. The single
 * denominator that admits nothing — halves, when the left operand is already one
 * half — steps up by one rather than retrying, because a retry loop's draw count
 * depends on what it rejected and every later draw would shift with it.
 */
function drawUnlikeFractions(maxDenominator: number, rng: Rng): Pair {
  const leftDen = drawBetween(rng, 2n, BigInt(maxDenominator));
  const leftNum = drawBetween(rng, 1n, leftDen - 1n);

  let rightDen = drawBetween(rng, 2n, BigInt(maxDenominator));
  // The numerator that would make the two fractions equal, when it is a whole one.
  const sameValueNumerator = (den: bigint): bigint | null =>
    (leftNum * den) % leftDen === 0n ? (leftNum * den) / leftDen : null;

  if (rightDen === 2n && sameValueNumerator(2n) === 1n) {
    rightDen = 3n;
    if (BigInt(maxDenominator) < 3n) throw new InfeasibleLevelError("halves alone hold one proper fraction");
  }

  const blocked = sameValueNumerator(rightDen);
  const rightNum =
    blocked === null
      ? drawBetween(rng, 1n, rightDen - 1n)
      : drawBetweenExcluding(rng, 1n, rightDen - 1n, blocked);

  return {
    left: { kind: "fraction", num: leftNum, den: leftDen },
    right: { kind: "fraction", num: rightNum, den: rightDen },
  };
}

function drawPair(params: CompareOrderParams, rng: Rng): Pair {
  switch (params.numberType) {
    case "whole":
      return drawWhole(params.digits, params.sharedPrefix, rng);
    case "decimal":
      return drawDecimal(params.digits, params.decimalPlaces, params.placeGap, rng);
    case "fraction":
      return params.sameNumerator
        ? drawSameNumerator(params.maxDenominator, rng)
        : drawUnlikeFractions(params.maxDenominator, rng);
  }
}

function schemaFor(params: CompareOrderParams): AnswerSchema {
  switch (params.numberType) {
    case "whole":
      return { kind: "integer", digits: params.digits, decimalPlaces: 0 };
    case "decimal":
      // The field holds the longer writing; a child who answers with the shorter
      // one writes fewer digits into the same field and the values still compare
      // exactly, because comparison is on the rational and not on the characters.
      return {
        kind: "integer",
        digits: params.digits + params.decimalPlaces + params.placeGap,
        decimalPlaces: params.decimalPlaces + params.placeGap,
      };
    case "fraction":
      // As written: the answer is one of the two fractions on the card, exactly as
      // it is written there. Accepting any equivalent would accept a child who
      // rewrote `2/6` as `1/3` — right about the value, and no longer answering
      // the question that was asked.
      return fractionSchema(PROPER_PARTS, "as-written");
  }
}

/** The place, counted from the units column, where two written numbers first differ. */
function firstDifferingPlace(left: bigint, right: bigint, places: number): number {
  const width = Math.max(left.toString().length, right.toString().length);
  for (let index = width - 1; index >= 0; index--) {
    const unit = pow10(index);
    if ((left / unit) % 10n !== (right / unit) % 10n) return index - places;
  }
  return -places;
}

function solutionFor(params: CompareOrderParams, pair: Pair, answer: CompareOperand): SolutionStep[] {
  const steps: SolutionStep[] = [
    {
      key: SOLUTION_KEY_LINE_UP,
      slots: { [SLOT_LEFT]: operandSlot(pair.left), [SLOT_RIGHT]: operandSlot(pair.right) },
    },
  ];

  if (params.numberType === "fraction") {
    if (params.sameNumerator) {
      steps.push({
        key: SOLUTION_KEY_SAME_NUMERATOR,
        slots: { [SLOT_LEFT]: operandSlot(pair.left), [SLOT_RIGHT]: operandSlot(pair.right) },
      });
    } else if (pair.left.kind === "fraction" && pair.right.kind === "fraction") {
      const common = lcm(pair.left.den, pair.right.den);
      steps.push({
        key: SOLUTION_KEY_COMMON_DENOMINATOR,
        slots: {
          [SLOT_DENOMINATOR]: numberSlot(common),
          [SLOT_LEFT_SCALED]: fractionSlot(pair.left.num * (common / pair.left.den), common),
          [SLOT_RIGHT_SCALED]: fractionSlot(pair.right.num * (common / pair.right.den), common),
        },
      });
    }
  } else if (pair.left.kind === "number" && pair.right.kind === "number") {
    const places = Math.max(pair.left.decimalPlaces, pair.right.decimalPlaces);
    const leftScaled = toScaled(pair.left.value, places);
    const rightScaled = toScaled(pair.right.value, places);
    const term = leftScaled === null || rightScaled === null
      ? null
      : placeTerm(firstDifferingPlace(leftScaled, rightScaled, places));
    if (term !== null) {
      steps.push({
        key: SOLUTION_KEY_FIRST_DIFFERENCE,
        slots: {
          [SLOT_PLACE]: termSlot(term),
          [SLOT_LEFT]: operandSlot(pair.left),
          [SLOT_RIGHT]: operandSlot(pair.right),
        },
      });
    }
  }

  steps.push({ key: SOLUTION_KEY_RESULT, slots: { [SLOT_ANSWER]: operandSlot(answer) } });
  return steps;
}

export const compareOrderFamily: GeneratorFamily<CompareOrderParams> = {
  family: COMPARE_ORDER_FAMILY,
  familyRev: COMPARE_ORDER_FAMILY_REV,
  paramSchema: compareOrderParamSchema,
  forms: COMPARE_ORDER_FORMS,
  choiceOnly: false,
  representations: [],

  answerSchema(params: CompareOrderParams): AnswerSchema {
    return schemaFor(params);
  },

  difficultyOffset(params: CompareOrderParams): Rational {
    if (params.numberType === "fraction") {
      let b = mul(COEFF_DENOMINATOR, rational(BigInt(params.maxDenominator)));
      if (params.sameNumerator) b = ratAdd(b, COEFF_SAME_NUMERATOR);
      return b;
    }
    let b = mul(COEFF_DIGIT_OVER_TWO, rational(BigInt(params.digits - 2)));
    b = ratAdd(b, mul(COEFF_SHARED_PREFIX, rational(BigInt(params.numberType === "whole" ? params.sharedPrefix : 0))));
    if (params.numberType === "decimal") {
      b = ratAdd(b, mul(COEFF_DECIMAL_PLACE, rational(BigInt(params.decimalPlaces + params.placeGap))));
    }
    return b;
  },

  formOffset(): Rational {
    return FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<CompareOrderParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(COMPARE_ORDER_FAMILY, COMPARE_ORDER_FAMILY_REV, skillId, level, seed);
    const rng = createRng(seedFrom(exerciseId));

    const form = chooseForm(forms, COMPARE_ORDER_FORMS, rng);
    const pair = drawPair(params, rng);

    const order = cmp(operandValue(pair.left), operandValue(pair.right));
    if (order === 0) {
      throw new InfeasibleLevelError(`equal operands on ${exerciseId}: a comparison with no answer`);
    }
    const greater = order > 0 ? pair.left : pair.right;
    const lesser = order > 0 ? pair.right : pair.left;
    const answer = params.task === "greater" ? greater : lesser;

    const schema = schemaFor(params);
    const base: Exercise = {
      exerciseId,
      skillId,
      level,
      seed,
      family: COMPARE_ORDER_FAMILY,
      familyRev: COMPARE_ORDER_FAMILY_REV,
      form,
      prompt: {
        key: params.task === "greater" ? PROMPT_KEY_GREATER : PROMPT_KEY_LESSER,
        slots: { [SLOT_LEFT]: operandSlot(pair.left), [SLOT_RIGHT]: operandSlot(pair.right) },
      },
      schema,
      answer: { canonical: operandAnswer(answer), alsoAccept: [] },
      distractors: [],
      check: { kind: "exact" },
      solution: solutionFor(params, pair, answer),
    };

    return { ...base, distractors: distractorsFor(COMPARE_ORDER_FAMILY, base) };
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    return judge(exercise, submitted);
  },
};
