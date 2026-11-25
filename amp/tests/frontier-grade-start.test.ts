import assert from "node:assert/strict";
import test from "node:test";
import {
  createFrontierState,
  estimateFrontier,
  NO_COURSE_START,
  overallTrend,
  startFromGrade,
  startWidth,
  type FrontierCatalog,
} from "../src/learning/frontier";
import {
  DEFAULT_FRONTIER_POLICY,
  EVIDENCE_CLIMB_FRONTIER_POLICY,
  GRADE_START_SD,
  GRADE_START_SD_CAP,
} from "../src/learning/frontier-policy";
import { withinGradeSd } from "../src/schools/norms-prior";
import {
  decodeLearnerFrontier,
  encodeLearnerFrontier,
  isCurrentLearnerFrontier,
  newLearnerFrontier,
  readLearnerFrontier,
} from "../src/server/learner-frontier";

/* A start from a birth year or a roster grade is the learner's grade, and
   counts for more than a guessed start before the first answers. */

const epoch = Date.parse("2026-10-19T12:00:00Z");
/** Typed families named `strand:grade:n`. */
const catalog: FrontierCatalog = {
  gradeOf: (id) => Number(id.split(":")[1]),
  strandOf: (id) => id.split(":")[0]!,
  guessOf: () => 0,
};
const answers = (list: readonly (readonly [grade: number, right: boolean])[]) =>
  list.map(([grade, correct], i) => ({
    templateId: `s${i % 4}:${grade}:${i}`,
    correct,
    assisted: false,
    createdAt: new Date(epoch + i * 40_000).toISOString(),
  }));
const level = (
  start: number,
  list: readonly (readonly [number, boolean])[],
  gradeStart: boolean,
) =>
  estimateFrontier({
    start,
    gradeStart,
    observations: answers(list),
    ...catalog,
  }).overall;

test("a birth year, or a start kept from the class's course, makes the start a grade", () => {
  assert.equal(NO_COURSE_START, 2);
  const cases: [Parameters<typeof startFromGrade>[0], boolean, string][] = [
    [{ birthYear: 2017 }, true, "a birth year"],
    [{ birthYear: null }, false, "no birth year, nothing else"],
    [{}, false, "nothing known"],
    [{ courseStart: null, classCourses: [4] }, false, "no start was kept"],
    [{ courseStart: 4, classCourses: [4] }, true, "a grade 4 class"],
    [{ courseStart: 9 }, true, "an Algebra 1 class"],
    [{ courseStart: 0 }, true, "a kindergarten class"],
    // A kept start other than 2 can only have come from a course, and stays
    // a grade start whatever the class's course becomes.
    [{ courseStart: 4, classCourses: [5] }, true, "the course changed since"],
    [{ courseStart: 4, classCourses: [] }, true, "the class lost its course"],
    // 2 is also what a learner with no course is given.
    [{ courseStart: 2, classCourses: [] }, false, "2 and no class course"],
    [{ courseStart: 2 }, false, "2 and no class"],
    [{ courseStart: 2, classCourses: [4] }, false, "2 kept before a course"],
    [{ courseStart: 2, classCourses: [2] }, true, "a grade 2 class"],
    [{ courseStart: 2, classCourses: [5, 2] }, true, "one of two classes"],
    [{ birthYear: 2017, courseStart: null }, true, "a birth year wins"],
  ];
  for (const [options, expected, name] of cases)
    assert.equal(startFromGrade(options), expected, name);
});

test("a grade start is as wide as its grade's spread, a guessed start as wide as before", () => {
  const policy = DEFAULT_FRONTIER_POLICY;
  const wide = policy.prior.overallSd;
  assert.equal(wide, 2.5);
  const cases: [start: number, gradeStart: boolean, width: number][] = [
    [0, true, 0.78],
    [1, true, 0.89],
    [2, true, 1.11],
    [3, true, 1.22],
    [4, true, 1.78],
    // From grade 5 the norms are wider than two grades, and two is the cap.
    [5, true, 2],
    [6, true, 2],
    [9, true, 2],
    [12, true, 2],
    // Past the scale: a guess's width.
    [13, true, wide],
    // A start between grades takes the nearer grade's; below K, K's.
    [2.6, true, 1.22],
    [-1, true, 0.78],
    // A guess is wide at every grade.
    [0, false, wide],
    [3, false, wide],
    [9, false, wide],
  ];
  for (const [start, gradeStart, width] of cases)
    assert.equal(
      startWidth(policy, start, gradeStart),
      width,
      `start ${start}, ${gradeStart ? "grade" : "guess"}`,
    );
  // The policy before knows no grade start.
  for (const start of [0, 3, 9])
    assert.equal(startWidth(EVIDENCE_CLIMB_FRONTIER_POLICY, start, true), wide);
});

