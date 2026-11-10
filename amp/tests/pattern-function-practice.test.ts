import { reportEditorialLimit } from "./fixtures/editorial";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  functionDisplaySchema,
  generatedProblemSchema,
} from "../src/math/contracts";
import { generateProblem } from "./fixtures/pre-clause-problem";
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

test("report placement prompt reading length", () => {
  for (let i = 0; i < 2000; i++)
    reportEditorialLimit(
      generateProblem("dependent-variable-value", `opener-${i}`).public.prompt
        .length <= 160,
      "dependent-variable-value: placement prompt exceeds 160 characters",
    );
});

test("proportional pairs compare two different representations, including distance-time", () => {
  let speedGraph = 0;
  let equal = 0;
  let checked = 0;
  for (let i = 0; checked < 500; i++) {
    const problem = generateProblem("compare-function-rates", `prop-${i}`);
    if (problem.variant?.id !== "proportional-other" && problem.variant?.id !== "speed-graph-equation")
      continue;
    checked++;
    const response = problem.public.response;
    if (response.kind !== "choice") throw new Error("choice");
    const key = response.options.find((o) => o.id === problem.answer)!.label;
    const figure = problem.public.figure;
    if (figure?.kind !== "function-display") throw new Error("figure");
    const rates = new Map<string, number>();
    if (figure.graph) {
      assert.ok(figure.graph.xStep >= 2);
      for (const series of figure.graph.series) {
        assert.equal(series.line?.b, 0);
        const marked = series.points.filter((p) => p.x >= 2);
        assert.ok(marked.length >= 1);
        rates.set(series.label!, series.line!.rise / series.line!.run);
      }
    }
    if (figure.table) {
      assert.deepEqual(figure.table.rows.map((row) => row.x), [2, 5, 8]);
      const slope = figure.table.rows[0]!.y / figure.table.rows[0]!.x;
      for (const row of figure.table.rows)
        assert.equal(row.y / row.x, slope);
      rates.set(figure.table.title!, slope);
    }
    for (const match of problem.public.prompt.matchAll(
      /([A-Z][a-z]+ [AB]) is given by \$[a-z] = (\d+)[a-z]\$/g,
    ))
      rates.set(match[1]!, Number(match[2]));
    for (const match of problem.public.prompt.matchAll(
      /([A-Z][a-z]+ [AB]) (?:travels|charges|adds) (\d+) \w+ (?:in|for) (\d+)/g,
    ))
      rates.set(match[1]!, Number(match[2]) / Number(match[3]));
    const a = [...rates.entries()].find(([name]) => name.endsWith(" A"))![1];
    const b = [...rates.entries()].find(([name]) => name.endsWith(" B"))![1];
    const sources = problem.public.prompt.split(". ").slice(0, 2);
    assert.notEqual(sources[0], sources[1]);
    if (problem.variant?.id === "speed-graph-equation") {
      speedGraph++;
      assert.match(problem.public.prompt, /Car A is shown on the graph/);
      assert.match(problem.public.prompt, /Car B is given by/);
    }
    const diff = Math.abs(a - b);
    if (a === b) {
      equal++;
      assert.match(key, /same/);
      for (const option of response.options)
        if (option.id !== problem.answer)
          assert.match(option.label, /by [1-9]/);
    } else {
      const winner = a > b ? "A" : "B";
      assert.match(key, new RegExp(`${winner}, by ${diff} `));
      const oneTime = response.options.find(
        (o) => o.id !== problem.answer && o.label.includes(`, by ${diff * 2}`),
      );
      if (oneTime) assert.notEqual(diff * 2, diff);
    }
    assert.ok(i < 4000, "not enough proportional items");
  }
  assert.ok(speedGraph > 50);
  assert.ok(equal > 10);
});

test("nonlinear-by-points uses the square points and unequal changes", () => {
  let squares = 0;
  for (let i = 0; i < 400; i++) {
    const problem = generateProblem("linear-function-choice", `nl-${i}`);
    if (!problem.variant) continue;
    const response = problem.public.response;
    if (response.kind !== "choice") throw new Error("choice");
    const key = response.options.find((o) => o.id === problem.answer)!.label;
    const shown = [...problem.public.prompt.matchAll(/\((\d+), (\d+)\)/g)].map(
      (m) => [Number(m[1]), Number(m[2])] as const,
    );
    assert.equal(shown.length, 3);
    const [p, q, u] = shown;
    const d1 = (q![1] - p![1]) / (q![0] - p![0]);
    const d2 = (u![1] - q![1]) / (u![0] - q![0]);
    assert.notEqual(d1, d2);
    assert.ok(key.includes(`(${p![0]}, ${p![1]})`));
    assert.ok(key.includes(`(${u![0]}, ${u![1]})`));
    const hasConstant = /s\^2 \+ /.test(problem.public.prompt);
    const noConstant = response.options.some((o) =>
      o.label.includes("no constant term"),
    );
    assert.equal(noConstant, !hasConstant);
    if (problem.variant.id === "square-area") {
      squares++;
      assert.deepEqual(shown, [[1, 1], [2, 4], [3, 9]]);
    }
  }
  assert.ok(squares > 40);
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
