/**
 * Worked examples verified by hand, and the arithmetic every family claims,
 * recomputed independently of the generator that produced it.
 *
 * Two kinds of test, and the second is the one that would catch a real bug. The
 * first pins documented numbers — `4,208 ÷ 4 = 1,052` and the `152` a dropped zero
 * writes — onto the pure procedures, checked against arithmetic done on paper. The
 * second takes generated items and **re-derives the answer from the prompt**, using
 * `Rational` and nothing the family exported, so a generator whose draw and whose
 * answer agreed with each other and with nothing else would fail here.
 *
 * The edge cases are named in the same order the acceptance criteria name them:
 * zeros, repeated digits, regrouping through zeros, boundary values, equal
 * operands, remainders, unsimplified fractions and decimal precision.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  add as ratAdd,
  cmp,
  eq as ratEq,
  mul as ratMul,
  rational,
  sub as ratSub,
  toScaled,
  toString as rationalToString,
} from "../math/rational.ts";
import type { Rational } from "../math/rational.ts";
import { skillId } from "../types/ids.ts";
import type { Exercise, PromptSlot } from "../types/exercise.ts";
import { answerAccepted } from "../types/answer.ts";
import { erase } from "../types/generator.ts";
import type { AnyGeneratorFamily } from "../types/generator.ts";
import { classify } from "../malrules/registry.ts";
import { fingerprintItem } from "../serialize.ts";

import { placeValueFamily } from "./placeValue/family.ts";
import { placeValueParamSchema } from "./placeValue/params.ts";
import { readPlaceValueQuestion } from "./placeValue/read.ts";
import { MIS_DIGIT_FOR_VALUE } from "../malrules/placeValue.ts";

import { compareOrderFamily } from "./compareOrder/family.ts";
import { compareOrderParamSchema } from "./compareOrder/params.ts";
import { operandValue, readComparePair } from "./compareOrder/read.ts";
import { MIS_LARGER_DENOMINATOR_LARGER_FRACTION } from "../malrules/compareOrder.ts";

import { roundEstimateFamily, roundHalfUp } from "./roundEstimate/family.ts";
import { roundEstimateParamSchema } from "./roundEstimate/params.ts";

import { multidigitMulFamily } from "./multidigitMul/family.ts";
import { multidigitMulParamSchema } from "./multidigitMul/params.ts";
import {
  carryBeforeMultiply,
  digitSum,
  littleEndianDigits,
  passCarries,
  passCarriesInward,
} from "./multidigitMul/procedure.ts";
import { readFactors } from "./multidigitMul/read.ts";
import { PROMPT_KEY_PRODUCT, SLOT_BOTTOM, SLOT_TOP } from "./multidigitMul/constants.ts";
import { MIS_FORGOT_THE_SHIFT, carryAddedBeforeMultiplying } from "../malrules/multidigitMul.ts";

import { longDivFamily } from "./longDiv/family.ts";
import { longDivParamSchema } from "./longDiv/params.ts";
import { hasInteriorZero, longDivisionSteps, withoutInteriorZeros } from "./longDiv/procedure.ts";
import { readDivision } from "./longDiv/read.ts";

import { fracEquivalenceFamily } from "./fracEquivalence/family.ts";
import { fracEquivalenceParamSchema } from "./fracEquivalence/params.ts";
import { readEquivalenceItem } from "./fracEquivalence/read.ts";
import { MIS_MIXED_NUMBER_CONCATENATION } from "../malrules/fractions.ts";

import { fracArithFamily } from "./fracArith/family.ts";
import { fracArithParamSchema } from "./fracArith/params.ts";
import { readFracOperands } from "./fracArith/read.ts";

import { missingOperandFamily } from "./missingOperand/family.ts";
import { missingOperandParamSchema } from "./missingOperand/params.ts";
import { readSentence } from "./missingOperand/read.ts";
import { MIS_ADD_ALL_NUMBERS, MIS_EQUALS_AS_OPERATOR } from "../malrules/missingOperand.ts";

import { isReduced, reduce } from "./shared/fractions.ts";

const SKILL = skillId("dw.ns.place.digit-value");
const SEEDS = 300;

/**
 * Validate params the way the gates do, then generate. A bad table fails loudly.
 *
 * Takes the **erased** family — `erase()` exists for exactly this, and it is what
 * lets one helper serve eight families with eight different parameter types
 * without a cast at every call site. The parameter object is validated by the
 * family's own schema first, which is the same order `buildSamples` uses.
 */
function items(family: AnyGeneratorFamily, raw: unknown, forms: readonly string[], seeds = SEEDS): Exercise[] {
  const validated = family.paramSchema.validate(raw);
  assert.ok(validated.ok, validated.ok ? "" : validated.issues.map((i) => `${i.path}: ${i.message}`).join("; "));
  if (!validated.ok) return [];
  const out: Exercise[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    out.push(family.generate({ skillId: SKILL, level: 0, seed, params: validated.value, forms }));
  }
  return out;
}

