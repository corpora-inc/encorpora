import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { estimateFrontier, strandLevel } from "../src/learning/frontier";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { guessChance, guessChanceOf } from "../src/math/guess-chance";
import { skills } from "../src/curriculum/catalog";
import { templateGrade } from "../src/server/mixed-practice";

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const byId = new Map(templates.map((template) => [template.id, template]));

/** One strand of grade-`grade` items; `typed` and `choice` differ only in the
 * chance that a guess is right. */
function estimate(
  answers: readonly { kind: "typed" | "choice"; correct: boolean }[],
  options: { start?: number; grade?: number; guess?: number } = {},
) {
  return estimateFrontier({
    start: options.start ?? 0,
    observations: answers.map((answer, i) => ({
      templateId: answer.kind,
      correct: answer.correct,
      assisted: false,
      createdAt: new Date(Date.UTC(2026, 9, 19, 12, i)).toISOString(),
    })),
    gradeOf: () => options.grade ?? 4,
    strandOf: () => "fractions",
    guessOf: (id) => (id === "choice" ? (options.guess ?? 1 / 4) : 0),
  });
}

test("one lucky guess moves the estimate far less than a typed correct answer", () => {
  // A kindergarten-age learner answers one grade-4 item correctly.
  const prior = estimate([]).overall.level;
  const typed = estimate([{ kind: "typed", correct: true }]).overall.level;
  const choice = estimate([{ kind: "choice", correct: true }]).overall.level;
  assert.ok(typed - prior > 1.8, `typed lift ${typed - prior}`);
  assert.ok(choice - prior < 0.8, `choice lift ${choice - prior}`);
  assert.ok(choice - prior < 0.4 * (typed - prior), `${choice} vs ${typed}`);
  // Fewer options, more luck: a correct pick of three says less than of four.
  const third = estimate([{ kind: "choice", correct: true }], { guess: 1 / 3 });
  assert.ok(third.overall.level < choice);
  // On level the discount is smaller, since knowing it is the likelier cause.
  const onLevel = (kind: "typed" | "choice") =>
    estimate([{ kind, correct: true }], { start: 4 }).overall.level;
  assert.ok(onLevel("choice") < onLevel("typed"));
  assert.ok(onLevel("choice") > estimate([], { start: 4 }).overall.level);
});

test("a wrong choice is as strong evidence as a typed miss", () => {
  for (const start of [2, 6])
    assert.deepEqual(
      estimate([{ kind: "choice", correct: false }], { start }),
      estimate([{ kind: "typed", correct: false }], { start }),
    );
});

test("repeated correct choice answers still converge upward", () => {
  const run = (n: number) =>
    estimate(
      Array.from({ length: n }, () => ({
        kind: "choice" as const,
        correct: true,
      })),
      { start: 2, grade: 6 },
    ).overall;
  const levels = [1, 4, 8, 16].map((n) => run(n));
  for (let i = 1; i < levels.length; i++)
    assert.ok(levels[i]!.level > levels[i - 1]!.level, JSON.stringify(levels));
  assert.ok(levels.at(-1)!.level > 6, JSON.stringify(levels.at(-1)));
  // Slower than typed evidence, but it gets there.
  const typed = estimate(
    Array.from({ length: 4 }, () => ({
      kind: "typed" as const,
      correct: true,
    })),
    { start: 2, grade: 6 },
  ).overall.level;
  assert.ok(levels[1]!.level < typed);
});

test("the recorded below-catalog trial no longer lifts fractions two grades on one guess", async () => {
  // Captured from a real anonymous run (also replayed by
  // trial-exhaustion.integration.ts): the first answer is option A on a
  // four-option fraction choice, which happens to be right; nearly every
  // later typed answer is wrong.
  const fixture: [string, string][] = JSON.parse(
    await readFile(
      new URL("./fixtures/trial-low-frontier.json", import.meta.url),
      "utf8",
    ),
  );
  const observations = fixture.map(([templateId, seed], i) => {
    const problem = generateProblem(templateId, seed);
    const response = problem.public.response;
    return {
      templateId,
      correct: gradeAnswer(
        problem,
        response.kind === "choice" ? response.options[0]!.id : "1",
      ),
      assisted: false,
      createdAt: new Date(Date.UTC(2026, 9, 19, 12, i)).toISOString(),
    };
  });
  assert.equal(observations[0]!.correct, true);
  const run = (guessOf: (id: string) => number) =>
    estimateFrontier({
      start: 4,
      observations,
      gradeOf: (id) => templateGrade(byId.get(id)!, nodes),
      strandOf: (id) => nodes.get(byId.get(id)!.skillId)!.strand,
      guessOf,
    });
  const before = run(() => 0);
  const after = run(guessChanceOf);
  const lift = (frontier: typeof after) =>
    strandLevel(frontier, "fractions") - frontier.overall.level;
  assert.ok(lift(before) > 1.8, `before ${lift(before)}`);
  assert.ok(lift(after) < 1.4, `after ${lift(after)}`);
  // Correct choice evidence must not lift the pooled estimate above treating
  // the answer as typed. The steadier summary retains more early history.
  assert.ok(after.overall.level <= before.overall.level);
  assert.equal(after.adaptive!.level, before.adaptive!.level);
});

test("guess chance comes from each family's answer schema and is never understated", () => {
  let choiceFamilies = 0;
  for (const template of templates) {
    const chance = guessChance(template);
    if (!template.requiredResponseCapability) {
      assert.equal(chance, 0, template.id);
      continue;
    }
    choiceFamilies++;
    assert.ok(chance > 0 && chance <= 1 / 2, `${template.id}: ${chance}`);
    for (let i = 0; i < 120; i++) {
      const response = generateProblem(template.id, `audit:${i}`).public
        .response;
      assert.equal(
        response.kind,
        template.requiredResponseCapability === "multi-select-v1"
          ? "multi-select"
          : template.requiredResponseCapability === "point-plot-v1"
            ? "point-plot"
            : "choice",
        template.id,
      );
      if (response.kind === "choice")
        assert.ok(
          chance >= 1 / response.options.length - 1e-12,
          `${template.id} seed ${i}: ${response.options.length} options, chance ${chance}`,
        );
      if (response.kind === "multi-select") {
        // Enumerate permitted sets independently of the binomial implementation.
        const possibilities = Array.from(
          { length: 2 ** response.options.length },
          (_, mask) => mask.toString(2).replaceAll("0", "").length,
        ).filter((count) => count === response.selectionCount).length;
        assert.ok(chance >= 1 / possibilities - 1e-12, template.id);
      }
    }
  }
  assert.ok(choiceFamilies > 40, String(choiceFamilies));
  // Typed families and unknown ids score as typed answers.
  assert.equal(guessChanceOf("count-objects"), 0);
  assert.equal(guessChanceOf("no-such-family"), 0);
  // An unregistered choice family is treated as the most guessable kind.
  assert.equal(
    guessChance({
      id: "future-choice",
      requiredResponseCapability: "single-choice-v1",
    }),
    1 / 2,
  );
});
