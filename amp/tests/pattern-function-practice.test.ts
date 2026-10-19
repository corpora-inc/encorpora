import { test } from "node:test";
import assert from "node:assert/strict";
import {
  functionDisplaySchema,
  generatedProblemSchema,
} from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import { patternFunctionTemplates } from "../src/math/pattern-function-practice";
import { templateRole } from "../src/learning/placement";

test("pattern and function items are valid, deterministic assessment items", () => {
  for (const template of patternFunctionTemplates) {
    const positions = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const problem = generateProblem(template.id, `family-${i}`);
      assert.deepEqual(problem, generateProblem(template.id, `family-${i}`));
      generatedProblemSchema.parse(problem);
      assert.equal(templateRole(template.id), "assessment");
      const { response, figure } = problem.public;
      assert.equal(
        template.requiredResponseCapability === "single-choice-v1",
        response.kind === "choice",
        template.id,
      );
      assert.equal(
        template.requiredFigureCapability === "function-displays-v1",
        figure?.kind === "function-display",
        template.id,
      );
      if (response.kind === "choice") {
        assert.equal(response.options.length, 4);
        positions.set(problem.answer, (positions.get(problem.answer) ?? 0) + 1);
        for (const option of response.options)
          if (option.id !== problem.answer)
            assert.ok(problem.choiceFeedback?.[option.id], template.id);
      }
    }
    // The correct statement lands in every position.
    if (positions.size) assert.equal(positions.size, 4, template.id);
  }
});

test("the placement item stays short enough to read at a glance", () => {
  for (let i = 0; i < 2000; i++)
    assert.ok(
      generateProblem("dependent-variable-value", `opener-${i}`).public.prompt
        .length <= 160,
    );
});

test("function displays reject points off the grid or off their stated line", () => {
  const good = {
    kind: "function-display" as const,
    graph: {
      xLabel: "x",
      yLabel: "y",
      xMax: 6,
      yMax: 20,
      xStep: 1,
      yStep: 5,
      series: [
        {
          points: [
            { x: 0, y: 3 },
            { x: 4, y: 9 },
          ],
          line: { rise: 3, run: 2, b: 3 },
        },
      ],
    },
  };
  assert.ok(functionDisplaySchema.safeParse(good).success);
  for (const bad of [
    { kind: "function-display" },
    {
      ...good,
      graph: {
        ...good.graph,
        series: [{ ...good.graph.series[0]!, line: { rise: 2, run: 1, b: 3 } }],
      },
    },
    {
      ...good,
      graph: {
        ...good.graph,
        series: [{ points: [{ x: 7, y: 1 }] }],
      },
    },
    { ...good, graph: { ...good.graph, xStep: 4 } },
    {
      kind: "function-display",
      table: { columns: ["x", "y"], rows: [{ x: 1, y: 2 }] },
    },
  ])
    assert.equal(functionDisplaySchema.safeParse(bad).success, false);
});
