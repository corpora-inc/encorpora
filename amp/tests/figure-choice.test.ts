import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientCanDraw,
  generatedProblemSchema,
  problemResponseSchema,
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
  figureChoiceAnswerText,
  figureChoiceGuessChance,
  figureChoiceLetter,
  figureChoiceName,
  gradeFigureChoice,
  normalizeFigureChoice,
  type FigureChoiceResponse,
} from "../src/math/figure-choice";
import { guessChance } from "../src/math/guess-chance";
import { answerText } from "../src/math/selection-response";
import { layoutScene } from "../src/math/scene";
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
import { graph } from "../src/math/scene/author";

const families = [
  "graph-of-linear-rule",
  "graph-of-proportional-rate",
  "graph-of-inequality-number-line",
  "graph-of-quadratic-or-exponential",
] as const;
const figure = (m: number) =>
  graph({ x: [-6, 6], y: [-6, 6], grid: 1, tick: 2, aspect: 1 })
    .line({ m, b: 1 })
    .scene({ width: 240, maxHeight: 240 });
const sample: FigureChoiceResponse = {
  kind: "figure-choice",
  label: "Choose the graph",
  noun: "Graph",
  options: [1, -1, 2].map((m, i) => ({
    id: `option-${"abc"[i]}`,
    label: `A line through (0, 1) with slope ${m} drawn here.`,
    scene: figure(m),
  })),
};
const figuresOf = (r: unknown) => {
  const response = r as FigureChoiceResponse;
  assert.equal(response.kind, "figure-choice");
  return response;
};

test("a figure choice grades one displayed option; anything else is invalid, not wrong", () => {
  assert.equal(normalizeFigureChoice(sample, "option-b"), "option-b");
  assert.equal(gradeFigureChoice(sample, "option-b", "option-b"), true);
  assert.equal(gradeFigureChoice(sample, "option-b", "option-a"), false);
  for (const raw of ["", "option-d", "option-e", "B", '["option-b"]', "b"]) {
    assert.equal(normalizeFigureChoice(sample, raw), null, raw);
    assert.equal(gradeFigureChoice(sample, "option-b", raw), false, raw);
  }
  // A key naming no displayed option never grades anything correct.
  assert.equal(gradeFigureChoice(sample, "option-d", "option-d"), false);
  assert.equal(figureChoiceLetter(sample, "option-c"), "C");
  assert.equal(figureChoiceName(sample, "option-a"), "Graph A");
  assert.equal(figureChoiceName(sample, "option-z"), null);
  assert.equal(
    figureChoiceAnswerText(sample, "option-b"),
    sample.options[1]!.label,
  );
  assert.throws(() => figureChoiceAnswerText(sample, "option-d"));
  assert.equal(answerText(sample, "option-c"), sample.options[2]!.label);
  assert.equal(figureChoiceGuessChance(sample), 1 / 3);
});

test("the schema keeps options lettered, distinct, untitled and card-sized", () => {
  assert.equal(problemResponseSchema.safeParse(sample).success, true);
  const broken = (change: (r: FigureChoiceResponse) => void) => {
    const r = structuredClone(sample);
    change(r);
    return problemResponseSchema.safeParse(r).success;
  };
  // Ids are positions: a shuffled id would carry information.
  assert.equal(
    broken((r) => (r.options[0]!.id = "option-b")),
    false,
  );
  assert.equal(
    broken((r) => (r.options[2]!.id = "option-d")),
    false,
  );
  assert.equal(
    broken((r) => (r.options[1]!.label = r.options[0]!.label)),
    false,
  );
  assert.equal(
    broken((r) => (r.options[1]!.scene = r.options[0]!.scene)),
    false,
  );
  assert.equal(
    broken((r) => (r.options[0]!.scene.title = "Correct")),
    false,
  );
  assert.equal(
    broken((r) => (r.options[0]!.scene.note = "Answer")),
    false,
  );
  assert.equal(
    broken((r) => (r.options[0]!.scene.width = 600)),
    false,
  );
  assert.equal(
    broken((r) => (r.options = r.options.slice(0, 1))),
    false,
  );
  assert.equal(
    broken((r) => {
      r.options.push({
        ...r.options[0]!,
        id: "option-d",
        label: "x".repeat(20),
        scene: figure(3),
      });
      r.options.push({
        ...r.options[0]!,
        id: "option-e",
        label: "y".repeat(20),
        scene: figure(-3),
      });
    }),
    false,
  );
});

