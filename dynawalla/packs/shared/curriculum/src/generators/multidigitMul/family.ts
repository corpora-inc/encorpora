/**
 * `gen.arith.multidigit-mul` — the multiplication algorithm.
 *
 * The carry structure is drawn first, exactly as `gen.arith.column-op` draws its
 * regrouping pattern first: a level that says its first partial product carries
 * gets that on every seed, rather than on the 80% of seeds a uniform draw would
 * happen to give it. That is what makes `mis.mul.carry-added-before-multiplying`
 * measurable — the bug is instantiated on every item of a carrying level.
 *
 * Both operands are non-negative and the product is checked against exact rational
 * multiplication on every call, so a digit-wise slip cannot be served as an answer.
 */

import { eq as rationalEq, mul as ratMul, mul, pow10, rational, add as ratAdd } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { Rng } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue } from "../../types/answer.ts";
import type { Exercise, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { chooseForm, distractorsFor, judge } from "../shared/build.ts";
import { countSlot, numberSlot } from "../shared/slots.ts";
import { InfeasibleLevelError } from "../shared/errors.ts";
import {
  COEFF_CARRY,
  COEFF_DIGIT_OVER_TWO,
  COEFF_PARTIAL_PRODUCT,
  COEFF_POWER_OF_TEN,
  FORM_OFFSET_FREE_ENTRY,
  MULTIDIGIT_MUL_FAMILY,
  MULTIDIGIT_MUL_FAMILY_REV,
  MULTIDIGIT_MUL_FORMS,
  PROMPT_KEY_PRODUCT,
  SLOT_ANSWER,
  SLOT_BOTTOM,
  SLOT_DIGIT,
  SLOT_PARTIAL,
  SLOT_SHIFT,
  SLOT_TOP,
  SLOT_ZEROS,
  SOLUTION_KEY_ADD_PARTIALS,
  SOLUTION_KEY_PARTIAL,
  SOLUTION_KEY_RESULT,
  SOLUTION_KEY_SETUP,
  SOLUTION_KEY_SHIFT,
} from "./constants.ts";
import { multidigitMulParamSchema } from "./params.ts";
import type { MultidigitMulParams } from "./params.ts";
import { littleEndianDigits } from "./procedure.ts";

type Draw = { readonly top: bigint; readonly bottom: bigint; readonly zeros: number };

/** `ceil(a / b)` for positive integers, in integers. */
function ceilDiv(a: number, b: number): number {
  return (a - (a % b)) / b + (a % b === 0 ? 0 : 1);
}

function fromDigits(digits: readonly number[]): bigint {
  let value = 0n;
  for (const digit of digits) value = value * 10n + BigInt(digit);
  return value;
}

/**
 * A multiplicand and a multiplier whose first partial product carries out of the
 * units column.
 *
 * The units digit of the multiplier is drawn first, and the units digit of the
 * multiplicand is then drawn from the range that forces `d × m ≥ 10`. Drawing both
 * freely and rejecting would make the item stream depend on what was rejected.
 */
function drawCarrying(digits: number, multiplierDigits: number, rng: Rng): Draw {
  const units = rng.nextInt(2, 9);
  const multiplier: number[] = [units];
  for (let index = 1; index < multiplierDigits; index++) {
    multiplier.push(rng.nextInt(index === multiplierDigits - 1 ? 1 : 0, 9));
  }

  const top: number[] = [rng.nextInt(ceilDiv(10, units), 9)];
  for (let index = 1; index < digits; index++) {
    top.push(rng.nextInt(index === digits - 1 ? 1 : 0, 9));
  }

  return { top: fromDigits([...top].reverse()), bottom: fromDigits([...multiplier].reverse()), zeros: 0 };
}

/**
 * A multiplicand and a single-digit multiplier whose product carries nowhere.
 *
 * Every digit must satisfy `d × m ≤ 9`, so the multiplier is drawn from 2..4: at 5
 * and above the only admissible digits are 0 and 1 and the level would pose the
 * same handful of items forever.
 */
function drawNonCarrying(digits: number, rng: Rng): Draw {
  const multiplier = rng.nextInt(2, 4);
  const ceiling = (9 - (9 % multiplier)) / multiplier;
  const top: number[] = [];
  for (let index = 0; index < digits; index++) {
    top.push(rng.nextInt(index === 0 ? 1 : 0, ceiling));
  }
  return { top: fromDigits(top), bottom: BigInt(multiplier), zeros: 0 };
}

function drawPowerOfTen(digits: number, maxPower: number, rng: Rng): Draw {
  const zeros = rng.nextInt(1, maxPower);
  const top: number[] = [];
  for (let index = 0; index < digits; index++) top.push(rng.nextInt(index === 0 ? 1 : 0, 9));
  return { top: fromDigits(top), bottom: pow10(zeros), zeros };
}

function drawFor(params: MultidigitMulParams, rng: Rng): Draw {
  if (params.shape === "power-of-ten") return drawPowerOfTen(params.digits, params.maxPower, rng);
  return params.carries
    ? drawCarrying(params.digits, params.multiplierDigits, rng)
    : drawNonCarrying(params.digits, rng);
}

function answerCapacity(params: MultidigitMulParams): number {
  // The widest product the level can produce, which is the field width and never
  // this item's answer width.
  return params.shape === "power-of-ten"
    ? params.digits + params.maxPower
    : params.digits + params.multiplierDigits;
}

function solutionFor(params: MultidigitMulParams, draw: Draw, answer: bigint): SolutionStep[] {
  const steps: SolutionStep[] = [
    { key: SOLUTION_KEY_SETUP, slots: { [SLOT_TOP]: numberSlot(draw.top), [SLOT_BOTTOM]: numberSlot(draw.bottom) } },
  ];

  if (params.shape === "power-of-ten") {
    steps.push({
      key: SOLUTION_KEY_SHIFT,
      slots: {
        [SLOT_TOP]: numberSlot(draw.top),
        [SLOT_ZEROS]: countSlot(draw.zeros),
        [SLOT_ANSWER]: numberSlot(answer),
      },
    });
    steps.push({ key: SOLUTION_KEY_RESULT, slots: { [SLOT_ANSWER]: numberSlot(answer) } });
    return steps;
  }

  const digits = littleEndianDigits(draw.bottom);
  digits.forEach((digit, index) => {
    steps.push({
      key: SOLUTION_KEY_PARTIAL,
      slots: {
        [SLOT_DIGIT]: countSlot(digit),
        [SLOT_SHIFT]: countSlot(index),
        [SLOT_PARTIAL]: numberSlot(draw.top * BigInt(digit) * pow10(index)),
      },
      focusColumn: index,
    });
  });
  // One partial product *is* the answer; announcing a sum of one term would be the
  // walkthrough inventing a step the child does not take.
  if (digits.length > 1) {
    steps.push({ key: SOLUTION_KEY_ADD_PARTIALS, slots: { [SLOT_ANSWER]: numberSlot(answer) } });
  }
  steps.push({ key: SOLUTION_KEY_RESULT, slots: { [SLOT_ANSWER]: numberSlot(answer) } });
  return steps;
}

export const multidigitMulFamily: GeneratorFamily<MultidigitMulParams> = {
  family: MULTIDIGIT_MUL_FAMILY,
  familyRev: MULTIDIGIT_MUL_FAMILY_REV,
  paramSchema: multidigitMulParamSchema,
  forms: MULTIDIGIT_MUL_FORMS,
  choiceOnly: false,
  representations: [],

  answerSchema(params: MultidigitMulParams): AnswerSchema {
    return { kind: "integer", digits: answerCapacity(params), decimalPlaces: 0 };
  },

  difficultyOffset(params: MultidigitMulParams): Rational {
    let b = mul(COEFF_DIGIT_OVER_TWO, rational(BigInt(params.digits - 2)));
    if (params.shape === "power-of-ten") return ratAdd(b, COEFF_POWER_OF_TEN);
    b = ratAdd(b, mul(COEFF_PARTIAL_PRODUCT, rational(BigInt(params.multiplierDigits - 1))));
    if (params.carries) b = ratAdd(b, COEFF_CARRY);
    return b;
  },

  formOffset(): Rational {
    return FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<MultidigitMulParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(MULTIDIGIT_MUL_FAMILY, MULTIDIGIT_MUL_FAMILY_REV, skillId, level, seed);
    const rng = createRng(seedFrom(exerciseId));

    const form = chooseForm(forms, MULTIDIGIT_MUL_FORMS, rng);
    const draw = drawFor(params, rng);
    const answer = draw.top * draw.bottom;

    // The point of the family, asserted on every call: the digit work and exact
    // rational arithmetic agree.
    if (!rationalEq(ratMul(rational(draw.top), rational(draw.bottom)), rational(answer))) {
      throw new InfeasibleLevelError(`multiplication disagreed with exact arithmetic on ${exerciseId}`);
    }

    const base: Exercise = {
      exerciseId,
      skillId,
      level,
      seed,
      family: MULTIDIGIT_MUL_FAMILY,
      familyRev: MULTIDIGIT_MUL_FAMILY_REV,
      form,
      prompt: {
        key: PROMPT_KEY_PRODUCT,
        slots: { [SLOT_TOP]: numberSlot(draw.top), [SLOT_BOTTOM]: numberSlot(draw.bottom) },
      },
      schema: { kind: "integer", digits: answerCapacity(params), decimalPlaces: 0 },
      answer: { canonical: { kind: "integer", value: rational(answer) }, alsoAccept: [] },
      distractors: [],
      check: { kind: "exact" },
      solution: solutionFor(params, draw, answer),
    };

    return { ...base, distractors: distractorsFor(MULTIDIGIT_MUL_FAMILY, base) };
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    return judge(exercise, submitted);
  },
};
