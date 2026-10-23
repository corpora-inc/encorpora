import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  clientCanDraw,
  generatedProblemSchema,
  problemResponseSchema,
  type GeneratedProblem,
  type MultiSelectResponse,
} from "../src/math/contracts";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import { guessChance, responseGuessChance } from "../src/math/guess-chance";
import {
  answerText,
  joinAnswerLabels,
  normalizeSelection,
  parseSelection,
  serializeSelection,
} from "../src/math/selection-response";
import { capabilitySchema, packSchema } from "../src/offline/contracts";
import { problemLesson } from "../src/content/problem-lessons";
import { ProblemLesson } from "../src/web/ProblemLesson";

const response: MultiSelectResponse = {
  kind: "multi-select",
  label: "Choose three four-sided shapes",
  selectionCount: 3,
  options: ["Rectangle", "Triangle", "Square", "Rhombus", "Circle"].map(
    (label, index) => ({ id: `option-${"abcde"[index]}`, label }),
  ),
};
const problem: GeneratedProblem = {
  public: {
    id: "a".repeat(64),
    templateId: "test-selection",
    templateVersion: 1,
    seed: "handwritten",
    skillId: "shape-hierarchy",
    prompt: "Choose the 3 four-sided shapes.",
    response,
  },
  answer: '["option-a","option-c","option-d"]',
  hint: "Count each shape's sides.",
  explanation: ["Rectangles, squares, and rhombuses each have four sides."],
};
const familyId = "quadrilateral-hierarchy-multiselect";

test("exact-set grading accepts all orders and no other three-choice set", () => {
  generatedProblemSchema.parse(problem);
  let correct = 0,
    total = 0;
  for (let a = 0; a < 5; a++)
    for (let b = a + 1; b < 5; b++)
      for (let c = b + 1; c < 5; c++) {
        const ids = [a, b, c].map((index) => response.options[index]!.id);
        const input = JSON.stringify(ids);
        assert.equal(isValidResponse(problem.public, input), true);
        const expected = a === 0 && b === 2 && c === 3;
        assert.equal(gradeAnswer(problem, input), expected);
        correct += Number(expected);
        total++;
      }
  assert.equal(total, 10);
  assert.equal(correct, 1);
  for (const ids of [
    ["option-a", "option-c", "option-d"],
    ["option-a", "option-d", "option-c"],
    ["option-c", "option-a", "option-d"],
    ["option-c", "option-d", "option-a"],
    ["option-d", "option-a", "option-c"],
    ["option-d", "option-c", "option-a"],
  ]) {
    const input = JSON.stringify(ids, null, 1);
    assert.equal(gradeAnswer(problem, input), true);
    assert.equal(normalizeSelection(response, input), problem.answer);
  }
  assert.equal(responseGuessChance(response), correct / total);
});

test("incomplete, repeated, foreign, malformed and oversized selections cannot earn credit", () => {
  for (const input of [
    "",
    "[]",
    "null",
    "{}",
    '"option-a"',
    '["option-a","option-c"]',
    '["option-a","option-c","option-d","option-e"]',
    '["option-a","option-a","option-d"]',
    '["option-a","option-c","option-f"]',
    '["option-a","option-c",3]',
    '["option-a","option-c",["option-d"]]',
    '["option-a","option-c","option-z"]',
    " ".repeat(201) + problem.answer,
  ]) {
    assert.equal(isValidResponse(problem.public, input), false, input);
    assert.equal(gradeAnswer(problem, input), false, input);
  }
  assert.deepEqual(parseSelection("[]"), []);
  assert.equal(
    answerText(response, problem.answer),
    "Rectangle; Square; Rhombus",
  );
  assert.throws(() => answerText(response, "[]"));
  assert.equal(
    joinAnswerLabels(["Squares are rectangles.", "Squares are rhombuses."]),
    "Squares are rectangles. Squares are rhombuses.",
  );
  assert.equal(
    serializeSelection(["option-a", "option-a"]),
    '["option-a","option-a"]',
  );
});

