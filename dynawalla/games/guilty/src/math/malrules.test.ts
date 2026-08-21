import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  addedInstead,
  borrowNotPaid,
  carryDropped,
  carryWrittenInline,
  digitsReversed,
  droppedStep,
  leftToRight,
  offByOne,
  remainderAsQuotient,
  smallerFromLarger,
  tableSlip,
} from "./malrules.ts";

test("smaller-from-larger takes each column the easy way round", () => {
  assert.equal(smallerFromLarger(52, 27), 35);
  assert.equal(smallerFromLarger(5001, 2798), 3797); // the curriculum's own example
  assert.equal(smallerFromLarger(83, 46), 43);
});

test("borrow-not-paid adds the ten and never gives it back", () => {
  // 52 − 27: 12−7=5, then 5−2=3 because the 5 was never decremented.
  assert.equal(borrowNotPaid(52, 27), 35);
  // Three digits separate it from smaller-from-larger.
  assert.equal(borrowNotPaid(413, 168), 355);
  assert.equal(smallerFromLarger(413, 168), 355);
  assert.equal(borrowNotPaid(302, 147), 265);
  assert.equal(smallerFromLarger(302, 147), 245);
});

test("borrow-not-paid never disagrees with correct subtraction when no column borrows", () => {
  for (let a = 10; a < 100; a++) {
    for (let b = 0; b <= a; b++) {
      if (a % 10 >= b % 10) assert.equal(borrowNotPaid(a, b), a - b);
    }
  }
});

test("carry-dropped keeps every column under ten", () => {
  assert.equal(carryDropped(27, 45), 62);
  assert.equal(carryDropped(8, 7), 5);
  assert.equal(carryDropped(66, 66), 22);
});

test("carry-written-inline spills the tens digit sideways", () => {
  assert.equal(carryWrittenInline(27, 45), 612);
  assert.equal(carryWrittenInline(8, 7), 15);
});

test("table-slip is one rung of the times table away", () => {
  assert.equal(tableSlip(7, 6, -1), 35);
  assert.equal(tableSlip(7, 6, 1), 49);
  assert.equal(tableSlip(9, 4, -1), 27);
});

test("assorted rules", () => {
  assert.equal(addedInstead(7, 6), 13);
  assert.equal(offByOne(42, -1), 41);
  assert.equal(remainderAsQuotient(45, 9), 36);
  assert.equal(remainderAsQuotient(47, 9), 2);
  assert.equal(leftToRight(2, "+", 3, "*", 4), 20);
  assert.equal(droppedStep(2, "+", 3), 5);
  assert.equal(digitsReversed(71), 17);
});
