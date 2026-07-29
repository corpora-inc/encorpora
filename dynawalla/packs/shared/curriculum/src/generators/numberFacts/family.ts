/**
 * `gen.arith.number-facts` — the number facts, from `0 + 1` up to `15 − 8`.
 *
 * ## Why this is not `gen.arith.column-op` with smaller parameters
 *
 * The column family *can* be made to emit a single-digit sum: its digit-wise
 * procedure, its regrouping trace and its exact-arithmetic cross-check all work at
 * one column, and only `MIN_DIGITS = 2` in its validator stands in the way. Two
 * things make widening it the wrong move anyway.
 *
 * **A fact is bounded by a value and a column is bounded by a width.** "Two-digit
 * minuend, one-digit subtrahend, one borrow" is `94 − 6` exactly as readily as
 * `15 − 8`, and there is no digit count that means "within twenty". The
 * subtraction milestone of first grade is unreachable through that parameter
 * space, which is not a gap that a smaller number closes.
 *
 * **A fact is recalled and a column is performed.** The column family's worked
 * solution is a walk down the columns — "line them up, take the units, regroup" —
 * and its three mal-rules are all bugs in that walk. Run at one column, the
 * walkthrough for `3 + 5` reads as a procedure with one step, which is not how a
 * child gets `3 + 5`, and every mal-rule's `applies()` is false. The hint ladder
 * here is count-on and bridge-through-ten instead, which is the strategy work the
 * bottom of the ladder is actually made of.
 *
 * So the two families are siblings, and `dw.add.facts.*` sits under
 * `dw.add.column.*` in the graph rather than beside it.
 *
 * ## No mal-rules, on purpose
 *
 * Every buggy procedure in `malrules/` is a column-algorithm bug. The documented
 * error at this level is a counting slip — off by one, or the count started at the
 * wrong end — and an off-by-one distractor would be a bug this program invented
 * rather than one it has evidence for, which `README.md` forbids outright. The
 * rows declare `misconceptions: []` and the items carry no distractors, and a
 * wrong answer routes to the worked example, which is the honest outcome.
 *
 * ## Uniform over a closed set
 *
 * `facts.ts` enumerates the level's whole fact set and `generate` picks one
 * uniformly. See that file for why enumeration is the stronger option here.
 */

