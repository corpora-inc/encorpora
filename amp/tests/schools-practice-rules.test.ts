import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WEEKLY_TARGET_MINUTES,
  lowPractice,
  lowPracticeFacts,
  lowPracticeLine,
  lowPracticeRule,
  practiced,
  weekElapsed,
} from "../src/schools/practice-rules";
import {
  standingOf,
  usageOf,
  type StudentFact,
} from "../src/schools/org-reads";
import { todayTodos, type TodayStudent } from "../src/schools/today";
import { resolveWeeklyTarget } from "../src/schools/term-grades";
import { schoolClock } from "../src/schools/clock";

const MONDAY = 0;
const TUESDAY = 1;
const WEDNESDAY = 2;
const FRIDAY = 4;
const SUNDAY = 6;
const week = (minutes: number[], problems = minutes.map(() => 0)) => ({
  minutes,
  practiced: minutes.filter((m, i) => practiced(m, problems[i]!)).length,
});

test("practiced means 5 active minutes or 5 problems, never one second", () => {
  assert.equal(practiced(0, 0), false);
  assert.equal(practiced(0.1, 1), false);
  assert.equal(practiced(4.9, 4), false);
  assert.equal(practiced(5, 0), true);
  assert.equal(practiced(0, 5), true);
});

test("the median's line is a quarter of the target for the share of the week gone", () => {
  assert.equal(weekElapsed(WEDNESDAY), 0.6);
  assert.equal(weekElapsed(FRIDAY), 1);
  assert.equal(weekElapsed(SUNDAY), 1);
  assert.equal(lowPracticeLine(60, WEDNESDAY), 9);
  assert.equal(lowPracticeLine(60, FRIDAY), 15);
  assert.equal(lowPracticeLine(90, 3), 18);
});

test("the first days of a week never flag a class, however empty", () => {
  const empty = week(Array.from({ length: 22 }, () => 0));
  assert.equal(lowPractice(empty, 60, MONDAY), null);
  assert.equal(lowPractice(empty, 60, TUESDAY), null);
  assert.deepEqual(lowPractice(empty, 60, WEDNESDAY), {
    students: 22,
    practiced: 0,
    medianMinutes: 0,
    target: 60,
    line: 9,
    fewPracticed: true,
    lowMedian: true,
  });
});

test("one student: flagged only by their own week, with the facts said plainly", () => {
  assert.equal(lowPractice(week([40]), 60, FRIDAY), null);
  const flag = lowPractice(week([4]), 60, FRIDAY)!;
  assert.equal(
    lowPracticeFacts(flag),
    "0 of 1 have practiced · median 4 of 60 min",
  );
  // 6 minutes is practiced, but under the median's line of 15 on a Friday.
  const short = lowPractice(week([6]), 60, FRIDAY)!;
  assert.equal(short.fewPracticed, false);
  assert.equal(short.lowMedian, true);
  assert.equal(
    lowPracticeFacts(short),
    "1 of 1 has practiced · median 6 of 60 min",
  );
});

test("thirty students: 60% practiced is enough, the median decides the rest", () => {
  const minutes = (practicedCount: number, each: number) =>
    Array.from({ length: 30 }, (_, i) => (i < practicedCount ? each : 0));
  // 18 of 30 is 60%: not "fewer than 60%". Their median is 30 minutes.
  assert.equal(lowPractice(week(minutes(18, 30)), 60, FRIDAY), null);
  // 17 of 30 is under.
  const few = lowPractice(week(minutes(17, 30)), 60, FRIDAY)!;
  assert.equal(few.fewPracticed, true);
  assert.equal(
    lowPracticeFacts(few),
    "17 of 30 have practiced · median 30 of 60 min",
  );
  // Everyone practiced a little: the mean would hide nothing, the median does.
  const thin = lowPractice(week(minutes(30, 8)), 60, FRIDAY)!;
  assert.equal(thin.fewPracticed, false);
  assert.equal(thin.lowMedian, true);
});

test("all-identical students are all in or all out, with no tie-break surprises", () => {
  const same = (each: number) => week(Array.from({ length: 22 }, () => each));
  assert.equal(lowPractice(same(15), 60, FRIDAY), null);
  assert.equal(lowPractice(same(14), 60, FRIDAY)?.lowMedian, true);
  assert.equal(lowPractice(same(9), 60, WEDNESDAY), null);
  assert.equal(lowPractice(same(8), 60, WEDNESDAY)?.lowMedian, true);
});

test("a family with no target is flagged only for who practiced", () => {
  const flag = lowPractice(week([0, 30]), null, FRIDAY)!;
  assert.equal(flag.fewPracticed, true);
  assert.equal(lowPracticeFacts(flag), "1 of 2 has practiced");
  assert.equal(lowPractice(week([6, 6]), null, FRIDAY), null);
  assert.doesNotMatch(lowPracticeRule(null, FRIDAY), /target/);
  assert.match(lowPracticeRule(60, WEDNESDAY), /\(9 minutes by today\)\.$/);
});

