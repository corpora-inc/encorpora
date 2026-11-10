import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { estimateFrontier, strandLevel } from "../src/learning/frontier";
import {
  generateProblem,
  generateProblemFor,
  gradeAnswer,
  templates,
} from "../src/math/engine";
import {
  guessChance,
  guessChanceOf,
  problemGuessChance,
} from "../src/math/guess-chance";
import { skills } from "../src/curriculum/catalog";
import { templateGrade } from "../src/server/mixed-practice";
import {
  figureCapabilities,
  type ResponseCapability,
} from "../src/math/contracts";

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

test("graphical solution estimates cover three-choice intersection variants", () => {
  const problem = generateProblem("graphical-solution-table", "audit:13");
  assert.equal(problem.public.response.kind, "choice");
  if (problem.public.response.kind !== "choice") throw new Error("response");
  assert.equal(problem.public.response.options.length, 3);
  assert.equal(problemGuessChance(problem), 1 / 3);
  assert.equal(guessChanceOf("graphical-solution-table"), 1 / 3);
});

for (const [id, seed, cards] of [
  ["tile-then-multiply", "audit:95", 4],
  ["split-tiled-count", "audit:5", 5],
] as const) {
  test(`${id} estimates cover ${cards}-card reusable trays`, () => {
    const problem = generateProblem(id, seed);
    const response = problem.public.response;
    assert.equal(response.kind, "multi-part-choice");
    if (response.kind !== "multi-part-choice") throw new Error("response");
    assert.equal(response.reuse, true);
    assert.equal(response.blanks.length, 4);
    assert.ok(response.blanks.every((blank) => blank.options.length === cards));
    assert.equal(problemGuessChance(problem), 1 / cards ** 4);
    assert.equal(guessChanceOf(id), 1 / cards ** 4);
  });
}

