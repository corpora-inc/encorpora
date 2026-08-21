/**
 * `gen.number.round-estimate` — rounding a whole number to a named place.
 *
 * The number is built from its two halves rather than drawn and filtered: the part
 * at and above the rounding place, and the part below it. That is what lets a level
 * guarantee the two properties a rounding item needs and a filtered draw would only
 * usually have —
 *
 * - the number is **never already round** (`4,700` to the nearest hundred is a
 *   question whose answer is the question), and
 * - a `ties` level poses the exact halfway number often enough to be a test of the
 *   convention rather than a one-in-a-hundred surprise.
 *
 * **This family ships no mal-rules, and that is a decision, not an omission.** The
 * documented rounding errors — truncating, and reading the last digit instead of
 * the one below the place — produce the *correct* answer on roughly half of all
 * items, because half of all items round down. CG-12 requires a mal-rule to diverge
 * on 95% of the items it applies to, and the only ways to reach that number are to
 * pose almost exclusively round-up items (which teaches the error) or to have
 * `applies()` decline the items where the bug happens to be right (which is the
 * self-filtering the mal-rule contract forbids in as many words). CURRICULUM.md's
 * honesty rule covers this case: where the catalogue is thin, an unclassified error
 * and a faded worked example, and never an invented bug.
 */

