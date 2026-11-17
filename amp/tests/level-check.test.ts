import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_CHECK_EVERY,
  levelCheckDue,
  reportable,
  levelRange,
  levelDetails,
  shownRange,
  shownSpan,
  trendCounts,
  trendStep,
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
  assert.ok(Math.abs(from - 2.72) < 1e-9 && Math.abs(to - 5.28) < 1e-9);
  assert.deepEqual(levelRange({ level: 0.5, sd: 2.5 }), [0, 0.5 + 1.28 * 2.5]);
  assert.deepEqual(levelRange({ level: 12.5, sd: 2 }), [12.5 - 2.56, 13]);
});

test("an estimate's own likely range wins over its sd, skew and all", () => {
  // One correct answer from an adult: the range runs up, not around.
  assert.deepEqual(
    levelRange({ level: 9, sd: 2.1, low: 6.4, high: 12.6 }),
    [6.4, 12.6],
  );
  assert.deepEqual(
    levelRange({ level: 0.4, sd: 1, low: -0.8, high: 2 }),
    [0, 2],
  );
});

test("words and bar read one shown range: whole grades, open at precalculus", () => {
  // 5.3–10.7 names Grade 5 to Algebra 2, and the bar covers exactly those
  // grades (CP 2026-11-15: the bar ended near Geometry, the words said
  // Algebra 2).
  const shown = shownRange({ level: 8, sd: 1.6, low: 5.3, high: 10.7 });
  assert.deepEqual(shown, { from: 5, to: 11, openLow: false, openHigh: false });
  assert.deepEqual(shownSpan(shown), [4.5, 11.5]);
  // A range that reaches Precalculus is open above and drawn to the end.
  const open = shownRange({ level: 9, sd: 2.1, low: 6.4, high: 11.6 });
  assert.equal(open.openHigh, true);
  assert.equal(shownSpan(open)[1], 13);
  // One reaching kindergarten starts at the scale's start.
  const low = shownRange({ level: 2, sd: 1.5, low: 0.2, high: 4.1 });
  assert.deepEqual(low, { from: 0, to: 4, openLow: true, openHigh: false });
  assert.equal(shownSpan(low)[0], -1);
  // A narrow range is one grade.
  assert.deepEqual(
    shownSpan(shownRange({ level: 8, sd: 0.2, low: 7.7, high: 8.3 })),
    [7.5, 8.5],
  );
});

test("numeric readouts preserve hundredths and include estimates below the chart floor", () => {
  assert.deepEqual(levelDetails({ level: 7.49, sd: 0.5 }), {
    point: "7.49",
    from: "6.85",
    to: "8.13",
  });
  assert.deepEqual(levelDetails({ level: -0.67, sd: 0.4 }), {
    point: "-0.67",
    from: "-1.00",
    to: "-0.16",
  });
  assert.deepEqual(levelDetails({ level: 12.9, sd: 1 }), {
    point: "12.90",
    from: "11.62",
    to: "13.00",
  });
  assert.deepEqual(levelDetails({ level: 9, sd: 2, low: 6.4, high: 12.6 }), {
    point: "9.00",
    from: "6.40",
    to: "12.60",
  });
});

test("a long record's level path keeps to about the points asked for", () => {
  assert.equal(trendStep(40), 5);
  assert.equal(trendStep(0, 48), 5);
  assert.deepEqual(
    trendCounts(96, trendStep(96, 48)),
    [
      0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90,
      95, 96,
    ],
  );
  const long = trendCounts(2000, trendStep(2000, 48));
  assert.ok(long.length <= 49 && long.length >= 40, String(long.length));
  assert.equal(long[0], 0);
  assert.equal(long.at(-1), 2000);
});

test("a progress report is offered only once there is progress to report", () => {
  // No stored level, or one stored before any answer (Q-201): nothing yet.
  assert.equal(reportable(null), false);
  assert.equal(reportable({ overall: null }), false);
  assert.equal(reportable({ overall: { answered: 0 } }), false);
  // One answer behind it, or a level from a server that predates `answered`.
  assert.equal(reportable({ overall: { answered: 1 } }), true);
  assert.equal(reportable({ overall: {} }), true);
});
