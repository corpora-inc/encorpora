import { test } from "node:test";
import assert from "node:assert/strict";
import { planMixedPractice, templateGrade } from "../src/server/mixed-practice";
import {
  completedGrade,
  estimateFrontier,
  initialLevel,
  strandLevel,
} from "../src/learning/frontier";
import { projectSkillEvidence } from "../src/server/evidence.js";
import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { guessChanceOf } from "../src/math/guess-chance";
import type { Outcome } from "../src/server/repository";

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const byId = new Map(templates.map((template) => [template.id, template]));
const gradeOf = (id: string) => templateGrade(byId.get(id)!, nodes);
const strandOf = (id: string) => nodes.get(byId.get(id)!.skillId)!.strand;
const october = Date.parse("2026-10-17T12:00:00Z");

/** A simulated learner answers correctly with a probability that falls as
 * problems rise above their true level in each strand. */
function simulate(
  birthYear: number,
  ability: (strand: string) => number,
  problems = 30,
  seed = 7,
) {
  let state = seed;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
  // Park–Miller's first outputs are proportional to a small seed (seed 1 draws
  // 0.0000078), which would make every early answer "correct"; discard them.
  for (let i = 0; i < 4; i++) random();
  const attempts: Outcome[] = [];
  const shown: { grade: number; strand: string; correct: boolean }[] = [];
  const start = initialLevel({ birthYear, now: october });
  for (let i = 0; attempts.length < problems; i++) {
    const at = october + i * 60000;
    const frontier = estimateFrontier({
      start,
      observations: attempts,
      gradeOf,
      strandOf,
      guessOf: guessChanceOf,
    });
    for (const choice of planMixedPractice({
      templates,
      skills,
      attempts,
      evidence: projectSkillEvidence(attempts),
      frontier,
      count: 3,
      seed: `${seed}:${i}`,
      now: at,
    })) {
      const grade = gradeOf(choice.template.id);
      const p = 1 / (1 + Math.exp(-3 * (ability(choice.strand) + 0.3 - grade)));
      const correct = random() < p;
      shown.push({ grade, strand: choice.strand, correct });
      const n = attempts.length;
      attempts.push({
        id: String(n).padStart(6, "0"),
        problemId: `problem-${n}`,
        requestId: `request-${n}`,
        templateId: choice.template.id,
        skillId: choice.template.skillId,
        correct,
        assisted: false,
        response: "",
        answer: "",
        explanation: [],
        createdAt: new Date(at + n * 1000).toISOString(),
      });
    }
  }
  return {
    shown,
    frontier: estimateFrontier({
      start,
      observations: attempts,
      gradeOf,
      strandOf,
      guessOf: guessChanceOf,
    }),
  };
}

test("birth year centres placement on the grade a learner of that age is in", () => {
  assert.equal(completedGrade(2016, october), 3);
  assert.equal(completedGrade(2016, Date.parse("2026-06-01T00:00:00Z")), 2);
  assert.equal(initialLevel({ birthYear: 2016, now: october }), 4);
  assert.equal(initialLevel({ birthYear: 2022, now: october }), 0);
  assert.equal(initialLevel({ birthYear: 1990, now: october }), 12);
  const { shown } = simulate(2016, () => 4, 3);
  assert.ok(
    shown.every((entry) => entry.grade >= 3 && entry.grade <= 5),
    JSON.stringify(shown),
  );
});

test("a learner far ahead of their age climbs to their frontier within a dozen problems", () => {
  const { shown, frontier } = simulate(2016, () => 7);
  assert.ok(
    shown.slice(9, 15).some((entry) => entry.grade >= 6),
    JSON.stringify(shown),
  );
  assert.ok(frontier.overall.level >= 6, String(frontier.overall.level));
});

test("a learner missing basics descends as far as counting within a few problems", () => {
  const { shown, frontier } = simulate(2016, () => 0.3);
  assert.ok(
    shown.slice(4, 10).some((entry) => entry.grade === 0),
    JSON.stringify(shown),
  );
  assert.ok(shown.slice(10).every((entry) => entry.grade <= 3));
  assert.ok(frontier.overall.level <= 1);
});

