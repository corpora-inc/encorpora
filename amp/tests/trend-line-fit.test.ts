import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
  templates,
} from "../src/math/engine";
import {
  clientCanDraw,
  generatedProblemSchema,
  problemResponseSchema,
  responseCapabilities,
} from "../src/math/contracts";
import {
  acceptsTrendLine,
  normalizeTrendLine,
  trendLineFeedback,
  trendStatistics,
  throughTrendPoints,
  initialTrendPoints,
  type TrendLineFitResponse,
} from "../src/math/trend-line-fit";
import { responseGuessChance, guessChance } from "../src/math/guess-chance";
import { problemLesson } from "../src/content/problem-lessons";
import { PrintExerciseBody } from "../src/content/print-exercise";

const ids = ["trend-line-fit", "trend-line-compare", "trend-line-read"];
function fit(seed: string) {
  const p = generateProblem("trend-line-fit", seed);
  assert.equal(p.public.response.kind, "trend-line-fit");
  return { p, r: p.public.response as TrendLineFitResponse };
}
test("500 deterministic clouds have both trends, six contexts, reachable hand fits and honest guessing", () => {
  const seen = new Set<string>(),
    contexts = new Set<string>();
  let negative = 0,
    greatest = 0,
    smallest = 1;
  for (let i = 0; i < 500; i++) {
    const { p, r } = fit(`fit-audit-${i}`);
    assert.deepEqual(p, generateProblem("trend-line-fit", `fit-audit-${i}`));
    assert.ok(generatedProblemSchema.safeParse(p).success);
    seen.add(JSON.stringify(r.data));
    contexts.add(p.variant!.axes!.context!);
    const g = r.grid,
      data = r.data;
    // Independent normal-equation calculation and direct squared residuals.
    const n = data.length,
      sx = data.reduce((s, [x]) => s + x, 0),
      sy = data.reduce((s, [, y]) => s + y, 0);
    const sxx = data.reduce((s, [x]) => s + x * x, 0),
      sxy = data.reduce((s, [x, y]) => s + x * y, 0);
    const m = (n * sxy - sx * sy) / (n * sxx - sx * sx),
      b = (sy - m * sx) / n;
    const minimum = data.reduce((s, [x, y]) => s + (y - m * x - b) ** 2, 0) / n;
    const variance = sxx / n - (sx / n) ** 2;
    if (m < 0) negative++;
    assert.ok(data.length >= 9 && data.length <= 12);
    assert.ok(m < 0 === ["car", "tv"].includes(p.variant!.axes!.context!));
    const syy = data.reduce((s, [, y]) => s + (y - sy / n) ** 2, 0);
    assert.ok(
      Math.abs(
        (sxy - (sx * sy) / n) / Math.sqrt((sxx - (sx * sx) / n) * syy),
      ) >= 0.85,
    );
    assert.ok(gradeAnswer(p, p.answer));
    const key = JSON.parse(p.answer);
    assert.ok(gradeAnswer(p, JSON.stringify([...key].reverse())));
    // Exhaust the uniform domain: choose two distinct x columns, then one
    // y lattice value independently for each. Ordered handles double both
    // counts, so swapping does not change the chance. Use sufficient sums
    // independently of the production grader for the quadratic inequality.
    let all = 0,
      passes = 0,
      spreadFits = 0;
    for (let x = g.xMin; x <= g.xMax; x += g.xStep)
      for (let u = x + g.xStep; u <= g.xMax; u += g.xStep)
        for (let y = g.yMin; y <= g.yMax; y += g.yStep)
          for (let v = g.yMin; v <= g.yMax; v += g.yStep) {
            all++;
            const mm = (v - y) / (u - x),
              bb = y - mm * x;
            if (mm / m < 0.65 || mm / m > 1.5) continue;
            if (
              (mm - m) ** 2 * variance + ((mm * sx) / n + bb - sy / n) ** 2 <=
              0.6 * minimum + 1e-9
            ) {
              passes++;
              if (
                x <= g.xMin + (g.xMax - g.xMin) / 3 &&
                u >= g.xMax - (g.xMax - g.xMin) / 3
              )
                spreadFits++;
            }
          }
    greatest = Math.max(greatest, passes / all);
    smallest = Math.min(smallest, passes / all);
    assert.ok(passes / all <= responseGuessChance(r), `${i}: ${passes / all}`);
    assert.ok(
      spreadFits >= 15,
      `${i}: only ${spreadFits} reachable spread pairs`,
    );
    let near = 0;
    for (let j = 0; j <= 40; j++) {
      const mm = m * (0.8 + j * 0.01);
      if (acceptsTrendLine(data, { m: mm, b: sy / n - (mm * sx) / n })) near++;
    }
    assert.ok(
      near / 41 >= 0.25,
      `${i}: hand-fit slope neighborhood too narrow`,
    );
    for (const factor of [-1, 0, 0.4, 2])
      assert.equal(
        acceptsTrendLine(data, {
          m: factor * m,
          b: sy / n - (factor * m * sx) / n,
        }),
        false,
      );
    for (const direction of [-1, 1])
      assert.equal(
        acceptsTrendLine(data, {
          m,
          b:
            b +
            direction *
              Math.max(...data.map(([x, y]) => Math.abs(y - m * x - b))) *
              1.1,
        }),
        false,
      );
    const ends = throughTrendPoints([data[0]!, data.at(-1)!]);
    if (
      data.reduce((s, [x, y]) => s + (y - ends.m * x - ends.b) ** 2, 0) / n >
      1.6 * minimum + 1e-8
    )
      assert.equal(acceptsTrendLine(data, ends), false);
  }
  assert.ok(seen.size >= 450);
  assert.equal(contexts.size, 6);
  assert.ok(negative >= 167 && negative <= 300);
  console.log(
    `Uniform random-line pass range: ${(smallest * 100).toFixed(3)}%–${(greatest * 100).toFixed(3)}%; declared ceiling 5%.`,
  );
});
test("schemas, validation, normalization, diagnoses and capability negotiation", () => {
  const { p, r } = fit("validation"),
    points = initialTrendPoints(r);
  assert.ok(responseCapabilities.includes("trend-line-fit-v1"));
  const meta = templates.find((t) => t.id === p.public.templateId)!;
  assert.equal(
    clientCanDraw(meta, {
      responseCapabilities: ["point-plot-v1"],
      figureCapabilities: ["scenes-v1"],
    }),
    false,
  );
  assert.equal(
    clientCanDraw(meta, {
      responseCapabilities: ["trend-line-fit-v1"],
      figureCapabilities: [],
    }),
    true,
  );
  assert.equal(guessChance(meta), 0.05);
  assert.equal(isValidResponse(p.public, JSON.stringify(points)), true);
  assert.equal(gradeAnswer(p, JSON.stringify(points)), false);
  assert.ok(trendLineFeedback(r, JSON.stringify(points)).length);
  for (const raw of [
    "",
    "null",
    "[]",
    "{}",
    JSON.stringify([points[0], points[0]]),
    JSON.stringify([
      [points[0][0], r.grid.yMin],
      [points[0][0], r.grid.yMax],
    ]),
    JSON.stringify([[0.5, 0.5], points[1]]),
    JSON.stringify([[1e20, 2], points[1]]),
    "x".repeat(101),
  ])
    assert.equal(normalizeTrendLine(r, raw), null, raw);
  assert.equal(
    problemResponseSchema.safeParse({ ...r, answer: p.answer }).success,
    false,
  );
  assert.equal(
    problemResponseSchema.safeParse({ ...r, guessChance: 0 }).success,
    false,
  );
  assert.equal(
    generatedProblemSchema.safeParse({ ...p, answer: JSON.stringify(points) })
      .success,
    false,
  );
});
test("all three types pass the independent rational oracle and reject corrupt keys", () => {
  const cases = ids.flatMap((id) =>
    Array.from({ length: 200 }, (_, i) => generateProblem(id, `oracle-${i}`)),
  );
  for (const p of cases)
    assert.ok(generatedProblemSchema.safeParse(p).success, p.public.templateId);
  const result = spawnSync(
    "python3",
    ["scripts/trend_line_fit_math_oracle.py"],
    { input: JSON.stringify(cases), encoding: "utf8", maxBuffer: 10_000_000 },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    JSON.parse(result.stdout),
    cases.map((p) => p.answer),
  );
  const corrupt = structuredClone(cases[0]!);
  const r = corrupt.public.response as TrendLineFitResponse;
  corrupt.answer = JSON.stringify(initialTrendPoints(r));
  const rejected = spawnSync(
    "python3",
    ["scripts/trend_line_fit_math_oracle.py"],
    { input: JSON.stringify([corrupt]), encoding: "utf8" },
  );
  assert.notEqual(rejected.status, 0);
  const positions = cases.filter(
    (p) => p.public.templateId === "trend-line-compare",
  );
  assert.ok(positions.filter((p) => p.answer === "option-a").length >= 70);
  assert.ok(positions.filter((p) => p.answer === "option-b").length >= 70);
  assert.equal(new Set(positions.map((p) => p.variant!.id)).size, 5);
});
test("lessons and print show one scatter surface and human-readable answers", () => {
  for (const id of ids) {
    const p = generateProblem(id, "print");
    const lesson = problemLesson(id, "print");
    assert.ok(lesson);
    for (const solutions of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(PrintExerciseBody, { number: 1, problem: p, solutions }),
      );
      assert.ok(html.includes("svg"));
      assert.ok(!html.includes("trend-handle"));
      assert.ok(
        !html.includes("square handles"),
        "Paper uses a device-neutral instruction",
      );
      if (id === "trend-line-fit")
        assert.equal((html.match(/<svg\s/g) ?? []).length, 1);
    }
  }
});
