import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  clientCanDraw,
  generatedProblemSchema,
  responseCapabilities,
} from "../src/math/contracts";
import {
  generateProblem,
  generateProblemFor,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import {
  counterBuilderAnswerText,
  counterBuilderFeedback,
  counterBuilderGuessChance,
  counterBuilderResponseSchema,
  gradeCounterBuilder,
  normalizeCounterBuilder,
  type CounterBuilderResponse,
  type CounterBuilderAnswer,
} from "../src/math/counter-builder";
import { counterBuilderVariants } from "../src/math/counter-builder-practice";
import {
  guessChanceOf,
  problemGuessChance,
  responseGuessChance,
} from "../src/math/guess-chance";
import { problemLesson } from "../src/content/problem-lessons";
import { PrintExerciseBody } from "../src/content/print-exercise";

const r: CounterBuilderResponse = {
  kind: "counter-builder",
  label: "Show it",
  board: "two-groups",
  canRemove: false,
  max: 10,
  thing: "apple",
};
const key = JSON.stringify({
  groups: [3, 2],
  removed: 0,
  sentence: [3, "+", 2, 5],
});
const take: CounterBuilderResponse = { ...r, board: "row", canRemove: true };
const takeKey = JSON.stringify({
  groups: [7],
  removed: 2,
  sentence: [7, "-", 2, 5],
});

test("exact models accept commuted joins, preserve the drawing, and reject wrong sentences", () => {
  for (const groups of [
    [3, 2],
    [2, 3],
  ])
    for (const sentence of [
      [3, "+", 2, 5],
      [2, "+", 3, 5],
    ]) {
      const answer = JSON.stringify({ groups, removed: 0, sentence });
      assert.equal(gradeCounterBuilder(r, key, answer), true);
      assert.equal(
        normalizeCounterBuilder(r, answer),
        answer,
        "Never reorder the child's picture on grading",
      );
    }
  for (const candidate of [
    { groups: [5, 0], removed: 0, sentence: [3, "+", 2, 5] },
    { groups: [3, 2], removed: 0, sentence: [3, "-", 2, 1] },
    { groups: [3, 2], removed: 0, sentence: [3, "+", 2, 6] },
    { groups: [4, 1], removed: 0, sentence: [4, "+", 1, 5] },
  ]) {
    const raw = JSON.stringify(candidate);
    assert.notEqual(
      normalizeCounterBuilder(r, raw),
      null,
      "Log complete wrong first attempts",
    );
    assert.equal(gradeCounterBuilder(r, key, raw), false);
    assert.ok(counterBuilderFeedback(r, key, raw).length);
  }
  for (const [placed, removed, sentence] of [
    [7, 5, [7, "-", 5, 2]],
    [2, 0, [7, "-", 2, 5]],
    [5, 0, [7, "-", 2, 5]],
    [9, 2, [7, "-", 2, 5]],
    [7, 2, [2, "-", 7, 5]],
  ] as const) {
    const raw = JSON.stringify({ groups: [placed], removed, sentence });
    assert.notEqual(normalizeCounterBuilder(take, raw), null);
    assert.equal(gradeCounterBuilder(take, takeKey, raw), false);
  }
  assert.ok(gradeCounterBuilder(take, takeKey, takeKey));
});

test("strict schema rejects unreachable, fractional, incomplete and foreign answers", () => {
  for (const raw of [
    "null",
    "[]",
    "{}",
    key.replace("[3,2]", "[3.5,2]"),
    key.replace("[3,2]", "[9,9]"),
    key.replace("[3,2]", "[3,-2]"),
    key.replace("[3,2]", "[3]"),
    key.replace('"removed":0', '"removed":1'),
    key.replace('"+"', '"×"'),
    key.replace('[3,"+",2,5]', '[null,"+",2,5]'),
    key.slice(0, -1) + ',"extra":true}',
    takeKey.replace('"removed":2', '"removed":8'),
  ]) {
    assert.equal(normalizeCounterBuilder(r, raw), null, raw);
  }
  assert.equal(
    counterBuilderResponseSchema.safeParse({ ...r, canRemove: true }).success,
    false,
  );
  assert.equal(
    counterBuilderResponseSchema.safeParse({ ...r, thing: "dot" }).success,
    false,
  );
  assert.equal(
    counterBuilderResponseSchema.safeParse({ ...r, max: 100 }).success,
    false,
  );
});

test("guess chance enumerates every labelled board and number/sign-tile assignment", () => {
  // Independent integer enumeration of the actual UI domains. Do not use the
  // grader or its normalization to define the sample space or count successes.
  for (const [takeAway, equal] of [
    [false, false],
    [false, true],
    [true, false],
  ]) {
    let all = 0,
      accepted = 0;
    const x = takeAway ? 7 : equal ? 2 : 3,
      y = 2,
      result = takeAway ? 5 : x + y;
    for (let first = 0; first <= 10; first++)
      for (let second = 0; second <= (takeAway ? first : 10 - first); second++)
        for (let a = 0; a <= 10; a++)
          for (let b = 0; b <= 10; b++)
            for (let c = 0; c <= 10; c++)
              for (const sign of ["+", "-"]) {
                all++;
                const boardMatches = takeAway
                  ? first === x && second === y
                  : (first === x && second === y) ||
                    (first === y && second === x);
                const sentenceMatches = takeAway
                  ? sign === "-" && a === x && b === y
                  : sign === "+" &&
                    ((a === x && b === y) || (a === y && b === x));
                if (boardMatches && sentenceMatches && c === result) accepted++;
              }
    const response = takeAway ? take : r;
    const answer = JSON.stringify({
      groups: takeAway ? [x] : [x, y],
      removed: takeAway ? y : 0,
      sentence: [x, takeAway ? "-" : "+", y, result],
    });
    assert.equal(counterBuilderGuessChance(response, answer), accepted / all);
    assert.ok(responseGuessChance(response) >= accepted / all);
  }
});

test("500 seeds cover the spec, match an independent prompt oracle and fall back without changing givens", () => {
  const cases = Array.from({ length: 500 }, (_, i) =>
    generateProblem("build-the-number-sentence", `counter-${i}`),
  );
  const seen = new Map<string, number>(),
    things = new Set<string>();
  const chance = guessChanceOf("build-the-number-sentence");
  const template = templates.find((t) => t.id === "build-the-number-sentence")!;
  assert.ok(responseCapabilities.includes("counter-builder-v1"));
  assert.equal(
    clientCanDraw(template, {
      responseCapabilities: ["figure-choice-v1"],
      figureCapabilities: ["scenes-v1"],
    }),
    true,
  );
  assert.equal(
    clientCanDraw(template, {
      responseCapabilities: ["figure-choice-v1"],
      figureCapabilities: [],
    }),
    false,
  );
  assert.equal(
    clientCanDraw(template, {
      responseCapabilities: ["counter-builder-v1"],
      figureCapabilities: [],
    }),
    true,
  );
  for (const p of cases) {
    generatedProblemSchema.parse(p);
    assert.deepEqual(generateProblem(p.public.templateId, p.public.seed), p);
    assert.ok(gradeAnswer(p, p.answer));
    assert.ok(isValidResponse(p.public, p.answer));
    assert.ok(chance >= problemGuessChance(p));
    const response = p.public.response as CounterBuilderResponse;
    const a = JSON.parse(p.answer) as CounterBuilderAnswer;
    assert.ok(
      a.sentence.every((v) => typeof v !== "number" || (v >= 1 && v <= 10)),
    );
    things.add(response.thing);
    seen.set(p.variant!.id, (seen.get(p.variant!.id) ?? 0) + 1);
    const fallback = generateProblemFor(
      p.public.templateId,
      p.public.seed,
      ["scenes-v1"],
      undefined,
      ["figure-choice-v1"],
    );
    generatedProblemSchema.parse(fallback);
    assert.equal(fallback.public.response.kind, "figure-choice");
    assert.deepEqual(
      fallback.public.prompt.match(/\d+/g),
      p.public.prompt.match(/\d+/g),
    );
    assert.ok(gradeAnswer(fallback, fallback.answer));
    assert.ok(chance >= problemGuessChance(fallback));
    assert.doesNotMatch(
      fallback.hint,
      /tap|place|build/i,
      "Picture-choice hints describe picture reading",
    );
    assert.deepEqual(
      generateProblemFor(p.public.templateId, p.public.seed, [], undefined, [
        "counter-builder-v1",
      ]),
      p,
    );
    assert.doesNotMatch(
      JSON.stringify(p.public),
      /"answer"|"groups"|"removed"|"sentence"|walkthrough/,
    );
  }
  for (const v of counterBuilderVariants) assert.ok(seen.get(v)! >= 10, v);
  assert.equal(things.size, 6);
  const oracle = spawnSync(
    "python3",
    ["scripts/counter_builder_math_oracle.py"],
    {
      input: cases.map((p) => JSON.stringify(p)).join("\n"),
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(oracle.status, 0, oracle.stderr + oracle.stdout);
  assert.match(oracle.stdout, /500 stories and 1500 corrupted keys/);
  const routing = spawnSync(
    "python3",
    [
      "-c",
      "import runpy,sys; sys.path.insert(0,'scripts'); m=runpy.run_path('scripts/independent-math-review.py'); assert 'build-the-number-sentence' in m['FAMILY_ORACLE_FOR']",
    ],
    { encoding: "utf8" },
  );
  assert.equal(routing.status, 0, routing.stderr);
});

test("lessons and print explain and draw the model without serialized answers", () => {
  const p = generateProblem("build-the-number-sentence", "counter-print");
  const lesson = problemLesson(p.public.templateId, p.public.seed);
  assert.ok(lesson);
  assert.doesNotMatch(JSON.stringify(lesson), /\\"groups\\"/);
  for (const solutions of [false, true]) {
    const html = renderToStaticMarkup(
      createElement(PrintExerciseBody, { problem: p, number: 1, solutions }),
    );
    assert.match(html, /svg/);
    assert.doesNotMatch(html, /&quot;groups&quot;/);
    if (!solutions) assert.match(html, /Number sentence/);
  }
  assert.match(
    counterBuilderAnswerText(take, takeKey),
    /7 at the start; 2 crossed out; 5 left/,
  );
});

test("lessons never solve the active model, including its legacy picture-choice form", () => {
  for (let i = 0; i < 30; i++) {
    const active = generateProblem(
      "build-the-number-sentence",
      `lesson-guard-${i}`,
    );
    const response = active.public.response as CounterBuilderResponse;
    const a = JSON.parse(active.answer) as CounterBuilderAnswer;
    const equivalent = new Set<string>();
    for (const groups of [a.groups, [...a.groups].reverse()])
      for (const sentence of [
        a.sentence,
        a.sentence[1] === "+"
          ? [a.sentence[2], "+", a.sentence[0], a.sentence[3]]
          : a.sentence,
      ])
        equivalent.add(
          counterBuilderAnswerText(
            response,
            JSON.stringify({ groups, removed: a.removed, sentence }),
          ),
        );
    for (const p of [
      active,
      generateProblemFor(
        active.public.templateId,
        active.public.seed,
        ["scenes-v1"],
        undefined,
        ["figure-choice-v1"],
      ),
    ]) {
      const lesson = problemLesson(
        p.public.templateId,
        p.public.seed,
        p.public.prompt,
        p.public.response,
        p,
      );
      assert.ok(
        !equivalent.has(lesson.example.answer),
        `${p.public.seed}: lesson reveals the active model`,
      );
    }
  }
});
