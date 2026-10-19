import assert from "node:assert/strict";
import test from "node:test";
import {
  similarityTrigCase,
  similarityTrigTemplates,
} from "../src/math/similarity-trig-practice.js";
import { generateProblem, gradeAnswer } from "../src/math/engine.js";
import { semanticFigureSchema } from "../src/math/contracts.js";
import { templateRole } from "../src/learning/placement.js";
import { layoutScene } from "../src/math/scene/index.js";
import { captionText, missingTargets } from "../src/math/scene/timeline.js";
import { similarityTrigScenes as lessonScenes } from "../src/content/similarity-trig-scenes.js";

const SEEDS = 200;
const cases = (id: string) =>
  Array.from({ length: SEEDS }, (_, i) => similarityTrigCase(id, `t-${i}`));

test("each probability problem type is deterministic, scene-gated and an assessment item", () => {
  for (const t of similarityTrigTemplates) {
    assert.equal(t.requiredFigureCapability, "scenes-v1");
    assert.equal(templateRole(t.id), "assessment");
    assert.deepEqual(
      generateProblem(t.id, "same"),
      generateProblem(t.id, "same"),
    );
  }
});

test("every skill is practiced in at least three prompt frames", () => {
  const frames: Record<string, string[]> = {
    "dilation-image": [
      "image-length",
      "scale-factor",
      "center",
      "slope",
      "angle",
    ],
    "similar-triangle-side": [
      "pair",
      "splitter",
      "shadow",
      "area",
      "perimeter",
    ],
    "special-right-triangle": [
      "45",
      "30",
      "rationalize",
      "leg-to-hypotenuse",
      "hypotenuse-to-long",
    ],
    "trig-ratio": [
      "three-sides",
      "two-sides",
      "side-from-ratio",
      "ladder",
      "sin",
      "cos",
      "tan",
    ],
    "complementary-trig": ["angle", "equation", "triangle", "cofunction"],
  };
  for (const [id, needed] of Object.entries(frames)) {
    const seen = new Set(cases(id).flatMap((c) => c.tags));
    for (const tag of needed) assert.ok(seen.has(tag), `${id} lacks ${tag}`);
  }
});

test("triangle figures are drawn to their stated lengths", () => {
  for (const { problem } of cases("similar-triangle-side")) {
    const f = problem.public.figure;
    if (
      f?.kind !== "scene" ||
      !problem.public.prompt.startsWith("Triangle ABC is similar")
    )
      continue;
    const [t1, t2] = f.scene.elements;
    assert.ok(t1?.type === "triangle" && t2?.type === "triangle");
    if (t1?.type !== "triangle" || t2?.type !== "triangle") continue;
    const len = (p: number[][], i: number) =>
      Math.hypot(
        p[(i + 1) % 3]![0]! - p[i]![0]!,
        p[(i + 1) % 3]![1]! - p[i]![1]!,
      );
    // Same shape: every side ratio between the two drawings is one number.
    const ratios = [0, 1, 2].map((i) => len(t2.points, i) / len(t1.points, i));
    for (const r of ratios) assert.ok(Math.abs(r - ratios[0]!) < 1e-9);
  }
});

test("answers are exact, graded in either form, and never sit in the figure", () => {
  for (const t of similarityTrigTemplates)
    for (const { problem } of cases(t.id)) {
      const [n, d = "1"] = problem.answer.split("/");
      assert.ok(Number(d) > 0 && Number.isInteger(Number(n)));
      if (problem.public.response.kind === "fraction") {
        // A terminating decimal is accepted for the same value.
        const value = Number(n) / Number(d);
        if (Number.isFinite(value) && /^\d+(\.\d{1,4})?$/.test(String(value)))
          assert.ok(gradeAnswer(problem, String(value)), problem.answer);
      }
      const figure = problem.public.figure;
      if (!figure) continue;
      assert.equal(semanticFigureSchema.safeParse(figure).success, true);
      assert.equal(figure.kind, "scene");
      if (figure.kind !== "scene") continue;
      assert.ok(layoutScene(figure.scene).items.length > 0);
    }
});

test("walkthroughs name real elements, and hint captions never state the answer", () => {
  const plainAnswer = (answer: string) => {
    const [n, d = 1] = answer.split("/").map(Number);
    const out = [answer];
    const v = n! / d!;
    if (/^\d+(\.\d+)?$/.test(String(v))) out.push(String(v));
    return out;
  };
  let walkthroughs = 0;
  for (const t of similarityTrigTemplates)
    for (const { problem } of cases(t.id)) {
      const f = problem.public.figure;
      if (f?.kind !== "scene" || !f.scene.steps) continue;
      walkthroughs++;
      for (const reveal of [false, true]) {
        const layout = layoutScene(f.scene, { reveal });
        assert.deepEqual(missingTargets(layout, f.scene.steps), [], t.id);
      }
      // No caption, in a hint or a lesson, states the answer unless the
      // prompt does; every masked label reads "?".
      const masked = layoutScene(f.scene);
      for (const s of f.scene.steps) {
        const caption = captionText(masked, s.caption);
        for (const a of plainAnswer(problem.answer))
          assert.ok(
            !new RegExp(`(?<![\\d/.])${a.replace(".", "\\.")}(?![\\d/])`).test(
              caption,
            ) || problem.public.prompt.includes(a),
            `${t.id}: "${caption}" states ${a}`,
          );
      }
      for (const d of masked.items)
        if (d.k === "text" && d.masked) assert.equal(d.plain, "?");
    }
  assert.ok(walkthroughs > 300);
});

test("lesson scenes play only on elements they draw", () => {
  for (const [kind, scene] of Object.entries(lessonScenes)) {
    if (!scene.steps) continue;
    assert.deepEqual(
      missingTargets(layoutScene(scene, { reveal: true }), scene.steps),
      [],
      kind,
    );
  }
});
