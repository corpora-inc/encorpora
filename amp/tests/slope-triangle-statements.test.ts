import assert from "node:assert/strict";
import test from "node:test";
import { generatedProblemSchema } from "../src/math/contracts";
import {
  parseSelection,
  serializeSelection,
} from "../src/math/selection-response";
import {
  generateSlopeTriangleStatementsProblem,
  slopeTriangleStatementsCase,
  slopeTriangleStatementsTemplate,
} from "../src/math/slope-triangle-statements";

const cross = (
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
) =>
  BigInt(b[0] - a[0]) * BigInt(c[1] - a[1]) -
  BigInt(b[1] - a[1]) * BigInt(c[0] - a[0]);

test("metadata and public multi-select contract remain bounded", () => {
  assert.equal(slopeTriangleStatementsTemplate.id, "slope-triangle-statements");
  assert.equal(slopeTriangleStatementsTemplate.skillId, "slope");
  assert.equal(slopeTriangleStatementsTemplate.gradeBand, "6–8");
  assert.equal(
    slopeTriangleStatementsTemplate.requiredFigureCapability,
    "scenes-v1",
  );
  assert.equal(
    slopeTriangleStatementsTemplate.requiredResponseCapability,
    "multi-select-v1",
  );
  for (let i = 0; i < 400; i++) {
    const seed = `slope-author-${i}`;
    const { problem } = slopeTriangleStatementsCase(seed);
    assert.deepEqual(generateSlopeTriangleStatementsProblem(seed), problem);
    generatedProblemSchema.parse(problem);
    assert.equal(problem.public.templateId, slopeTriangleStatementsTemplate.id);
    assert.equal(problem.public.seed, seed);
    assert.equal(problem.public.response.kind, "multi-select");
    if (problem.public.response.kind !== "multi-select")
      throw Error("response kind");
    assert.equal(problem.public.response.selectionCount, 3);
    assert.equal(problem.public.response.options.length, 6);
    assert.equal(
      new Set(problem.public.response.options.map((option) => option.label))
        .size,
      6,
    );
    assert.ok(
      problem.public.response.options.every(
        (option) => Object.keys(option).sort().join(",") === "id,label",
      ),
    );
    const selected = parseSelection(problem.answer);
    assert.ok(selected);
    assert.equal(selected.length, 3);
    assert.equal(problem.answer, serializeSelection(selected));
    assert.equal(problem.explanation.length, 6);
    assert.equal(
      problem.explanation.filter((line) => line.includes(" True:")).length,
      3,
    );
    assert.equal(
      problem.explanation.filter((line) => line.includes(" False:")).length,
      3,
    );
    assert.ok(
      problem.public.response.options.every(({ label }) =>
        problem.explanation.some((line) => line.includes(label)),
      ),
    );
    assert.ok(problem.hint.includes("Subtract their $x$-coordinates"));
    assert.ok(problem.hint.includes("signed rise"));
    assert.doesNotMatch(problem.hint, /True:|False:|option-[a-f]/);
    assert.doesNotMatch(
      JSON.stringify(problem.public),
      /trueFromGeometry|"correct"|"answer"/,
    );
  }
});

test("drawn right triangles are separated, non-isosceles, collinear and physically scaled equally", () => {
  const tags = new Set<string>();
  const answerPatterns = new Set<string>();
  const names = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const { problem, tags: caseTags } = slopeTriangleStatementsCase(
      `slope-author-${i}`,
    );
    caseTags.forEach((tag) => tags.add(tag));
    const selected = parseSelection(problem.answer)!;
    answerPatterns.add(selected.join(","));
    names.add(caseTags[2]!);
    assert.equal(problem.public.figure?.kind, "scene");
    if (problem.public.figure?.kind !== "scene") throw Error("scene kind");
    const graph = problem.public.figure.scene.elements.find(
      (element) => element.type === "graph",
    );
    assert.ok(graph && graph.type === "graph");
    assert.equal(graph.aspect, 1);
    assert.equal(graph.points?.length, 6);
    assert.equal(graph.slopeTriangles?.length, 2);
    assert.equal(graph.lines?.length, 1);
    assert.equal(new Set(graph.points!.map(({ x, y }) => `${x},${y}`)).size, 6);
    const [a, b, c, d, e, f] = graph.points!.map(({ x, y }) => [x, y] as const);
    assert.equal(a[1], b[1]);
    assert.equal(b[0], c[0]);
    assert.equal(d[1], e[1]);
    assert.equal(e[0], f[0]);
    assert.ok(b[0] > a[0] && e[0] > d[0]);
    assert.ok(c[1] !== b[1] && f[1] !== e[1]);
    assert.notEqual(b[0] - a[0], Math.abs(c[1] - b[1]));
    assert.ok(d[0] > c[0], "the hypotenuse segments must be separated");
    assert.equal(cross(a, c, d), 0n);
    assert.equal(cross(a, c, f), 0n);
    const scale = (e[0] - d[0]) / (b[0] - a[0]);
    assert.ok([1, 2, 3].includes(scale));
    assert.equal(f[1] - e[1], scale * (c[1] - b[1]));
    assert.deepEqual(
      graph.slopeTriangles!.map(({ labels }) => labels),
      ["none", "none"],
    );
    for (const point of graph.points!)
      assert.ok(
        problem.public.prompt.includes(
          `$${point.label}(${point.x}, ${point.y})$`,
        ),
      );
    assert.ok(
      problem.hint.includes(`$${graph.points![0]!.label}(${a[0]}, ${a[1]})$`),
    );
  }
  for (const tag of [
    "positive-slope",
    "negative-slope",
    "translated-congruent",
    "similar-scale-2",
    "similar-scale-3",
  ])
    assert.ok(tags.has(tag), tag);
  assert.deepEqual([...names].sort(), ["A", "D", "P", "S"]);
  assert.ok(
    answerPatterns.size > 12,
    "correct positions must move across six choices",
  );
});

test("invalid seeds are rejected", () => {
  assert.throws(() => slopeTriangleStatementsCase(""));
  assert.throws(() => slopeTriangleStatementsCase("x".repeat(129)));
});

test("segment-slope relation is sometimes selected as a true or false claim", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const { problem } = slopeTriangleStatementsCase(`slope-author-${i}`);
    if (problem.public.response.kind !== "multi-select")
      throw Error("response kind");
    const selected = new Set(parseSelection(problem.answer)!);
    for (const option of problem.public.response.options) {
      if (!option.label.startsWith("The slopes of ")) continue;
      const relation = option.label.endsWith("are equal.")
        ? "equal"
        : "unequal";
      seen.add(`${relation}:${selected.has(option.id) ? "true" : "false"}`);
    }
  }
  assert.deepEqual([...seen].sort(), ["equal:true", "unequal:false"]);
});
