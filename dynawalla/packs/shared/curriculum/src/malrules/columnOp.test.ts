/**
 * The mal-rule tests.
 *
 * These assert the mathematics against worked examples, by hand, because the one
 * error this program has already had to correct is a *mapping* error between two
 * individually-valid rules — and no gate can catch that. CG-12 only measures that
 * each rule diverges from the correct answer; both of these do, on nearly every
 * seed. The mapping is only ever as good as the assertions in this file.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { fromScaled, add as ratAdd, sub as ratSub, toDecimalString, rational } from "../math/rational.ts";
import { COLUMN_OP_FAMILY, COLUMN_OP_FAMILY_REV, PROMPT_KEY_ADD, PROMPT_KEY_SUB } from "../generators/columnOp/constants.ts";
import type { AnswerValue } from "../types/answer.ts";
import type { Exercise } from "../types/exercise.ts";
import { familyId, malRuleId, skillId } from "../types/ids.ts";
import type { MalRule } from "../types/malrule.ts";
import {
  MIS_BORROW_ACROSS_ZERO,
  MIS_CARRY_DROPPED,
  MIS_SMALLER_FROM_LARGER,
  REP_COUNTING_BOARD,
  borrowAcrossZero,
  carryDropped,
  correctBorrows,
  correctCarries,
  smallerFromLarger,
} from "./columnOp.ts";
import { classify, classifyAll, malRulesForFamily } from "./registry.ts";

const SKILL = skillId("dw.add.regroup.subtract-across-zero");

/**
 * Build a column-op item by hand. Mal-rules read the public `Exercise` contract,
 * so an item assembled here exercises exactly the same path as a generated one —
 * and it lets a worked example be written as the worked example, rather than found
 * by hunting for the seed that produces it (5001 − 2798 is one draw in ~126,000).
 */
function item(top: bigint, bottom: bigint, op: "sub" | "add" = "sub", decimalPlaces = 0): Exercise {
  const topValue = fromScaled(top, decimalPlaces);
  const bottomValue = fromScaled(bottom, decimalPlaces);
  const answer = op === "sub" ? ratSub(topValue, bottomValue) : ratAdd(topValue, bottomValue);
  const width = Math.max(top.toString().length, bottom.toString().length);
  return {
    exerciseId: `${COLUMN_OP_FAMILY}@1:${SKILL}:L0:0`,
    skillId: SKILL,
    level: 0,
    seed: 0,
    family: COLUMN_OP_FAMILY,
    familyRev: COLUMN_OP_FAMILY_REV,
    form: "free-entry",
    prompt: {
      key: op === "sub" ? PROMPT_KEY_SUB : PROMPT_KEY_ADD,
      slots: {
        top: { kind: "number", value: topValue, decimalPlaces },
        bottom: { kind: "number", value: bottomValue, decimalPlaces },
      },
    },
    schema: { kind: "integer", digits: width + (op === "add" ? 1 : 0), decimalPlaces },
    answer: { canonical: { kind: "integer", value: answer }, alsoAccept: [] },
    distractors: [],
    check: { kind: "exact" },
    solution: [],
  };
}

function valueOf(answer: AnswerValue | null): string {
  assert.ok(answer !== null, "expected the rule to produce an answer");
  assert.ok(answer.kind === "integer", "expected an integer answer");
  return toDecimalString(answer.value, 0) ?? "?";
}

function decimalValueOf(answer: AnswerValue | null, places: number): string {
  assert.ok(answer !== null, "expected the rule to produce an answer");
  assert.ok(answer.kind === "integer", "expected an integer answer");
  return toDecimalString(answer.value, places) ?? "?";
}

test("mal-rule: 5001 − 2798 separates the two subtraction bugs", () => {
  const exercise = item(5001n, 2798n);
  assert.equal(valueOf(exercise.answer.canonical), "2203", "the correct answer");

  // |5−2| |0−7| |0−9| |1−8| — the smaller digit taken from the larger in every
  // column, no regrouping anywhere. Not off by a place-value unit at all.
  assert.ok(smallerFromLarger.applies(exercise));
  assert.equal(valueOf(smallerFromLarger.apply(exercise)), "3797");

  // Regrouped all the way down: the zeros became 9s and the thousands digit was
  // never decremented, so the answer is exactly 1,000 too big.
  assert.ok(borrowAcrossZero.applies(exercise));
  assert.equal(valueOf(borrowAcrossZero.apply(exercise)), "3203");

  const canonical = exercise.answer.canonical;
  assert.ok(canonical.kind === "integer");
  const borrowBug = borrowAcrossZero.apply(exercise);
  assert.ok(borrowBug !== null && borrowBug.kind === "integer");
  assert.equal(
    toDecimalString(ratSub(borrowBug.value, canonical.value), 0),
    "1000",
    "borrow-across-zero is the correct answer plus the thousand that was never given up",
  );
});