import { mul, pow10, rational, add as ratAdd } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { Rng } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue } from "../../types/answer.ts";
import type { Exercise, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { chooseForm, distractorsFor, judge } from "../shared/build.ts";
import { countSlot, numberSlot, termSlot } from "../shared/slots.ts";
import { drawBetween, drawBetweenExcluding } from "../shared/draw.ts";
import { InfeasibleLevelError } from "../shared/errors.ts";
import { placeTerm } from "../shared/placeTerms.ts";
import {
  COEFF_DIGIT_OVER_TWO,
  COEFF_PLACE,
  COEFF_TIES,
  FORM_OFFSET_FREE_ENTRY,
  PROMPT_KEY_ROUND,
  ROUND_ESTIMATE_FAMILY,
  ROUND_ESTIMATE_FAMILY_REV,
  ROUND_ESTIMATE_FORMS,
  SLOT_ANSWER,
  SLOT_DIGIT,
  SLOT_LOWER,
  SLOT_NUMBER,
  SLOT_PLACE,
  SLOT_UPPER,
  SOLUTION_KEY_DECIDER,
  SOLUTION_KEY_NEIGHBOURS,
  SOLUTION_KEY_RESULT,
} from "./constants.ts";
import { roundEstimateParamSchema } from "./params.ts";
import type { RoundEstimateParams } from "./params.ts";

/** One tie in four on a `ties` level: often enough to be a test, rarely enough to be a level about something else. */
const TIE_IN = 4;

/**
 * Round half up, exactly, in integers.
 *
 * `(value + unit/2) / unit * unit` with `/` as bigint division, which truncates —
 * and truncation is floor on non-negative values, which is what half-up needs.
 * Every operand here is a `bigint`; there is no division of a `number` anywhere on
 * this path and therefore nothing to round twice.
 */
export function roundHalfUp(value: bigint, unit: bigint): bigint {
  if (unit <= 0n) throw new RangeError("roundHalfUp: unit must be positive");
  if (value < 0n) throw new RangeError("roundHalfUp: negative value");
  return ((value + unit / 2n) / unit) * unit;
}

function drawNumber(params: RoundEstimateParams, place: number, rng: Rng): bigint {
  const unit = pow10(place);
  const half = unit / 2n;
  const aboveDigits = params.digits - place;
  if (aboveDigits < 1) throw new InfeasibleLevelError("nothing sits above the rounding place");

  // The part at and above the place keeps the leading-digit rule, so the number is
  // written with exactly the width the level asked for.
  const above = drawBetween(rng, pow10(aboveDigits - 1), pow10(aboveDigits) - 1n);

  const tie = params.ties && rng.nextInt(1, TIE_IN) === 1;
  // Below the place: never zero, or the number is already round and the question
  // answers itself. On a level that does not pose ties, never the exact half either.
  const below = tie ? half : params.ties ? drawBetween(rng, 1n, unit - 1n) : drawBetweenExcluding(rng, 1n, unit - 1n, half);

  return above * unit + below;
}

function solutionFor(value: bigint, place: number, answer: bigint): SolutionStep[] {
  const unit = pow10(place);
  const lower = (value / unit) * unit;
  const term = placeTerm(place);
  if (term === null) throw new InfeasibleLevelError(`no place name for place ${String(place)}`);

  return [
    {
      key: SOLUTION_KEY_NEIGHBOURS,
      slots: {
        [SLOT_NUMBER]: numberSlot(value),
        [SLOT_PLACE]: termSlot(term),
        [SLOT_LOWER]: numberSlot(lower),
        [SLOT_UPPER]: numberSlot(lower + unit),
      },
      focusColumn: place,
    },
    {
      key: SOLUTION_KEY_DECIDER,
      slots: {
        [SLOT_DIGIT]: countSlot((value / (unit / 10n)) % 10n),
        [SLOT_PLACE]: termSlot(term),
      },
      focusColumn: place - 1,
    },
    { key: SOLUTION_KEY_RESULT, slots: { [SLOT_ANSWER]: numberSlot(answer) } },
  ];
}

export const roundEstimateFamily: GeneratorFamily<RoundEstimateParams> = {
  family: ROUND_ESTIMATE_FAMILY,
  familyRev: ROUND_ESTIMATE_FAMILY_REV,
  paramSchema: roundEstimateParamSchema,
  forms: ROUND_ESTIMATE_FORMS,
  choiceOnly: false,
  representations: [],

  answerSchema(params: RoundEstimateParams): AnswerSchema {
    // One digit wider than the number: rounding 9,750 to the nearest hundred is
    // 9,800, but rounding 9,950 is 10,000, and a field that could not hold it
    // would tell the child which of the two kinds of item they had.
    return { kind: "integer", digits: params.digits + 1, decimalPlaces: 0 };
  },

  difficultyOffset(params: RoundEstimateParams): Rational {
    let b = mul(COEFF_DIGIT_OVER_TWO, rational(BigInt(params.digits - 2)));
    b = ratAdd(b, mul(COEFF_PLACE, rational(BigInt(params.minPlace + params.maxPlace), 2n)));
    if (params.ties) b = ratAdd(b, COEFF_TIES);
    return b;
  },

  formOffset(): Rational {
    return FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<RoundEstimateParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(ROUND_ESTIMATE_FAMILY, ROUND_ESTIMATE_FAMILY_REV, skillId, level, seed);
    const rng = createRng(seedFrom(exerciseId));

    const form = chooseForm(forms, ROUND_ESTIMATE_FORMS, rng);
    const place = rng.nextInt(params.minPlace, params.maxPlace);
    const value = drawNumber(params, place, rng);
    const answer = roundHalfUp(value, pow10(place));
    const term = placeTerm(place);
    if (term === null) throw new InfeasibleLevelError(`no place name for place ${String(place)}`);

    const base: Exercise = {
      exerciseId,
      skillId,
      level,
      seed,
      family: ROUND_ESTIMATE_FAMILY,
      familyRev: ROUND_ESTIMATE_FAMILY_REV,
      form,
      prompt: {
        key: PROMPT_KEY_ROUND,
        slots: { [SLOT_NUMBER]: numberSlot(value), [SLOT_PLACE]: termSlot(term) },
      },
      schema: { kind: "integer", digits: params.digits + 1, decimalPlaces: 0 },
      answer: { canonical: { kind: "integer", value: rational(answer) }, alsoAccept: [] },
      distractors: [],
      check: { kind: "exact" },
      solution: solutionFor(value, place, answer),
    };

    return { ...base, distractors: distractorsFor(ROUND_ESTIMATE_FAMILY, base) };
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    return judge(exercise, submitted);
  },
};