function numberSlot(exercise: Exercise, name: string): Rational {
  const slot: PromptSlot | undefined = exercise.prompt.slots[name];
  assert.ok(slot !== undefined && slot.kind === "number", `${exercise.exerciseId}: ${name} is not a number slot`);
  return slot.kind === "number" ? slot.value : rational(0n);
}

function integerAnswer(exercise: Exercise): bigint {
  const answer = exercise.answer.canonical;
  assert.equal(answer.kind, "integer", exercise.exerciseId);
  assert.ok(answer.kind === "integer");
  assert.equal(answer.value.d, 1n, `${exercise.exerciseId}: answer is not a whole number`);
  return answer.value.n;
}

// ---------------------------------------------------------------- place value

test("place-value: the worked example, by hand — 4,738", () => {
  // Hundreds is place 2. The digit there is 7, it is worth 700, and 4,738 holds
  // 47 hundreds altogether. Checked on paper: 4738 ÷ 100 = 47 remainder 38.
  const value = 4738n;
  assert.equal((value / 100n) % 10n, 7n);
  assert.equal(((value / 100n) % 10n) * 100n, 700n);
  assert.equal(value / 100n, 47n);
  assert.equal(value % 100n, 38n);
});

test("place-value: every answer is the digit, the value or the regrouped count of the number shown", () => {
  for (const task of ["digit-value", "digit-in-place", "total-in-place"] as const) {
    const params = { task, digits: 5, minPlace: task === "digit-in-place" ? 0 : 1, maxPlace: 3 };
    for (const exercise of items(erase(placeValueFamily), params, ["free-entry"])) {
      const question = readPlaceValueQuestion(exercise);
      assert.ok(question !== null, exercise.exerciseId);
      let unit = 1n;
      for (let i = 0; i < question.place; i++) unit *= 10n;
      const digit = (question.value / unit) % 10n;
      const expected =
        task === "digit-value" ? digit * unit : task === "digit-in-place" ? digit : question.value / unit;
      assert.equal(integerAnswer(exercise), expected, exercise.exerciseId);
      // The number is written to the width the level asked for, with no leading zero.
      assert.equal(question.value.toString().length, 5, exercise.exerciseId);
    }
  }
});

test("place-value: a digit-value item never asks about a place holding a zero", () => {
  // A zero there is worth zero, which is also what the digit-for-value bug answers:
  // the one item on which the distractor would be the answer.
  for (const exercise of items(erase(placeValueFamily), { task: "digit-value", digits: 4, minPlace: 1, maxPlace: 3 },
    ["free-entry"],
  )) {
    const question = readPlaceValueQuestion(exercise);
    assert.ok(question !== null && question.digit !== 0n, exercise.exerciseId);
    assert.equal(classify(exercise, { kind: "integer", value: rational(question.digit) }), MIS_DIGIT_FOR_VALUE);
  }
});

test("place-value: the validator rejects the questions that would have no content", () => {
  // Units-column value and units-column count are both `digit-in-place` again.
  assert.equal(placeValueParamSchema.validate({ task: "digit-value", digits: 3, minPlace: 0, maxPlace: 2 }).ok, false);
  // "How many hundreds altogether in 738" is the hundreds digit, asked twice.
  assert.equal(
    placeValueParamSchema.validate({ task: "total-in-place", digits: 3, minPlace: 1, maxPlace: 2 }).ok,
    false,
  );
  assert.equal(placeValueParamSchema.validate({ task: "digit-value", digits: 3, minPlace: 2, maxPlace: 1 }).ok, false);
});

// -------------------------------------------------------------- compare-order

test("compare-order: the answer is always the greater (or lesser) of the two written numbers", () => {
  const tables: unknown[] = [
    { numberType: "whole", task: "greater", digits: 4, sharedPrefix: 2 },
    { numberType: "whole", task: "lesser", digits: 3, sharedPrefix: 0 },
    { numberType: "fraction", task: "greater", maxDenominator: 20, sameNumerator: true },
    { numberType: "fraction", task: "lesser", maxDenominator: 16, sameNumerator: false },
    { numberType: "decimal", task: "greater", digits: 2, decimalPlaces: 1, placeGap: 2 },
  ];
  for (const table of tables) {
    for (const exercise of items(erase(compareOrderFamily), table, ["free-entry"])) {
      const pair = readComparePair(exercise);
      assert.ok(pair !== null, exercise.exerciseId);
      const left = operandValue(pair.left);
      const right = operandValue(pair.right);
      // Never equal: a comparison of equals has no answer.
      assert.notEqual(cmp(left, right), 0, exercise.exerciseId);
      const wanted = pair.task === "greater" ? (cmp(left, right) > 0 ? left : right) : cmp(left, right) < 0 ? left : right;
      const answer = exercise.answer.canonical;
      const written =
        answer.kind === "fraction" ? rational(answer.num, answer.den) : answer.kind === "integer" ? answer.value : null;
      assert.ok(written !== null && ratEq(written, wanted), exercise.exerciseId);
    }
  }
});