test("mal-rule: the classifier does not confuse the two", () => {
  const exercise = item(5001n, 2798n);
  const wrongBySmallerFromLarger = smallerFromLarger.apply(exercise);
  const wrongByBorrowAcrossZero = borrowAcrossZero.apply(exercise);
  assert.ok(wrongBySmallerFromLarger !== null && wrongByBorrowAcrossZero !== null);

  assert.equal(classify(exercise, wrongBySmallerFromLarger), MIS_SMALLER_FROM_LARGER);
  assert.equal(classify(exercise, wrongByBorrowAcrossZero), MIS_BORROW_ACROSS_ZERO);
  assert.deepEqual(classifyAll(exercise, wrongBySmallerFromLarger), [MIS_SMALLER_FROM_LARGER]);
  assert.deepEqual(classifyAll(exercise, wrongByBorrowAcrossZero), [MIS_BORROW_ACROSS_ZERO]);
});

test("mal-rule: an answer no buggy procedure produces gets no diagnosis", () => {
  const exercise = item(5001n, 2798n);
  assert.equal(classify(exercise, exercise.answer.canonical), null, "the correct answer is not a bug");
  for (const offset of [1n, -1n, 7n, 100n, 900n]) {
    const canonical = exercise.answer.canonical;
    assert.ok(canonical.kind === "integer");
    const wrong: AnswerValue = { kind: "integer", value: ratAdd(canonical.value, rational(offset)) };
    const matched = classifyAll(exercise, wrong);
    // 3203 is exactly +1000 and 3797 is +1594, so none of these offsets can match.
    assert.deepEqual(matched, [], `offset ${String(offset)} should not match a rule`);
    assert.equal(classify(exercise, wrong), null);
  }
});

test("mal-rule: 602 − 437 is the other documented borrow-across-zero example", () => {
  const exercise = item(602n, 437n);
  assert.equal(valueOf(exercise.answer.canonical), "165");
  assert.ok(borrowAcrossZero.applies(exercise));
  assert.equal(valueOf(borrowAcrossZero.apply(exercise)), "265", "the hundred that was borrowed and never given up");
  assert.equal(valueOf(smallerFromLarger.apply(exercise)), "235", "|6−4| |0−3| |2−7|");
});

test("mal-rule: borrow-across-zero does not fire when no borrow crosses a zero", () => {
  // 52 − 28 needs a borrow, but from a non-zero digit, so the buggy procedure and
  // the correct one are the same procedure. `applies` is what keeps CG-12 honest:
  // without it this item would be counted as a non-divergent case.
  const exercise = item(52n, 28n);
  assert.equal(valueOf(exercise.answer.canonical), "24");
  assert.equal(borrowAcrossZero.applies(exercise), false);
  assert.equal(valueOf(borrowAcrossZero.apply(exercise)), "24", "it reproduces the correct procedure here");
  assert.ok(smallerFromLarger.applies(exercise));
  assert.equal(valueOf(smallerFromLarger.apply(exercise)), "36", "|5−2| |2−8|");
});

test("mal-rule: smaller-from-larger does not fire when nothing needs regrouping", () => {
  const exercise = item(58n, 23n);
  assert.equal(smallerFromLarger.applies(exercise), false);
  assert.equal(valueOf(smallerFromLarger.apply(exercise)), "35", "identical to the correct answer, hence not evidence");
});

test("mal-rule: carry-dropped adds every column and records no carry", () => {
  const exercise = item(47n, 25n, "add");
  assert.equal(valueOf(exercise.answer.canonical), "72");
  assert.ok(carryDropped.applies(exercise));
  assert.equal(valueOf(carryDropped.apply(exercise)), "62");

  const allNines = item(99n, 99n, "add");
  assert.equal(valueOf(allNines.answer.canonical), "198");
  assert.equal(valueOf(carryDropped.apply(allNines)), "88");

  const noCarry = item(21n, 34n, "add");
  assert.equal(carryDropped.applies(noCarry), false);
  assert.equal(valueOf(carryDropped.apply(noCarry)), "55", "identical to the correct answer, hence not evidence");
});

