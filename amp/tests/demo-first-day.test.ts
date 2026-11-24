import test from "node:test";
import assert from "node:assert/strict";
import { persona } from "../src/schools/demo/personas";
import { simulatePersona } from "../src/schools/demo/simulate";
import { personaTruth } from "../src/schools/demo/truth";

/* A persona's first day (scripts/design-personas.ts `parent-day1`: "one
   session yesterday", 14 answers in 12 minutes). Planned as a term it came
   out as 4 answers in 52 minutes: the week's whole dose on one sitting of
   four problems. */

const child = persona("Child", "Ashby", 4.1, {
  answers: 14,
  minutes: 12,
  every: 1,
  lastActive: 1,
  joined: 1,
  growth: 0,
});
const story = (today: string, yesterday: string) => ({
  name: "Child Ashby",
  grade: 4,
  persona: child,
  termStart: yesterday,
  today,
  weekShape: [1, 1, 1],
  workToday: true,
});
const minutes = (sittings: { msEach: number; problems: number }[]) =>
  sittings.reduce((sum, one) => sum + one.msEach * one.problems, 0) / 60_000;

test("a first day is one sitting: the persona's answers in the persona's minutes", () => {
  // A Tuesday: yesterday was a school day.
  const truth = personaTruth({
    ...story("2026-11-24", "2026-11-23"),
    strands: ["number"],
  });
  assert.equal(truth.sittings.length, 1);
  assert.equal(truth.sittings[0]!.day, "2026-11-23");
  assert.equal(truth.sittings[0]!.problems, 14);
  assert.ok(Math.abs(minutes(truth.sittings) - 12) < 0.1);
});

test("a first day falls on yesterday whatever the weekday", () => {
  // Seeded on a Monday, yesterday is a Sunday: still their one session.
  const truth = personaTruth({
    ...story("2026-11-23", "2026-11-22"),
    strands: ["number"],
  });
  assert.deepEqual(
    truth.sittings.map((one) => [one.day, one.problems]),
    [["2026-11-22", 14]],
  );
});

test("the first day as it is written: 14 answers, about 12 active minutes, all yesterday", () => {
  const now = Date.parse("2026-11-24T15:00:00Z");
  const written = simulatePersona({
    ...story("2026-11-24", "2026-11-23"),
    now,
  });
  assert.equal(written.answers.length, 14);
  assert.ok(written.answers.every((answer) => answer.day === "2026-11-23"));
  const active = written.active.reduce((sum, row) => sum + row.ms, 0) / 60_000;
  assert.ok(active > 10 && active < 14, `${active} active minutes`);
});

test("a persona with weeks behind them is planned as before: many sittings, a few problems each", () => {
  const truth = personaTruth({
    name: "Wren Pell",
    grade: 4,
    persona: persona("Wren", "Pell", 4.6, { answers: 300, minutes: 11 }),
    termStart: "2026-10-12",
    today: "2026-11-24",
    weekShape: [0.75, 0.81, 0.87, 0.93, 0.99, 1.05, 1.11],
    strands: ["number"],
    workToday: true,
  });
  assert.ok(truth.sittings.length > 10);
  assert.ok(truth.sittings.every((one) => one.problems <= 12));
});
