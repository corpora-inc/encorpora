import test from "node:test";
import assert from "node:assert/strict";
import { applyCurve, CURVE_POLICY } from "../src/schools/curve-grades";
import {
  allocationSampler,
  curveIssues,
  curveIssueText,
  curveLetters,
  curveSentence,
  defaultCurve,
  isValidCurve,
  letterBands,
  placeOdds,
  scaleCurve,
  seededRandom,
  type CurveRanges,
  type GradeCurve,
} from "../src/schools/grade-curve";
import {
  DEFAULT_GRADE_POLICY,
  compositeScore,
  retentionPosterior,
  suggestGrade,
  type GradeActivity,
  type GradeInput,
  type GradeSuggestion,
  type StudentLevel,
} from "../src/schools/grade-policy";

const YEAR = { from: "2026-08-15", to: "2027-06-15" };
const TERM = { from: "2026-08-15", to: "2026-12-29" };
const level = (at: number, sd = 0.3): StudentLevel => ({
  overall: { level: at, sd },
  strands: {
    fractions: { level: at, sd: sd + 0.05 },
    number: { level: at, sd: sd + 0.05 },
  },
});
const activity = (patch: Partial<GradeActivity> = {}): GradeActivity => ({
  activeMinutes: 1140,
  unmeasuredProblems: 0,
  daysActive: 40,
  review: 40,
  reviewIndependent: 33,
  problems: 1500,
  correct: 1200,
  independent: 1100,
  ...patch,
});
const input = (end: number, sd = 0.3, patch: Partial<GradeInput> = {}) =>
  ({
    year: YEAR,
    enrolled: TERM,
    course: { from: 4.5, to: 5.5 },
    gradeLevel: 5,
    start: level(4.5, sd),
    end: level(end, sd),
    objectivesGained: 10,
    activity: activity(),
    weeklyTargetMinutes: 60,
    classMedianWeeklyMinutes: 55,
    ...patch,
  }) satisfies GradeInput;
/** A class whose levels at the end of the term run evenly from `low` to
 * `high`, ids in a fixed order so "s07" is the 7th highest. */
function klass(size: number, sd = 0.3, low = 3.6, high = 5.6) {
  return Array.from({ length: size }, (_, index) => {
    const at = size === 1 ? high : high - ((high - low) * index) / (size - 1);
    const studentInput = input(at, sd);
    return {
      id: `s${String(index + 1).padStart(2, "0")}`,
      input: studentInput,
      suggestion: suggestGrade(studentInput),
    };
  });
}
const curve = (size: number, ranges: CurveRanges): GradeCurve => ({
  size,
  ranges,
});
const FOUNDER: GradeCurve = curve(30, {
  A: [15, 20],
  B: [10, 15],
  C: [3, 15],
  D: [0, 2],
  F: [0, 2],
});

test("a curve is valid when its ranges can sum to the class", () => {
  assert.deepEqual(curveIssues(FOUNDER), []);
  assert.ok(isValidCurve(FOUNDER));
  // Exactly the class at both ends is still a curve.
  const exact = curve(10, {
    A: [2, 2],
    B: [3, 3],
    C: [3, 3],
    D: [1, 1],
    F: [1, 1],
  });
  assert.ok(isValidCurve(exact));
});

test("a curve that can't hold its class says why, and what to change", () => {
  const lows = curve(20, {
    A: [10, 12],
    B: [8, 10],
    C: [4, 6],
    D: [0, 1],
    F: [0, 1],
  });
  assert.deepEqual(curveIssues(lows), [{ kind: "lows", total: 22, size: 20 }]);
  assert.equal(
    curveIssueText(curveIssues(lows)[0]!),
    "The lows add to 22, 2 more than the 20 students. Lower one.",
  );
  const highs = curve(20, {
    A: [1, 4],
    B: [1, 4],
    C: [1, 4],
    D: [0, 2],
    F: [0, 2],
  });
  assert.deepEqual(curveIssues(highs), [
    { kind: "highs", total: 16, size: 20 },
  ]);
  assert.equal(
    curveIssueText(curveIssues(highs)[0]!),
    "The highs add to 16, 4 short of the 20 students. Raise one.",
  );
  const crossed = curve(5, {
    A: [3, 1],
    B: [0, 6],
    C: [0, 5],
    D: [0, 0],
    F: [0, 0],
  });
  assert.deepEqual(
    curveIssues(crossed).map((issue) => issue.kind),
    ["order", "over"],
  );
  assert.equal(
    curveIssueText(curveIssues(crossed)[0]!),
    "A’s low is above its high.",
  );
  assert.equal(
    allocationSampler(lows.ranges, 20),
    null,
    "no allocation satisfies impossible ranges",
  );
  assert.equal(placeOdds(highs.ranges, 20), null);
});