test("compare-order: a same-numerator pair always diagnoses whole-number bias", () => {
  // 1/3 against 1/5: the greater is 1/3, and the child who reads 5 > 3 writes 1/5.
  assert.equal(cmp(rational(1n, 3n), rational(1n, 5n)), 1);
  for (const exercise of items(erase(compareOrderFamily), { numberType: "fraction", task: "greater", maxDenominator: 20, sameNumerator: true },
    ["free-entry"],
  )) {
    const pair = readComparePair(exercise);
    assert.ok(pair !== null && pair.left.kind === "fraction" && pair.right.kind === "fraction");
    assert.equal(pair.left.num, pair.right.num, exercise.exerciseId);
    assert.notEqual(pair.left.den, pair.right.den, exercise.exerciseId);
    const bigger = pair.left.den > pair.right.den ? pair.left : pair.right;
    assert.equal(
      classify(exercise, { kind: "fraction", num: bigger.num, den: bigger.den }),
      MIS_LARGER_DENOMINATOR_LARGER_FRACTION,
      exercise.exerciseId,
    );
  }
});

test("compare-order: a decimal item writes the longer number as the smaller one", () => {
  for (const exercise of items(erase(compareOrderFamily), { numberType: "decimal", task: "greater", digits: 1, decimalPlaces: 1, placeGap: 2 },
    ["free-entry"],
  )) {
    const pair = readComparePair(exercise);
    assert.ok(pair !== null && pair.left.kind === "number" && pair.right.kind === "number");
    assert.ok(pair.right.decimalPlaces > pair.left.decimalPlaces, exercise.exerciseId);
    assert.equal(cmp(operandValue(pair.left), operandValue(pair.right)), 1, exercise.exerciseId);
    // Both numbers sit exactly on their own decimal grid — no value needs a place
    // it was not written to.
    assert.notEqual(toScaled(pair.left.value, pair.left.decimalPlaces), null);
    assert.notEqual(toScaled(pair.right.value, pair.right.decimalPlaces), null);
  }
});

// ------------------------------------------------------------- round-estimate

test("round-estimate: rounding half up, on paper", () => {
  assert.equal(roundHalfUp(4750n, 100n), 4800n); // the tie goes up
  assert.equal(roundHalfUp(4749n, 100n), 4700n);
  assert.equal(roundHalfUp(4751n, 100n), 4800n);
  assert.equal(roundHalfUp(9950n, 100n), 10000n); // and gains a digit
  assert.equal(roundHalfUp(5n, 10n), 10n);
  assert.equal(roundHalfUp(4n, 10n), 0n);
});

test("round-estimate: the number is never already round, and the answer is the nearest multiple", () => {
  for (const table of [
    { digits: 4, minPlace: 1, maxPlace: 3, ties: false },
    { digits: 5, minPlace: 2, maxPlace: 3, ties: true },
  ]) {
    for (const exercise of items(erase(roundEstimateFamily), table, ["free-entry"])) {
      const value = numberSlot(exercise, "number");
      assert.equal(value.d, 1n);
      const answer = integerAnswer(exercise);
      // Recomputed from the answer's own trailing zeros rather than from the level.
      const unit = answer === 0n ? 10n : (() => {
        let u = 1n;
        while (answer % (u * 10n) === 0n && u < 1000000n) u *= 10n;
        return u;
      })();
      assert.notEqual(value.n % unit, 0n, `${exercise.exerciseId}: already round`);
      assert.ok(
        (value.n - answer) * 2n <= unit && (answer - value.n) * 2n <= unit,
        `${exercise.exerciseId}: not the nearest multiple`,
      );
    }
  }
});

// ------------------------------------------------------------ multidigit-mul

test("multidigit-mul: the two mal-rules on 47 × 23 and 47 × 3, by hand", () => {
  // 47 × 23 = 1,081. Written with both partial products in the units column:
  // 47 × 3 = 141, 47 × 2 = 94, 141 + 94 = 235 — which is 47 × 5, the digit sum.
  assert.equal(47n * 23n, 1081n);
  assert.equal(digitSum(23n), 5n);
  assert.equal(47n * digitSum(23n), 235n);

  // 47 × 3 = 141. Adding the carry before multiplying: units 7 × 3 = 21, write 1
  // carry 2; tens (4 + 2) × 3 = 18, write 8 carry 1 — 181, not 141.
  assert.equal(47n * 3n, 141n);
  assert.ok(passCarriesInward(littleEndianDigits(47n), 3));
  assert.equal(carryBeforeMultiply(littleEndianDigits(47n), 3), 181n);

  // With no carry there is nothing to add in the wrong order, and the two
  // procedures are the same one.
  assert.equal(passCarries(littleEndianDigits(11n), 3), false);
  assert.equal(carryBeforeMultiply(littleEndianDigits(11n), 3), 33n);
});

