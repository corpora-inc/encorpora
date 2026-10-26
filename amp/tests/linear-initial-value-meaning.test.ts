import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateProblem, templates } from "../src/math/engine.js";
import { lessons } from "../src/content/lessons.js";
import { methods } from "../src/content/problem-methods.js";
import { principles } from "../src/content/problem-principles.js";
import { linearFunctionFacetMappings } from "../src/content/linear-function-coverage.js";
import { releasedItems } from "../src/curriculum/released-items/index.js";

const id = "linear-initial-value-meaning";

function modelFromPrompt(prompt: string) {
  const match = prompt.match(/\$([VHC]) = ([^$]+)\$/);
  assert.ok(match, prompt);
  const expression = match[2]!;
  const first = expression.match(/^(-?)(\d*)([thd]) \+ (\d+)$/);
  const second = expression.match(/^(\d+) ([+-]) (\d*)([thd])$/);
  assert.ok(first || second, expression);
  return first
    ? {
        input: first[3]!,
        rate: (first[1] === "-" ? -1 : 1) * Number(first[2] || 1),
        initial: Number(first[4]),
      }
    : {
        input: second![4]!,
        rate: Number(second![3] || 1) * (second![2] === "-" ? -1 : 1),
        initial: Number(second![1]),
      };
}

test("the public model and labeled graph support exactly one contextual starting amount", () => {
  const seen = new Set<string>();
  const order = new Set<string>();
  for (let index = 0; index < 512; index++) {
    const problem = generateProblem(id, `linear-review-${index}`);
    const { prompt, figure, response } = problem.public;
    const { input, rate, initial } = modelFromPrompt(prompt);
    assert.notEqual(rate, 0);
    const duration = Number(
      prompt.match(/first (\d+) (?:minutes|hours|kilometers)/)?.[1],
    );
    assert.ok(Number.isInteger(duration) && duration >= 3 && duration <= 7);
    assert.notEqual(initial, Math.abs(rate));
    assert.notEqual(initial, Math.abs(rate) * duration);
    assert.ok(initial + rate * duration >= 0);
    assert.equal(response.kind, "choice");
    assert.equal(response.options.length, 4);
    assert.equal(
      new Set(response.options.map((option) => option.label)).size,
      4,
    );
    const context = prompt.includes("water in a tank")
      ? "tank"
      : prompt.includes("height $H$ of a candle")
        ? "candle"
        : "ride";
    seen.add(context);
    const trueAtZero = response.options.filter((option) =>
      context === "tank"
        ? option.label ===
          `There were ${initial} liters of water in the tank when filling began.`
        : context === "candle"
          ? option.label ===
            `The candle was ${initial} centimeters tall when it was lit.`
          : option.label ===
            `The booked ride cost ${initial} dollars before any distance was traveled.`,
    );
    assert.equal(trueAtZero.length, 1, prompt);
    assert.equal(
      response.options.find((option) => option.id === problem.answer)?.label,
      trueAtZero[0]!.label,
    );
    assert.ok(response.options.some((option) => option.label.includes("each")));
    assert.ok(response.options.some((option) => option.label.includes("one ")));
    assert.ok(
      response.options.some((option) =>
        option.label.includes(`first ${duration} `),
      ),
    );
    assert.ok(problem.hint.includes(`$${input} = 0$`));
    assert.ok(!problem.hint.includes(trueAtZero[0]!.label));
    assert.equal(figure?.kind, "scene");
    const graph = figure.scene.elements.find(
      (element) => element.type === "graph",
    );
    assert.ok(graph);
    assert.deepEqual(
      graph.points?.map((point) => [point.x, point.y]),
      [[0, initial]],
    );
    assert.deepEqual(
      graph.lines?.map((line) => line.line),
      [{ m: rate, b: initial }],
    );
    assert.deepEqual(graph.x, [0, duration]);
    const units =
      context === "tank"
        ? ["minutes", "liters"]
        : context === "candle"
          ? ["hours", "centimeters"]
          : ["kilometers", "dollars"];
    assert.deepEqual(graph.axisNames, units);
    order.add(
      prompt.match(/\$[VHC] = ([^$]+)\$/)![1]!.startsWith(String(initial))
        ? "constant-first"
        : "term-first",
    );
  }
  assert.deepEqual([...seen].sort(), ["candle", "ride", "tank"]);
  assert.deepEqual([...order].sort(), ["constant-first", "term-first"]);
});

test("the existing linear-models lesson and partial audit bind the narrow family", () => {
  const template = templates.find((value) => value.id === id);
  assert.equal(template?.skillId, "linear-models");
  assert.equal(template?.requiredResponseCapability, "single-choice-v1");
  assert.equal(template?.requiredFigureCapability, "scenes-v1");
  const reference = lessons.find((lesson) => lesson.templateIds.includes(id));
  assert.equal(reference?.id, "linear-models");
  assert.ok(
    reference.sections.some((section) => section.stage === "intuition"),
  );
  assert.ok(
    reference.closingSections?.some((section) => section.stage === "formal"),
  );
  const fullText = [
    reference.summary,
    ...reference.sections.flatMap((section) => section.paragraphs),
    ...(reference.closingSections ?? []).flatMap(
      (section) => section.paragraphs,
    ),
  ].join(" ");
  assert.match(fullText, /starting amount/i);
  assert.match(fullText, /when \$x=0\$/i);
  assert.match(fullText, /rate/i);
  assert.ok(methods[id]?.intuition);
  assert.ok(methods[id]?.watch);
  assert.ok(methods[id]?.method.length >= 2);
  assert.match(principles[id], /\$y=mx\+b\$/);
  const facet = linearFunctionFacetMappings.find(
    (row) => row.templateId === id,
  );
  assert.equal(facet?.facetId, "linear-models.initial-value-in-context");
  assert.equal(facet?.extent, "partial");
  const item = releasedItems.find(
    (row) => row.sourceId === "mcas-2025-8" && row.item.number === "10",
  );
  assert.ok(item);
  assert.ok(item.templateIds.includes(id));
  assert.match(item.limitations, /Fitting a model from data/);
});

test("the independent Python oracle and central dispatcher derive public choice truth", () => {
  const cases = Array.from({ length: 256 }, (_, index) =>
    generateProblem(id, `independent-linear-${index}`),
  );
  const checked = spawnSync(
    "python3",
    [
      "-c",
      `import json,runpy,sys
sys.path.insert(0,'scripts')
oracle=runpy.run_path('scripts/linear_initial_value_math_oracle.py')
central=runpy.run_path('scripts/independent-math-review.py')
assert 'linear-initial-value-meaning' in central['SUPPORTED']
oracle['self_test']()
cases=json.load(sys.stdin)
for problem in cases:
    assert oracle['review_problem'](problem)==problem['answer']
    assert central['solve'](problem['public'])==problem['answer']
print(len(cases))`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /256/);
});