test("mixed frontiers find fraction gaps while preserving advanced algebra across seeds", () => {
  // Fractions material ends near grade 6; a grade-7 learner with a fraction gap
  // must still meet it, or the gap is never found. Weighted sampling has more
  // than one valid trajectory, so these are rates over seeded runs, not
  // per-seed guarantees: a single unlucky draw of grade-4 items is valid, and
  // any change to the template inventory rearranges which seeds draw them.
  // Rates measured over 800 runs, with and without the newest templates:
  // fractions shown 100%, estimate at or below 5 99%, algebra preserved 98%,
  // advanced work kept 100%, late lower-grade fraction repair 90%. Each bar
  // below sits at least 4.5 standard deviations under its measured rate for
  // 200 runs (sd = sqrt(200 * p * (1 - p)), 4.2 for repair), so inventory
  // changes do not flip it, while a real regression still fails.
  const runs = 200;
  const levels: number[] = [];
  const count = { shown: 0, found: 0, algebra: 0, advanced: 0, repair: 0 };
  for (let seed = 1; seed <= runs; seed++) {
    const { shown, frontier } = simulate(
      2012,
      (strand) => (strand === "fractions" ? 3 : 7),
      30,
      seed,
    );
    count.shown += Number(shown.some((entry) => entry.strand === "fractions"));
    const level = strandLevel(frontier, "fractions");
    levels.push(level);
    count.found += Number(level <= 5);
    count.algebra += Number(strandLevel(frontier, "algebra") >= 6);
    const late = shown.slice(15);
    count.advanced += Number(
      late.some((e) => e.strand !== "fractions" && e.grade >= 6),
    );
    count.repair += Number(
      late.some((e) => e.strand === "fractions" && e.grade <= 4),
    );
  }
  const summary = JSON.stringify(count);
  assert.ok(count.shown >= runs * 0.95, `fractions shown ${summary}`);
  assert.ok(count.found >= runs * 0.95, `fraction gap found ${summary}`);
  assert.ok(count.algebra >= runs * 0.9, `algebra preserved ${summary}`);
  assert.ok(count.advanced >= runs * 0.95, `advanced work kept ${summary}`);
  assert.ok(count.repair >= runs * 0.8, `late fraction repair ${summary}`);
  levels.sort((a, b) => a - b);
  assert.ok(
    levels[runs / 2]! <= 4,
    `median fraction estimate ${levels[runs / 2]}`,
  );
  assert.ok(
    levels.filter((l) => l <= 4.5).length >= runs * 0.9,
    String(levels),
  );
});

test("on-level practice stays within a grade of the frontier and keeps mixing strands", () => {
  const { shown } = simulate(2016, () => 3, 30, 11);
  const near = shown.filter((entry) => Math.abs(entry.grade - 3) <= 1).length;
  assert.ok(near >= 20, `${near}/30 within a grade`);
  for (let i = 1; i < shown.length; i++)
    assert.ok(
      shown
        .slice(Math.max(0, i - 3), i + 1)
        .some((e) => e.strand !== shown[i].strand),
    );
  assert.ok(new Set(shown.map((entry) => entry.strand)).size >= 5);
});

test("the estimate narrows with evidence and discounts uninformative answers", () => {
  const run = (templateId: string, correct: boolean, assisted = false, n = 1) =>
    estimateFrontier({
      start: 6,
      observations: Array.from({ length: n }, () => ({
        templateId,
        correct,
        assisted,
      })),
      gradeOf,
      strandOf,
      guessOf: guessChanceOf,
    }).overall;
  const prior = run("linear-equation", true, false, 0);
  assert.equal(prior.level, 6);
  assert.ok(prior.sd > 2);
  const strong = run("logarithm-integer", true, false, 20);
  assert.ok(strong.level > 11.5 && strong.sd < 1, JSON.stringify(strong));
  const weak = run("count-objects", false, false, 20);
  assert.ok(weak.level < 0.5 && weak.sd < 1, JSON.stringify(weak));
  // Help is not independent success.
  assert.ok(
    run("linear-equation", true, true).level <
      run("linear-equation", true).level,
  );
  // Counting correctly says almost nothing about a grade-6 learner.
  assert.ok(Math.abs(run("count-objects", true).level - prior.level) < 0.15);
  assert.deepEqual(
    run("linear-equation", true, false, 3),
    run("linear-equation", true, false, 3),
  );
});

test("offline packs never exceed a grade above the strand frontier", () => {
  const frontier = estimateFrontier({
    start: 2,
    observations: [],
    gradeOf,
    strandOf,
    guessOf: guessChanceOf,
  });
  const choices = planMixedPractice({
    templates,
    skills,
    attempts: [],
    evidence: [],
    frontier,
    count: 5,
    seed: "offline",
    now: october,
    strictCeiling: true,
  });
  assert.ok(choices.length > 0);
  assert.ok(choices.every((choice) => gradeOf(choice.template.id) <= 3));
});

test("a learner who improves is followed: old misses fade and surprises re-widen the estimate", () => {
  const day = 86400000;
  const answer = (templateId: string, correct: boolean, at: number) => ({
    templateId,
    correct,
    assisted: false,
    createdAt: new Date(october + at).toISOString(),
  });
  // A long run of misses on grade-6 work, then (days later) steady success
  // on grade-7 work.
  const misses = Array.from({ length: 60 }, (_, i) =>
    answer("divide-fractions", false, i * 60000),
  );
  const successes = Array.from({ length: 30 }, (_, i) =>
    answer("linear-equation", true, 5 * day + i * 60000),
  );
  const estimate = (observations: typeof misses) =>
    estimateFrontier({
      start: 4,
      observations,
      gradeOf,
      strandOf,
      guessOf: guessChanceOf,
      now: Date.parse(observations.at(-1)!.createdAt) - october + october,
    }).overall;
  const low = estimate(misses);
  assert.ok(low.level < 5, JSON.stringify(low));
  const turning = estimate([...misses, ...successes.slice(0, 4)]);
  assert.ok(turning.sd > low.sd, "surprising successes re-widen the estimate");
  const after = estimate([...misses, ...successes]);
  assert.ok(after.level > 7, JSON.stringify(after));
  assert.ok(after.sd < 1.2, JSON.stringify(after));
});