test("the widths are the norms' within-grade spread for a student of no particular school, capped at two grades", () => {
  assert.equal(GRADE_START_SD_CAP, 2);
  assert.equal(GRADE_START_SD.length, 13);
  GRADE_START_SD.forEach((sd, grade) =>
    assert.equal(
      sd,
      Math.min(
        GRADE_START_SD_CAP,
        Math.round((withinGradeSd(grade) / 0.9) * 100) / 100,
      ),
      `grade ${grade}`,
    ),
  );
  // The cap binds from grade 5, and is narrower than a guessed start.
  assert.deepEqual(
    GRADE_START_SD.map((sd) => sd === GRADE_START_SD_CAP),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => grade >= 5),
  );
  assert.ok(GRADE_START_SD_CAP < DEFAULT_FRONTIER_POLICY.prior.overallSd);
});

test("right answers at the grade move a grade start less than a guessed start", () => {
  // After 1, 4 and 8 right answers at the grade: [grade start, guessed start].
  const expected: Record<number, [number, number][]> = {
    0: [
      [0.33, 1.76],
      [0.72, 2.33],
      [0.99, 2.64],
    ],
    3: [
      [3.58, 4.56],
      [4.17, 5.33],
      [4.47, 5.64],
    ],
    6: [
      [7.16, 7.51],
      [7.89, 8.29],
      [8.2, 8.6],
    ],
    9: [
      [10.02, 10.17],
      [10.72, 10.9],
      [11, 11.17],
    ],
  };
  for (const [start, rows] of Object.entries(expected)) {
    [1, 4, 8].forEach((count, i) => {
      const right = Array.from(
        { length: count },
        () => [Number(start), true] as const,
      );
      const grade = level(Number(start), right, true);
      const guess = level(Number(start), right, false);
      assert.deepEqual(
        [grade.level, guess.level],
        rows[i],
        `grade ${start}, ${count} right`,
      );
      // The range is narrower too: the same estimate, not a damped display.
      assert.ok(grade.high! - grade.low! < guess.high! - guess.low!);
    });
  }
  // Eight right answers at grade 3 do not read a grade and a half ahead.
  assert.ok(
    level(
      3,
      Array.from({ length: 8 }, () => [3, true] as const),
      true,
    ).level < 4.5,
  );
});

test("a learner who misses still comes down to where they are", () => {
  // Misses at the grade and below it, then a right answer two grades down.
  const falling = (start: number) =>
    [
      [start, false],
      [start, false],
      [start - 1, false],
      [start - 1, false],
      [start - 2, false],
      [start - 2, true],
    ] as const;
  // After those six answers: [grade start, guessed start].
  const expected: Record<number, [number, number]> = {
    2: [0.19, -0.2],
    3: [1.05, 0.54],
    4: [1.68, 1.43],
    5: [2.56, 2.38],
    6: [3.56, 3.36],
    9: [6.56, 6.35],
  };
  for (const [start, levels] of Object.entries(expected)) {
    const grade = level(Number(start), falling(Number(start)), true).level;
    const guess = level(Number(start), falling(Number(start)), false).level;
    assert.deepEqual([grade, guess], levels, `grade ${start}`);
    // A grade and three quarters below the start within six answers, and
    // within about half a grade of where a guessed start would be.
    assert.ok(grade <= Number(start) - 1.75, `grade ${start}: ${grade}`);
    assert.ok(grade - guess <= 0.55, `grade ${start}: ${grade} vs ${guess}`);
  }
});

test("a long record reads the same from a grade start as from a guess", () => {
  const record = Array.from(
    { length: 300 },
    (_, i) => [3 + (i % 3), i % 4 !== 0] as const,
  );
  const grade = level(3, record, true);
  const guess = level(3, record, false);
  assert.ok(Math.abs(grade.level - guess.level) <= 0.02);
  assert.ok(Math.abs(grade.low! - guess.low!) <= 0.02);
  assert.ok(Math.abs(grade.high! - guess.high!) <= 0.02);
  // The two come together as answers accumulate.
  const gap = (count: number) =>
    Math.abs(
      level(3, record.slice(0, count), true).level -
        level(3, record.slice(0, count), false).level,
    );
  assert.ok(gap(20) > gap(80));
  assert.ok(gap(80) > gap(300) || gap(300) === 0);
  assert.ok(gap(150) <= 0.05);
});

