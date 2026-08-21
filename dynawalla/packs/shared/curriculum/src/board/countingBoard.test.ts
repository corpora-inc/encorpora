/**
 * The counting-board contrast pair, tested against the library's own graph and its
 * own executable mal-rule.
 *
 * The wrong answers here are not invented and not derived from the right one: each
 * is what `borrowAcrossZero.apply` — the buggy procedure, run column by column —
 * actually produces on that item. A test that fabricated the child's answer would
 * be checking the board against itself.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { rational, toScaled } from "../math/rational.ts";
import { columnOpFamily } from "../generators/columnOp/family.ts";
import { COLUMN_OP_FAMILY, FORM_FREE_ENTRY, SLOT_BOTTOM, SLOT_TOP } from "../generators/columnOp/constants.ts";
import { activeNodes, allNodes } from "../graph/graph.ts";
import { borrowAcrossZero, smallerFromLarger, REP_COUNTING_BOARD } from "../malrules/columnOp.ts";
import { classify } from "../malrules/registry.ts";
import { skillId } from "../types/ids.ts";
import type { SkillId } from "../types/ids.ts";
import type { AnswerValue } from "../types/answer.ts";
import type { Exercise } from "../types/exercise.ts";
import { countingBoard } from "./countingBoard.ts";
import { digitsOf, plainDigits, readProblem, writtenAnswer } from "./problem.ts";

const SUBTRACT_MULTIDIGIT = skillId("dw.add.regroup.subtract-multidigit");
const SUBTRACT_ACROSS_ZERO = skillId("dw.add.regroup.subtract-across-zero");

/** An exact integer answer value. */
function answerOf(value: bigint): AnswerValue {
  return { kind: "integer", value: rational(value) };
}

function generateAt(id: SkillId, level: number, seed: number): Exercise {
  const node = allNodes.find((candidate) => candidate.id === id);
  assert.ok(node !== undefined, `fixture needs ${id}`);
  const params = node.generator.params[level];
  const validated = columnOpFamily.paramSchema.validate(params);
  assert.ok(validated.ok, `level ${String(level)} of ${id} has invalid params`);
  return columnOpFamily.generate({
    skillId: id,
    level,
    seed,
    params: validated.value,
    forms: [FORM_FREE_ENTRY],
  });
}

/** The scaled whole-unit value of a prompt slot, or `null`. */
function operand(exercise: Exercise, slot: string): bigint | null {
  const value = exercise.prompt.slots[slot];
  if (value === undefined || value.kind !== "number") return null;
  return toScaled(value.value, value.decimalPlaces);
}

const SEARCH_LIMIT = 400_000;

/**
 * A real generated item with these operands, found by seed search rather than
 * hand-built. A literal could drift from what the generator emits; this cannot.
 * `exerciseIdOf` mixes `familyRev` into the seed, so a legitimate generator change
 * moves every seed at once and the search simply finds the new one.
 */
function itemFor(id: SkillId, level: number, top: bigint, bottom: bigint): Exercise {
  for (let seed = 0; seed < SEARCH_LIMIT; seed++) {
    const exercise = generateAt(id, level, seed);
    if (operand(exercise, SLOT_TOP) === top && operand(exercise, SLOT_BOTTOM) === bottom) return exercise;
  }
  throw new Error(`no seed under ${String(SEARCH_LIMIT)} produces ${top.toString()} − ${bottom.toString()}`);
}

/** `5001 − 2798`, on the across-zero node's hardest level. */
function fiveThousandOne(): Exercise {
  return itemFor(SUBTRACT_ACROSS_ZERO, 2, 5001n, 2798n);
}

/** `903 − 778` — the shape where digit-wise and quantity-wise drawings disagree. */
function nineHundredThree(): Exercise {
  return itemFor(SUBTRACT_MULTIDIGIT, 2, 903n, 778n);
}

test("the item reader takes the operands from the public prompt contract", () => {
  const exercise = fiveThousandOne();
  const problem = readProblem(exercise);
  assert.ok(problem !== null);
  assert.equal(problem.op, "sub");
  assert.equal(problem.top, "5001");
  assert.equal(problem.bottom, "2798");
  assert.equal(problem.topScaled, 5001n);
  assert.equal(problem.bottomScaled, 2798n);
  assert.equal(problem.decimalPlaces, 0);
  assert.equal(writtenAnswer(exercise), "2203");

  assert.deepEqual(digitsOf(5001n), [5, 0, 0, 1]);
  assert.throws(() => digitsOf(-1n), RangeError);
  // A third is not a decimal: the reader declines rather than inventing 0.333.
  assert.equal(plainDigits(rational(1n, 3n), 3), null);
  assert.equal(plainDigits(rational(2203n), 0), "2203");
});

