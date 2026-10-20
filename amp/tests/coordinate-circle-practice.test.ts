import assert from "node:assert/strict";
import test from "node:test";
import {
  coordinateCircleCase,
  coordinateCircleTemplates,
} from "../src/math/coordinate-circle-practice.js";
import { generateProblem, gradeAnswer } from "../src/math/engine.js";
import { semanticFigureSchema } from "../src/math/contracts.js";
import { templateRole } from "../src/learning/placement.js";
import { layoutScene } from "../src/math/scene/index.js";
import { captionText, missingTargets } from "../src/math/scene/timeline.js";
import { coordinateCircleScenes as lessonScenes } from "../src/content/coordinate-circle-scenes.js";

const SEEDS = 200;
const cases = (id: string) =>
  Array.from({ length: SEEDS }, (_, i) => coordinateCircleCase(id, `t-${i}`));

test("each probability problem type is deterministic, scene-gated and an assessment item", () => {
  for (const t of coordinateCircleTemplates) {
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
    "circle-equation": ["standard", "general", "center-point", "graph"],
    "coordinate-polygon": [
      "area",
      "perimeter",
      "triangle",
      "quadrilateral",
      "parallelogram",
    ],
    "segment-partition": ["ratio", "fraction", "axis-x", "axis-y"],
    "perpendicular-slopes": [
      "parallel",
      "perpendicular",
      "parallel-line",
      "perpendicular-line",
      "missing-coordinate",
    ],
    "circle-angles": ["inscribed", "semicircle", "tangent", "same-arc"],
  };
  for (const [id, needed] of Object.entries(frames)) {
    const seen = new Set(cases(id).flatMap((c) => c.tags));
    for (const tag of needed) assert.ok(seen.has(tag), `${id} lacks ${tag}`);
  }
});

test("circle figures are drawn to their stated angles", () => {
  for (const { problem } of cases("circle-angles")) {
    const f = problem.public.figure;
    if (f?.kind !== "scene") continue;
    const c = f.scene.elements[0]!;
    assert.ok(c.type === "circleDiagram");
    if (c.type !== "circleDiagram") continue;
    const at = Object.fromEntries(c.points.map((p) => [p.name, p.at]));
    const deg = /(\d+)°/.exec(problem.public.prompt)?.[1];
    if (/diameter/.test(problem.public.prompt))
      // ∠CAB is half of arc CB, with B at 0°.
      assert.equal(at.C, 2 * Number(deg));
    if (/central angle AOB measures/.test(problem.public.prompt))
      assert.equal((((at.B! - at.A!) % 360) + 360) % 360, Number(deg));
  }
});

test("answers are exact, graded in either form, and never sit in the figure", () => {
  for (const t of coordinateCircleTemplates)
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
  for (const t of coordinateCircleTemplates)
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