test("mal-rule: each rule declines an item it has nothing to say about", () => {
  const subtraction = item(5001n, 2798n);
  const addition = item(47n, 25n, "add");
  assert.equal(carryDropped.apply(subtraction), null);
  assert.equal(carryDropped.applies(subtraction), false);
  assert.equal(smallerFromLarger.apply(addition), null);
  assert.equal(borrowAcrossZero.apply(addition), null);
  assert.equal(smallerFromLarger.applies(addition), false);
  assert.equal(borrowAcrossZero.applies(addition), false);

  // An item whose prompt has no operand slots — a shape from some other family —
  // is declined rather than guessed at.
  const slotless: Exercise = { ...subtraction, prompt: { ...subtraction.prompt, slots: {} } };
  assert.equal(smallerFromLarger.apply(slotless), null);
  assert.equal(borrowAcrossZero.apply(slotless), null);
  assert.equal(carryDropped.apply({ ...addition, prompt: { ...addition.prompt, slots: {} } }), null);
});

test("mal-rule: an undefined buggy procedure returns null rather than nonsense", () => {
  // 102 − 456 is not a well-formed item (the answer would be negative). The buggy
  // procedure runs out of digits to borrow from, and must decline rather than
  // invent a wrap-around.
  const malformed = item(102n, 456n);
  assert.equal(borrowAcrossZero.apply(malformed), null);
  assert.equal(borrowAcrossZero.applies(malformed), false);
});

test("mal-rule: the bugs work on decimals too", () => {
  const exercise = item(501n, 279n, "sub", 1);
  assert.equal(decimalValueOf(exercise.answer.canonical, 1), "22.2");
  assert.equal(decimalValueOf(smallerFromLarger.apply(exercise), 1), "37.8", "|5−2| |0−7| |1−9|");
  assert.ok(borrowAcrossZero.applies(exercise));
  assert.equal(decimalValueOf(borrowAcrossZero.apply(exercise), 1), "32.2", "ten tenths never given up");
});

test("mal-rule: two rules that agree on an answer produce no diagnosis at all", () => {
  // A confident diagnosis that names one of two equally likely bugs is worse than
  // none: Stage 2 would show a contrast pair built for a misconception the child
  // may not hold. Ambiguity has to route to Stage 3.
  const exercise = item(5001n, 2798n);
  const twin = (id: string): MalRule => ({
    id: malRuleId(id),
    family: COLUMN_OP_FAMILY,
    locateCapable: false,
    applies: () => true,
    apply: (target) => smallerFromLarger.apply(target),
  });
  const rules = [smallerFromLarger, twin("mis.add.smaller-from-larger-twin")];
  const wrong = smallerFromLarger.apply(exercise);
  assert.ok(wrong !== null);
  assert.equal(classifyAll(exercise, wrong, rules).length, 2);
  assert.equal(classify(exercise, wrong, rules), null);
});

test("mal-rule: a rule from another family never fires on this item", () => {
  const exercise = item(5001n, 2798n);
  const foreign: MalRule = {
    id: malRuleId("mis.frac.add-numerators-and-denominators"),
    family: familyId("gen.frac.arith"),
    locateCapable: false,
    applies: () => true,
    apply: () => exercise.answer.canonical,
  };
  assert.deepEqual(classifyAll(exercise, exercise.answer.canonical, [foreign]), []);
});

test("mal-rule: registry metadata is honest about LOCATE", () => {
  assert.equal(borrowAcrossZero.locateCapable, true);
  assert.equal(borrowAcrossZero.contrastRep, REP_COUNTING_BOARD);
  // The contrast for smaller-from-larger is magnitude — a number line, not a
  // counting board — and that pair is not built, so it must not claim LOCATE.
  assert.equal(smallerFromLarger.locateCapable, false);
  assert.equal(smallerFromLarger.contrastRep, undefined);
  assert.equal(carryDropped.locateCapable, false);
  assert.deepEqual(
    malRulesForFamily(COLUMN_OP_FAMILY).map((rule) => rule.id),
    [MIS_SMALLER_FROM_LARGER, MIS_BORROW_ACROSS_ZERO, MIS_CARRY_DROPPED],
  );
  assert.deepEqual(malRulesForFamily(familyId("gen.frac.arith")), []);
});

test("mal-rule: the shared procedure helpers agree with the worked examples", () => {
  assert.deepEqual(correctBorrows([1, 0, 0, 5], [8, 9, 7, 2], 4), [true, true, true, false]);
  assert.deepEqual(correctBorrows([2, 5], [8, 2], 2), [true, false]);
  assert.deepEqual(correctBorrows([8, 5], [3, 2], 2), [false, false]);
  assert.deepEqual(correctCarries([7, 4], [5, 2], 2), [true, false]);
  assert.deepEqual(correctCarries([9, 9], [9, 9], 2), [true, true]);
  assert.deepEqual(correctCarries([1, 2], [4, 3], 2), [false, false]);
});
