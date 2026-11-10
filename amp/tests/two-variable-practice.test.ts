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

test("choose-graph descriptions match the inequality at the test point", () => {
  let single = 0;
  let systems = 0;
  const holds = (a: number, b: number, op: string, c: number, x: number, y: number) => {
    const left = a * x + b * y;
    return op === "<" ? left < c : op === "<=" || op === "≤" ? left <= c : op === ">" ? left > c : left >= c;
  };
  for (let i = 0; i < 200; i++) {
    const problem = generateProblem("half-plane-inequality", `graph-${i}`);
    if (!problem.variant) continue;
    const response = problem.public.response;
    if (response.kind !== "choice") throw new Error("choice");
    const key = response.options.find((o) => o.id === problem.answer)!.label;
    if (problem.variant.id === "choose-graph") {
      single++;
      const tex = /\$([^$]+)\$/.exec(problem.public.prompt)![1]!;
      const match = /(.+) (<=|>=|<|>|\\le|\\ge) (-?\d+)/.exec(tex.replaceAll("−", "-").replaceAll("\\le", "<=").replaceAll("\\ge", ">="))!;
      const left = match[1]!.replace(/\s/g, "");
      const coeff = (variable: string) => {
        const found = new RegExp(`([+-]?)(\\d*)${variable}`).exec(left.startsWith("-") || left.startsWith("+") ? left : `+${left}`);
        if (!found) return 0;
        const sign = found[1] === "-" ? -1 : 1;
        const mag = found[2] === "" ? 1 : Number(found[2]);
        return sign * mag;
      };
      const op = match[2] === "\\le" ? "<=" : match[2] === "\\ge" ? ">=" : match[2]!;
      const c = Number(match[3]);
      const origin = holds(coeff("x"), coeff("y"), op, c, 0, 0);
      const strict = op === "<" || op === ">";
      assert.match(key, strict ? /^Dashed / : /^Solid /);
      assert.match(key, origin ? /includes \(0, 0\)/ : /excludes \(0, 0\)/);
      for (const option of response.options)
        if (option.id !== problem.answer)
          assert.notEqual(option.label, key);
    } else if (problem.variant.id === "choose-system") {
      systems++;
      assert.match(key, /only the overlap/);
      assert.match(key, /is included/);
      assert.ok(response.options.some((o) => o.label.includes("union")));
    }
  }
  assert.ok(single > 20 && systems > 20);
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
