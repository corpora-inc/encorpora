import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientCanDraw,
  generatedProblemSchema,
  publicProblemSchema,
  responseCapabilities,
} from "../src/math/contracts";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import {
  canonicalMultiPart,
  chooseOption,
  chosenCount,
  draftChoices,
  gradeMultiPart,
  multiPartAnswerText,
  multiPartFeedback,
  multiPartGuessChance,
  multiPartMarks,
  normalizeMultiPart,
  parseMultiPartDraft,
  type MultiPartChoiceResponse,
} from "../src/math/multi-part-choice";
import { guessChance } from "../src/math/guess-chance";
import { answerText } from "../src/math/selection-response";
import { capabilitySchema, packSchema } from "../src/offline/contracts";
import { planMixedPractice } from "../src/server/mixed-practice";
import { skills } from "../src/curriculum/catalog";
import { problemLesson } from "../src/content/problem-lessons";
import { publicationHtml } from "../src/content/publications";
import { lessons } from "../src/content/lessons";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { templateArchetypes } from "../src/curriculum/template-archetypes";

const families = [
  "inline-linear-features",
  "proportional-match-table",
  "label-expression-parts",
] as const;
const options = (...labels: string[]) =>
  labels.map((label, i) => ({ id: "abcdef"[i]!, label }));
const inline: MultiPartChoiceResponse = {
  kind: "multi-part-choice",
  label: "Choose an option for each blank",
  layout: "inline",
  blanks: [
    {
      id: "slope",
      label: "the slope",
      options: options("$2$", "$-2$", "$\\frac{1}{2}$"),
    },
    { id: "int", label: "the $y$-intercept", options: options("$3$", "$-3$") },
    {
      id: "dir",
      label: "the direction",
      options: options("increases", "decreases"),
    },
  ],
  sentence: [
    { text: "The slope is " },
    { blank: "slope" },
    { text: ", the $y$-intercept is " },
    { blank: "int" },
    { text: ", and $y$ " },
    { blank: "dir" },
    { text: "." },
  ],
};
const key = JSON.stringify({ slope: "a", int: "b", dir: "a" });

test("credit needs every blank right, in any key order; marks record each blank", () => {
  assert.equal(gradeMultiPart(inline, key, key), true);
  // Key order is not part of the answer.
  assert.equal(
    gradeMultiPart(
      inline,
      key,
      JSON.stringify({ dir: "a", int: "b", slope: "a" }),
    ),
    true,
  );
  const oneWrong = JSON.stringify({ slope: "a", int: "a", dir: "a" });
  assert.equal(gradeMultiPart(inline, key, oneWrong), false);
  assert.deepEqual(
    multiPartMarks(inline, key, oneWrong).map((m) => m.correct),
    [true, false, true],
  );
  assert.equal(
    multiPartFeedback(inline, key, oneWrong),
    "2 of 3 parts are correct. Recheck the $y$-intercept.",
  );
  assert.equal(multiPartFeedback(inline, key, key), null);
  const twoWrong = JSON.stringify({ slope: "b", int: "a", dir: "a" });
  assert.equal(
    multiPartFeedback(inline, key, twoWrong),
    "1 of 3 parts are correct. Recheck the slope and the $y$-intercept.",
  );
  // An incomplete draft never earns credit.
  assert.equal(
    gradeMultiPart(inline, key, JSON.stringify({ slope: "a", int: "b" })),
    false,
  );
});

test("incomplete, foreign and malformed responses are invalid, not wrong", () => {
  const problem = {
    ...generateProblem(families[0], "invalid").public,
    response: inline,
  };
  for (const raw of [
    "",
    "{}",
    JSON.stringify({ slope: "a", int: "b" }),
    JSON.stringify({ slope: "a", int: "b", dir: "c" }),
    JSON.stringify({ slope: "a", int: "b", dir: "a", extra: "a" }),
    JSON.stringify({ slope: "a", int: "b", other: "a" }),
    JSON.stringify(["a", "b", "a"]),
    JSON.stringify({ slope: 1, int: "b", dir: "a" }),
    JSON.stringify({ slope: "option-a", int: "b", dir: "a" }),
    "a,b,a",
    "malformed",
    "x".repeat(101),
  ])
    assert.equal(isValidResponse(problem, raw), false, raw);
  assert.equal(
    normalizeMultiPart(
      inline,
      JSON.stringify({ dir: "a", int: "b", slope: "a" }),
    ),
    key,
  );
  assert.equal(parseMultiPartDraft("[]"), null);
  assert.equal(
    canonicalMultiPart(JSON.stringify({ int: "b", slope: "a" })),
    JSON.stringify({ int: "b", slope: "a" }),
  );
  assert.equal(
    canonicalMultiPart(JSON.stringify({ slope: "a", int: "b" })),
    JSON.stringify({ int: "b", slope: "a" }),
  );
  // A multi-select or plotted answer never reads as a multi-part answer.
  assert.equal(canonicalMultiPart('["option-a","option-b"]'), null);
  assert.equal(canonicalMultiPart("[[1,2],[3,4]]"), null);
});

