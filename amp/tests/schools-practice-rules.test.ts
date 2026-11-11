import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_WEEKLY_TARGET_MINUTES,
  practiced,
} from "../src/schools/practice-rules";
import { usageOf, type StudentFact } from "../src/schools/org-reads";
import { todayTodos, type TodayStudent } from "../src/schools/today";
import { resolveWeeklyTarget } from "../src/schools/term-grades";
import { schoolClock } from "../src/schools/clock";

test("practiced means 5 active minutes or 5 problems, never one second", () => {
  assert.equal(practiced(0, 0), false);
  assert.equal(practiced(0.1, 1), false);
  assert.equal(practiced(4.9, 4), false);
  assert.equal(practiced(5, 0), true);
  assert.equal(practiced(0, 5), true);
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
  levelSd: 0.3,
  startSd: 0.4,
  seated: true,
  signedIn: true,
  since: "2026-08-17",
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
  // One student's growth interval is their own: Δμ ± 1.96·√(0.3² + 0.4²).
  const one = usageOf([fact({ level: 5, startLevel: 5.3 })]);
  assert.equal(one.growth, -0.3);
  assert.ok(Math.abs(one.growthLow! - (-0.3 - 1.96 * 0.5)) < 0.12);
  assert.ok(Math.abs(one.growthHigh! - (-0.3 + 1.96 * 0.5)) < 0.12);
  assert.ok(usage.growthLow! < usage.growth! && usage.growth! < usage.growthHigh!);
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
test("Today never judges a week's practice, whatever the minutes or the day", () => {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let run = 0; run < 200; run++) {
    const size = 1 + Math.floor(random() * 30);
    const students = Array.from({ length: size }, (_, i) =>
      student(
        `S${i}`,
        Math.floor(random() * random() * 80),
        Math.floor(random() * 12),
      ),
    );
    const target = random() < 0.2 ? null : 30 + 15 * Math.floor(random() * 5);
    const today = `2026-11-0${2 + Math.floor(random() * 7)}`;
    const todos = todayTodos({
      today,
      students,
      skills: [],
      course: null,
      weeklyTargetMinutes: target,
      skillTitle: (id) => id,
      lessonFor: () => null,
    });
    assert.ok(
      todos.every((todo) => todo.kind !== "no-practice"),
      JSON.stringify({ size, target, today }),
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