test("the counting board holds the contradiction, in exact whole counters", () => {
  const exercise = fiveThousandOne();

  // The child's answer is the buggy procedure's own output, not a number chosen
  // to make the test pass.
  const yours = borrowAcrossZero.apply(exercise);
  assert.ok(yours !== null);
  assert.equal(borrowAcrossZero.applies(exercise), true);
  assert.deepEqual(yours, answerOf(3203n));

  const board = countingBoard(exercise, yours);
  assert.ok(board !== null);

  assert.equal(board.minuend, "5001");
  assert.equal(board.subtrahend, "2798");

  // One column set, shared: the hundreds of one plate sit under the hundreds of
  // the other, which is the only way "side by side" is a comparison at all.
  assert.deepEqual([...board.places], [3, 2, 1, 0]);
  assert.equal(board.correct.columns.length, board.places.length);
  assert.equal(board.yours.columns.length, board.places.length);

  // The correct answer closes the board.
  assert.equal(board.correct.addend, "2203");
  assert.equal(board.correct.sum, "5001");
  assert.equal(board.correct.rebuilds, true);
  assert.ok(board.correct.columns.every((c) => c.seated === c.sockets && c.spare === 0));

  // The child's does not, and the surplus is exactly one counter in the thousands
  // column — the thousand that was borrowed and never given up.
  assert.equal(board.yours.addend, "3203");
  assert.equal(board.yours.sum, "6001");
  assert.equal(board.yours.rebuilds, false);
  assert.deepEqual(
    board.yours.columns.find((c) => c.place === 3),
    { place: 3, sockets: 5, seated: 5, spare: 1 },
  );
  assert.equal(
    board.yours.columns.reduce((n, c) => n + c.spare, 0),
    1,
    "one counter over, not a scattering",
  );
});

test("903 − 778 answered 225: one hundred over, and nine hundreds still seated", () => {
  // The shape that broke the first version of this module, and why it was
  // rewritten to compare quantities rather than digits. Putting 225 back gives
  // 225 + 778 = 1003 against a board carved for 903. Digit-wise that reads nine
  // EMPTY hundreds and a counter in a thousands column the correct plate does not
  // have — true of the digits, false of the board — and a child reads it as "I
  // lost all nine hundreds" on the one screen meant to repair regrouping.
  assert.equal(903n - 778n, 125n);
  assert.equal(125n + 100n, 225n);
  assert.equal(225n + 778n, 1003n);

  const exercise = nineHundredThree();
  const yours = borrowAcrossZero.apply(exercise);
  assert.ok(yours !== null);
  assert.deepEqual(yours, answerOf(225n), "the buggy procedure itself produces 225 here");

  const board = countingBoard(exercise, yours);
  assert.ok(board !== null);
  assert.deepEqual([...board.places], [3, 2, 1, 0]);

  assert.deepEqual(
    [...board.correct.columns],
    [
      { place: 3, sockets: 0, seated: 0, spare: 0 },
      { place: 2, sockets: 9, seated: 9, spare: 0 },
      { place: 1, sockets: 0, seated: 0, spare: 0 },
      { place: 0, sockets: 3, seated: 3, spare: 0 },
    ],
  );
  assert.deepEqual(
    [...board.yours.columns],
    [
      { place: 3, sockets: 0, seated: 0, spare: 0 },
      // Nine hundreds seated, exactly as on the plate above, and one over.
      { place: 2, sockets: 9, seated: 9, spare: 1 },
      { place: 1, sockets: 0, seated: 0, spare: 0 },
      { place: 0, sockets: 3, seated: 3, spare: 0 },
    ],
  );
});

