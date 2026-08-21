/**
 * `gen.arith.long-div` — sharing and grouping, with the remainder taken seriously.
 *
 * The quotient is drawn and the dividend is multiplied back, so a level can promise
 * "three quotient digits, one of them an interior zero, and something left over"
 * and deliver it on every seed. Drawing a dividend instead would leave both
 * properties to chance, and the interior zero — the digit children drop — would
 * appear on roughly one item in ten.
 *
 * **The mixed-number answer is `as-written`.** `46 ÷ 6` is seven with four left
 * over, written `7 4/6`: the numerator is the remainder and the denominator is the
 * divisor. `7 2/3` is the same number and a different answer, and accepting it
 * would accept a child who has stopped answering the question that was asked.
 * That is the whole reason `AnswerSchema.fraction.equivalence` exists.
 */

import { mul, rational, add as ratAdd } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { Rng } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue } from "../../types/answer.ts";
import type { Exercise, PromptSlot, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { LocKey } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { chooseForm, distractorsFor, judge } from "../shared/build.ts";
import { countSlot, fractionSlot, numberSlot } from "../shared/slots.ts";
import { drawBetween, drawWithDigits } from "../shared/draw.ts";
import { InfeasibleLevelError } from "../shared/errors.ts";
import { MIXED_PARTS, fractionAnswer, fractionSchema } from "../shared/fractions.ts";
import {
  COEFF_DIVISOR_DIGIT,
  COEFF_QUOTIENT_DIGIT,
  COEFF_QUOTIENT_ZEROS,
  COEFF_REMAINDER,
  FORM_OFFSET_FREE_ENTRY,
  LONG_DIV_FAMILY,
  LONG_DIV_FAMILY_REV,
  LONG_DIV_FORMS,
  PROMPT_KEY_QUOTIENT,
  PROMPT_KEY_QUOTIENT_REMAINDER,
  PROMPT_KEY_REMAINDER,
  SLOT_ANSWER,
  SLOT_DIGIT,
  SLOT_DIVIDEND,
  SLOT_DIVISOR,
  SLOT_LEFTOVER,
  SLOT_PARTIAL,
  SLOT_PRODUCT,
  SLOT_REMAINDER,
  SOLUTION_KEY_LEFTOVER,
  SOLUTION_KEY_RESULT,
  SOLUTION_KEY_SETUP,
  SOLUTION_KEY_STEP,
} from "./constants.ts";
import { longDivParamSchema } from "./params.ts";
import type { DivTask, LongDivParams } from "./params.ts";
import { longDivisionSteps } from "./procedure.ts";

const PROMPT_KEYS: Readonly<Record<DivTask, LocKey>> = {
  quotient: PROMPT_KEY_QUOTIENT,
  remainder: PROMPT_KEY_REMAINDER,
  "quotient-and-remainder": PROMPT_KEY_QUOTIENT_REMAINDER,
};

type Draw = {
  readonly dividend: bigint;
  readonly divisor: bigint;
  readonly quotient: bigint;
  readonly remainder: bigint;
};

/**
 * The divisor. Never one: dividing by one produces the dividend and asks nothing,
 * and a level that drew it would serve that item one time in eight.
 */
function drawDivisor(divisorDigits: number, rng: Rng): bigint {
  return divisorDigits === 1 ? BigInt(rng.nextInt(2, 9)) : drawWithDigits(rng, divisorDigits);
}

function drawQuotient(quotientDigits: number, interiorZero: boolean, rng: Rng): bigint {
  const digits: number[] = [];
  for (let index = 0; index < quotientDigits; index++) {
    digits.push(rng.nextInt(index === 0 ? 1 : 0, 9));
  }
  if (interiorZero) {
    // One position, never the leading one, forced to zero. Drawn rather than fixed
    // so a level does not always put the zero in the same column.
    digits[rng.nextInt(1, quotientDigits - 1)] = 0;
  }
  let value = 0n;
  for (const digit of digits) value = value * 10n + BigInt(digit);
  return value;
}

function drawFor(params: LongDivParams, rng: Rng): Draw {
  const divisor = drawDivisor(params.divisorDigits, rng);
  const quotient = drawQuotient(params.quotientDigits, params.quotientZeros, rng);
  const remainder = params.exact ? 0n : drawBetween(rng, 1n, divisor - 1n);
  return { dividend: quotient * divisor + remainder, divisor, quotient, remainder };
}

function schemaFor(params: LongDivParams): AnswerSchema {
  switch (params.task) {
    case "quotient":
      return { kind: "integer", digits: params.quotientDigits, decimalPlaces: 0 };
    case "remainder":
      return { kind: "integer", digits: params.divisorDigits, decimalPlaces: 0 };
    case "quotient-and-remainder":
      return fractionSchema(MIXED_PARTS, "as-written");
  }
}

function answerFor(task: DivTask, draw: Draw): AnswerValue {
  switch (task) {
    case "quotient":
      return { kind: "integer", value: rational(draw.quotient) };
    case "remainder":
      return { kind: "integer", value: rational(draw.remainder) };
    case "quotient-and-remainder":
      return fractionAnswer({ whole: draw.quotient, num: draw.remainder, den: draw.divisor });
  }
}

function answerSlot(task: DivTask, draw: Draw): PromptSlot {
  return task === "quotient-and-remainder"
    ? fractionSlot(draw.remainder, draw.divisor, draw.quotient)
    : numberSlot(task === "quotient" ? draw.quotient : draw.remainder);
}

function solutionFor(task: DivTask, draw: Draw): SolutionStep[] {
  const steps: SolutionStep[] = [
    {
      key: SOLUTION_KEY_SETUP,
      slots: { [SLOT_DIVIDEND]: numberSlot(draw.dividend), [SLOT_DIVISOR]: numberSlot(draw.divisor) },
    },
  ];

  longDivisionSteps(draw.dividend, draw.divisor).forEach((step, index) => {
    steps.push({
      key: SOLUTION_KEY_STEP,
      slots: {
        [SLOT_PARTIAL]: numberSlot(step.partial),
        [SLOT_DIGIT]: countSlot(step.digit),
        [SLOT_PRODUCT]: numberSlot(step.product),
        [SLOT_LEFTOVER]: numberSlot(step.leftover),
      },
      focusColumn: index,
    });
  });

  if (draw.remainder > 0n) {
    steps.push({
      key: SOLUTION_KEY_LEFTOVER,
      slots: { [SLOT_REMAINDER]: numberSlot(draw.remainder), [SLOT_DIVISOR]: numberSlot(draw.divisor) },
    });
  }
  steps.push({ key: SOLUTION_KEY_RESULT, slots: { [SLOT_ANSWER]: answerSlot(task, draw) } });
  return steps;
}

export const longDivFamily: GeneratorFamily<LongDivParams> = {
  family: LONG_DIV_FAMILY,
  familyRev: LONG_DIV_FAMILY_REV,
  paramSchema: longDivParamSchema,
  forms: LONG_DIV_FORMS,
  choiceOnly: false,
  representations: [],

  answerSchema(params: LongDivParams): AnswerSchema {
    return schemaFor(params);
  },

  difficultyOffset(params: LongDivParams): Rational {
    let b = mul(COEFF_DIVISOR_DIGIT, rational(BigInt(params.divisorDigits - 1)));
    b = ratAdd(b, mul(COEFF_QUOTIENT_DIGIT, rational(BigInt(params.quotientDigits - 1))));
    if (!params.exact) b = ratAdd(b, COEFF_REMAINDER);
    if (params.quotientZeros) b = ratAdd(b, COEFF_QUOTIENT_ZEROS);
    return b;
  },

  formOffset(): Rational {
    return FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<LongDivParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(LONG_DIV_FAMILY, LONG_DIV_FAMILY_REV, skillId, level, seed);
    const rng = createRng(seedFrom(exerciseId));

    const form = chooseForm(forms, LONG_DIV_FORMS, rng);
    const draw = drawFor(params, rng);

    // The division identity, asserted on every call. A quotient drawn and
    // multiplied back cannot be wrong, which is exactly why it is worth checking
    // that the item's own dividend still divides the way the item says it does.
    if (draw.quotient * draw.divisor + draw.remainder !== draw.dividend) {
      throw new InfeasibleLevelError(`division identity failed on ${exerciseId}`);
    }
    if (draw.remainder >= draw.divisor) {
      throw new InfeasibleLevelError(`remainder is not smaller than the divisor on ${exerciseId}`);
    }

    const schema = schemaFor(params);
    const base: Exercise = {
      exerciseId,
      skillId,
      level,
      seed,
      family: LONG_DIV_FAMILY,
      familyRev: LONG_DIV_FAMILY_REV,
      form,
      prompt: {
        key: PROMPT_KEYS[params.task],
        slots: {
          [SLOT_DIVIDEND]: numberSlot(draw.dividend),
          [SLOT_DIVISOR]: numberSlot(draw.divisor),
        },
      },
      schema,
      answer: { canonical: answerFor(params.task, draw), alsoAccept: [] },
      distractors: [],
      check: { kind: "exact" },
      solution: solutionFor(params.task, draw),
    };

    return { ...base, distractors: distractorsFor(LONG_DIV_FAMILY, base) };
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    return judge(exercise, submitted);
  },
};
