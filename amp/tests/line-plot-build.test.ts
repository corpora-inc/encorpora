import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrintExerciseBody } from "../src/content/print-exercise";
import {
  generateProblem,
  generateProblemFor,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import {
  clientCanDraw,
  generatedProblemSchema,
  responseCapabilities,
} from "../src/math/contracts";
import {
  diagnoseLinePlotBuild,
  gradeLinePlotBuild,
  linePlotCounts,
  linePlotValues,
  normalizeLinePlotBuild,
  linePlotBuildResponseSchema,
  type LinePlotBuildResponse,
} from "../src/math/line-plot-build";
import { problemLesson } from "../src/content/problem-lessons";
import {
  guessChanceOf,
  problemGuessChance,
  responseGuessChance,
} from "../src/math/guess-chance";

const response: LinePlotBuildResponse = {
  kind: "line-plot-build",
  label: "Lengths",
  axis: { min: 2, max: 7, unit: "centimeters" },
  maxPerValue: 6,
  marker: "x",
};
const encode = (counts: Record<string, number>) => JSON.stringify({ counts });
const key = encode({ 3: 2, 5: 2, 6: 1 });

test("guess chance counts distinct permitted maps, including empty columns", () => {
  for (const [columns, maxPerValue] of [
    [5, 2],
    [6, 1],
  ] as const) {
    const r: LinePlotBuildResponse = {
      ...response,
      axis: { ...response.axis, max: response.axis.min + columns - 1 },
      maxPerValue,
      measurementCount: 3,
    };
    linePlotBuildResponseSchema.parse(r);
    const answers = new Set<string>();
    const enumerate = (value: number, counts: Record<string, number>) => {
      if (value > r.axis.max) {
        const answer = normalizeLinePlotBuild(r, encode(counts));
        assert.notEqual(answer, null);
        answers.add(answer!);
        return;
      }
      for (let count = 0; count <= r.maxPerValue; count++)
        enumerate(value + 1, { ...counts, [value]: count });
    };
    enumerate(r.axis.min, {});
    assert.ok(answers.has(encode({})), "Empty columns are valid answers");
    const correct = encode({ 2: 1, 3: 1, 4: 1 });
    const accepted = [...answers].filter((answer) =>
      gradeLinePlotBuild(r, correct, answer),
    ).length;
    assert.equal(accepted, 1);
    assert.equal(responseGuessChance(r), accepted / answers.size);
  }
});

test("count validation, canonicalization and diagnosis precedence", () => {
  assert.equal(
    normalizeLinePlotBuild(response, '{"counts":{"6":1,"5":2,"3":2,"2":0}}'),
    key,
  );
  assert.equal(normalizeLinePlotBuild(response, encode({})), encode({}));
  for (const invalid of [
    "null",
    "[]",
    '{"counts":[]}',
    '{"counts":null}',
    '{"counts":{"03":1}}',
    '{"counts":{"__proto__":1}}',
    '{"counts":{},"extra":1}',
    encode({ 1: 0 }),
    encode({ 8: 1 }),
    encode({ 3: -1 }),
    encode({ 3: 1.5 }),
    encode({ 3: 7 }),
    '{"counts":{"3":"2"}}',
  ])
    assert.equal(normalizeLinePlotBuild(response, invalid), null, invalid);
  assert.equal(
    linePlotBuildResponseSchema.safeParse({
      ...response,
      axis: { ...response.axis, max: 10 },
    }).success,
    false,
  );
  assert.equal(diagnoseLinePlotBuild(response, key, key), null);
  assert.equal(
    diagnoseLinePlotBuild(response, key, encode({ 4: 2, 6: 2, 7: 1 }))?.tag,
    "shift",
  );
  assert.equal(
    diagnoseLinePlotBuild(response, key, encode({ 2: 2, 4: 2, 5: 1 }))?.tag,
    "shift",
  );
  assert.equal(
    diagnoseLinePlotBuild(response, key, encode({ 3: 1, 5: 1, 6: 1 }))?.tag,
    "dedupe",
  );
  assert.equal(
    diagnoseLinePlotBuild(response, key, encode({ 3: 2, 5: 2 }))?.tag,
    "total",
  );
  assert.equal(
    diagnoseLinePlotBuild(response, key, encode({ 3: 2, 4: 1, 5: 1, 6: 1 }))
      ?.tag,
    "recount",
  );
  const context = {
    object: "ribbon",
    readings: [
      { start: 1, end: 4.2 },
      { start: 0, end: 3.2 },
      { start: 0, end: 5 },
      { start: 0, end: 5.1 },
      { start: 0, end: 5.8 },
    ],
  };
  assert.equal(
    diagnoseLinePlotBuild(
      response,
      key,
      encode({ 3: 1, 4: 1, 5: 2, 6: 1 }),
      context,
    )?.tag,
    "end-mark",
  );
});

test("1000 generated plots satisfy the independent oracle, bounds, gating and reachability", () => {
  const cases = Array.from({ length: 1000 }, (_, i) =>
    generateProblem("line-plot-build", `build-${i}`),
  );
  const families = new Map<string, number>();
  const chance = guessChanceOf("line-plot-build");
  assert.ok(chance > 0 && chance < 1 / 1000, `Count-map chance: ${chance}`);
  let several = 0,
    gaps = 0;
  for (const [i, p] of cases.entries()) {
    const r = p.public.response;
    assert.equal(r.kind, "line-plot-build");
    if (r.kind !== "line-plot-build") throw new Error("response");
    assert.ok(
      chance >= problemGuessChance(p),
      `build-${i}: ${problemGuessChance(p)} > ${chance}`,
    );
    assert.ok(
      r.axis.max - r.axis.min + 1 <= 6,
      "Generated scales leave room for 44px columns at 320px",
    );
    generatedProblemSchema.parse(p);
    assert.ok(gradeAnswer(p, p.answer));
    assert.ok(isValidResponse(p.public, p.answer));
    assert.ok(!isValidResponse(p.public, encode({ [r.axis.max + 1]: 1 })));
    assert.ok(!gradeAnswer(p, encode({})));
    const counts = linePlotCounts(r, p.answer),
      values = Object.keys(counts).map(Number);
    assert.equal(
      Object.values(counts).reduce((a, b) => a + b, 0),
      r.measurementCount,
    );
    families.set(p.variant!.id, (families.get(p.variant!.id) ?? 0) + 1);
    if (p.variant!.id === "given-several") {
      several++;
      if (
        linePlotValues(r).some(
          (v) =>
            v > Math.min(...values) && v < Math.max(...values) && !counts[v],
        )
      )
        gaps++;
    }
    const legacy = generateProblemFor("line-plot-build", `build-${i}`, [
      "scenes-v1",
      "data-displays-v1",
    ]);
    assert.notEqual(legacy.variant!.id, "measure-and-plot");
  }
  for (const f of [
    "given-several",
    "given-repeated",
    "given-table",
    "measure-and-plot",
  ])
    assert.ok((families.get(f) ?? 0) >= 50, f);
  assert.ok(gaps / several >= 0.5);
  for (const f of families.keys()) {
    const sample = cases.find((p) => p.variant!.id === f)!;
    for (let i = 0; i < 100; i++)
      assert.deepEqual(
        generateProblem("line-plot-build", sample.public.seed),
        sample,
      );
  }
  const result = spawnSync(
    "python3",
    [
      "-c",
      "import json,sys; sys.path.insert(0,'scripts'); import line_plot_build_math_oracle as o; o.self_test(); cases=json.load(sys.stdin); [o.review_problem(p) for p in cases]; print(len(cases))",
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "1000");
});

test("capability, lesson and feedback text are integrated", () => {
  const template = templates.find((t) => t.id === "line-plot-build")!;
  assert.ok(responseCapabilities.includes("line-plot-build-v1"));
  assert.equal(
    clientCanDraw(template, {
      responseCapabilities: [],
      figureCapabilities: ["scenes-v1"],
    }),
    false,
  );
  assert.equal(
    clientCanDraw(template, {
      responseCapabilities: ["line-plot-build-v1"],
      figureCapabilities: ["scenes-v1"],
    }),
    true,
  );
  const lesson = problemLesson("line-plot-build", "lesson-build");
  assert.ok(lesson);
  assert.ok(
    !JSON.stringify(lesson).includes('\\"counts\\"'),
    "Lesson shows readable answer text",
  );
  assert.equal(lesson.example.figure?.kind, "scene");
  let tableExamples = 0;
  for (let i = 0; i < 20; i++) {
    const example = problemLesson(
      "line-plot-build",
      `table-lesson-${i}`,
    ).example;
    if (example.prompt.startsWith("These")) {
      tableExamples++;
      assert.match(example.prompt, /Lengths: [\d, ]+ (centimeters|inches)\./);
    }
  }
  assert.ok(tableExamples > 0);
  const p = generateProblem("line-plot-build", "print-example");
  const blank = renderToStaticMarkup(
    createElement(PrintExerciseBody, {
      number: 1,
      problem: p,
      solutions: false,
    }),
  );
  const solution = renderToStaticMarkup(
    createElement(PrintExerciseBody, {
      number: 1,
      problem: p,
      solutions: true,
    }),
  );
  assert.match(blank, /stroke="currentColor"/);
  assert.ok(!blank.includes('class="line-build-x"'));
  assert.ok(solution.includes('class="line-build-x" stroke="currentColor"'));
});