test("a school class follows its school's target, else 60; a family has none until set", () => {
  const school = "00000000-0000-4000-8000-000000000001";
  const klass = "00000000-0000-4000-8000-000000000002";
  const none = resolveWeeklyTarget([], klass, [school], false);
  assert.deepEqual(none, {
    minutes: DEFAULT_WEEKLY_TARGET_MINUTES,
    locked: false,
    own: false,
    inherited: 60,
  });
  const row = (
    kind: string,
    id: string,
    values: object,
    locked: string[] = [],
  ) => ({
    scope_kind: kind,
    scope_id: id,
    values: values as Record<string, unknown>,
    locked,
  });
  const set = resolveWeeklyTarget(
    [row("org", school, { weeklyTargetMinutes: 90 })],
    klass,
    [school],
    false,
  );
  assert.equal(set.minutes, 90);
  assert.equal(set.inherited, 90);
  const own = resolveWeeklyTarget(
    [
      row("org", school, { weeklyTargetMinutes: 90 }),
      row("class", klass, { weeklyTargetMinutes: 45 }),
    ],
    klass,
    [school],
    false,
  );
  assert.deepEqual(own, {
    minutes: 45,
    locked: false,
    own: true,
    inherited: 90,
  });
  const locked = resolveWeeklyTarget(
    [
      row("org", school, { weeklyTargetMinutes: 90 }, ["weeklyTargetMinutes"]),
      row("class", klass, { weeklyTargetMinutes: 45 }),
    ],
    klass,
    [school],
    false,
  );
  assert.equal(locked.minutes, 90);
  assert.equal(locked.locked, true);
  assert.equal(resolveWeeklyTarget([], klass, [school], true).minutes, null);
});

const fact = (patch: Partial<StudentFact>): StudentFact => ({
  id: "p",
  learner: "l",
  org: "o",
  grade: 5,
  thisMs: 0,
  lastMs: 0,
  thisAttempts: 0,
  lastAttempts: 0,
  level: null,
  startLevel: null,
  seated: true,
  signedIn: true,
  ...patch,
});
test("the overview counts practiced students and states the growth median's n", () => {
  const usage = usageOf([
    fact({ thisMs: 8_000 }), // eight seconds: not practiced
    fact({ thisMs: 6 * 60_000 }),
    fact({ thisAttempts: 5 }),
    fact({ level: 5.2, startLevel: 5.5 }),
    fact({ level: 5.6, startLevel: 5.2 }),
  ]);
  assert.equal(usage.active, 2);
  assert.equal(usage.placed, 2);
  // Either sign, as the grade model now shows it.
  assert.equal(usage.growth, 0.05);
  assert.equal(usageOf([fact({ level: 5, startLevel: 5.3 })]).growth, -0.3);
});

test("only placed students stand anywhere; the rest are not placed yet", () => {
  // A level is null in the overview's facts below placement (org-reads.ts).
  const standing = standingOf([
    fact({ level: 5.1 }),
    fact({ level: null }),
    fact({ level: 3.9 }),
    fact({ grade: null, level: 6 }),
  ]);
  assert.equal(standing.at, 1);
  assert.equal(standing.behind, 1);
  assert.equal(standing.unplaced, 2);
});

const student = (
  first: string,
  minutes: number,
  problems = 0,
): TodayStudent => ({
  id: first,
  name: first,
  first,
  gradeLevel: 5,
  level: null,
  weekMinutes: minutes,
  weekProblems: problems,
  workedToday: false,
  todayMinutes: 0,
  usualWeeklyMinutes: null,
  lastActive: "2026-11-02",
  review: 0,
  reviewIndependent: 0,
  objectivesThisWeek: 0,
});
test("whenever a head's overview flags a class, its teacher's Today says so too", () => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let run = 0; run < 400; run++) {
    const size = 1 + Math.floor(random() * 30);
    const students = Array.from({ length: size }, (_, i) =>
      student(
        `S${i}`,
        Math.floor(random() * random() * 80),
        Math.floor(random() * 12),
      ),
    );
    const target = random() < 0.2 ? null : 30 + 15 * Math.floor(random() * 5);
    // Wednesday 2026-11-04 to Sunday 2026-11-08.
    const day = 4 + Math.floor(random() * 5);
    const today = `2026-11-0${day}`;
    const flag = lowPractice(
      {
        minutes: students.map((s) => s.weekMinutes),
        practiced: students.filter((s) =>
          practiced(s.weekMinutes, s.weekProblems),
        ).length,
      },
      target,
      day - 2,
    );
    const todos = todayTodos({
      today,
      students,
      skills: [],
      course: null,
      weeklyTargetMinutes: target,
      skillTitle: (id) => id,
      lessonFor: () => null,
    });
    if (flag)
      assert.ok(
        todos.some((todo) => todo.kind === "no-practice"),
        JSON.stringify({ size, target, today, flag }),
      );
  }
});

test("a pinned school clock is for a local preview only", () => {
  assert.equal(schoolClock({}), undefined);
  const now = schoolClock({ AMP_SCHOOL_NOW: "2026-11-11T15:00:00Z" })!;
  assert.equal(now().toISOString(), "2026-11-11T15:00:00.000Z");
  assert.throws(() =>
    schoolClock({
      AMP_SCHOOL_NOW: "2026-11-11T15:00:00Z",
      NODE_ENV: "production",
    }),
  );
  assert.throws(() =>
    schoolClock({
      AMP_SCHOOL_NOW: "2026-11-11T15:00:00Z",
      AMP_HOST: "0.0.0.0",
    }),
  );
  assert.throws(() => schoolClock({ AMP_SCHOOL_NOW: "Wednesday" }));
});