test("drafts choose, change and count blanks in blank order", () => {
  let raw = "";
  raw = chooseOption(inline, raw, "dir", "b");
  raw = chooseOption(inline, raw, "slope", "c");
  assert.equal(raw, JSON.stringify({ slope: "c", dir: "b" }));
  assert.equal(chosenCount(inline, raw), 2);
  raw = chooseOption(inline, raw, "slope", "a");
  // Unknown blanks and options change nothing.
  assert.equal(chooseOption(inline, raw, "slope", "f"), raw);
  assert.equal(chooseOption(inline, raw, "nope", "a"), raw);
  assert.deepEqual(draftChoices(inline, raw), { slope: "a", dir: "b" });
  assert.deepEqual(draftChoices(inline, "garbage"), {});
});

test("readable answers fill the sentence or name each label, never the transport format", () => {
  assert.equal(
    multiPartAnswerText(inline, key),
    "The slope is $2$, the $y$-intercept is $-3$, and $y$ increases.",
  );
  assert.equal(answerText(inline, key), multiPartAnswerText(inline, key));
  assert.throws(() => answerText(inline, JSON.stringify({ slope: "a" })));
  // Formulas on either side of a blank read as one once it is filled.
  const equation: MultiPartChoiceResponse = {
    ...inline,
    blanks: inline.blanks.slice(0, 2),
    sentence: [
      { text: "$y = mx + b$ with $m =$ " },
      { blank: "slope" },
      { text: " and $b =$ " },
      { blank: "int" },
      { text: "." },
    ],
  };
  assert.equal(
    multiPartAnswerText(equation, JSON.stringify({ slope: "c", int: "a" })),
    "$y = mx + b$ with $m = \\frac{1}{2}$ and $b = 3$.",
  );
});

test("the schema keeps each layout's shape", () => {
  const base = generateProblem("inline-linear-features", "schema").public;
  const valid = (response: object) =>
    publicProblemSchema.safeParse({ ...base, response }).success;
  assert.equal(valid(inline), true);
  // Sentence blanks must follow the blank list exactly once each.
  assert.equal(
    valid({
      ...inline,
      sentence: inline.sentence!.filter(
        (p) => !("blank" in p) || p.blank !== "dir",
      ),
    }),
    false,
  );
  assert.equal(
    valid({ ...inline, blanks: [...inline.blanks].reverse() }),
    false,
  );
  assert.equal(valid({ ...inline, layout: "slots" }), false);
  const { sentence: _, ...slots } = { ...inline, layout: "slots" as const };
  assert.equal(valid(slots), true);
  assert.equal(
    valid({ ...slots, layout: "table" }),
    false,
    "table rows share columns",
  );
  const rows = ["$y = 2x$", "$y = x + 1$"].map((label, i) => ({
    id: `r${i + 1}`,
    label,
    options: options("Proportional", "Not proportional"),
  }));
  assert.equal(
    valid({
      ...slots,
      layout: "table",
      blanks: rows,
      rowHeader: "Relationship",
    }),
    true,
  );
  assert.equal(
    valid({ ...slots, blanks: [inline.blanks[0]] }),
    false,
    "two blanks at least",
  );
  assert.equal(
    valid({
      ...slots,
      blanks: Array.from({ length: 7 }, (_, i) => ({
        ...inline.blanks[0]!,
        id: `b${i}`,
      })),
    }),
    false,
    "six blanks at most",
  );
  assert.equal(
    valid({
      ...slots,
      blanks: [
        { ...inline.blanks[0]!, options: options("$2$", "$2$") },
        inline.blanks[1],
      ],
    }),
    false,
    "distinct option labels",
  );
  assert.equal(
    valid({
      ...slots,
      blanks: [
        {
          ...inline.blanks[0]!,
          options: options("a", "b", "c", "d", "e", "f", "g"),
        },
        inline.blanks[1],
      ],
    }),
    false,
    "six options at most",
  );
});