test("multidigit-mul: a carry out of the leading column is not a carry the bug can reorder", () => {
  // 50 × 2 = 100, and the buggy pass agrees. Correct: units 0 × 2 = 0, write 0
  // carry 0; tens 5 × 2 = 10, write 0 carry 1; the carry is written — 100. Buggy:
  // units (0 + 0) × 2 = 0, write 0 carry 0; tens (5 + 0) × 2 = 10, write 0 carry
  // 1; the carry is written — 100. The pass *carries out* of the tens, but nothing
  // ever carries *in*, so the two orders of operations never differ.
  //
  // The mal-rule read "carries out" once. It admitted 7,980 items like this one
  // among the 795,390 it claimed over 10..99999 × 2..9, on every one of which it
  // reproduced the correct answer and `distractorsFor` silently dropped it. The
  // carry-in reading admits none.
  const fifty = littleEndianDigits(50n);
  assert.equal(50n * 2n, 100n);
  assert.equal(carryBeforeMultiply(fifty, 2), 100n);
  assert.equal(passCarries(fifty, 2), true);
  assert.equal(passCarriesInward(fifty, 2), false);

  // The same shape wherever the only carry is the leading one.
  for (const [top, multiplier] of [
    [20n, 5],
    [21n, 9],
    [30n, 4],
    [64n, 2],
    [700n, 3],
  ] as const) {
    assert.equal(carryBeforeMultiply(littleEndianDigits(top), multiplier), top * BigInt(multiplier));
    assert.equal(passCarries(littleEndianDigits(top), multiplier), true);
    assert.equal(passCarriesInward(littleEndianDigits(top), multiplier), false);
  }

  // And an exhaustive statement of the fix over the two- and three-digit space:
  // under the carry-in reading the buggy product is never the correct one.
  let inward = 0;
  for (let top = 10n; top <= 999n; top++) {
    for (let multiplier = 2; multiplier <= 9; multiplier++) {
      const digits = littleEndianDigits(top);
      if (!passCarriesInward(digits, multiplier)) continue;
      inward += 1;
      assert.notEqual(
        carryBeforeMultiply(digits, multiplier),
        top * BigInt(multiplier),
        `${String(top)} × ${String(multiplier)}`,
      );
    }
  }
  assert.ok(inward > 5000, `expected a real space, got ${String(inward)} items`);
});

test("multidigit-mul: the mal-rule declines 50 × 2, which no shipped level can pose", () => {
  // The sweep cannot see this. `drawCarrying` forces the units column to carry, so
  // every item a level poses carries inward and the carries-out reading measures
  // 100% divergence anyway — the guarantee would be a fact about the generator's
  // content, not about the rule. `applies()` is public and `classify()` runs on
  // whatever a child is holding, so it is tested on an item the graph cannot draw.
  const base = items(erase(multidigitMulFamily), { shape: "general", digits: 2, multiplierDigits: 1, carries: true }, [
    "free-entry",
  ])[0];
  assert.ok(base !== undefined);
  const fiftyTimesTwo: Exercise = {
    ...base,
    prompt: {
      key: PROMPT_KEY_PRODUCT,
      slots: {
        [SLOT_TOP]: { kind: "number", value: rational(50n), decimalPlaces: 0 },
        [SLOT_BOTTOM]: { kind: "number", value: rational(2n), decimalPlaces: 0 },
      },
    },
    answer: { canonical: { kind: "integer", value: rational(100n) }, alsoAccept: [] },
  };

  const factors = readFactors(fiftyTimesTwo);
  assert.ok(factors !== null);
  assert.equal(factors.top * factors.bottom, 100n);
  // The buggy procedure lands on the correct answer here, so the rule must be
  // undefined on the item rather than defined and wrong.
  assert.equal(carryBeforeMultiply(littleEndianDigits(factors.top), Number(factors.bottom)), 100n);
  assert.equal(carryAddedBeforeMultiplying.applies(fiftyTimesTwo), false);
  assert.equal(carryAddedBeforeMultiplying.apply(fiftyTimesTwo), null);
  assert.equal(classify(fiftyTimesTwo, { kind: "integer", value: rational(100n) }), null);
});

test("multidigit-mul: the answer is the exact product, and the level's carry promise holds", () => {
  for (const table of [
    { shape: "general", digits: 3, multiplierDigits: 1, carries: true },
    { shape: "general", digits: 4, multiplierDigits: 2, carries: true },
    { shape: "general", digits: 4, multiplierDigits: 1, carries: false },
    { shape: "power-of-ten", digits: 3, maxPower: 3 },
  ]) {
    for (const exercise of items(erase(multidigitMulFamily), table, ["free-entry"])) {
      const factors = readFactors(exercise);
      assert.ok(factors !== null, exercise.exerciseId);
      assert.ok(
        ratEq(rational(integerAnswer(exercise)), ratMul(rational(factors.top), rational(factors.bottom))),
        exercise.exerciseId,
      );
      if (table.shape === "general" && table.multiplierDigits === 1) {
        assert.equal(
          passCarries(littleEndianDigits(factors.top), Number(factors.bottom)),
          table.carries,
          `${exercise.exerciseId}: the level promised carries=${String(table.carries)}`,
        );
        // A carrying level does not merely carry, it carries *into* a column —
        // which is what makes the add-the-carry-first bug defined on its items.
        // `drawCarrying` forces the units column to carry out, so the tens column
        // always has a carry in; nothing else in the family guarantees it.
        assert.equal(
          passCarriesInward(littleEndianDigits(factors.top), Number(factors.bottom)),
          table.carries,
          `${exercise.exerciseId}: the level promised a carry the bug can reorder`,
        );
      }
      if (table.shape === "power-of-ten") {
        assert.equal(factors.bottom.toString().replace(/0+$/, ""), "1", exercise.exerciseId);
        // `47 × 100` answered as `47` is the shift never applied, not a partial
        // product misplaced — the two rules are disjoint, so `classify` names one.
        assert.equal(classify(exercise, { kind: "integer", value: rational(factors.top) }), MIS_FORGOT_THE_SHIFT);
      }
    }
  }
});