test("response schemas keep known-count sets and the single-choice protocol distinct", () => {
  for (const changed of [
    { ...response, selectionCount: 1 },
    { ...response, selectionCount: 5 },
    {
      ...response,
      options: [...response.options.slice(0, 4), response.options[0]!],
    },
    {
      ...response,
      options: response.options.map((o, i) =>
        i === 4 ? { ...o, label: "Rectangle" } : o,
      ),
    },
  ])
    assert.equal(problemResponseSchema.safeParse(changed).success, false);
  assert.equal(
    problemResponseSchema.safeParse({
      kind: "choice",
      label: "Choose one",
      options: response.options,
    }).success,
    false,
  );
  for (const answer of [
    '["option-a","option-d","option-c"]',
    '["option-a","option-c"]',
    '["option-a","option-c","option-f"]',
  ])
    assert.equal(
      generatedProblemSchema.safeParse({ ...problem, answer }).success,
      false,
    );
  assert.equal(
    generatedProblemSchema.safeParse({
      ...problem,
      choiceFeedback: { "option-b": "Try again" },
    }).success,
    false,
  );
});

test("the family is gated online and excluded from immutable offline grader v1", () => {
  const template = templates.find((t) => t.id === familyId)!;
  assert.ok(template);
  assert.equal(
    clientCanDraw(template, {
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities: [],
    }),
    false,
  );
  assert.equal(
    clientCanDraw(template, {
      responseCapabilities: ["multi-select-v1"],
      figureCapabilities: [],
    }),
    true,
  );
  assert.equal(
    capabilitySchema.safeParse({ responseCapabilities: ["multi-select-v1"] })
      .success,
    false,
  );
  const pack = {
    format: "amp-offline-v1",
    serviceId: "https://example.invalid",
    accountBinding: "a".repeat(64),
    authorization: {
      consentRevision: "b".repeat(64),
      grantBinding: "c".repeat(64),
    },
    packId: "00000000-0000-4000-8000-000000000001",
    learnerId: "00000000-0000-4000-8000-000000000002",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T01:00:00.000Z",
    selectionPolicy: "mixed-five-three-variants-v1",
    evidence: "offline-provisional",
    capabilities: {
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities: [],
    },
    items: [
      {
        problem: problem.public,
        graderVersion: 1,
        reason: "frontier",
        strand: "geometry",
        selfCheck: {
          answer: problem.answer,
          hint: problem.hint,
          explanation: problem.explanation,
        },
      },
    ],
  };
  assert.equal(packSchema.safeParse(pack).success, false);
  const ordinary = generateProblem("count-objects", "offline-control");
  assert.equal(
    packSchema.safeParse({
      ...pack,
      items: [
        {
          ...pack.items[0],
          problem: ordinary.public,
          selfCheck: {
            answer: ordinary.answer,
            hint: ordinary.hint,
            explanation: ordinary.explanation,
          },
        },
      ],
    }).success,
    true,
  );
  assert.equal(guessChance(template), 1 / 10);
  const sizes = new Set<number>();
  for (let i = 0; i < 64; i++) {
    const p = generateProblem(familyId, `guess-proof-${i}`);
    assert.equal(p.public.response.kind, "multi-select");
    sizes.add(p.public.response.options.length);
    assert.ok(guessChance(template) >= responseGuessChance(p.public.response));
  }
  assert.deepEqual([...sizes].sort(), [5, 6]);
});

test("worked lessons display every option and avoid the current set despite a fixed prompt", () => {
  const current = generateProblem(familyId, "example-selection:lesson:0");
  assert.equal(current.public.response.kind, "multi-select");
  const lesson = problemLesson(
    familyId,
    "example-selection",
    current.public.prompt,
    current.public.response,
  );
  assert.ok(lesson.example.choices?.length);
  assert.notDeepEqual(
    [...lesson.example.choices].sort(),
    current.public.response.options.map((o) => o.label).sort(),
  );
  const html = renderToStaticMarkup(createElement(ProblemLesson, { lesson }));
  const choices = html.match(
    /<ol type="A" aria-label="Example choices">([\s\S]*?)<\/ol>/,
  )?.[1];
  assert.ok(choices);
  assert.equal(
    (choices.match(/<li>/g) ?? []).length,
    lesson.example.choices.length,
  );
  for (const label of lesson.example.choices)
    assert.ok(choices.includes(label));
  assert.equal(lesson.example.answer.includes("option-"), false);
});
