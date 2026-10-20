import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import { dollarsAreMath } from "./fixtures/math-typography";
import { twoVariableTemplates } from "../src/math/two-variable-practice";
import { templateRole } from "../src/learning/placement";
import { layoutScene } from "../src/math/scene";
import { missingTargets, visibleSteps } from "../src/math/scene/timeline";

test("Algebra 1 two-variable items are valid, deterministic assessment items", () => {
  for (const template of twoVariableTemplates) {
    const positions = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const problem = generateProblem(template.id, `alg1-${i}`);
      assert.deepEqual(problem, generateProblem(template.id, `alg1-${i}`));
      generatedProblemSchema.parse(problem);
      // Money is written in words: "$" only opens and closes math spans.
      assert.ok(
        [
          problem.public.prompt,
          problem.public.response,
          problem.hint,
          problem.explanation,
          problem.choiceFeedback ?? null,
        ]
          .flat()
          .flatMap((v) =>
            typeof v === "string"
              ? [v]
              : v && typeof v === "object"
                ? Object.values(v).flatMap((w) =>
                    typeof w === "string" ? [w] : JSON.stringify(w),
                  )
                : [],
          )
          .every(dollarsAreMath),
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

test("walkthroughs name only parts their scene has and never state the answer", () => {
  for (const id of ["inequality-solution-point", "elimination-equivalent"])
    for (let i = 0; i < 300; i++) {
      const p = generateProblem(id, `walk-${i}`);
      const f = p.public.figure;
      if (f?.kind !== "scene" || !f.scene.steps) continue;
      assert.deepEqual(
        missingTargets(layoutScene(f.scene), f.scene.steps),
        [],
        id,
      );
      const label =
        p.public.response.kind === "choice"
          ? p.public.response.options.find((o) => o.id === p.answer)!.label
          : p.answer;
      for (const s of visibleSteps(f.scene.steps, "hint"))
        assert.ok(!s.caption.includes(label), `${id}: ${s.caption}`);
    }
});
