import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_CHECK_EVERY,
  levelCheckDue,
  levelRange,
  levelDetails,
  trendCounts,
} from "../src/learning/level-check";
import { trialLimits } from "../src/server/trials";

test("a level check follows every fifth problem, except at placement's end and the limit", () => {
  assert.equal(LEVEL_CHECK_EVERY, 5);
  const limits = trialLimits(100);
  const due = Array.from({ length: 101 }, (_, used) => used).filter((used) =>
    levelCheckDue(used, limits),
  );
  assert.deepEqual(
    due,
    [5, 10, 15, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95],
  );
  // A small allowance: placement ends at 2, the limit is 10.
  assert.deepEqual(
    Array.from({ length: 11 }, (_, used) => used).filter((used) =>
      levelCheckDue(used, trialLimits(10)),
    ),
    [5],
  );
});

test("the trend samples the start, every step and the latest answer", () => {
  assert.deepEqual(trendCounts(0), [0]);
  assert.deepEqual(trendCounts(5), [0, 5]);
  assert.deepEqual(trendCounts(12), [0, 5, 10, 12]);
  assert.deepEqual(trendCounts(20), [0, 5, 10, 15, 20]);
});

test("the chart envelope is kept within the curriculum axis", () => {
  const [from, to] = levelRange({ level: 4, sd: 1 });
  assert.ok(Math.abs(from - 2.36) < 1e-9 && Math.abs(to - 5.64) < 1e-9);
  assert.deepEqual(levelRange({ level: 0.5, sd: 2.5 }), [0, 0.5 + 1.64 * 2.5]);
  assert.deepEqual(levelRange({ level: 12.5, sd: 2 }), [12.5 - 3.28, 13]);
});

test("numeric readouts preserve hundredths and include estimates below the chart floor", () => {
  assert.deepEqual(levelDetails({ level: 7.49, sd: 0.5 }), {
    point: "7.49",
    from: "6.67",
    to: "8.31",
  });
  assert.deepEqual(levelDetails({ level: -0.67, sd: 0.4 }), {
    point: "-0.67",
    from: "-1.00",
    to: "-0.01",
  });
  assert.deepEqual(levelDetails({ level: 12.9, sd: 1 }), {
    point: "12.90",
    from: "11.26",
    to: "13.00",
  });
});
