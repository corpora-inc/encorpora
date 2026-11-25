import { test } from "node:test";
import assert from "node:assert/strict";
import { paired } from "./placement-simulation.fixture";
import {
  answersToShow,
  answersToWork,
  errorAt,
  gradeCoverage,
  highestOffered,
  paceEngines,
  paceLearners,
  shareFarAbove,
  simulatePace,
  type PaceEngine,
  type PaceLearner,
  type PaceRun,
  type PaceType,
} from "./placement-pace.fixture";

// `npm run test:placement-sim`. The first answers of a learner who starts
// from their grade, on the engine before coverage and the current one, with
// the same simulated learners (scripts/simulate-placement-pace.ts prints the
// whole table). Synthetic regression scenarios, not evidence about real
// learners.

const SEEDS = 12;
const learner = (type: PaceType, expected: number) =>
  paceLearners().find(
    (candidate) => candidate.type === type && candidate.expected === expected,
  )!;
const runs = (who: PaceLearner, engine: PaceEngine, count: number) =>
  Array.from({ length: SEEDS }, (_, seed) =>
    simulatePace(who, { ...engine, seed: String(seed), count }),
  );
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)]!;
const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const compare = (
  before: PaceRun[],
  after: PaceRun[],
  pick: (run: PaceRun) => number,
) =>
  paired(
    before as unknown as Parameters<typeof paired>[0],
    after as unknown as Parameters<typeof paired>[1],
    pick as unknown as Parameters<typeof paired>[2],
  );

test("a learner who is right about everything climbs a grade at a time, not to high school", (t) => {
  for (const expected of [0, 3, 6]) {
    const who = learner("always right", expected);
    const before = runs(who, paceEngines.before, 40);
    const after = runs(who, paceEngines.after, 40);
    const top = (set: PaceRun[], first: number) =>
      Math.max(...set.map((run) => highestOffered(run, first)));
    const shown = (set: PaceRun[], answered: number) =>
      mean(set.map((run) => run.steps[answered - 1]!.shown));
    t.diagnostic(
      `from grade ${expected}: highest grade offered in 5/10/20/40, before ${[5, 10, 20, 40].map((n) => top(before, n)).join("/")}, after ${[5, 10, 20, 40].map((n) => top(after, n)).join("/")}; level shown at 20/40, before ${shown(before, 20).toFixed(1)}/${shown(before, 40).toFixed(1)}, after ${shown(after, 20).toFixed(1)}/${shown(after, 40).toFixed(1)}`,
    );
    // The first ten problems: the grade, and a stretch from the next.
    assert.ok(top(after, 10) <= expected + 1.5, `first 10: ${top(after, 10)}`);
    // The first twenty: no further than two grades and a half ahead.
    assert.ok(top(after, 20) <= expected + 2.5, `first 20: ${top(after, 20)}`);
    // Forty right answers earn two thirds of the grade (and of the next,
    // from kindergarten, where a grade is 17 skills), and a stretch past
    // them. Never eight grades.
    assert.ok(top(after, 40) <= expected + 3.5, `first 40: ${top(after, 40)}`);
    assert.ok(
      shown(after, 40) <= expected + 3.5,
      `level at 40: ${shown(after, 40)}`,
    );
    // Before, the same learner was past that within twenty.
    assert.ok(top(before, 20) >= expected + 5, `before: ${top(before, 20)}`);
    assert.ok(
      mean(after.map((run) => shareFarAbove(run, 20))) <= 0.05,
      "almost nothing in the first 20 is more than two grades ahead",
    );
  }
});

test("a learner four grades ahead is working within a grade of their level inside four sittings", (t) => {
  for (const expected of [0, 3, 6]) {
    const who = learner("four above", expected);
    const after = runs(who, paceEngines.after, 130);
    // Most of ten problems in a row within a grade of the level,
    const reached = after.map((run) => answersToWork(run) ?? Infinity);
    // and the first problem within a grade of it.
    const first = after.map(
      (run) => run.steps.findIndex((step) => step.grade >= who.level - 1) + 1,
    );
    t.diagnostic(
      `from grade ${expected}: working near the level from problem ${median(reached)} (median), ${Math.max(...reached)} (slowest); first problem within a grade of it ${median(first)} (median), ${Math.max(...first)} (slowest)`,
    );
    // A sitting is about 25 problems. Two thirds of each grade between is
    // earned on the way: about three sittings, four from grade 6.
    assert.ok(median(reached) <= 90, `median ${median(reached)}`);
    assert.ok(Math.max(...reached) <= 120, `slowest ${Math.max(...reached)}`);
    assert.ok(
      first.every((at) => at > 0 && at <= 85),
      `first within a grade: ${first.join(" ")}`,
    );
    // None of it by a leap: the first ten stay within a stretch of the grade.
    assert.ok(
      after.every((run) => highestOffered(run, 10) <= expected + 1.5),
      "first ten",
    );
    // And the level shown has arrived within a grade by a hundred answers.
    assert.ok(mean(after.map((run) => errorAt(run, 100))) <= 1);
  }
});