test("area card guessing floors cover every permitted set of dimensions", () => {
  // Independently enumerate distinct numerical choices, then four reusable
  // slots: n choices per slot give n^4 equally likely submitted answers.
  let tileMinimum = Infinity,
    splitMinimum = Infinity;
  for (let a = 3; a <= 9; a++) {
    for (let b = 3; b <= 10; b++) {
      if (a === b) continue;
      for (let k = 1; k < a; k++) {
        const choices = Math.min(
          6,
          new Set([b, a, a * b, k * b, a + b, 2 * (a + b), k * a]).size,
        );
        tileMinimum = Math.min(tileMinimum, choices);
      }
    }
    for (let b = 2; b <= 8; b++) {
      for (let c = 2; c <= 8; c++) {
        if (b === c || b + c > 12) continue;
        const choices = Math.min(
          6,
          new Set([
            a * b,
            a * c,
            a * (b + c),
            a + b + c,
            b * c,
            a * b * c,
            b + c,
          ]).size,
        );
        splitMinimum = Math.min(splitMinimum, choices);
      }
    }
  }
  assert.equal(tileMinimum, 4);
  assert.equal(splitMinimum, 5);
  assert.equal(guessChanceOf("tile-then-multiply"), 1 / tileMinimum ** 4);
  assert.equal(guessChanceOf("split-tiled-count"), 1 / splitMinimum ** 4);
  const intersection = generateProblem("graphical-solution-table", "audit:13");
  assert.equal(intersection.public.response.kind, "choice");
  if (intersection.public.response.kind !== "choice")
    throw new Error("response");
  assert.equal(intersection.public.response.options.length, 3);
  assert.equal(guessChanceOf("graphical-solution-table"), 1 / 3);
});
test("guess chance comes from each family's answer schema and is never understated", () => {
  const kindForCapability: Record<ResponseCapability, string> = {
    "single-choice-v1": "choice",
    "multi-select-v1": "multi-select",
    "point-plot-v1": "point-plot",
    "line-plot-build-v1": "line-plot-build",
    "shape-composer-v1": "shape-composer",
    "multi-part-choice-v1": "multi-part-choice",
    "multi-part-cards-v1": "multi-part-choice",
    "figure-choice-v1": "figure-choice",
    "structured-work-v1": "structured-work",
    "unit-square-marking-v1": "unit-square-marking",
    "counter-builder-v1": "counter-builder",
    "peg-board-v1": "peg-board",
  };
  let choiceFamilies = 0;
  for (const template of templates) {
    const chance = guessChance(template);
    if (
      template.requiredResponseCapability === "structured-work-v1" &&
      !template.requiredResponseCapabilities?.some(
        (capability) => capability !== "structured-work-v1",
      )
    ) {
      // Typed steps cannot be guessed; orderings and bank-built proofs can.
      // The family's chance covers every instance's exact chance.
      assert.ok(chance >= 0 && chance <= 1 / 2, `${template.id}: ${chance}`);
      for (let i = 0; i < 120; i++) {
        const problem = generateProblem(template.id, `audit:${i}`);
        assert.equal(problem.public.response.kind, "structured-work");
        assert.ok(
          chance >= problemGuessChance(problem) - 1e-12,
          `${template.id} seed ${i}: ${problemGuessChance(problem)} > ${chance}`,
        );
      }
      continue;
    }
    // Versioned families can add formats to a structured-work legacy surface.
    // Check every declared format through the shared schema audit below.
    if (chance > 0) choiceFamilies++;
    assert.ok(chance >= 0 && chance <= 1 / 2, `${template.id}: ${chance}`);
    const capabilities = [
      ...(template.requiredResponseCapability
        ? [template.requiredResponseCapability]
        : []),
      ...(template.requiredResponseCapabilities ?? []),
    ];
    // Typed answers are supported without a response capability.
    const declaredKinds = [
      "number",
      "fraction",
      ...capabilities.map((capability) => kindForCapability[capability]),
    ];
    for (let i = 0; i < 120; i++) {
      const problem = generateProblem(template.id, `audit:${i}`);
      const response = problem.public.response;
      // Clause variants can add formats beyond the legacy admission format.
      // The transport must fall back for a client declaring only that format.
      const compatible = problem.variant?.axes?.clause
        ? generateProblemFor(
            template.id,
            `audit:${i}`,
            figureCapabilities,
            undefined,
            capabilities,
          )
        : problem;
      if (capabilities.length)
        assert.ok(
          declaredKinds.includes(compatible.public.response.kind),
          `${template.id}: ${compatible.public.response.kind} must have a declared capability`,
        );
      // Audit the actual instance, including structured work with private
      // grading rules; also independently enumerate its public answer space.
      assert.ok(
        chance >= problemGuessChance(problem) - 1e-12,
        `${template.id} seed ${i}: ${problemGuessChance(problem)} > ${chance}`,
      );
      if (response.kind === "choice" || response.kind === "figure-choice")
        assert.ok(
          chance >= 1 / response.options.length - 1e-12,
          `${template.id} seed ${i}: ${response.options.length} options, chance ${chance}`,
        );
      if (response.kind === "multi-part-choice") {
        // Count the answers a blind learner can submit: one option per
        // blank, and for cards used once, blanks that share a tray row take
        // different cards (counted here by enumeration, not the formula).
        const rows = new Map<string, number>();
        for (const b of response.blanks) {
          const key = JSON.stringify(b.options);
          rows.set(key, (rows.get(key) ?? 0) + 1);
        }
        const once = response.layout === "cards" && !response.reuse;
        let answers = 1;
        for (const [key, boxes] of rows) {
          const n = (JSON.parse(key) as unknown[]).length;
          let count = 0;
          const walk = (depth: number, used: Set<number>) => {
            if (depth === boxes) return void count++;
            for (let c = 0; c < n; c++)
              if (!once || !used.has(c)) walk(depth + 1, new Set([...used, c]));
          };
          walk(0, new Set());
          answers *= count;
        }
        assert.ok(
          chance >= 1 / answers - 1e-12,
          `${template.id} seed ${i}: 1/${answers} > ${chance}`,
        );
      }
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