test("multidigit-mul: the validator rejects a non-carrying multi-digit multiplier", () => {
  assert.equal(
    multidigitMulParamSchema.validate({ shape: "general", digits: 3, multiplierDigits: 2, carries: false }).ok,
    false,
  );
});

// ------------------------------------------------------------------- long-div

test("long-div: 4,208 ÷ 4 and the zero children drop, by hand", () => {
  assert.equal(4208n / 4n, 1052n);
  assert.equal(4208n % 4n, 0n);
  const steps = longDivisionSteps(4208n, 4n);
  assert.deepEqual(
    steps.map((step) => step.digit),
    [1, 0, 5, 2],
  );
  assert.ok(hasInteriorZero(1052n));
  assert.equal(withoutInteriorZeros(1052n), 152n);
  // Removing a digit removes a place, so the two can never coincide.
  assert.ok(withoutInteriorZeros(1052n) < 1052n);
  // A leading digit is never removed: 1,052 keeps its 1.
  assert.equal(withoutInteriorZeros(1000n), 1n);
});

test("long-div: the division identity holds, and the remainder is smaller than the divisor", () => {
  for (const table of [
    { task: "quotient", quotientDigits: 3, divisorDigits: 1, exact: true, quotientZeros: false },
    { task: "remainder", quotientDigits: 3, divisorDigits: 2, exact: false, quotientZeros: false },
    { task: "quotient-and-remainder", quotientDigits: 3, divisorDigits: 1, exact: false, quotientZeros: false },
    { task: "quotient", quotientDigits: 4, divisorDigits: 1, exact: true, quotientZeros: true },
  ]) {
    for (const exercise of items(erase(longDivFamily), table, ["free-entry"])) {
      const division = readDivision(exercise);
      assert.ok(division !== null, exercise.exerciseId);
      assert.equal(division.quotient * division.divisor + division.remainder, division.dividend, exercise.exerciseId);
      assert.ok(division.remainder < division.divisor, exercise.exerciseId);
      assert.ok(division.divisor >= 2n, `${exercise.exerciseId}: dividing by one asks nothing`);
      assert.equal(division.quotient.toString().length, table.quotientDigits, exercise.exerciseId);
      if (table.exact) assert.equal(division.remainder, 0n, exercise.exerciseId);
      else assert.ok(division.remainder > 0n, exercise.exerciseId);
      if (table.quotientZeros) assert.ok(hasInteriorZero(division.quotient), exercise.exerciseId);

      if (table.task === "quotient-and-remainder") {
        const answer = exercise.answer.canonical;
        assert.ok(answer.kind === "fraction");
        // The mixed number *is* the exact quotient: whole + remainder/divisor.
        assert.ok(
          ratEq(
            ratAdd(rational(answer.whole ?? 0n), rational(answer.num, answer.den)),
            rational(division.dividend, division.divisor),
          ),
          exercise.exerciseId,
        );
        // …and it is `as-written`: `7 4/6` is the answer, `7 2/3` is not.
        assert.equal(answer.den, division.divisor, exercise.exerciseId);
        assert.equal(
          answerAccepted(exercise.schema, exercise.answer.canonical, {
            kind: "fraction",
            num: reduce(answer.num, answer.den).num,
            den: reduce(answer.num, answer.den).den,
            whole: answer.whole ?? 0n,
          }),
          isReduced(answer.num, answer.den),
          exercise.exerciseId,
        );
      }
    }
  }
});

test("long-div: the validator rejects the three questions with no content", () => {
  const base = { quotientDigits: 3, divisorDigits: 1, exact: true, quotientZeros: false };
  assert.equal(longDivParamSchema.validate({ ...base, task: "remainder" }).ok, false);
  assert.equal(longDivParamSchema.validate({ ...base, task: "quotient", exact: false }).ok, false);
  assert.equal(
    longDivParamSchema.validate({ ...base, task: "quotient", quotientDigits: 1, quotientZeros: true }).ok,
    false,
  );
});

// ---------------------------------------------------------- frac-equivalence