test("a learner two grades ahead reads within a grade of their level in two sittings, and works there", (t) => {
  for (const expected of [0, 3, 6]) {
    const who = learner("two above", expected);
    const after = runs(who, paceEngines.after, 90);
    const read = after.map((run) => answersToShow(run) ?? Infinity);
    const reached = after.map((run) => answersToWork(run) ?? Infinity);
    t.diagnostic(
      `from grade ${expected}: level within a grade from answer ${median(read)} (median), ${Math.max(...read)} (slowest); working near the level from problem ${median(reached)} (median), ${Math.max(...reached)} (slowest)`,
    );
    assert.ok(median(read) <= 25, `median ${median(read)}`);
    assert.ok(Math.max(...read) <= 50, `slowest ${Math.max(...read)}`);
    assert.ok(median(reached) <= 50, `work, median ${median(reached)}`);
    assert.ok(Math.max(...reached) <= 80, `work, slowest`);
  }
});

test("a learner at their grade meets more of it, and their level reads about as close", (t) => {
  for (const expected of [0, 3, 6]) {
    const who = learner("at grade", expected);
    const before = runs(who, paceEngines.before, 40);
    const after = runs(who, paceEngines.after, 40);
    const met = compare(before, after, (run) => -gradeCoverage(run, 40).skills);
    const error = compare(before, after, (run) => errorAt(run, 20));
    t.diagnostic(
      `from grade ${expected}: own-grade skills met by 40, before ${mean(before.map((run) => gradeCoverage(run, 40).skills)).toFixed(1)}, after ${mean(after.map((run) => gradeCoverage(run, 40).skills)).toFixed(1)}; error at 20 after − before ${JSON.stringify(error)}`,
    );
    assert.ok(met.noWorse, `skills met ${JSON.stringify(met)}`);
    assert.ok(
      mean(after.map((run) => gradeCoverage(run, 40).skills)) >= 12,
      "a dozen of the grade's skills by 40 answers",
    );
    assert.ok(
      mean(after.map((run) => gradeCoverage(run, 40).areas)) >= 3.5,
      "across the areas",
    );
    // Nothing harder than a stretch is asked until the grade is covered, so
    // less bounds the level from above. From grade 6 that costs about a
    // quarter of a grade after twenty answers (0.26 here), less by forty.
    assert.ok(error.mean <= 0.4, `error at 20 ${JSON.stringify(error)}`);
  }
});

test("a learner behind their grade is found as fast as before", (t) => {
  for (const [expected, level] of [
    [3, 1],
    [5, 3],
    [6, 4],
    [9, 7],
  ] as const) {
    const who: PaceLearner = {
      type: "two below",
      expected,
      level,
      model: { kind: "probit", slip: 0.03 },
    };
    const before = runs(who, paceEngines.before, 30);
    const after = runs(who, paceEngines.after, 30);
    const work = compare(before, after, (run) => answersToWork(run) ?? 31);
    const at10 = compare(before, after, (run) => errorAt(run, 10));
    const at20 = compare(before, after, (run) => errorAt(run, 20));
    t.diagnostic(
      `grade ${expected} at level ${level}, after − before: problems to work near level ${JSON.stringify(work)}, error at 10 ${JSON.stringify(at10)}, at 20 ${JSON.stringify(at20)}`,
    );
    // Work comes down within a problem of before, and the level shown is
    // within a quarter grade of before after ten answers and after twenty.
    assert.ok(work.mean <= 1, JSON.stringify(work));
    assert.ok(at10.mean <= 0.25, JSON.stringify(at10));
    assert.ok(at20.mean <= 0.25, JSON.stringify(at20));
  }
});

test("a learner with a long record is asked what they would have been asked", (t) => {
  const RECORD = 200;
  const NEXT = 15;
  for (const [type, expected] of [
    ["at grade", 3],
    ["two above", 3],
    ["four above", 6],
  ] as const) {
    const who = learner(type, expected);
    const whole = simulatePace(who, {
      ...paceEngines.before,
      seed: "record",
      count: RECORD + NEXT,
    }).steps;
    let same = 0;
    let lower = 0;
    let levelGap = 0;
    for (let k = 0; k < NEXT; k++) {
      const next = simulatePace(who, {
        ...paceEngines.after,
        seed: "record",
        count: 1,
        record: whole.slice(0, RECORD + k),
      }).steps[0]!;
      const was = whole[RECORD + k]!;
      if (next.templateId === was.templateId) same++;
      if (next.grade < was.grade - 1) lower++;
      levelGap = Math.max(
        levelGap,
        Math.abs(next.shownBefore - was.shownBefore),
      );
    }
    t.diagnostic(
      `${type} from grade ${expected}, ${RECORD} answers on record: ${same} of ${NEXT} next problems the same, ${lower} more than a grade lower, level shown differs by at most ${levelGap.toFixed(2)}`,
    );
    assert.ok(levelGap <= 0.05, `level ${levelGap}`);
    assert.ok(same >= NEXT - 2, `${same} of ${NEXT} the same`);
    assert.equal(lower, 0);
  }
});