test("every family is reachable, valid, self-consistent and leaks no answer", () => {
  for (const id of families) {
    const template = templates.find((t) => t.id === id);
    assert.ok(template, id);
    assert.equal(template.requiredResponseCapability, "multi-part-choice-v1");
    const prompts = new Set<string>();
    // Where each blank's correct option sits, per blank position.
    const positions = new Map<string, Set<number>>();
    for (let i = 0; i < 300; i++) {
      const problem = generateProblem(id, `multi-part-${i}`);
      generatedProblemSchema.parse(problem);
      publicProblemSchema.parse(problem.public);
      prompts.add(
        JSON.stringify([
          problem.public.prompt,
          problem.public.figure ?? null,
          problem.public.response,
        ]),
      );
      const response = problem.public.response;
      assert.equal(response.kind, "multi-part-choice");
      if (response.kind !== "multi-part-choice") continue;
      const pub = JSON.stringify(problem.public);
      assert.equal(pub.includes(problem.answer), false, `${id}: answer leak`);
      for (const secret of ['"answer"', '"explanation"', '"hint"'])
        assert.equal(pub.includes(secret), false, `${id}: ${secret}`);
      assert.equal(isValidResponse(problem.public, problem.answer), true);
      assert.equal(gradeAnswer(problem, problem.answer), true);
      const marks = multiPartMarks(response, problem.answer, problem.answer);
      marks.forEach((m, b) => {
        const at = m.blank.options.findIndex((o) => o.id === m.expected.id);
        const slot = `${response.layout}:${b}:${m.blank.options.length}`;
        positions.set(slot, (positions.get(slot) ?? new Set()).add(at));
      });
      // Changing any one blank to another option makes the answer wrong.
      for (const blank of response.blanks) {
        const other = blank.options.find(
          (o) =>
            o.id !== marks.find((m) => m.blank.id === blank.id)!.expected.id,
        )!;
        const changed = chooseOption(
          response,
          problem.answer,
          blank.id,
          other.id,
        );
        assert.equal(isValidResponse(problem.public, changed), true);
        assert.equal(gradeAnswer(problem, changed), false);
      }
      const text = answerText(response, problem.answer);
      assert.equal(/\{"|"[a-z0-9]+":/.test(text), false, `${id}: ${text}`);
      assert.ok(problem.hint.length > 20 && problem.explanation.length >= 3);
    }
    assert.ok(prompts.size > 250, `${id}: ${prompts.size} distinct problems`);
    // Option order is shuffled: a correct option is not always in one place.
    // Table columns are fixed headings, so their position follows the row.
    for (const [slot, seen] of positions)
      if (!slot.startsWith("table:") && !slot.endsWith(":3"))
        assert.ok(
          seen.size > 1,
          `${id} ${slot}: correct option always at ${[...seen]}`,
        );
  }
});

test("a stored answer must name a displayed option for every blank", () => {
  const problem = generateProblem("proportional-match-table", "contract");
  assert.equal(generatedProblemSchema.safeParse(problem).success, true);
  for (const answer of [
    JSON.stringify({ r1: "a" }),
    JSON.stringify({ r1: "z" }),
    '["a","b"]',
    problem.answer.replace('"r1"', '"r9"'),
  ])
    assert.equal(
      generatedProblemSchema.safeParse({ ...problem, answer }).success,
      false,
      answer,
    );
  assert.equal(
    generatedProblemSchema.safeParse({
      ...problem,
      pointGrading: { mode: "exact" },
    }).success,
    false,
  );
  assert.equal(
    generatedProblemSchema.safeParse({
      ...problem,
      choiceFeedback: { "option-a": "No" },
    }).success,
    false,
  );
});

test("clients without multi-part-choice-v1 are never served these families, online or offline", () => {
  const partTemplates = templates.filter((t) =>
    families.includes(t.id as (typeof families)[number]),
  );
  assert.equal(partTemplates.length, 3);
  assert.ok(responseCapabilities.includes("multi-part-choice-v1"));
  const allFigures = ["function-displays-v1", "scenes-v1"];
  for (const client of [
    { responseCapabilities: [], figureCapabilities: allFigures },
    {
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities: allFigures,
    },
    {
      responseCapabilities: [
        "single-choice-v1",
        "multi-select-v1",
        "point-plot-v1",
      ],
      figureCapabilities: allFigures,
    },
  ]) {
    for (const t of partTemplates)
      assert.equal(clientCanDraw(t, client), false);
    const supported = templates.filter((t) => clientCanDraw(t, client));
    for (let seed = 0; seed < 20; seed++)
      for (const choice of planMixedPractice({
        templates: supported,
        skills,
        attempts: [],
        evidence: [],
        count: 5,
        seed: `negotiation-${seed}`,
        learnerKey: "learner",
      }))
        assert.notEqual(
          choice.template.requiredResponseCapability,
          "multi-part-choice-v1",
        );
  }
  // The line family also needs its graphs and tables drawn as scenes.
  const current = {
    responseCapabilities: ["multi-part-choice-v1"],
    figureCapabilities: ["scenes-v1"],
  };
  for (const t of partTemplates) assert.equal(clientCanDraw(t, current), true);
  assert.equal(
    clientCanDraw(partTemplates[0]!, {
      responseCapabilities: ["multi-part-choice-v1"],
      figureCapabilities: [],
    }),
    false,
  );
  // Offline packs never declare it, and grader v1 rejects a multi-part item.
  assert.equal(
    capabilitySchema.safeParse({
      responseCapabilities: ["multi-part-choice-v1"],
    }).success,
    false,
  );
  const problem = generateProblem("label-expression-parts", "offline");
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
        strand: "algebra",
        selfCheck: {
          answer: problem.answer,
          hint: problem.hint,
          explanation: problem.explanation,
        },
      },
    ],
  };
  assert.equal(packSchema.safeParse(pack).success, false);
  // The same pack with a typed problem is accepted, so the rejection is the kind.
  const typed = generateProblem("count-objects", "offline");
  assert.equal(
    packSchema.safeParse({
      ...pack,
      items: [
        {
          ...pack.items[0]!,
          problem: typed.public,
          selfCheck: {
            answer: typed.answer,
            hint: typed.hint,
            explanation: typed.explanation,
          },
        },
      ],
    }).success,
    true,
  );
});