test("the trend chart reads the same estimate, answer by answer", () => {
  const record = Array.from(
    { length: 12 },
    (_, i) => [3 + (i % 2), i % 5 !== 0] as const,
  );
  const now = epoch + 12 * 40_000;
  const counts = [0, 4, 8, 12];
  const trend = overallTrend(
    {
      start: 3,
      gradeStart: true,
      observations: answers(record),
      now,
      ...catalog,
    },
    counts,
  );
  counts.forEach((count, i) => {
    const whole = estimateFrontier({
      start: 3,
      gradeStart: true,
      observations: answers(record).slice(0, count),
      now,
      ...catalog,
    }).overall;
    assert.equal(trend[i]!.level, whole.level, `after ${count}`);
    assert.equal(trend[i]!.low, whole.low);
    assert.equal(trend[i]!.high, whole.high);
  });
  // Before any answer the level is the grade itself.
  assert.equal(trend[0]!.level, 3);
});

test("a guessed start estimates exactly as before, at every grade", () => {
  const histories = [
    [],
    Array.from({ length: 4 }, () => [3, true] as const),
    [
      [3, true],
      [4, true],
      [4, false],
      [2, true],
      [5, false],
      [3, true],
      [6, true],
      [1, false],
    ] as const,
  ];
  for (const start of [0, 2, 3, 5, 7, 9, 12])
    for (const list of histories) {
      const observations = answers(
        list.map(([grade, right]) => [grade + start - 3, right] as const),
      );
      // A child with no birth year, and no start width of their own.
      const now = estimateFrontier({ start, observations, ...catalog });
      const before = estimateFrontier({
        start,
        observations,
        policy: EVIDENCE_CLIMB_FRONTIER_POLICY,
        ...catalog,
      });
      assert.deepEqual(now, before, `start ${start}, ${list.length} answers`);
      assert.equal(now.gradeStart, undefined);
    }
});

test("an adult's wide reported start is kept, whatever the start is called", () => {
  const state = createFrontierState(7, DEFAULT_FRONTIER_POLICY, 12, false);
  const child = createFrontierState(
    3,
    DEFAULT_FRONTIER_POLICY,
    undefined,
    true,
  );
  assert.equal(state.gradeStart, undefined);
  assert.equal(child.gradeStart, true);
  const right = Array.from({ length: 4 }, () => [7, true] as const);
  const adult = estimateFrontier({
    start: 7,
    startSd: 12,
    observations: answers(right),
    ...catalog,
  });
  const before = estimateFrontier({
    start: 7,
    startSd: 12,
    observations: answers(right),
    policy: EVIDENCE_CLIMB_FRONTIER_POLICY,
    ...catalog,
  });
  assert.deepEqual(adult.overall, before.overall);
  assert.deepEqual(adult.adaptive, before.adaptive);
  assert.equal(adult.gradeStart, undefined);
});

test("a stored level remembers whether its start is a grade", () => {
  const key = { epoch: 0, start: 3, gradeStart: true, strandStarts: {} };
  const state = newLearnerFrontier(key);
  assert.equal(isCurrentLearnerFrontier(state, key), true);
  // A learner whose birth year is added or removed is estimated afresh.
  assert.equal(
    isCurrentLearnerFrontier(state, { ...key, gradeStart: false }),
    false,
  );
  assert.equal(
    isCurrentLearnerFrontier(
      newLearnerFrontier({ ...key, gradeStart: false }),
      {
        epoch: 0,
        start: 3,
        strandStarts: {},
      },
    ),
    true,
  );
  const decoded = decodeLearnerFrontier(encodeLearnerFrontier(state))!;
  assert.equal(decoded.main.gradeStart, true);
  assert.equal(isCurrentLearnerFrontier(decoded, key), true);
  assert.equal(readLearnerFrontier(decoded, epoch).gradeStart, true);
  assert.equal(
    readLearnerFrontier(
      newLearnerFrontier({ epoch: 0, start: 3, strandStarts: {} }),
      epoch,
    ).gradeStart,
    undefined,
  );
});