test("no contrast card ever draws a hole the other plate fills", () => {
  // Every level of every active subtraction node, every seed, and the mal-rule's
  // own output as the child's answer. The old digit-wise model failed this on
  // 11–16% of contrast cards per rung; every test it had used `5001 − 2798` or
  // `606 − 199`, the shapes where the surplus does not carry.
  const SEEDS = 1000;
  let cards = 0;

  for (const node of activeNodes(allNodes)) {
    // The board is a place-value drawing of a column subtraction, so only the rows
    // that bind `gen.arith.column-op` can produce one. The number-fact rows below
    // them are active and bind a different family, and `generateAt` would hand
    // their parameters to the wrong schema.
    if (node.generator.family !== COLUMN_OP_FAMILY) continue;
    node.generator.params.forEach((_params, level) => {
      for (let seed = 0; seed < SEEDS; seed++) {
        const exercise = generateAt(node.id, level, seed);
        const problem = readProblem(exercise);
        if (problem === null || problem.op !== "sub") continue;
        if (!borrowAcrossZero.applies(exercise)) continue;

        const yours = borrowAcrossZero.apply(exercise);
        if (yours === null) continue;
        const board = countingBoard(exercise, yours);
        if (board === null) continue;
        cards += 1;

        const where = `${node.id} L${String(level)} seed ${String(seed)}: ${problem.top} − ${problem.bottom}`;
        for (const plate of [board.correct, board.yours] as const) {
          assert.equal(plate.columns.length, board.places.length, `${where}: plates disagree on columns`);
          for (const column of plate.columns) {
            assert.equal(column.seated, column.sockets, `${where}: an empty socket at 10^${String(column.place)}`);
          }
        }

        // The child's plate holds exactly their own check, no more and no less.
        const drawn = board.yours.columns.reduce(
          (total, c) => total + BigInt(c.seated + c.spare) * 10n ** BigInt(c.place),
          0n,
        );
        assert.equal(drawn.toString(), board.yours.sum, `${where}: the plate is not the child's sum`);
        assert.equal(
          board.correct.columns.every((c) => c.spare === 0),
          true,
          `${where}: the correct plate spills`,
        );
        assert.equal(board.correct.rebuilds, true, where);
        assert.equal(board.yours.rebuilds, false, where);
      }
    });
  }

  assert.ok(cards > 2000, `only ${String(cards)} contrast cards exercised`);
});

test("the board is declined when it would show no contradiction", () => {
  const exercise = fiveThousandOne();

  // The right answer closes the board, so there is nothing to point at.
  assert.equal(countingBoard(exercise, answerOf(2203n)), null);
  // A check that comes to LESS than the board holds has no honest place-by-place
  // drawing — empty sockets and stranded counters at once — so Stage 1 it is.
  assert.equal(countingBoard(exercise, answerOf(2103n)), null);
  assert.equal(countingBoard(exercise, answerOf(-1n)), null);
  // Not a value this board can place counters for.
  assert.equal(countingBoard(exercise, { kind: "choice", index: 0 }), null);

  // Addition is not a subtraction check.
  const sum = generateAt(skillId("dw.add.regroup.add-multidigit"), 0, 1);
  assert.equal(countingBoard(sum, answerOf(1n)), null);
});

test("the board is never built for the misconception it does not explain", () => {
  // 3797 on 5001 − 2798 is `mis.add.smaller-from-larger`: |5−2| |0−7| |0−9| |1−8|,
  // the smaller digit taken from the larger in every column. It is not off by a
  // place-value unit at all — 3797 + 2798 = 6595, and 6595 − 5001 = 1594, not a
  // single counter anywhere — so counters would show two unrelated numbers rather
  // than a contradiction.
  //
  // The library's guard is the mal-rule declaration, and it is what a pack must
  // route on: this rule is not LOCATE-capable and names no contrast
  // representation, so there is nothing for a pack to draw.
  const exercise = fiveThousandOne();
  const theirs = smallerFromLarger.apply(exercise);
  assert.ok(theirs !== null);
  assert.deepEqual(theirs, answerOf(3797n));
  assert.equal(3797n + 2798n, 6595n);
  assert.notEqual(6595n - 5001n, 1000n);

  assert.equal(classify(exercise, theirs), smallerFromLarger.id);
  assert.equal(smallerFromLarger.locateCapable, false);
  assert.equal(smallerFromLarger.contrastRep, undefined);

  // And the rule the board *does* explain declares it.
  assert.equal(classify(exercise, answerOf(3203n)), borrowAcrossZero.id);
  assert.equal(borrowAcrossZero.locateCapable, true);
  assert.equal(borrowAcrossZero.contrastRep, REP_COUNTING_BOARD);
});
