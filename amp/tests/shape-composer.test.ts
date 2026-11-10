import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  clientCanDraw,
  generatedProblemSchema,
  responseCapabilities,
} from "../src/math/contracts";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import {
  shapeGuessChance,
  gradeShapeComposer,
  hasOverlap,
  shapeAtoms,
  poseCells,
  parseShapeAnswer,
  normalizeShapeAnswer,
  shapePath,
  shapeFeedbackSummary,
  inspectShapeStage,
  type ShapeAnswer,
  type ShapeComposerResponse,
  type ShapePlacement,
} from "../src/math/shape-composer";
import { shapePieces, shapeRecipes } from "../src/math/shape-composer-practice";
import { guessChance, problemGuessChance } from "../src/math/guess-chance";
import { answerText } from "../src/math/selection-response";
import { PrintExerciseBody } from "../src/content/print-exercise";
import { problemLesson } from "../src/content/problem-lessons";
import { shapeComposerScene } from "../src/math/shape-composer-scene";
import { sceneSchema } from "../src/math/scene/spec";

const template = templates.find((t) => t.id === "compose-flat-shape")!;
const placement = (
  copy: number,
  rot: ShapePlacement["rot"] = 0,
): ShapePlacement => ({ pieceId: "T1", copy, x: 2, y: 1, rot, flip: false });
const base: ShapeComposerResponse = {
  kind: "shape-composer",
  label: "Make a square",
  lattice: { w: 5, h: 4 },
  guessChance: 4 / 81 ** 2,
  stages: [
    {
      prompt: "Make a square.",
      target: [{ x: 2, y: 1, fill: "full" }],
      tray: [{ ...shapePieces.T1, copies: 2 }],
    },
  ],
};

