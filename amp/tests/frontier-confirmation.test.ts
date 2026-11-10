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
  assert.ok(before.confirmation!.algebra!.level >= 7);
  assert.equal(
    after.confirmation!.algebra!.level,
    before.confirmation!.algebra!.level,
  );
  assert.equal(
    before.confirmation!.algebra!.foundationConfirmed,
    false,
    "hard success does not substitute for direct foundation checks",
  );
});
test("the ceiling stands on what independent work shows, not on the start", () => {
  const right = Array.from({ length: 12 }, (_, n) => answer(7, n));
  // Before anything is shown: a grade above the start (4).
  assert.equal(estimate([]).unconfirmedCeiling, 5);
  assert.equal(estimate(right.slice(0, 1)).confirmation!.algebra!.level, 5);
  // Two varied successes at grade 7 show it, at once: while still climbing,
  // practice reaches two grades past it, here and in areas not yet tried.
  const shown = estimate(right.slice(0, 2));
  assert.equal(shown.climbing, true);
  assert.equal(shown.confirmation!.algebra!.level, 9);
  assert.equal(shown.unconfirmedCeiling, 9);
  // Two misses past it place the learner: the ceiling is what they showed.
  const placed = estimate([
    ...right.slice(0, 4),
    answer(9, 4, false),
    answer(9, 5, false),
  ]);
  assert.equal(placed.climbing, false);
  assert.equal(placed.confirmation!.algebra!.level, 7);
  // Help shows nothing: the ceiling stays a grade above the start.
  assert.equal(
    estimate(right.map((o) => ({ ...o, assisted: true }))).confirmation!
      .algebra!.level,
    5,
  );
  // One family needs twice the successes.
  const one = (n: number) => ({
    ...answer(7, 0),
    createdAt: answer(7, n).createdAt,
  });
  assert.equal(
    estimate([one(0), one(1), one(2)]).confirmation!.algebra!.level,
    5,
  );
  assert.equal(
    estimate([one(0), one(1), one(2), one(3)]).confirmation!.algebra!.level,
    9,
  );
});
test("a slip on the way up does not end the climb; finding the edge does", () => {
  const climb = [answer(5, 0), answer(5, 1), answer(6, 2), answer(6, 3)];
  // A miss well below what is shown is a slip.
  assert.equal(estimate([...climb, answer(3, 4, false)]).climbing, true);
  // A miss at the top stops counting once later work succeeds past it.
  const slip = [...climb, answer(6, 4, false), answer(6, 5, false)];
  assert.equal(estimate(slip).climbing, false);
  assert.equal(
    estimate([...slip, answer(6, 6), answer(7, 7), answer(7, 8)]).climbing,
    true,
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

test("thirty correct mixed problems climb with probes, and help climbs nowhere", () => {
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
    const ordinary: number[] = [];
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
      if (selected.selection?.purpose === "foundation") foundations++;
      if (selected.selection?.purpose === "probe") {
        probes++;
        if (scenario === "helped")
          assert.ok(grade <= 7.5, `helped probe at ${grade}`);
      } else {
        ordinary.push(grade);
        if (scenario === "helped")
          assert.ok(grade <= 5.5, `helped work climbed to ${grade}`);
      }
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
    // Every answer right: no edge found yet, so no foundation checks.
    assert.equal(foundations, 0, `${scenario}: ${foundations} foundations`);
    if (scenario === "unmarked") {
      assert.ok(probes >= 10, `${probes} probes`);
      const late = ordinary.slice(-8);
      assert.ok(
        late.reduce((a, b) => a + b, 0) / late.length >= 8,
        `ordinary work after 32 right answers: ${ordinary.join(" ")}`,
      );
    }
  }
});