test("frac-equivalence: 2 3/4 is 11/4, and the concatenation bug writes 23/4", () => {
  assert.equal(2n * 4n + 3n, 11n);
  assert.equal(BigInt("23"), 23n);
  assert.notEqual(11n, 23n);
  // The one denominator on which the two agree is ten, and the generator never
  // draws it: 2 3/10 → 23/10 either way.
  assert.equal(2n * 10n + 3n, 23n);
});

test("frac-equivalence: the rewriting never changes the number, and never rewrites nothing", () => {
  for (const table of [
    { task: "simplify", maxDenominator: 24, maxFactor: 4, maxWhole: 1 },
    { task: "build", maxDenominator: 24, maxFactor: 6, maxWhole: 1 },
    { task: "to-mixed", maxDenominator: 12, maxFactor: 2, maxWhole: 9 },
    { task: "to-improper", maxDenominator: 12, maxFactor: 2, maxWhole: 9 },
  ]) {
    for (const exercise of items(erase(fracEquivalenceFamily), table, ["free-entry"])) {
      const item = readEquivalenceItem(exercise);
      assert.ok(item !== null, exercise.exerciseId);
      const answer = exercise.answer.canonical;
      assert.ok(answer.kind === "fraction");
      const shown = ratAdd(rational(item.whole), rational(item.num, item.den));
      const written = ratAdd(rational(answer.whole ?? 0n), rational(answer.num, answer.den));
      assert.ok(ratEq(shown, written), `${exercise.exerciseId}: the rewriting changed the number`);
      assert.ok(
        item.num !== answer.num || item.den !== answer.den || item.whole !== (answer.whole ?? 0n),
        `${exercise.exerciseId}: nothing was rewritten`,
      );

      if (table.task === "simplify") {
        assert.ok(isReduced(answer.num, answer.den), `${exercise.exerciseId}: the answer is not in lowest terms`);
        assert.ok(!isReduced(item.num, item.den), `${exercise.exerciseId}: the question was already simplified`);
      }
      if (table.task === "to-mixed") {
        assert.ok((answer.whole ?? 0n) >= 1n && answer.num >= 1n && answer.num < answer.den, exercise.exerciseId);
      }
      if (table.task === "to-improper") {
        assert.ok(answer.num > answer.den, exercise.exerciseId);
        const concatenated = BigInt(`${item.whole.toString()}${item.num.toString()}`);
        assert.notEqual(concatenated, answer.num, `${exercise.exerciseId}: the bug and the answer coincide`);
        assert.equal(
          classify(exercise, { kind: "fraction", num: concatenated, den: item.den }),
          MIS_MIXED_NUMBER_CONCATENATION,
          exercise.exerciseId,
        );
      }
      // The denominator a child reads never exceeds what the level asked for.
      assert.ok(item.den <= BigInt(table.maxDenominator), exercise.exerciseId);
    }
  }
});

// ----------------------------------------------------------------- frac-arith

test("frac-arith: 1/2 + 1/3 is 5/6, and the mediant 2/5 is neither operand nor the sum", () => {
  assert.ok(ratEq(ratAdd(rational(1n, 2n), rational(1n, 3n)), rational(5n, 6n)));
  // (1+1)/(2+3) = 2/5, which lies strictly between 1/3 and 1/2 — so it can never be
  // the sum, which is greater than both.
  assert.equal(cmp(rational(2n, 5n), rational(1n, 2n)), -1);
  assert.equal(cmp(rational(2n, 5n), rational(1n, 3n)), 1);
  // 3/4 × 5 = 15/4. Scaling both parts gives 15/20, which is 3/4 again.
  assert.ok(ratEq(ratMul(rational(3n, 4n), rational(5n)), rational(15n, 4n)));
  assert.ok(ratEq(rational(15n, 20n), rational(3n, 4n)));
});

test("frac-arith: the answer is the exact result, positive, and never a whole number", () => {
  for (const table of [
    { op: "add", denominators: "like", maxDenominator: 12, lowestTerms: false },
    { op: "add", denominators: "unlike", maxDenominator: 20, lowestTerms: true },
    { op: "sub", denominators: "multiple", maxDenominator: 16, lowestTerms: false },
    { op: "mul", wholeMultiplier: true, maxDenominator: 16, maxWhole: 9, lowestTerms: true },
    { op: "mul", wholeMultiplier: false, maxDenominator: 12, maxWhole: 2, lowestTerms: false },
  ]) {
    for (const exercise of items(erase(fracArithFamily), table, ["free-entry"])) {
      const operands = readFracOperands(exercise);
      assert.ok(operands !== null, exercise.exerciseId);
      const left = rational(operands.leftNum, operands.leftDen);
      const right = rational(operands.rightNum, operands.rightDen);
      const expected =
        table.op === "add" ? ratAdd(left, right) : table.op === "sub" ? ratSub(left, right) : ratMul(left, right);

      const answer = exercise.answer.canonical;
      assert.ok(answer.kind === "fraction");
      assert.ok(ratEq(rational(answer.num, answer.den), expected), exercise.exerciseId);
      assert.ok(expected.n > 0n, `${exercise.exerciseId}: a non-positive result`);
      assert.notEqual(expected.d, 1n, `${exercise.exerciseId}: a whole-number result in a fraction entry`);
      assert.ok(isReduced(answer.num, answer.den), `${exercise.exerciseId}: canonical is not in lowest terms`);

      // `lowestTerms` is the knob that decides whether an unsimplified answer
      // counts. Doubling the canonical answer's parts is always a correct value
      // and never lowest terms, so it is exactly the case the knob is about.
      const unsimplified = { kind: "fraction" as const, num: answer.num * 2n, den: answer.den * 2n };
      assert.equal(
        answerAccepted(exercise.schema, exercise.answer.canonical, unsimplified),
        !table.lowestTerms,
        exercise.exerciseId,
      );
    }
  }
});