test("exact geometry accepts complementary halves and rejects positive-area overlaps", () => {
  const quarterStage = { ...base.stages[0]!, tray: [shapePieces.Q] };
  assert.deepEqual(
    inspectShapeStage(quarterStage, [{ ...placement(0), pieceId: "Q" }]),
    { ok: false, overlap: false, outside: false, gap: true, required: true },
  );
  assert.equal(
    gradeShapeComposer(
      base,
      JSON.stringify([[placement(0), placement(1, 180)]]),
    ),
    true,
  );
  assert.equal(
    gradeShapeComposer(
      base,
      JSON.stringify([[placement(0, 90), placement(1, 270)]]),
    ),
    true,
    "Alternative diagonal",
  );
  assert.equal(
    gradeShapeComposer(base, JSON.stringify([[placement(0), placement(1)]])),
    false,
  );
  assert.equal(
    hasOverlap([
      { x: 0, y: 0, fill: "q:SW" },
      { x: 0, y: 0, fill: "full" },
    ]),
    true,
  );
  assert.equal(
    hasOverlap([
      { x: 0, y: 0, fill: "q:SW" },
      { x: 0, y: 0, fill: "h:NE" },
    ]),
    true,
  );
  assert.equal(
    hasOverlap([
      { x: 0, y: 0, fill: "h:SW" },
      { x: 0, y: 0, fill: "h:NE" },
    ]),
    false,
  );
  assert.equal(
    gradeShapeComposer(
      base,
      JSON.stringify([[placement(0), { ...placement(1, 180), x: 3 }]]),
    ),
    false,
  );
  assert.equal(gradeShapeComposer(base, JSON.stringify([[]])), false);
});
test("feedback describes gaps, overlap and overhang rather than counting pieces", () => {
  assert.equal(
    shapeFeedbackSummary(base, JSON.stringify([[placement(0)]])),
    "Part of the outline is still empty.",
  );
  assert.equal(
    shapeFeedbackSummary(base, JSON.stringify([[placement(0), placement(1)]])),
    "Pieces overlap, and part of the outline is still empty.",
  );
  assert.equal(
    shapeFeedbackSummary(base, JSON.stringify([[{ ...placement(0), x: 3 }]])),
    "A piece sticks out of the outline, and part of the outline is still empty.",
  );
  assert.equal(
    shapeFeedbackSummary(
      base,
      JSON.stringify([[placement(0), placement(1, 180)]]),
    ),
    "The outline is filled.",
  );
  const required = structuredClone(base);
  required.stages[0]!.required = [{ pieceId: "T1", count: 1 }];
  assert.equal(
    shapeFeedbackSummary(
      required,
      JSON.stringify([[placement(0), placement(1, 180)]]),
    ),
    "Use the pieces named in the question.",
  );
});
test("transport rejects forged copies, transforms and stages; mistakes stay valid attempts", () => {
  for (const a of [
    [[placement(0), placement(0, 180)]],
    [[{ ...placement(0), pieceId: "unknown" }]],
    [[{ ...placement(0), copy: 2 }]],
    [[{ ...placement(0), flip: true }]],
    [[{ ...placement(0), rot: 45 }]],
    [[{ ...placement(0), x: 1.5 }]],
    [],
  ])
    assert.equal(parseShapeAnswer(base, JSON.stringify(a)), null);
  assert.ok(
    parseShapeAnswer(base, JSON.stringify([[placement(0), placement(1)]])),
  );
  const p = generateProblem("compose-flat-shape", "contract");
  assert.ok(
    isValidResponse(
      p.public,
      JSON.stringify(
        (p.public.response as ShapeComposerResponse).stages.map(() => []),
      ),
    ),
  );
  assert.equal(
    normalizeShapeAnswer(
      base,
      JSON.stringify([[placement(1, 180), placement(0)]]),
    ),
    normalizeShapeAnswer(
      base,
      JSON.stringify([[placement(0), placement(1, 180)]]),
    ),
  );
  const required = structuredClone(base);
  required.stages[0]!.tray.push({ ...shapePieces.S });
  required.stages[0]!.required = [{ pieceId: "T1", count: 2 }];
  assert.equal(
    gradeShapeComposer(
      required,
      JSON.stringify([[{ ...placement(0), pieceId: "S" }]]),
    ),
    false,
    "Right outline with wrong required pieces",
  );
  delete required.stages[0]!.required;
  assert.equal(
    gradeShapeComposer(
      required,
      JSON.stringify([[{ ...placement(0), pieceId: "S" }]]),
    ),
    true,
    "Unneeded tray pieces do not count against an exact cover",
  );
});
test("piece symmetries close exactly; arcs and joined shapes have no artificial internal edges", () => {
  const canonical = (cells: typeof shapePieces.S.cells) =>
    shapeAtoms(cells).sort();
  for (const piece of Object.values(shapePieces)) {
    let turned = piece.cells;
    for (let i = 0; i < 4; i++) turned = poseCells(turned, 90);
    assert.deepEqual(canonical(turned), canonical(piece.cells));
    assert.deepEqual(
      canonical(poseCells(poseCells(piece.cells, 0, true), 0, true)),
      canonical(piece.cells),
    );
    for (const rot of [0, 90, 180, 270])
      for (const flip of [false, true])
        assert.equal(hasOverlap(poseCells(piece.cells, rot, flip)), false);
  }
  assert.match(shapePath(shapePieces.Q.cells), /A1 1/);
  assert.equal((shapePath(shapePieces.R2.cells).match(/M/g) ?? []).length, 1);
});
test("guess chance counts the complete independent placement space, not only a reference key", () => {
  let correct = 0,
    total = 0;
  const choices: (ShapePlacement | null)[] = [null];
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 5; x++)
      for (const rot of [0, 90, 180, 270] as const)
        choices.push({ ...placement(0, rot), x, y });
  for (const a of choices)
    for (const b of choices) {
      total++;
      if (
        gradeShapeComposer(
          base,
          JSON.stringify([
            [...(a ? [a] : []), ...(b ? [{ ...b, copy: 1 }] : [])],
          ]),
        )
      )
        correct++;
    }
  assert.equal(correct, 4);
  assert.equal(shapeGuessChance(base), correct / total);
});
test("500 deterministic seeds cover all recipes, stay bounded, and grade exactly; independent oracle validates and attacks keys", () => {
  const cases = [],
    seen = new Set<string>(),
    variants = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const p = generateProblem(template.id, `coverage:${i}`),
      r = p.public.response as ShapeComposerResponse;
    assert.deepEqual(p, generateProblem(template.id, `coverage:${i}`));
    generatedProblemSchema.parse(p);
    assert.equal(gradeAnswer(p, p.answer), true);
    seen.add(p.variant!.axes!.recipe!);
    variants.add(p.variant!.id);
    cases.push(p);
    assert.ok(problemGuessChance(p) > 0 && problemGuessChance(p) <= 2 / 441);
    for (const s of r.stages) {
      assert.ok(s.tray.reduce((n, p) => n + p.copies, 0) <= 6);
      assert.ok(s.prompt.split(/\s+/).length <= 20);
    }
    const a = JSON.parse(p.answer) as ShapeAnswer;
    a[0]!.pop();
    assert.equal(gradeAnswer(p, JSON.stringify(a)), false);
    sceneSchema.parse(shapeComposerScene(r));
    sceneSchema.parse(shapeComposerScene(r, p.answer));
  }
  assert.equal(seen.size, shapeRecipes.length);
  assert.equal(variants.size, 3);
  assert.equal(guessChance(template), 2 / 441);
  const output = execFileSync(
    "python3",
    ["scripts/shape_composer_math_oracle.py"],
    {
      input: cases.map((p) => JSON.stringify(p)).join("\n"),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.match(output, /500/);
});
test("capability gate retains the existing shape-name format and readable lessons/print", () => {
  assert.ok(responseCapabilities.includes("shape-composer-v1"));
  const legacy = {
    responseCapabilities: ["single-choice-v1", "figure-choice-v1"],
    figureCapabilities: ["scenes-v1"],
  };
  assert.equal(clientCanDraw(template, legacy), false);
  assert.equal(
    clientCanDraw(
      templates.find((t) => t.id === "composite-shape-name")!,
      legacy,
    ),
    true,
  );
  assert.equal(
    clientCanDraw(template, {
      ...legacy,
      responseCapabilities: [
        ...legacy.responseCapabilities,
        "shape-composer-v1",
      ],
    }),
    true,
  );
  const p = generateProblem(template.id, "print"),
    r = p.public.response as ShapeComposerResponse;
  assert.doesNotMatch(answerText(r, p.answer), /[{}\[\]]/);
  const lesson = problemLesson(template.id, "lesson", p.public.prompt, r, p);
  assert.ok(lesson);
  assert.ok(p.walkthrough);
  for (const solutions of [false, true]) {
    const html = renderToStaticMarkup(
      createElement(PrintExerciseBody, { number: 1, problem: p, solutions }),
    );
    assert.match(html, /<svg/);
    assert.doesNotMatch(html, /pieceId/);
  }
});
