import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import { linearFunctionTemplates } from "../src/math/linear-function-practice";
import { templateRole } from "../src/learning/placement";
import { problemLesson } from "../src/content/problem-lessons";
import { layoutScene, sceneSchema } from "../src/math/scene";
import { missingTargets, visibleSteps } from "../src/math/scene/timeline";
import { sceneIllustrations } from "../src/content/scene-illustrations";

test("Algebra 1 function items are valid, deterministic assessment items", () => {
  for (const template of linearFunctionTemplates) {
    const positions = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const problem = generateProblem(template.id, `alg1-${i}`);
      assert.deepEqual(problem, generateProblem(template.id, `alg1-${i}`));
      generatedProblemSchema.parse(problem);
      // Money is written in words: "$" opens a math span in MathText.
      assert.ok(
        !/\$/.test(
          JSON.stringify([
            problem.public.prompt,
            problem.public.response,
            problem.hint,
            problem.explanation,
            problem.choiceFeedback ?? null,
          ]),
        ),
        template.id,
      );
      assert.equal(templateRole(template.id), "assessment");
      const { response, figure } = problem.public;
      assert.equal(
        template.requiredResponseCapability === "single-choice-v1",
        response.kind === "choice",
        template.id,
      );
      // Scene figures only where the template declares them.
      if (figure) {
        assert.equal(figure.kind, "scene", template.id);
        assert.equal(template.requiredFigureCapability, "scenes-v1");
        const l = layoutScene(figure.scene);
        assert.ok(l.width <= 361 && l.height <= 321, template.id);
      }
      if (response.kind === "choice") {
        assert.equal(response.options.length, 4);
        positions.set(problem.answer, (positions.get(problem.answer) ?? 0) + 1);
        for (const option of response.options)
          if (option.id !== problem.answer)
            assert.ok(problem.choiceFeedback?.[option.id], template.id);
      }
    }
    if (positions.size) assert.equal(positions.size, 4, template.id);
  }
});

test("high-school openers read at a glance", () => {
  for (const id of [
    "linear-model-value",
    "average-rate-formula",
    "formula-value",
  ])
    for (let i = 0; i < 1000; i++)
      assert.ok(
        generateProblem(id, `opener-${i}`).public.prompt.length <= 160,
        id,
      );
});

test("lesson scenes are valid, revealed models that fit their box", () => {
  for (const [kind, scene] of Object.entries(sceneIllustrations)) {
    assert.ok(sceneSchema.safeParse(scene).success, kind);
    const l = layoutScene(scene, { reveal: true });
    assert.ok(l.width <= 361 && l.height <= 321, kind);
  }
});

test("walkthroughs name only parts their scene has and never state the answer", () => {
  for (const id of [
    "graph-domain-range",
    "average-rate-display",
    "linear-model-equation",
  ])
    for (let i = 0; i < 300; i++) {
      const p = generateProblem(id, `walk-${i}`);
      const f = p.public.figure;
      if (f?.kind !== "scene" || !f.scene.steps) continue;
      const masked = layoutScene(f.scene);
      assert.deepEqual(missingTargets(masked, f.scene.steps), [], id);
      const label =
        p.public.response.kind === "choice"
          ? p.public.response.options.find((o) => o.id === p.answer)!.label
          : p.answer;
      // A number answer may appear only where the prompt states it too.
      const nums = (t: string): string[] =>
        t
          .replace(/\{[^}]+\}/g, "")
          .replaceAll("−", "-")
          .match(/-?\d+(?:\/\d+)?/g) ?? [];
      const given = new Set(nums(p.public.prompt));
      for (const s of visibleSteps(f.scene.steps, "hint"))
        assert.ok(
          p.public.response.kind === "choice"
            ? !s.caption.includes(label)
            : given.has(label) || !nums(s.caption).includes(label),
          `${id}: ${s.caption}`,
        );
      // Masked labels (the rise of a secant) never show a value.
      for (const d of masked.items)
        if (d.k === "text" && d.masked) assert.equal(d.plain, "?");
    }
});

test("a lesson example plays the type's walkthrough when it has one", () => {
  for (const id of [
    "linear-model-equation",
    "average-rate-display",
    "graph-domain-range",
  ])
    for (const seed of ["a", "b", "c", "scene-player"]) {
      const figure = problemLesson(id, seed).example.figure;
      assert.ok(
        figure?.kind === "scene" && figure.scene.steps?.length,
        `${id}/${seed}`,
      );
    }
});