// ------------------------------------------------------------ missing-operand

test("missing-operand: 8 + 4 = ☐ + 5, by hand", () => {
  // The answer is 7. The two documented wrong answers are 12 — the total of the
  // side that is finished — and 17, every number on the card added up.
  assert.equal(8n + 4n - 5n, 7n);
  assert.equal(8n + 4n, 12n);
  assert.equal(8n + 4n + 5n, 17n);
  assert.notEqual(7n, 12n);
  assert.notEqual(7n, 17n);
  assert.notEqual(12n, 17n);
});

test("missing-operand: substituting the answer balances the sentence, on every shape", () => {
  for (const shape of ["add-unknown", "sub-unknown", "sub-unknown-minuend", "mul-unknown", "both-sides"] as const) {
    const table = { shape, digits: shape === "mul-unknown" ? 2 : 3, balance: shape === "both-sides" };
    for (const exercise of items(erase(missingOperandFamily), table, ["free-entry"])) {
      const sentence = readSentence(exercise);
      assert.ok(sentence !== null, exercise.exerciseId);
      const box = integerAnswer(exercise);
      assert.ok(box > 0n, `${exercise.exerciseId}: the unknown is not positive`);

      if (sentence.shape === "both-sides") {
        assert.equal(sentence.leftA + sentence.leftB, box + sentence.rightKnown, exercise.exerciseId);
        assert.equal(classify(exercise, { kind: "integer", value: rational(sentence.leftA + sentence.leftB) }), MIS_EQUALS_AS_OPERATOR);
        assert.equal(
          classify(exercise, {
            kind: "integer",
            value: rational(sentence.leftA + sentence.leftB + sentence.rightKnown),
          }),
          MIS_ADD_ALL_NUMBERS,
        );
        // The scale holds the finished side and the part that is already there.
        assert.ok(exercise.representation !== undefined, exercise.exerciseId);
        assert.equal(exercise.representation.params["left"], Number(sentence.leftA + sentence.leftB));
        assert.equal(exercise.representation.params["right"], Number(sentence.rightKnown));
      } else if (sentence.shape === "add-unknown") {
        assert.equal(sentence.known + box, sentence.total, exercise.exerciseId);
      } else if (sentence.shape === "sub-unknown") {
        assert.equal(sentence.known - box, sentence.total, exercise.exerciseId);
      } else if (sentence.shape === "sub-unknown-minuend") {
        assert.equal(box - sentence.known, sentence.total, exercise.exerciseId);
        // Adding every number on the card *is* the answer here, so the rule is
        // undefined on this shape and must not be diagnosed.
        assert.equal(classify(exercise, { kind: "integer", value: rational(box) }), null);
      } else {
        assert.equal(sentence.known * box, sentence.total, exercise.exerciseId);
        assert.equal(sentence.total % sentence.known, 0n, `${exercise.exerciseId}: a missing factor with a remainder`);
      }
    }
  }
});