import { add as ratAdd, mul, rational } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue } from "../../types/answer.ts";
import type { Exercise, RepSpec, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { REP_TEN_FRAME } from "../../render/representations.ts";
import { chooseForm, distractorsFor, judge } from "../shared/build.ts";
import { InfeasibleLevelError } from "../shared/errors.ts";
import { countSlot, numberSlot } from "../shared/slots.ts";
import {
  COEFF_CROSS_TEN,
  COEFF_INCLUDE_ZERO,
  COEFF_PICTURE,
  COEFF_RANGE_OVER_ROOT,
  COEFF_SUBTRACTION,
  FORM_OFFSET_FREE_ENTRY,
  NUMBER_FACTS_FAMILY,
  NUMBER_FACTS_FAMILY_REV,
  NUMBER_FACTS_FORMS,
  PROMPT_KEY_ADD,
  PROMPT_KEY_SUB,
  ROOT_MAX_TOTAL,
  SLOT_ANSWER,
  SLOT_COUNT,
  SLOT_FIRST,
  SLOT_FROM,
  SLOT_REST,
  SLOT_SECOND,
  SLOT_TO_TEN,
  SOLUTION_KEY_BRIDGE_DOWN,
  SOLUTION_KEY_BRIDGE_UP,
  SOLUTION_KEY_COUNT_BACK,
  SOLUTION_KEY_COUNT_ON,
  SOLUTION_KEY_READ,
  SOLUTION_KEY_RESULT,
} from "./constants.ts";
import { factSet } from "./facts.ts";
import type { Fact } from "./facts.ts";
import { numberFactsParamSchema } from "./params.ts";
import type { NumberFactsParams } from "./params.ts";

/** The frame the picture is drawn in. Ten cells, the standard one. */
const FRAME_CAPACITY = 10;

/**
 * The answer field's width, which is the *level's* width and never this item's.
 *
 * Sizing the field to the answer would tell a child how many digits it has
 * (ARCHITECTURE L3), which on a level whose answers straddle ten is the whole
 * question. Both operations get the same width for the same reason: on a
 * subtraction level reaching eighteen the answers are all single digits, and a
 * field one cell wide would say so.
 */
function answerDigits(params: NumberFactsParams): number {
  return String(params.maxTotal).length;
}

function schemaFor(params: NumberFactsParams): AnswerSchema {
  return { kind: "integer", digits: answerDigits(params), decimalPlaces: 0 };
}

/**
 * The frame beside the numerals, or nothing.
 *
 * Addition puts the second addend in a second group; subtraction crosses the part
 * out of the whole. Never both — a frame that groups *and* crosses out asks two
 * questions, and `repSpecDefect` rejects it.
 *
 * A subtraction picture holds `first` counters with `second` of them crossed, and
 * not `first − second` counters beside `second`: the counters left standing are
 * the answer, and a picture that draws the answer is not a question.
 */
function representationFor(params: NumberFactsParams, fact: Fact): RepSpec | undefined {
  if (!params.picture) return undefined;
  return params.op === "add"
    ? { rep: REP_TEN_FRAME, params: { capacity: FRAME_CAPACITY, first: fact.first, second: fact.second, removed: 0 } }
    : { rep: REP_TEN_FRAME, params: { capacity: FRAME_CAPACITY, first: fact.first, second: 0, removed: fact.second } };
}

/**
 * The hint ladder: read the fact, apply the strategy, state the answer.
 *
 * The middle rung is the strategy the level is teaching, not a restatement of the
 * arithmetic. Within ten it is counting on from the larger number — starting at
 * the smaller one is the slower habit this rung exists to displace. Across ten it
 * is the bridge: `7 + 8` is `7 + 3` to ten and `5` more, and `15 − 8` is `15 − 5`
 * down to ten and `3` more.
 */
function solutionFor(params: NumberFactsParams, fact: Fact): SolutionStep[] {
  const read: SolutionStep = {
    key: SOLUTION_KEY_READ,
    slots: { [SLOT_FIRST]: numberSlot(BigInt(fact.first)), [SLOT_SECOND]: numberSlot(BigInt(fact.second)) },
  };
  const result: SolutionStep = {
    key: SOLUTION_KEY_RESULT,
    slots: { [SLOT_ANSWER]: numberSlot(BigInt(fact.result)) },
  };

  if (params.crossesTen) {
    // `toTen` is the step that lands exactly on ten and `rest` is what is left of
    // the second number after it. Both are at least one on every crossing fact:
    // the sum passes ten strictly, so the second number is strictly larger than
    // the gap to it.
    const toTen = params.op === "add" ? 10 - fact.first : fact.first - 10;
    const rest = fact.second - toTen;
    return [
      read,
      {
        key: params.op === "add" ? SOLUTION_KEY_BRIDGE_UP : SOLUTION_KEY_BRIDGE_DOWN,
        slots: {
          [SLOT_FIRST]: numberSlot(BigInt(fact.first)),
          [SLOT_TO_TEN]: countSlot(toTen),
          [SLOT_REST]: countSlot(rest),
        },
      },
      result,
    ];
  }

  // Count on from the larger addend, whichever way round the fact is written.
  const from = params.op === "add" ? Math.max(fact.first, fact.second) : fact.first;
  const count = params.op === "add" ? Math.min(fact.first, fact.second) : fact.second;
  return [
    read,
    {
      key: params.op === "add" ? SOLUTION_KEY_COUNT_ON : SOLUTION_KEY_COUNT_BACK,
      slots: { [SLOT_FROM]: numberSlot(BigInt(from)), [SLOT_COUNT]: countSlot(count) },
    },
    result,
  ];
}

export const numberFactsFamily: GeneratorFamily<NumberFactsParams> = {
  family: NUMBER_FACTS_FAMILY,
  familyRev: NUMBER_FACTS_FAMILY_REV,
  paramSchema: numberFactsParamSchema,
  forms: NUMBER_FACTS_FORMS,
  choiceOnly: false,
  representations: [REP_TEN_FRAME],

  answerSchema(params: NumberFactsParams): AnswerSchema {
    return schemaFor(params);
  },

  difficultyOffset(params: NumberFactsParams): Rational {
    let b = mul(COEFF_RANGE_OVER_ROOT, rational(BigInt(params.maxTotal - ROOT_MAX_TOTAL)));
    if (params.op === "sub") b = ratAdd(b, COEFF_SUBTRACTION);
    if (params.crossesTen) b = ratAdd(b, COEFF_CROSS_TEN);
    if (params.includeZero) b = ratAdd(b, COEFF_INCLUDE_ZERO);
    if (params.picture) b = ratAdd(b, COEFF_PICTURE);
    return b;
  },

  formOffset(): Rational {
    return FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<NumberFactsParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(NUMBER_FACTS_FAMILY, NUMBER_FACTS_FAMILY_REV, skillId, level, seed);
    const rng = createRng(seedFrom(exerciseId));
    const form = chooseForm(forms, NUMBER_FACTS_FORMS, rng);

    const facts = factSet(params);
    if (facts.length === 0) {
      // The schema rejects every combination that empties the set, so reaching
      // here is a disagreement between the validator and the enumeration — the one
      // bug class a family of this shape is most likely to have.
      throw new InfeasibleLevelError(`no fact satisfies the parameters of ${exerciseId}`);
    }
    const fact = rng.pick(facts);

    // The enumeration and exact rational arithmetic agree, asserted on every call.
    // `facts.ts` computes the result while it builds the pair, so this is the one
    // place the two derivations meet.
    const expected = params.op === "add" ? fact.first + fact.second : fact.first - fact.second;
    if (fact.result !== expected) {
      throw new Error(`the fact set disagreed with exact arithmetic on ${exerciseId}`);
    }

    const representation = representationFor(params, fact);
    const base: Exercise = {
      exerciseId,
      skillId,
      level,
      seed,
      family: NUMBER_FACTS_FAMILY,
      familyRev: NUMBER_FACTS_FAMILY_REV,
      form,
      prompt: {
        key: params.op === "add" ? PROMPT_KEY_ADD : PROMPT_KEY_SUB,
        slots: {
          [SLOT_FIRST]: numberSlot(BigInt(fact.first)),
          [SLOT_SECOND]: numberSlot(BigInt(fact.second)),
        },
      },
      ...(representation === undefined ? {} : { representation }),
      schema: schemaFor(params),
      answer: { canonical: { kind: "integer", value: rational(BigInt(fact.result)) }, alsoAccept: [] },
      distractors: [],
      check: { kind: "exact" },
      solution: solutionFor(params, fact),
    };

    return { ...base, distractors: distractorsFor(NUMBER_FACTS_FAMILY, base) };
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    return judge(exercise, submitted);
  },
};
