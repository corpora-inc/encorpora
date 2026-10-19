import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import {
  generatedProblemSchema,
  type FigureCapability,
} from "../src/math/contracts";
import { shapeTemplates } from "../src/math/shape-practice";
import { supportedOfflineTemplates } from "../src/offline/repository";
import { templateRole } from "../src/learning/placement";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";

test("shape figures reach only clients that declare them", () => {
  for (const t of shapeTemplates)
    assert.equal(t.requiredFigureCapability, "shape-figures-v1");
  const ids = (figureCapabilities: FigureCapability[]) =>
    supportedOfflineTemplates({
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities,
      requestId: "00000000-0000-4000-8000-000000000000",
    }).map((t) => t.id);
  assert.ok(!ids(["measurement-models-v1"]).includes("name-flat-shape"));
  assert.ok(ids(["shape-figures-v1"]).includes("name-flat-shape"));
});

test("shape problems are deterministic, valid and balanced", () => {
  for (const t of shapeTemplates) {
    const answers = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(t.id, `shape-${i}`);
      assert.deepEqual(p, generateProblem(t.id, `shape-${i}`));
      generatedProblemSchema.parse(p);
      answers.set(p.answer, (answers.get(p.answer) ?? 0) + 1);
      // A square is a rectangle too: when "square" is right, "rectangle"
      // would be right as well, so it is never offered.
      if (p.public.response.kind === "choice") {
        const options = p.public.response.options;
        const right = options.find((o) => o.id === p.answer)!.label;
        if (right === "square")
          assert.ok(!options.some((o) => o.label === "rectangle"));
      }
    }
    // No answer position or value dominates.
    for (const [answer, n] of answers)
      assert.ok(n < 120, `${t.id} answers ${answer} ${n} times in 200`);
  }
});

test("every shape item is a whole assessment item", () => {
  for (const t of shapeTemplates)
    assert.equal(templateRole(t.id), "assessment");
});

test("the attribute lesson morphs its own three shapes and keeps the side count", () => {
  for (let i = 0; i < 40; i++) {
    const lesson = problemLesson("defining-attribute", `animation-${i}`);
    const model = animationModel(lesson);
    assert(model?.kind === "shape-morph");
    const n = model.shapes[0]!.points.length;
    assert.ok([3, 4, 6].includes(n));
    const frames = animationFrames(model);
    assert.equal(frames.length, 3);
    for (const frame of frames)
      assert.equal(frame.math, `$${n}$ sides, $${n}$ corners`);
  }
  assert.equal(
    animationModel(problemLesson("count-sides-corners", "animation")),
    null,
  );
});