test("every family is reachable, valid, self-consistent and leaks no answer", () => {
  for (const id of families) {
    const template = templates.find((t) => t.id === id);
    assert.ok(template, id);
    assert.equal(template.requiredResponseCapability, "figure-choice-v1");
    assert.equal(template.requiredFigureCapability, "scenes-v1");
    const prompts = new Set<string>();
    const positions = new Set<number>();
    // A structural or wording feature that only correct options have would
    // let a learner pick without the mathematics.
    const tells = new Map<string, { correct: number; total: number }>();
    for (let i = 0; i < 300; i++) {
      const problem = generateProblem(id, `figure-${i}`);
      generatedProblemSchema.parse(problem);
      publicProblemSchema.parse(problem.public);
      const response = figuresOf(problem.public.response);
      prompts.add(
        problem.public.prompt + JSON.stringify(problem.public.figure ?? null),
      );
      const pub = JSON.stringify(problem.public);
      for (const secret of [
        '"answer"',
        '"explanation"',
        '"hint"',
        "choiceFeedback",
        "walkthrough",
      ])
        assert.equal(pub.includes(secret), false, `${id}: ${secret}`);
      assert.equal(
        /correct|answer/i.test(response.options.map((o) => o.label).join(" ")),
        false,
      );
      const at = response.options.findIndex((o) => o.id === problem.answer);
      assert.ok(at >= 0, `${id}: the answer is displayed`);
      positions.add(at);
      assert.equal(isValidResponse(problem.public, problem.answer), true);
      assert.equal(gradeAnswer(problem, problem.answer), true);
      for (const [k, option] of response.options.entries()) {
        const skeleton = JSON.stringify([
          option.scene.elements.map((e) => [e.type, Object.keys(e).sort()]),
          option.label.replace(/−?\d+(\/\d+)?/g, "#"),
        ]);
        const tell = tells.get(skeleton) ?? { correct: 0, total: 0 };
        tell.total++;
        if (k === at) tell.correct++;
        tells.set(skeleton, tell);
        if (k === at) continue;
        // Every distractor is wrong and has its own misconception feedback.
        assert.equal(gradeAnswer(problem, option.id), false);
        const feedback = problem.choiceFeedback?.[option.id] ?? "";
        assert.ok(
          feedback.startsWith(`${response.noun} ${"ABCD"[k]} `),
          `${id} ${i}: ${feedback}`,
        );
      }
      assert.deepEqual(
        Object.keys(problem.choiceFeedback ?? {}).sort(),
        response.options
          .filter((o) => o.id !== problem.answer)
          .map((o) => o.id),
      );
      assert.match(
        problem.explanation.at(-1)!,
        new RegExp(`^${response.noun} ${"ABCD"[at]} `),
      );
      assert.ok(problem.hint.length > 40 && problem.explanation.length >= 3);
      assert.equal(/\$\{|undefined|NaN/.test(JSON.stringify(problem)), false);
      // The worked answer is the figure's description, never an id.
      assert.equal(
        answerText(response, problem.answer),
        response.options[at]!.label,
      );
      assert.ok(problem.walkthrough, `${id}: a lesson figure`);
    }
    assert.ok(prompts.size >= 90, `${id}: ${prompts.size} distinct problems`);
    assert.deepEqual([...positions].sort(), [0, 1, 2, 3], `${id}: positions`);
    for (const [skeleton, { correct, total }] of tells)
      assert.ok(
        total < 20 || correct < total,
        `${id}: options shaped ${skeleton} are always correct`,
      );
  }
});

test("option figures lay out at card size, so labels stay legible", () => {
  for (const id of families)
    for (let i = 0; i < 20; i++) {
      const response = figuresOf(
        generateProblem(id, `layout-${i}`).public.response,
      );
      for (const option of response.options) {
        const layout = layoutScene(option.scene);
        // Cards draw a figure at its laid-out width, at least 80% of it
        // where two cards share a row: 15 px labels stay at 12 px or more.
        assert.ok(
          layout.width <= 280 && layout.height <= 300,
          `${id}: ${layout.width}×${layout.height}`,
        );
        assert.ok(layout.width >= 200, `${id}: ${layout.width} wide`);
        assert.equal(
          layout.dropped.length > 6,
          false,
          `${id}: ${layout.dropped.length} labels dropped`,
        );
      }
    }
});

test("a stored answer must name a displayed option; feedback names only distractors", () => {
  const problem = generateProblem("graph-of-linear-rule", "contract");
  assert.equal(generatedProblemSchema.safeParse(problem).success, true);
  for (const answer of ["option-e", "Graph A", "", '["option-a"]'])
    assert.equal(
      generatedProblemSchema.safeParse({ ...problem, answer }).success,
      false,
      answer,
    );
  assert.equal(
    generatedProblemSchema.safeParse({
      ...problem,
      choiceFeedback: { ...problem.choiceFeedback, [problem.answer]: "No" },
    }).success,
    false,
  );
  assert.equal(
    generatedProblemSchema.safeParse({
      ...problem,
      pointGrading: { mode: "exact" },
    }).success,
    false,
  );
  assert.equal(
    generatedProblemSchema.safeParse({ ...problem, entryPolicy: "sat-spr" })
      .success,
    false,
  );
});

test("clients without figure-choice-v1 are never served these families, online or offline", () => {
  const figureTemplates = templates.filter((t) =>
    families.includes(t.id as (typeof families)[number]),
  );
  assert.equal(figureTemplates.length, families.length);
  assert.ok(responseCapabilities.includes("figure-choice-v1"));
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
    for (const t of figureTemplates)
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
          "figure-choice-v1",
        );
  }
  // Option figures are scenes: the client must also draw scenes.
  for (const t of figureTemplates) {
    assert.equal(
      clientCanDraw(t, {
        responseCapabilities: ["figure-choice-v1"],
        figureCapabilities: ["scenes-v1"],
      }),
      true,
    );
    assert.equal(
      clientCanDraw(t, {
        responseCapabilities: ["figure-choice-v1"],
        figureCapabilities: [],
      }),
      false,
    );
  }
  // Offline packs never declare it, and grader v1 rejects a figure item.
  assert.equal(
    capabilitySchema.safeParse({ responseCapabilities: ["figure-choice-v1"] })
      .success,
    false,
  );
  const problem = generateProblem("graph-of-inequality-number-line", "offline");
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
      figureCapabilities: ["scenes-v1"],
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

test("a blind pick is one of four", () => {
  for (const id of families)
    assert.equal(guessChance(templates.find((t) => t.id === id)!), 1 / 4);
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

test("a lesson never shows the learner's correct figure, and print letters every figure", () => {
  for (const id of families)
    for (let i = 0; i < 16; i++) {
      const learner = generateProblem(id, `lesson-${i}`);
      const view = problemLesson(
        id,
        learner.public.seed,
        learner.public.prompt,
        learner.public.response,
        learner,
      );
      assert.notEqual(view.example.prompt, learner.public.prompt, `${id} ${i}`);
      assert.notEqual(
        view.example.answer,
        answerText(learner.public.response, learner.answer),
        `${id} ${i}`,
      );
      assert.equal(view.example.figure?.kind, "scene");
      assert.equal(/option-[a-d]/.test(JSON.stringify(view)), false);
      // The lesson draws one figure: no step points at a lettered card.
      assert.equal(
        /\b(Graph|Number line) [A-D]\b/.test(view.example.steps.join(" ")),
        false,
      );
    }
  for (const id of families) {
    const lesson = lessons.find((l) => l.templateIds.includes(id))!;
    const workbook = publicationHtml(lesson, "workbook");
    const solutions = publicationHtml(lesson, "solutions");
    assert.ok(
      workbook.includes('class="print-figures"'),
      `${id} workbook figures`,
    );
    assert.equal(workbook.includes("☑"), false, `${id} workbook marks nothing`);
    assert.equal(
      workbook.includes('class="print-figure print-figure--answer"'),
      false,
    );
    assert.ok(solutions.includes("☑"), `${id} solution ticks`);
    assert.match(solutions, /Answer: (Graph|Number line) [A-D]\./);
    assert.equal(
      /option-[a-d]/.test(workbook + solutions),
      false,
      `${id} ids in print`,
    );
    // One ringed figure per problem in the key.
    assert.equal(
      solutions.split('class="print-figure print-figure--answer"').length - 1,
      solutions.split('class="print-figures"').length - 1,
    );
  }
});
