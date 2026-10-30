import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateFrontier,
  type FrontierObservation,
} from "../src/learning/frontier";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import { templateGrade, planMixedPractice } from "../src/server/mixed-practice";
import { guessChanceOf } from "../src/math/guess-chance";
import type { Outcome } from "../src/server/repository";

const day = Date.parse("2026-10-30T12:00:00Z");
const answer = (
  grade: number,
  n: number,
  correct = true,
  hours = 0,
): FrontierObservation => ({
  templateId: `${grade}:${n % 2}`,
  correct,
  assisted: false,
  createdAt: new Date(day + hours * 3600000 + n * 60000).toISOString(),
});
const estimate = (observations: FrontierObservation[]) =>
  estimateFrontier({
    start: 4,
    observations,
    gradeOf: (id) => Number(id.split(":")[0]),
    strandOf: () => "algebra",
    guessOf: () => 0.25,
  });

test("below-kindergarten practice retains introductory variety without widening strict or advanced-focus ceilings", () => {
  const nodes = new Map(skills.map((skill) => [skill.id, skill]));
  const byId = new Map(templates.map((template) => [template.id, template]));
  const gradeOf = (id: string) => templateGrade(byId.get(id)!, nodes);
  const frontier = estimateFrontier({
    start: 0,
    observations: Array.from({ length: 30 }, (_, n) => ({
      templateId: "count-objects",
      correct: false,
      assisted: false,
      createdAt: new Date(day + n * 60000).toISOString(),
    })),
    gradeOf,
    strandOf: (id) => nodes.get(byId.get(id)!.skillId)!.strand,
    guessOf: guessChanceOf,
  });
  assert.ok(frontier.adaptive!.level < -0.4);
  const seen = new Set<number>();
  const advanced = templates.filter((template) => gradeOf(template.id) >= 9);
  const advancedFloor = Math.min(
    ...advanced.map((template) => gradeOf(template.id)),
  );
  for (let seed = 0; seed < 32; seed++) {
    const input = {
      templates,
      skills,
      frontier,
      attempts: [],
      evidence: [],
      count: 5,
      seed: `beginner-bound:${seed}`,
      now: day,
    };
    const online = planMixedPractice(input);
    assert.equal(online.length, 5);
    for (const choice of online) {
      const grade = gradeOf(choice.template.id);
      assert.ok(grade <= 1);
      seen.add(grade);
    }
    const offline = planMixedPractice({ ...input, strictCeiling: true });
    assert.ok(offline.every((choice) => gradeOf(choice.template.id) <= 0.5));
    const focused = planMixedPractice({ ...input, templates: advanced });
    assert.equal(focused.length, 5);
    assert.ok(
      focused.every((choice) => gradeOf(choice.template.id) === advancedFloor),
    );
  }
  assert.ok(seen.has(1), "nearby introductory families remain available");
});

test("a failed harder probe preserves established lower readiness", () => {
  const history = Array.from({ length: 8 }, (_, n) =>
    answer(7, n, true, n * 7),
  );
  const before = estimate(history),
    after = estimate([...history, answer(9, 8, false, 60)]);
  assert.equal(before.confirmation!.algebra!.level, 7);
  assert.equal(after.confirmation!.algebra!.level, 7);
  assert.equal(
    before.confirmation!.algebra!.foundationConfirmed,
    false,
    "hard success does not substitute for direct foundation checks",
  );
});
test("varied first-session success can advance without waiting, while spaced retrieval confirms a higher band", () => {
  const oneSession = Array.from({ length: 12 }, (_, n) => answer(7, n));
  assert.equal(
    estimate(oneSession.slice(0, 4)).confirmation!.algebra!.level,
    5,
  );
  assert.equal(estimate(oneSession).confirmation!.algebra!.level, 7);
  const later = oneSession.concat(
    Array.from({ length: 4 }, (_, n) => answer(9, n, true, 24)),
  );
  assert.ok(estimate(later).confirmation!.algebra!.level >= 7);
  const spaced = later.concat(
    Array.from({ length: 4 }, (_, n) => answer(9, n, true, 48)),
  );
  assert.equal(
    estimate(spaced).confirmation!.algebra!.level,
    9,
    "birth year is not a permanent ceiling",
  );
  assert.equal(
    estimate(oneSession.map((o) => ({ ...o, assisted: true }))).confirmation!
      .algebra!.level,
    5,
  );
});
test("foundations require varied direct independent retrieval and tolerate one harder miss", () => {
  const history = Array.from({ length: 6 }, (_, n) =>
    answer(4, n, true, n * 7),
  );
  assert.equal(
    estimate(history).confirmation!.algebra!.foundationConfirmed,
    true,
  );
  assert.equal(
    estimate([...history, answer(9, 6, false, 60)]).confirmation!.algebra!
      .foundationConfirmed,
    true,
  );
  assert.equal(
    estimate(history.map((o) => ({ ...o, assisted: true }))).confirmation!
      .algebra!.foundationConfirmed,
    false,
  );
});

test("thirty correct mixed problems keep foundation checks alongside bounded probes", () => {
  const nodes = new Map(skills.map((s) => [s.id, s]));
  const byId = new Map(templates.map((t) => [t.id, t]));
  for (const scenario of ["helped", "unmarked"] as const) {
    const attempts: Outcome[] = [];
    const initial = estimateFrontier({
      start: 4,
      observations: [],
      gradeOf: () => 4,
      strandOf: () => "math",
      guessOf: () => 0,
    }).overall.level;
    let foundations = 0,
      probes = 0;
    for (let n = 0; n < 32; n++) {
      const now = day + n * 60000;
      const frontier = estimateFrontier({
        start: 4,
        observations: attempts,
        gradeOf: (id) => templateGrade(byId.get(id)!, nodes),
        strandOf: (id) => nodes.get(byId.get(id)!.skillId)!.strand,
        guessOf: guessChanceOf,
        now,
      });
      const selected = planMixedPractice({
        templates,
        skills,
        evidence: [],
        attempts,
        frontier,
        count: 1,
        seed: `recovery:${scenario}:${n}`,
        learnerKey: "synthetic",
        now,
      })[0]!;
      const grade = templateGrade(selected.template, nodes);
      if (selected.selection?.purpose === "foundation") {
        foundations++;
        assert.ok(grade <= 4.5, `foundation at ${grade}`);
      }
      if (selected.selection?.purpose === "probe") probes++;
      else
        assert.ok(
          grade <= 6.5,
          `ordinary work climbed to ${grade} after ${n} answers`,
        );
      attempts.push({
        id: String(n),
        problemId: String(n),
        requestId: String(n),
        response: "",
        answer: "",
        explanation: [],
        templateId: selected.template.id,
        skillId: selected.template.skillId,
        correct: true,
        assisted: scenario === "helped",
        createdAt: new Date(now).toISOString(),
      });
      if (scenario === "helped") assert.ok(frontier.overall.level === initial);
    }
    assert.ok(foundations >= 5, `${scenario}: ${foundations} foundations`);
    if (scenario === "unmarked") assert.ok(probes >= 5, `${probes} probes`);
  }
});
