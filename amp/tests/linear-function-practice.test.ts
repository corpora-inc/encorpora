import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import { linearFunctionTemplates } from "../src/math/linear-function-practice";
import { templateRole } from "../src/learning/placement";
import { layoutScene, sceneSchema } from "../src/math/scene";
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