test("blind picks have a small, never understated chance of credit", () => {
  assert.ok(Math.abs(multiPartGuessChance(inline) - 1 / 12) < 1e-12);
  for (const id of families) {
    const chance = guessChance(templates.find((t) => t.id === id)!);
    assert.ok(chance > 0 && chance <= 1 / 16, `${id}: ${chance}`);
  }
});

test("content is registered: lessons, methods, principles, facets and archetypes", () => {
  for (const id of families) {
    assert.ok(
      lessons.some((l) => l.templateIds.includes(id)),
      `${id} lesson`,
    );
    assert.ok(methods[id], `${id} method`);
    assert.ok(principles[id], `${id} principle`);
    const template = templates.find((t) => t.id === id)!;
    const mapping = actualFacetMappings.filter((m) => m.templateId === id);
    assert.equal(mapping.length, 1, `${id} facet mapping`);
    assert.ok(mapping[0]!.facetId.startsWith(`${template.skillId}.`));
    assert.ok(templateArchetypes[id]?.length, `${id} archetypes`);
  }
});

test("a lesson never works the learner's own problem, and print keeps every blank", () => {
  for (const id of families)
    for (let i = 0; i < 12; i++) {
      const learner = generateProblem(id, `lesson-${i}`);
      const view = problemLesson(
        id,
        learner.public.seed,
        learner.public.prompt,
        learner.public.response,
        learner,
      );
      const response = learner.public.response;
      if (response.kind !== "multi-part-choice") throw new Error("kind");
      // Inline givens are in the prompt and figure; table and slot givens are
      // the row and slot labels, which the worked answer names.
      const givens = (answer: string) =>
        response.layout === "inline"
          ? ""
          : answer
              .split("; ")
              .map((part) => part.slice(0, part.lastIndexOf(": ")))
              .join("|");
      const sameGivens =
        view.example.prompt === learner.public.prompt &&
        JSON.stringify(view.example.figure ?? null) ===
          JSON.stringify(learner.public.figure ?? null) &&
        givens(view.example.answer) ===
          givens(answerText(response, learner.answer));
      assert.equal(sameGivens, false, `${id} ${i}`);
      assert.equal(/\{"|"[a-z0-9]+":/.test(view.example.answer), false);
    }
  for (const id of families) {
    const lesson = lessons.find((l) => l.templateIds.includes(id))!;
    const workbook = publicationHtml(lesson, "workbook");
    const solutions = publicationHtml(lesson, "solutions");
    assert.ok(
      workbook.includes("☐") && !workbook.includes("☑"),
      `${id} workbook boxes`,
    );
    assert.ok(solutions.includes("☑"), `${id} solution ticks`);
    assert.equal(
      /\{&quot;|\{"[a-z]/.test(workbook + solutions),
      false,
      `${id} transport format in print`,
    );
  }
});
