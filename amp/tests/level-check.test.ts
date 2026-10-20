import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_CHECK_EVERY,
  levelCheckDue,
  levelRange,
  trendCounts,
} from "../src/learning/level-check";
import { trialLimits } from "../src/server/trials";
import {
  approximateAge,
  levelCopy,
} from "../src/web/features/trial/level-copy";

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

test("the likely range is the 90% interval, kept between K and college", () => {
  const [from, to] = levelRange({ level: 4, sd: 1 });
  assert.ok(Math.abs(from - 2.36) < 1e-9 && Math.abs(to - 5.64) < 1e-9);
  assert.deepEqual(levelRange({ level: 0.5, sd: 2.5 }), [0, 0.5 + 1.64 * 2.5]);
  assert.deepEqual(levelRange({ level: 12.5, sd: 2 }), [12.5 - 3.28, 13]);
});

test("the level check states a best guess, a range and age only when known", () => {
  assert.equal(
    levelCopy.range({ answered: 5, from: "K", to: "Grade 8", age: 10 }),
    "You’re about 10 and have answered 5 problems, so we think you’re somewhere between K and Grade 8.",
  );
  assert.equal(
    levelCopy.range({ answered: 30, from: "Grade 4", to: "Grade 5" }),
    "After 30 problems, we think you’re somewhere between Grade 4 and Grade 5.",
  );
  assert.equal(
    levelCopy.range({ answered: 60, from: "Grade 4", to: "Grade 4" }),
    "After 60 problems, we’re fairly sure you’re at Grade 4.",
  );
  assert.equal(
    levelCopy.bestGuess("Grade 4"),
    "Our current best guess is Grade 4.",
  );
  assert.equal(approximateAge(2016, new Date("2026-10-20")), 10);
  assert.equal(approximateAge(null), undefined);
  assert.equal(approximateAge(1800, new Date("2026-10-20")), undefined);
  // Never hype, never a comparison that could read as a judgement.
  const sample = { answered: 5, from: "K", to: "Grade 2", level: "Grade 1" };
  const words = Object.values(levelCopy)
    .map((entry) =>
      typeof entry === "function"
        ? (entry as (p: unknown) => string)(
            entry === levelCopy.eyebrow
              ? 5
              : entry === levelCopy.bestGuess
                ? "Grade 1"
                : { ...sample, area: "Numbers", age: 7 },
          )
        : entry,
    )
    .join(" ")
    .toLowerCase();
  for (const banned of ["!", "amazing", "genius", "behind", "below", "ahead"])
    assert.ok(!words.includes(banned), `no "${banned}" in the level check`);
});
