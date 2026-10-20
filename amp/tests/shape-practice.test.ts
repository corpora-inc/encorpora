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
import { layoutScene } from "../src/math/scene";
import {
  frameAt,
  missingTargets,
  visibleSteps,
} from "../src/math/scene/timeline";

test("shape figures reach only clients that declare them", () => {
  for (const t of shapeTemplates)
    assert.equal(t.requiredFigureCapability, "scenes-v1");
  const ids = (figureCapabilities: FigureCapability[]) =>
    supportedOfflineTemplates({
      responseCapabilities: ["single-choice-v1"],
      figureCapabilities,
      requestId: "00000000-0000-4000-8000-000000000000",
    }).map((t) => t.id);
  assert.ok(!ids(["measurement-models-v1"]).includes("name-flat-shape"));
  assert.ok(ids(["scenes-v1"]).includes("name-flat-shape"));
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

test("the attribute lesson reshapes A into B, then into C", () => {
  for (let i = 0; i < 40; i++) {
    const p = generateProblem("defining-attribute", `animation-${i}`);
    const f = p.public.figure!;
    assert(f.kind === "scene");
    const steps = f.scene.steps!;
    assert.deepEqual(missingTargets(layoutScene(f.scene), steps), []);
    assert.deepEqual(
      steps.flatMap((st) =>
        st.actions.flatMap((a) => (a.do === "morph" ? [a.into] : [])),
      ),
      ["shapes.item.B.piece.0", "shapes.item.C.piece.0"],
    );
    // The morph ends exactly on C: the final frame is the static figure.
    const l = layoutScene(f.scene);
    const end = frameAt(l, steps, steps.length - 1, 1);
    const c = l.items.find((d) => d.id === "shapes.item.C.piece.0")!;
    assert(c.k === "path");
    const pts = (d: string) =>
      [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)]
        .map((m) => `${(+m[1]!).toFixed(1)},${(+m[2]!).toFixed(1)}`)
        .sort();
    assert.deepEqual(pts(end["shapes.morph"]!.d!), pts(c.d));
    // Every walkthrough step is lesson-only: hints show none of it.
    assert.equal(visibleSteps(steps, "hint").length, 0);
  }
});