test("missing-operand: a one-digit missing addend has exactly 81 items in the world, and they are the 81", () => {
  // `dw.alg.equality.missing-addend` L0 is `sentence("add-unknown", 1)`: the known
  // addend and the answer are each drawn 1..9 and nothing else varies, so the true
  // variant space is 9 × 9 = 81 — countable, not estimable.
  //
  // The sweep's `N²/2C` estimator reads ~298 on this level and CG-10 at 200 seeds
  // reads 161; the node declares `minVariants: 40`, half its entire universe.
  //
  // **This test used to end "it is not a floor to negotiate, it is a generator that
  // needs more shapes", and that reading has been reversed.** There are no more shapes
  // to add at one digit: the eighty-one are the single-digit addition facts read
  // backwards, the same closed set `dw.add.facts.add-within-ten` already declares a
  // *nine*-item slice of, and a row that may not repeat one of eighty-one facts in a
  // forty-item run is a row that may not teach number facts. So L0 declares
  // `closedFactSet: 81` and CG-10 measures the count against it instead of against the
  // floor — a sharper check, since it fails on an eighty-second.
  //
  // Which makes the count a claim about the mathematics rather than about a draw, so it
  // is pinned from both ends: the set is enumerated independently below and the
  // generator is required to reach **every** member. A generator that drew eighty-one
  // distinct sentences that were not these eighty-one would pass the size assertion
  // alone.
  const drawn = items(
    erase(missingOperandFamily),
    { shape: "add-unknown", digits: 1, balance: false },
    ["free-entry"],
    4000,
  );
  assert.equal(new Set(drawn.map(fingerprintItem)).size, 81, "the one-digit add-unknown space is 9 × 9");

  // `known + ☐ = total`, so the pair on the card is (known, known + answer).
  const wanted = new Set<string>();
  for (let known = 1n; known <= 9n; known++) {
    for (let answer = 1n; answer <= 9n; answer++) {
      wanted.add(`${String(known)}+${String(known + answer)}=${String(answer)}`);
    }
  }
  const reached = new Set<string>();
  for (const exercise of drawn) {
    const known = exercise.prompt.slots["known"];
    const total = exercise.prompt.slots["total"];
    assert.ok(known?.kind === "number" && total?.kind === "number", "a one-digit missing addend lost a slot");
    const value = exercise.answer.canonical;
    assert.equal(value.kind, "integer");
    reached.add(
      `${rationalToString(known.value)}+${rationalToString(total.value)}=${rationalToString(value.value)}`,
    );
  }
  assert.deepEqual([...reached].sort(), [...wanted].sort(), "the eighty-one drawn are not the eighty-one there are");

  // And the two levels above it, which take the ordinary floor and clear it by an order
  // of magnitude. Pinned as floors rather than exact counts — they are draws from a
  // space far larger than the sample, so an exact number would be a fact about the
  // seed count — because the claim `closedFactSet: [81, null, null]` makes about L1 and
  // L2 is precisely that they are *not* closed.
  for (const [digits, floor] of [
    [2, 7000],
    [3, 19000],
  ] as const) {
    const size = new Set(
      items(erase(missingOperandFamily), { shape: "add-unknown", digits, balance: false }, ["free-entry"], 20000).map(
        fingerprintItem,
      ),
    ).size;
    assert.ok(
      size >= floor,
      `${String(digits)}-digit add-unknown drew only ${String(size)} distinct items in 20,000 seeds — ` +
        `it is declared open and must clear CG-10's floor on its own`,
    );
  }
});

test("missing-operand: the balance scale is rejected on a sentence with one side", () => {
  assert.equal(missingOperandParamSchema.validate({ shape: "add-unknown", digits: 2, balance: true }).ok, false);
  assert.equal(missingOperandParamSchema.validate({ shape: "both-sides", digits: 2, balance: true }).ok, true);
});

// ------------------------------------------------------ validators, everywhere

test("every validator rejects the parameter set that admits no item", () => {
  // A validator is the first half of "never emits a contradictory or ambiguous
  // problem": it is what lets `generate()` treat an infeasible draw as a bug
  // rather than as input it has to guess about. Each case below is a level table
  // somebody could plausibly write, and each one has no item in it at all.

  // Two denominators above a shared numerator need room for two of them.
  assert.equal(
    compareOrderParamSchema.validate({ numberType: "fraction", task: "greater", maxDenominator: 3, sameNumerator: true }).ok,
    false,
  );
  // A shared prefix cannot be the whole number, or the two are the same number.
  assert.equal(
    compareOrderParamSchema.validate({ numberType: "whole", task: "greater", digits: 3, sharedPrefix: 3 }).ok,
    false,
  );
  // A backwards place range.
  assert.equal(roundEstimateParamSchema.validate({ digits: 4, minPlace: 3, maxPlace: 1, ties: false }).ok, false);
  // Rounding to a place at or above the number's own width answers itself.
  assert.equal(roundEstimateParamSchema.validate({ digits: 3, minPlace: 3, maxPlace: 3, ties: false }).ok, false);
  // A fraction scaled by up to six has a denominator of at least twelve; a
  // ceiling of eight admits nothing.
  assert.equal(
    fracEquivalenceParamSchema.validate({ task: "simplify", maxDenominator: 8, maxFactor: 6, maxWhole: 1 }).ok,
    false,
  );
  // A denominator that is a multiple of another needs room for both.
  assert.equal(
    fracArithParamSchema.validate({ op: "add", denominators: "multiple", maxDenominator: 4, lowestTerms: false }).ok,
    false,
  );
  // …and the healthy tables those were built from all validate.
  assert.equal(
    compareOrderParamSchema.validate({ numberType: "fraction", task: "greater", maxDenominator: 20, sameNumerator: true }).ok,
    true,
  );
  assert.equal(roundEstimateParamSchema.validate({ digits: 4, minPlace: 1, maxPlace: 3, ties: true }).ok, true);
  assert.equal(
    fracEquivalenceParamSchema.validate({ task: "simplify", maxDenominator: 24, maxFactor: 6, maxWhole: 1 }).ok,
    true,
  );
  assert.equal(
    fracArithParamSchema.validate({ op: "add", denominators: "multiple", maxDenominator: 12, lowestTerms: false }).ok,
    true,
  );
});