test("scaling a curve to another class size keeps it able to hold the class", () => {
  for (let size = 1; size <= 60; size++) {
    const scaled = scaleCurve(FOUNDER, size);
    assert.equal(scaled.size, size);
    assert.deepEqual(curveIssues(scaled), [], `size ${size}`);
  }
  assert.equal(scaleCurve(FOUNDER, 30), FOUNDER);
});

test("allocations honour every range, and are uniform among those allowed", () => {
  const sample = allocationSampler(FOUNDER.ranges, 30)!;
  const random = seededRandom("allocations");
  const totals = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const draws = 20_000;
  for (let i = 0; i < draws; i++) {
    const allocation = sample(random);
    let sum = 0;
    for (const letter of curveLetters) {
      const [low, high] = FOUNDER.ranges[letter];
      assert.ok(allocation[letter] >= low && allocation[letter] <= high);
      totals[letter] += allocation[letter];
      sum += allocation[letter];
    }
    assert.equal(sum, 30);
  }
  for (const letter of curveLetters) {
    const mean = totals[letter] / draws;
    const [low, high] = FOUNDER.ranges[letter];
    assert.ok(mean >= low && mean <= high, `${letter} mean ${mean}`);
  }
  // A small case enumerated: 4 students, A 0–2, B 1–3, C 0–2, D and F none.
  // Allowed: (0,2,2) (0,3,1) (1,1,2) (1,2,1) (1,3,0) (2,1,1) (2,2,0): seven.
  const small = allocationSampler(
    { A: [0, 2], B: [1, 3], C: [0, 2], D: [0, 0], F: [0, 0] },
    4,
  )!;
  const seen = new Map<string, number>();
  for (let i = 0; i < 70_000; i++) {
    const { A, B, C } = small(random);
    const key = `${A}${B}${C}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  assert.equal(seen.size, 7);
  for (const [key, times] of seen)
    assert.ok(Math.abs(times - 10_000) < 600, `${key}: ${times}`);
});

test("the place odds are the curve as a picture: each place sums to one, each letter to its expected count", () => {
  const odds = placeOdds(FOUNDER.ranges, 30)!;
  assert.equal(odds.length, 30);
  for (const place of odds) {
    const sum = curveLetters.reduce(
      (total, letter) => total + place[letter],
      0,
    );
    assert.ok(Math.abs(sum - 1) < 1e-9);
  }
  assert.ok(odds[0]!.A > 0.999, "the top of a class with 15+ As is an A");
  assert.ok(odds[29]!.A < 1e-9);
  for (const letter of curveLetters) {
    const expected = odds.reduce((total, place) => total + place[letter], 0);
    const [low, high] = FOUNDER.ranges[letter];
    assert.ok(expected >= low - 1e-9 && expected <= high + 1e-9);
  }
});

test("percentiles map through the teacher's curve: ranges honoured in expectation", () => {
  const students = klass(30);
  const curved = applyCurve(students, FOUNDER)!;
  assert.equal(curved.size, 30);
  for (const letter of curveLetters) {
    const expected = students.reduce(
      (total, { id }) => total + curved.get(id)!.curve!.letters[letter],
      0,
    );
    const [low, high] = FOUNDER.ranges[letter];
    assert.ok(
      expected >= low - 0.05 && expected <= high + 0.05,
      `${letter}: ${expected.toFixed(2)} outside ${low}–${high}`,
    );
  }
  const top = curved.get("s01")!;
  const bottom = curved.get("s30")!;
  assert.equal(top.policyVersion, "school-grades-v3");
  assert.equal(top.curve!.rankLow, 1);
  assert.ok(top.curve!.letters.A > 0.99);
  assert.ok(top.low! >= 90 && top.letterLow!.startsWith("A"));
  assert.equal(bottom.curve!.letters.A, 0);
  assert.ok(bottom.low! < 75, `the last of 30 reaches a C: ${bottom.low}`);
  // Rank order is the composite's order, so ranges never invert.
  for (let i = 1; i < 30; i++) {
    const above = curved.get(students[i - 1]!.id)!;
    const below = curved.get(students[i]!.id)!;
    assert.ok(above.low! >= below.low! && above.high! >= below.high!);
  }
  // The standard range stays alongside, for the default and the record.
  assert.deepEqual(top.curve!.standard, {
    low: students[0]!.suggestion.low,
    high: students[0]!.suggestion.high,
  });
});

test("a harsher curve gives lower grades to the same class", () => {
  const students = klass(30);
  const harsh = curve(30, {
    A: [2, 4],
    B: [6, 9],
    C: [10, 14],
    D: [3, 6],
    F: [1, 3],
  });
  const kind = applyCurve(students, FOUNDER)!;
  const hard = applyCurve(students, harsh)!;
  const mean = (map: Map<string, GradeSuggestion>) =>
    [...map.values()].reduce((sum, s) => sum + (s.low! + s.high!) / 2, 0) /
    map.size;
  assert.ok(mean(hard) < mean(kind) - 5);
});

test("level uncertainty widens a student's place; certainty narrows it", () => {
  const sure = applyCurve(klass(24, 0.02), scaleCurve(FOUNDER, 24))!;
  const unsure = applyCurve(klass(24, 1.2), scaleCurve(FOUNDER, 24))!;
  const width = (map: Map<string, GradeSuggestion>, id: string) =>
    map.get(id)!.curve!.rankHigh - map.get(id)!.curve!.rankLow;
  assert.equal(width(sure, "s12"), 0, "a sure middle student holds one place");
  assert.ok(width(unsure, "s12") >= 6, `${width(unsure, "s12")}`);
});

test("seeded: the same class and curve give the same suggestions, in any order", () => {
  const students = klass(18);
  const a = applyCurve(students, scaleCurve(FOUNDER, 18))!;
  const b = applyCurve([...students].reverse(), scaleCurve(FOUNDER, 18))!;
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
  const other = applyCurve(students, {
    ...scaleCurve(FOUNDER, 18),
    ranges: { ...scaleCurve(FOUNDER, 18).ranges, A: [4, 6] },
  });
  assert.notDeepEqual(
    [...a.values()].map((s) => [s.low, s.high]),
    [...other!.values()].map((s) => [s.low, s.high]),
  );
});

test("one student: the curve alone sets the letter", () => {
  const [only] = klass(1);
  const curved = applyCurve(
    [only!],
    curve(1, { A: [0, 1], B: [0, 1], C: [0, 0], D: [0, 0], F: [0, 0] }),
  )!.get(only!.id)!;
  assert.equal(curved.curve!.rankLow, 1);
  assert.equal(curved.curve!.rankHigh, 1);
  assert.ok(Math.abs(curved.curve!.letters.A - 0.5) < 0.06);
  assert.ok(Math.abs(curved.curve!.letters.B - 0.5) < 0.06);
  assert.equal(curved.letterLow!.at(0), "B");
  assert.equal(curved.letterHigh!.at(0), "A");
  // Inside a letter's band, the one student sits at its middle: B is 80–90.
  assert.equal(curved.low, 85);
  assert.equal(curved.high, 95);
});

test("two students: the stronger takes the A when the curve has one", () => {
  const pair = klass(2, 0.05);
  const curved = applyCurve(
    pair,
    curve(2, { A: [1, 1], B: [1, 1], C: [0, 0], D: [0, 0], F: [0, 0] }),
  )!;
  assert.equal(curved.get("s01")!.curve!.letters.A, 1);
  assert.equal(curved.get("s02")!.curve!.letters.B, 1);
  assert.equal(curved.get("s01")!.low, 95);
  assert.equal(curved.get("s02")!.high, 85);
});

test("identical students share every place evenly", () => {
  const same = Array.from({ length: 10 }, (_, index) => {
    const studentInput = input(5, 0);
    return {
      id: `t${index}`,
      input: studentInput,
      suggestion: suggestGrade(studentInput),
    };
  });
  const curved = applyCurve(
    same,
    curve(10, { A: [3, 3], B: [4, 4], C: [3, 3], D: [0, 0], F: [0, 0] }),
  )!;
  for (const suggestion of curved.values()) {
    assert.ok(Math.abs(suggestion.curve!.letters.A - 0.3) < 0.05);
    assert.ok(Math.abs(suggestion.curve!.letters.B - 0.4) < 0.05);
    assert.ok(suggestion.curve!.rankLow <= 2);
    assert.ok(suggestion.curve!.rankHigh >= 9);
  }
});

test("ranges impossible to satisfy leave the standard scale standing", () => {
  const students = klass(6);
  assert.equal(
    applyCurve(
      students,
      curve(6, { A: [3, 4], B: [3, 4], C: [1, 2], D: [0, 0], F: [0, 0] }),
    ),
    null,
  );
});

test("students without enough work are not ranked, and the curve scales to those who are", () => {
  const students = klass(10);
  const idle = input(5, 0.3, {
    activity: activity({ daysActive: 1, activeMinutes: 5 }),
  });
  const withIdle = [
    ...students,
    { id: "z-idle", input: idle, suggestion: suggestGrade(idle) },
  ];
  const curved = applyCurve(withIdle, scaleCurve(FOUNDER, 11))!;
  assert.equal(curved.has("z-idle"), false);
  assert.equal(curved.get("s01")!.curve!.ranked, 10);
});

test("with no noise, a draw's composite is the standard scale's middle", () => {
  const studentInput = input(5.1);
  const posterior = retentionPosterior(studentInput)!;
  const point = compositeScore(studentInput, {
    start: studentInput.start,
    end: studentInput.end,
    retentionShare: posterior.right / (posterior.right + posterior.wrong),
  });
  const standard = suggestGrade(studentInput);
  // The standard range is centred on the composite, up to rounding at the ends.
  assert.ok(Math.abs(point - (standard.low! + standard.high!) / 2) <= 1);
});

test("letter bands come from the school's scale", () => {
  assert.deepEqual(letterBands(DEFAULT_GRADE_POLICY.letters, 50), {
    A: { bottom: 90, top: 100 },
    B: { bottom: 80, top: 90 },
    C: { bottom: 70, top: 80 },
    D: { bottom: 60, top: 70 },
    F: { bottom: 50, top: 60 },
  });
  assert.equal(CURVE_POLICY.version, "school-grades-v3");
});

test("a default curve starts from the class's own letters and holds the class", () => {
  const proposed = defaultCurve(
    ["A", "A", "A", "B", "B", "B", "B", "C", "C", "D"],
    10,
  );
  assert.deepEqual(proposed.ranges, {
    A: [2, 4],
    B: [3, 5],
    C: [1, 3],
    D: [0, 2],
    F: [0, 1],
  });
  assert.ok(isValidCurve(proposed));
  for (let size = 1; size <= 40; size++)
    assert.ok(isValidCurve(defaultCurve([], size)), `${size}`);
});

test("one clinical sentence says where the curve put a student", () => {
  assert.equal(
    curveSentence({
      rankLow: 4,
      rankHigh: 9,
      ranked: 24,
      letterHigh: "A−",
      letterLow: "B+",
    }),
    "Ranks 4th to 9th of 24 on the composite; your curve gives that band an A− to B+.",
  );
  assert.equal(
    curveSentence({
      rankLow: 1,
      rankHigh: 1,
      ranked: 2,
      letterHigh: "A",
      letterLow: "A",
    }),
    "Ranks 1st of 2 on the composite; your curve gives that place an A.",
  );
  assert.equal(
    curveSentence({
      rankLow: 11,
      rankHigh: 23,
      ranked: 23,
      letterHigh: "C+",
      letterLow: "F",
    }),
    "Ranks 11th to 23rd of 23 on the composite; your curve gives that band a C+ to F.",
  );
});
