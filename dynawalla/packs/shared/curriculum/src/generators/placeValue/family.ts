/**
 * `gen.number.place-value-decompose` — what a digit is worth, which digit sits in a
 * place, and how many of a unit a number holds altogether.
 *
 * The three tasks are one family because they are one idea asked three ways, and
 * because the misconception that matters here — reading the *digit* where the
 * question asked for the *quantity* — is only visible when the same number is
 * asked about both ways.
 *
 * Two ambiguity traps are closed by construction rather than by hoping:
 *
 * - The question names the **place**, never the digit. "In 4737, what is the digit
 *   7 worth?" has two answers; "what is the digit in the hundreds place worth?" has
 *   one, whatever the digits happen to be.
 * - `digit-value` never asks about a place holding a zero. "What is the 0 in the
 *   hundreds place worth?" is a real question with the answer 0, and it is also the
 *   one item on which the digit-for-value mal-rule produces the correct answer, so
 *   it would be a distractor that is right.
 */

import { mul, pow10, rational, add as ratAdd } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { Rng } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue } from "../../types/answer.ts";
import type { Exercise, PromptSlot, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { LocKey } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { chooseForm, distractorsFor, judge } from "../shared/build.ts";
import { countSlot, numberSlot, termSlot } from "../shared/slots.ts";
import { InfeasibleLevelError } from "../shared/errors.ts";
import {
  COEFF_DIGIT_OVER_TWO,
  COEFF_PLACE,
  COEFF_REGROUPED_COUNT,
  COEFF_SPECIAL_CASE,
  FORM_OFFSET_FREE_ENTRY,
  PLACE_TERM_KEYS,
  PLACE_VALUE_FAMILY,
  PLACE_VALUE_FAMILY_REV,
  PLACE_VALUE_FORMS,
  PROMPT_KEY_DIGIT_IN_PLACE,
  PROMPT_KEY_DIGIT_VALUE,
  PROMPT_KEY_TOTAL_IN_PLACE,
  SLOT_ANSWER,
  SLOT_DIGIT,
  SLOT_NUMBER,
  SLOT_PLACE,
  SLOT_REST,
  SLOT_UNIT,
  SOLUTION_KEY_GROUP,
  SOLUTION_KEY_LOCATE,
  SOLUTION_KEY_RESULT,
  SOLUTION_KEY_UNIT_WORTH,
} from "./constants.ts";
import { placeValueParamSchema } from "./params.ts";
import type { PlaceValueParams, PlaceValueTask } from "./params.ts";


const PROMPT_KEYS: Readonly<Record<PlaceValueTask, LocKey>> = {
  "digit-value": PROMPT_KEY_DIGIT_VALUE,
  "digit-in-place": PROMPT_KEY_DIGIT_IN_PLACE,
  "total-in-place": PROMPT_KEY_TOTAL_IN_PLACE,
};

function placeSlot(place: number): PromptSlot {
  const key = PLACE_TERM_KEYS[place];
  if (key === undefined) throw new InfeasibleLevelError(`no place name for place ${String(place)}`);
  return termSlot(key);
}

/**
 * Draw the number, digit by digit, most significant first.
 *
 * Digit-wise rather than one draw over a range because `digit-value` has to be able
 * to force one particular column non-zero, and forcing it after a whole-number draw
 * would either bias the low digits or need a retry loop whose draw count depends on
 * what it rejected — which makes the rest of the stream depend on a rejected value.
 */
function drawNumber(params: PlaceValueParams, place: number, rng: Rng): bigint {
  const { digits, task } = params;
  const cells: number[] = [];
  for (let index = 0; index < digits; index++) {
    // Index 0 is the most significant digit and may not be zero, or the number
    // would be written with fewer digits than the level asked for.
    cells.push(rng.nextInt(index === 0 ? 1 : 0, 9));
  }
  if (task === "digit-value") {
    const column = digits - 1 - place;
    if (cells[column] === 0) cells[column] = rng.nextInt(1, 9);
  }
  let value = 0n;
  for (const cell of cells) value = value * 10n + BigInt(cell);
  return value;
}

function answerFor(task: PlaceValueTask, value: bigint, place: number): bigint {
  const unit = pow10(place);
  const digit = (value / unit) % 10n;
  switch (task) {
    case "digit-value":
      return digit * unit;
    case "digit-in-place":
      return digit;
    case "total-in-place":
      return value / unit;
  }
}

function answerCapacity(params: PlaceValueParams): number {
  // The field width, never this item's answer width: a field sized to the answer
  // tells the child how many digits it has.
  return params.task === "digit-in-place" ? 1 : params.digits;
}

function solutionFor(task: PlaceValueTask, value: bigint, place: number, answer: bigint): SolutionStep[] {
  const unit = pow10(place);
  const digit = (value / unit) % 10n;
  const steps: SolutionStep[] = [
    {
      key: SOLUTION_KEY_LOCATE,
      slots: { [SLOT_NUMBER]: numberSlot(value), [SLOT_PLACE]: placeSlot(place) },
      focusColumn: place,
    },
  ];

  if (task === "digit-value") {
    steps.push({
      key: SOLUTION_KEY_UNIT_WORTH,
      slots: {
        [SLOT_DIGIT]: countSlot(digit),
        [SLOT_PLACE]: placeSlot(place),
        [SLOT_UNIT]: numberSlot(unit),
        [SLOT_ANSWER]: numberSlot(answer),
      },
      focusColumn: place,
    });
  }
  if (task === "total-in-place") {
    steps.push({
      key: SOLUTION_KEY_GROUP,
      slots: {
        [SLOT_NUMBER]: numberSlot(value),
        [SLOT_UNIT]: numberSlot(unit),
        [SLOT_ANSWER]: numberSlot(answer),
        [SLOT_REST]: numberSlot(value % unit),
      },
      focusColumn: place,
    });
  }

  steps.push({ key: SOLUTION_KEY_RESULT, slots: { [SLOT_ANSWER]: numberSlot(answer) } });
  return steps;
}

export const placeValueFamily: GeneratorFamily<PlaceValueParams> = {
  family: PLACE_VALUE_FAMILY,
  familyRev: PLACE_VALUE_FAMILY_REV,
  paramSchema: placeValueParamSchema,
  forms: PLACE_VALUE_FORMS,
  choiceOnly: false,
  representations: [],

  answerSchema(params: PlaceValueParams): AnswerSchema {
    return { kind: "integer", digits: answerCapacity(params), decimalPlaces: 0 };
  },

  difficultyOffset(params: PlaceValueParams): Rational {
    let b = mul(COEFF_DIGIT_OVER_TWO, rational(BigInt(params.digits - 2)));
    // The midpoint of the drawn place range. An integer range's midpoint is a half
    // as often as not, which is why it is exact rather than rounded.
    b = ratAdd(b, mul(COEFF_PLACE, rational(BigInt(params.minPlace + params.maxPlace), 2n)));
    if (params.task === "digit-in-place") b = ratAdd(b, COEFF_SPECIAL_CASE);
    if (params.task === "total-in-place") b = ratAdd(b, COEFF_REGROUPED_COUNT);
    return b;
  },

  formOffset(): Rational {
    return FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<PlaceValueParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(PLACE_VALUE_FAMILY, PLACE_VALUE_FAMILY_REV, skillId, level, seed);
    const rng = createRng(seedFrom(exerciseId));

    const form = chooseForm(forms, PLACE_VALUE_FORMS, rng);
    const place = rng.nextInt(params.minPlace, params.maxPlace);
    const value = drawNumber(params, place, rng);
    const answer = answerFor(params.task, value, place);

    const canonical: AnswerValue = { kind: "integer", value: rational(answer) };
    const base: Exercise = {
      exerciseId,
      skillId,
      level,
      seed,
      family: PLACE_VALUE_FAMILY,
      familyRev: PLACE_VALUE_FAMILY_REV,
      form,
      prompt: {
        key: PROMPT_KEYS[params.task],
        slots: { [SLOT_NUMBER]: numberSlot(value), [SLOT_PLACE]: placeSlot(place) },
      },
      schema: { kind: "integer", digits: answerCapacity(params), decimalPlaces: 0 },
      // Nothing else is the same answer: an integer answer has one writing.
      answer: { canonical, alsoAccept: [] },
      distractors: [],
      check: { kind: "exact" },
      solution: solutionFor(params.task, value, place, answer),
    };

    return { ...base, distractors: distractorsFor(PLACE_VALUE_FAMILY, base) };
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    return judge(exercise, submitted);
  },
};
