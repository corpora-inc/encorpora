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
    }),
  };
}

test("birth year places the first problems in material the learner should already know", () => {
  assert.equal(completedGrade(2016, october), 3);
  assert.equal(completedGrade(2016, Date.parse("2026-06-01T00:00:00Z")), 2);
  assert.equal(initialLevel({ birthYear: 2022, now: october }), 0);
  assert.equal(initialLevel({ birthYear: 1990, now: october }), 12);
  const { shown } = simulate(2016, () => 3, 3);
  assert.ok(
    shown.every((entry) => entry.grade === 3),
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

test("each strand finds its own frontier: a fraction gap does not hold back algebra", () => {
  const { shown, frontier } = simulate(2012, (strand) =>
    strand === "fractions" ? 3 : 7,
  );
  assert.ok(strandLevel(frontier, "fractions") <= 4.5);
  assert.ok(strandLevel(frontier, "algebra") >= 6);
  const late = shown.slice(15);
  assert.ok(
    late.some((entry) => entry.strand === "fractions" && entry.grade <= 4),
  );
  assert.ok(
    late.some((entry) => entry.strand !== "fractions" && entry.grade >= 6),
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

test("the staircase is deterministic and bounded to the curriculum", () => {
  const always = (correct: boolean) =>
    estimateFrontier({
      start: 6,
      observations: Array.from({ length: 40 }, () => ({
        templateId: "logarithm-integer",
        correct,
        assisted: false,
      })),
      gradeOf,
      strandOf,
    });
  assert.equal(always(true).overall.level, 12);
  assert.equal(always(false).overall.level, 0);
  const assisted = estimateFrontier({
    start: 8,
    observations: [
      { templateId: "linear-equation", correct: true, assisted: true },
    ],
    gradeOf,
    strandOf,
  });
  assert.equal(
    assisted.overall.level,
    7,
    "assistance is not independent success",
  );
  const easy = estimateFrontier({
    start: 8,
    observations: [
      { templateId: "count-objects", correct: true, assisted: false },
    ],
    gradeOf,
    strandOf,
  });
  assert.equal(
    easy.overall.level,
    8,
    "an easy success carries no upward evidence",
  );
});

test("offline packs never exceed a grade above the strand frontier", () => {
  const frontier = estimateFrontier({
    start: 2,
    observations: [],
    gradeOf,
    strandOf,
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
