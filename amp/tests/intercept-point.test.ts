import { test } from "node:test";
import assert from "node:assert/strict";
import { sweep, optionLabel, variantsOf } from "./fixtures/algebra-kit-checks";

type Q = [number, number];
const q = (n: number, d = 1): Q => {
  if (d < 0) [n, d] = [-n, -d];
  const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a));
  const k = g(n, d) || 1;
  return [n / k, d / k];
};
const text = (v: Q) =>
  `${v[0] < 0 ? "−" : ""}${Math.abs(v[0])}${v[1] === 1 ? "" : `/${v[1]}`}`;
const pair = (x: Q, y: Q) => `(${text(x)}, ${text(y)})`;
const num = (s: string) => Number(s.replace("−", "-"));

/** The line a x + b y = c, read from what the learner sees. */
function lineOf(p: ReturnType<typeof sweep>[number]) {
  const prompt = p.public.prompt;
  const fig = p.public.figure;
  if (fig && fig.kind === "scene") {
    const g =
      JSON.parse(JSON.stringify(fig.scene)).elements?.[0] ??
      JSON.parse(JSON.stringify(fig.scene));
    const through = JSON.stringify(g).match(
      /"through":\[\[(-?\d+),(-?\d+)\],\[(-?\d+),(-?\d+)\]\]/,
    )!;
    const [x1, y1, x2, y2] = through.slice(1).map(Number) as [
      number,
      number,
      number,
      number,
    ];
    // (x1, 0) and (0, y2) on the line: y2 x + x1 y = x1 y2
    assert.equal(y1, 0);
    assert.equal(x2, 0);
    return { a: y2, b: x1, c: x1 * y2 };
  }
  const spans = [...prompt.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!);
  const body = spans
    .find((s) => / = /.test(s) && !/= 0$/.test(s))!
    .replace(/^f\(x\)/, "y");
  const slope = body.match(/^y = (−?)\\tfrac\{(\d+)\}\{(\d+)\}x ([+−]) (\d+)$/);
  if (slope) {
    const p = (slope[1] ? -1 : 1) * Number(slope[2]),
      d = Number(slope[3]),
      k = (slope[4] === "−" ? -1 : 1) * Number(slope[5]);
    return { a: -p, b: d, c: d * k };
  }
  const std = body.match(/^(−?\d*)x ([+−]) (\d*)y = (−?\d+)$/)!;
  const coeff = (s: string) => (s === "" ? 1 : s === "−" ? -1 : num(s));
  return {
    a: coeff(std[1]!),
    b: (std[2] === "−" ? -1 : 1) * coeff(std[3]!),
    c: num(std[4]!),
  };
}

test("intercept-point-choice: the keyed option is the intercept of the displayed line", () => {
  const problems = sweep("intercept-point-choice");
  for (const p of problems) {
    const { a, b, c } = lineOf(p);
    const x = q(c, a),
      y = q(c, b),
      zero = q(0);
    const variant = p.variant!.id;
    const ask = variant.replace(/^(graph|standard|slope-intercept)-/, "");
    const expected =
      ask === "y-intercept-point"
        ? pair(zero, y)
        : ask === "x-intercept-point"
          ? pair(x, zero)
          : ask === "zero-value"
            ? text(x)
            : text(q(x[0] * y[1] + y[0] * x[1], x[1] * y[1]));
    assert.equal(optionLabel(p), expected, `${p.public.seed} ${variant}`);
  }
});

test("intercept-point-choice: every form and question is reachable", () => {
  const seen = variantsOf(sweep("intercept-point-choice"));
  for (const form of ["graph", "standard", "slope-intercept"])
    for (const ask of [
      "y-intercept-point",
      "x-intercept-point",
      "zero-value",
      "intercept-sum",
    ])
      assert.ok(seen.has(`${form}-${ask}`), `${form}-${ask}`);
});

test("intercept-point-choice: fractional intercepts and negative slopes occur", () => {
  const problems = sweep("intercept-point-choice");
  assert.ok(problems.some((p) => /\/\d/.test(optionLabel(p))));
  assert.ok(problems.some((p) => p.hint.includes("falls")));
  assert.ok(problems.some((p) => p.hint.includes("rises")));
});

test("intercept-point-choice: hints vary and graphs draw a scene", () => {
  const problems = sweep("intercept-point-choice");
  const graphs = problems.filter((p) => p.variant!.id.startsWith("graph-"));
  assert.ok(graphs.length > 50);
  for (const p of graphs) assert.equal(p.public.figure?.kind, "scene");
  assert.ok(new Set(problems.map((p) => p.hint)).size > 100);
});
