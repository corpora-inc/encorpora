import test from "node:test";
import assert from "node:assert/strict";
import {
  componentSentence,
  createGradePolicy,
  DEFAULT_GRADE_POLICY,
  expectedLevel,
  gradeParameters,
  letterFor,
  rangeLetters,
  suggestGrade,
  weeklyMinutes,
  type GradeActivity,
  type GradeInput,
  type GradeSuggestion,
  type StudentLevel,
} from "../src/schools/grade-policy";
import {
  countedObjectives,
  courseBand,
  currentTerm,
  middleOf,
} from "../src/schools/term-grades";

/** A 2026–27 school year and its first semester: 137 days, about 45% of the
 * year, so one grade a year asks for about 0.45 grades. */
const YEAR = { from: "2026-08-15", to: "2027-06-15" };
const TERM = { from: "2026-08-15", to: "2026-12-29" };
const GRADE_5 = { from: 4.5, to: 5.5 };

const level = (at: number, sd = 0.3): StudentLevel => ({
  overall: { level: at, sd },
  strands: {
    fractions: { level: at, sd: sd + 0.05 },
    number: { level: at, sd: sd + 0.05 },
    geometry: { level: at, sd: sd + 0.1 },
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
const persona = (patch: Partial<GradeInput> = {}): GradeInput => ({
  year: YEAR,
  enrolled: TERM,
  course: GRADE_5,
  gradeLevel: 5,
  start: level(4.5),
  end: level(4.95),
  objectivesGained: 10,
  activity: activity(),
  weeklyTargetMinutes: 60,
  classMedianWeeklyMinutes: 55,
  ...patch,
});
const family = (letter: string | null) => letter?.[0];
const middle = (suggestion: GradeSuggestion) =>
  (suggestion.low! + suggestion.high!) / 2;
const scoreOf = (suggestion: GradeSuggestion, id: string) =>
  suggestion.components.find((component) => component.id === id)!.score;

test("the components add up to 100 at the design's weights", () => {
  const { weights } = DEFAULT_GRADE_POLICY;
  assert.deepEqual(
    { ...weights },
    { course: 40, growth: 30, practice: 20, retention: 10 },
  );
});

test("the default policy is reproducible and a changed one changes the result", () => {
  const same = createGradePolicy(gradeParameters());
  assert.equal(same.fingerprint, DEFAULT_GRADE_POLICY.fingerprint);
  assert.deepEqual(
    suggestGrade(persona(), same),
    suggestGrade(persona(), DEFAULT_GRADE_POLICY),
  );
  const parameters = gradeParameters();
  parameters.version = "changed";
  parameters.course.onPaceScore = 60;
  const changed = createGradePolicy(parameters);
  assert.notEqual(changed.fingerprint, DEFAULT_GRADE_POLICY.fingerprint);
  const result = suggestGrade(persona(), changed);
  assert.equal(result.policyVersion, "changed");
  assert.ok(result.low! < suggestGrade(persona()).low!);
});

test("a policy that doesn't validate is refused", () => {
  const parameters = gradeParameters();
  parameters.weights.course = 41;
  assert.throws(() => createGradePolicy(parameters), /add up to 100/);
  assert.throws(
    () => createGradePolicy({ ...gradeParameters(), unknown: 1 }),
    /unrecognized/i,
  );
  assert.throws(() => suggestGrade(persona(), { ...DEFAULT_GRADE_POLICY }));
  assert.equal(Object.isFrozen(DEFAULT_GRADE_POLICY.weights), true);
});

test("letters are the standard US plus and minus scale", () => {
  const cuts: [number, string][] = [
    [100, "A+"],
    [97, "A+"],
    [96, "A"],
    [93, "A"],
    [92, "A−"],
    [90, "A−"],
    [89, "B+"],
    [87, "B+"],
    [86, "B"],
    [83, "B"],
    [82, "B−"],
    [80, "B−"],
    [79, "C+"],
    [77, "C+"],
    [76, "C"],
    [73, "C"],
    [72, "C−"],
    [70, "C−"],
    [69, "D+"],
    [67, "D+"],
    [66, "D"],
    [63, "D"],
    [62, "D−"],
    [60, "D−"],
    [59, "F"],
    [0, "F"],
  ];
  for (const [score, letter] of cuts) assert.equal(letterFor(score), letter);
});

test("the calendar puts a course at its low edge in August and its high edge in June", () => {
  assert.equal(expectedLevel(YEAR, YEAR.from, GRADE_5), 4.5);
  assert.equal(expectedLevel(YEAR, YEAR.to, GRADE_5), 5.5);
  const halfway = expectedLevel(YEAR, "2027-01-14", GRADE_5);
  assert.ok(Math.abs(halfway - 5) < 0.01, String(halfway));
});

test("a fast accelerator gets an A range", () => {
  const result = suggestGrade(
    persona({
      start: level(5.2),
      end: level(6.4),
      objectivesGained: 24,
      activity: activity({
        activeMinutes: 1500,
        review: 50,
        reviewIndependent: 48,
      }),
    }),
  );
  assert.equal(result.status, "ready");
  assert.equal(family(result.letterLow), "A");
  assert.equal(family(result.letterHigh), "A");
  assert.equal(scoreOf(result, "course"), 100);
  assert.equal(scoreOf(result, "growth"), 100);
  assert.equal(scoreOf(result, "practice"), 100);
});

test("a steady at-level student gets a B range", () => {
  const result = suggestGrade(persona());
  assert.equal(family(result.letterLow), "B", JSON.stringify(result));
  assert.equal(family(result.letterHigh), "B", JSON.stringify(result));
  const course = scoreOf(result, "course")!;
  assert.ok(course >= 80 && course <= 90, `on pace is about 85: ${course}`);
});

test("two grades behind and growing fast is B to C, not failing", () => {
  const result = suggestGrade(
    persona({
      start: level(2.6),
      end: level(3.4),
      objectivesGained: 18,
      activity: activity({
        activeMinutes: 1200,
        review: 40,
        reviewIndependent: 34,
      }),
    }),
  );
  assert.equal(family(result.letterLow), "C", JSON.stringify(result));
  assert.equal(family(result.letterHigh), "B", JSON.stringify(result));
  assert.ok(result.low! >= 70);
});

test("high accuracy with little work lands below a hard worker at the same level", () => {
  const coaster = suggestGrade(
    persona({
      end: level(4.95, 0.45),
      objectivesGained: 3,
      activity: activity({
        activeMinutes: 170,
        daysActive: 6,
        review: 6,
        reviewIndependent: 6,
        problems: 90,
        correct: 88,
        independent: 88,
      }),
    }),
  );
  const worker = suggestGrade(
    persona({
      objectivesGained: 14,
      activity: activity({
        activeMinutes: 1300,
        review: 45,
        reviewIndependent: 34,
        problems: 2100,
        correct: 1400,
        independent: 1200,
      }),
    }),
  );
  assert.equal(coaster.status, "ready");
  assert.ok(middle(coaster) < middle(worker));
  assert.ok(coaster.high! < worker.low!, JSON.stringify([coaster, worker]));
});

test("inactive is not enough work, never a low grade", () => {
  const silent = suggestGrade(
    persona({
      objectivesGained: 0,
      activity: activity({
        activeMinutes: 0,
        daysActive: 0,
        review: 0,
        reviewIndependent: 0,
        problems: 0,
        correct: 0,
        independent: 0,
      }),
    }),
  );
  assert.equal(silent.status, "not-enough-work");
  assert.equal(silent.low, null);
  assert.equal(silent.letterHigh, null);
  assert.deepEqual(
    silent.components.map((component) => component.score),
    [null, null, null, null],
  );
  // A little work, but below the minimum.
  const glance = suggestGrade(
    persona({ activity: activity({ activeMinutes: 8, daysActive: 1 }) }),
  );
  assert.equal(glance.status, "not-enough-work");
  // Past the minimum but barely working: a low range, and a wide one.
  const barely = suggestGrade(
    persona({
      start: level(4.4, 0.7),
      end: level(4.4, 0.7),
      objectivesGained: 0,
      activity: activity({
        activeMinutes: 25,
        daysActive: 2,
        review: 0,
        reviewIndependent: 0,
      }),
    }),
  );
  assert.equal(barely.status, "ready");
  assert.ok(barely.high! < 75, String(barely.high));
  const steady = suggestGrade(persona());
  assert.ok(
    barely.high! - barely.low! > steady.high! - steady.low!,
    "less to go on, a wider range",
  );
});

test("joining mid-term isn't penalized for the days before enrollment", () => {
  const whole = suggestGrade(persona());
  // Enrolled for the last half of the term, at the same weekly rate and the
  // same pace of growth, and where the calendar wants them by the end.
  const lateTerm = { from: "2026-10-22", to: TERM.to };
  const joined = suggestGrade(
    persona({
      enrolled: lateTerm,
      start: level(4.72),
      end: level(4.95),
      objectivesGained: 5,
      activity: activity({ activeMinutes: 570, daysActive: 20 }),
    }),
  );
  assert.ok(
    Math.abs(scoreOf(joined, "practice")! - scoreOf(whole, "practice")!) <= 1,
  );
  assert.ok(
    Math.abs(scoreOf(joined, "growth")! - scoreOf(whole, "growth")!) <= 3,
    JSON.stringify([joined.components, whole.components]),
  );
  assert.ok(Math.abs(middle(joined) - middle(whole)) <= 2);
  // The practice measure itself only counts enrolled weeks.
  const rate = (minutes: number, enrolled: { from: string; to: string }) =>
    weeklyMinutes({ enrolled, activity: activity({ activeMinutes: minutes }) });
  assert.ok(Math.abs(rate(570, lateTerm) - rate(1140, TERM)) < 0.5);
});

test("a mixed-grade class grades against each student's own level", () => {
  const third = suggestGrade(
    persona({
      course: null,
      gradeLevel: 3,
      start: level(2.5),
      end: level(2.95),
    }),
  );
  const sixth = suggestGrade(
    persona({
      course: null,
      gradeLevel: 6,
      start: level(5.5),
      end: level(5.95),
    }),
  );
  assert.deepEqual(
    [third.low, third.high, third.letterLow, third.letterHigh],
    [sixth.low, sixth.high, sixth.letterLow, sixth.letterHigh],
  );
  // The same third grader, held to a Grade 5 course, reads far behind.
  const held = suggestGrade(
    persona({ gradeLevel: 3, start: level(2.5), end: level(2.95) }),
  );
  assert.ok(scoreOf(held, "course")! < scoreOf(third, "course")!);
  assert.match(componentSentence(third.components[0]!), /their own grade/);
});

test("attempt counts and percent correct on non-review problems change nothing", () => {
  const base = persona();
  const expected = suggestGrade(base);
  const sweeps: Partial<GradeActivity>[] = [
    { problems: 12, correct: 12, independent: 12 },
    { problems: 12, correct: 0, independent: 0 },
    { problems: 40_000, correct: 40_000, independent: 40_000 },
    { problems: 40_000, correct: 400, independent: 10 },
  ];
  const score = (result: GradeSuggestion) => ({
    low: result.low,
    high: result.high,
    letterLow: result.letterLow,
    letterHigh: result.letterHigh,
    scores: result.components.map((component) => component.score),
    status: result.status,
    inputs: result.inputs,
  });
  for (const patch of sweeps) {
    const moved = suggestGrade({
      ...base,
      activity: { ...base.activity, ...patch },
    });
    assert.deepEqual(score(moved), score(expected), JSON.stringify(patch));
  }
  // Well past the target, more of it adds nothing either.
  const capped = (activeMinutes: number) =>
    suggestGrade(persona({ activity: activity({ activeMinutes }) }));
  assert.equal(scoreOf(capped(1300), "practice"), 100);
  assert.deepEqual(score(capped(9000)).scores, score(capped(1300)).scores);
  assert.equal(capped(9000).low, capped(1300).low);
  // Review outcomes are the one place accuracy counts.
  const reviewed = suggestGrade(
    persona({ activity: activity({ review: 40, reviewIndependent: 10 }) }),
  );
  assert.ok(scoreOf(reviewed, "retention")! < scoreOf(expected, "retention")!);
});

test("a problem counts toward practice only where no time could be measured", () => {
  const paper = suggestGrade(
    persona({
      activity: activity({
        activeMinutes: 0,
        unmeasuredProblems: 1140,
        problems: 1140,
      }),
    }),
  );
  assert.equal(paper.status, "ready");
  assert.equal(
    scoreOf(paper, "practice"),
    scoreOf(suggestGrade(persona()), "practice"),
  );
});

test("practice falls back to the class median, and to a typical week", () => {
  const median = suggestGrade(
    persona({ weeklyTargetMinutes: null, classMedianWeeklyMinutes: 58 }),
  );
  assert.equal(scoreOf(median, "practice"), 100);
  const practice = median.components[2]!;
  assert.deepEqual(
    practice.id === "practice" && [practice.against, practice.targetMinutes],
    ["class", 58],
  );
  const low = suggestGrade(
    persona({ weeklyTargetMinutes: null, classMedianWeeklyMinutes: 120 }),
  );
  assert.ok(scoreOf(low, "practice")! < 100);
  const nothing = suggestGrade(
    persona({ weeklyTargetMinutes: null, classMedianWeeklyMinutes: null }),
  );
  const typical = nothing.components[2]!;
  assert.equal(typical.id === "practice" && typical.against, "typical");
});

test("uncertain estimates widen the range, and evidence narrows it", () => {
  const width = (suggestion: GradeSuggestion) =>
    suggestion.high! - suggestion.low!;
  const sure = suggestGrade(persona());
  const unsure = suggestGrade(persona({ end: level(4.95, 1.2) }));
  assert.ok(width(unsure) > width(sure));
  const short = suggestGrade(
    persona({
      activity: activity({ activeMinutes: 60, daysActive: 3 }),
    }),
  );
  assert.ok(width(short) > width(sure));
  // Never narrower than the minimum, nor wider than the maximum.
  const { range } = DEFAULT_GRADE_POLICY;
  const widest = suggestGrade(
    persona({
      end: level(4.95, 6),
      activity: activity({ activeMinutes: 20, daysActive: 2 }),
    }),
  );
  assert.ok(width(widest) <= 2 * range.maximumHalfWidth + 1);
});

test("with no review due, the other three carry the range", () => {
  const none = suggestGrade(
    persona({ activity: activity({ review: 0, reviewIndependent: 0 }) }),
  );
  assert.equal(scoreOf(none, "retention"), null);
  assert.ok(middle(none) >= middle(suggestGrade(persona())) - 2);
  assert.match(componentSentence(none.components[3]!), /No spaced review/);
});

test("a few days' noise in a level isn't a huge multiple of the pace", () => {
  const firstWeek = { from: TERM.from, to: "2026-08-24" };
  const noisy = suggestGrade(
    persona({
      enrolled: firstWeek,
      start: level(4.5),
      end: level(5.1),
      objectivesGained: 0,
      activity: activity({ activeMinutes: 120, daysActive: 6 }),
    }),
  );
  assert.ok(scoreOf(noisy, "growth")! < 100, JSON.stringify(noisy.components));
  // And a slow first week doesn't sink anyone.
  const slow = suggestGrade(
    persona({
      enrolled: firstWeek,
      start: level(4.5),
      end: level(4.5),
      objectivesGained: 0,
      activity: activity({ activeMinutes: 120, daysActive: 6 }),
    }),
  );
  assert.ok(scoreOf(slow, "growth")! > 60, JSON.stringify(slow.components));
  // Across a whole term no growth is no growth.
  const flat = suggestGrade(
    persona({ start: level(4.95), end: level(4.95), objectivesGained: 0 }),
  );
  assert.ok(scoreOf(flat, "growth")! < 45, JSON.stringify(flat.components));
});

test("a stored level that went down reads as no growth, not negative", () => {
  const result = suggestGrade(persona({ start: level(5.4), end: level(5.0) }));
  const growth = result.components[1]!;
  assert.equal(growth.id === "growth" && growth.levelsGained, 0);
});

test("the sentences state their numbers and never gender a student", () => {
  const result = suggestGrade(persona());
  const sentences = result.components.map(componentSentence);
  assert.match(sentences[0]!, /grade 5\.\d, against grade \d\.\d/);
  assert.match(sentences[1]!, /10 new objectives and 0\.5 grades/);
  assert.match(sentences[2]!, /of 60 target minutes a week, 1,500 problems/);
  assert.match(sentences[3]!, /83% of spaced reviews/);
  for (const sentence of sentences)
    assert.doesNotMatch(sentence, /\b(he|she|his|her|him|hers)\b/i);
  // A small count of problems isn't stated.
  const small = suggestGrade(persona({ activity: activity({ problems: 40 }) }))
    .components[2]!;
  assert.doesNotMatch(componentSentence(small), /problems/);
  assert.equal(rangeLetters({ letterLow: "B", letterHigh: "A−" }), "B to A−");
  assert.equal(rangeLetters({ letterLow: "B", letterHigh: "B" }), "B");
  assert.equal(rangeLetters({ letterLow: null, letterHigh: null }), null);
});

test("a course is a stretch of the level axis; no course or an unknown one is none", () => {
  assert.deepEqual(courseBand(["5"]), {
    label: "Grade 5",
    level: 5,
    from: 4.5,
    to: 5.5,
  });
  assert.deepEqual(courseBand(["K"]), {
    label: "K",
    level: 0,
    from: -0.5,
    to: 0.5,
  });
  assert.deepEqual(courseBand(["algebra-1"]), {
    label: "Algebra 1",
    level: 9,
    from: 8.5,
    to: 9.5,
  });
  const span = courseBand(["7", "8"])!;
  assert.deepEqual(
    [span.from, span.to, span.label],
    [6.5, 8.5, "Grade 7 to Grade 8"],
  );
  assert.equal(courseBand([]), null);
  assert.equal(courseBand(["Advanced seminar"]), null);
});

test("showing a skill well below the term's start isn't ground gained", () => {
  const gained = [
    { skillId: "fraction-addition", day: "2026-10-01" }, // grade 5
    { skillId: "fraction-equivalence", day: "2026-10-02" }, // grade 4
    { skillId: "unit-fractions", day: "2026-10-03" }, // grade 3
  ];
  const ids = (start: number | null) =>
    countedObjectives(gained, start).map((objective) => objective.skillId);
  assert.deepEqual(ids(4.8), ["fraction-addition", "fraction-equivalence"]);
  assert.deepEqual(ids(5.4), ["fraction-addition"]);
  // Behind, the same work is real ground.
  assert.deepEqual(ids(2.5), [
    "fraction-addition",
    "fraction-equivalence",
    "unit-fractions",
  ]);
  // With no level yet there's nothing to hold it against.
  assert.equal(ids(null).length, 3);
});

test("a screen opens to the term today is in, else the last one begun", () => {
  const terms = [
    { id: "a", startsOn: "2026-08-15", endsOn: "2026-10-16" },
    { id: "b", startsOn: "2026-10-19", endsOn: "2026-12-18" },
    { id: "c", startsOn: "2027-01-04", endsOn: "2027-03-12" },
  ].map((term) => ({ ...term, name: term.id, state: "open" as const }));
  assert.equal(currentTerm(terms, "2026-11-07")?.id, "b");
  assert.equal(currentTerm(terms, "2026-12-25")?.id, "b", "between terms");
  assert.equal(currentTerm(terms, "2026-01-01")?.id, "a", "before the year");
  assert.equal(currentTerm([], "2026-11-07"), null);
});

test("a class median is the middle of those who worked", () => {
  assert.equal(middleOf([]), null);
  assert.equal(middleOf([3, 1, 2]), 2);
  assert.equal(middleOf([4, 1, 2, 3]), 2.5);
});
