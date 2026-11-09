import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import {
  PATTERNS,
  SHAPE_PHRASE,
  distributionContexts,
  distributionShapeFitTemplates,
  generateDistributionShapeFit,
  scatterContexts,
  shapeFamilies,
} from "../src/math/distribution-shape-fit-practice";

/**
 * Checks for describing a distribution (6.SP.A.2) and judging a trend line
 * (8.SP.A.2). Medians, ends, shapes, least-squares lines and distances are
 * recomputed here from the drawn data; nothing calls the generator's own
 * statistics. The Python oracle reviews 256 seeds of every template.
 */

const IDS = distributionShapeFitTemplates.map((t) => t.id);
const gen = (id: string, seed: string) =>
  generateDistributionShapeFit(id, seed);
const sample = (id: string, count: number, prefix = "s") =>
  Array.from({ length: count }, (_, i) => gen(id, `${prefix}-${i}`));

type Pt = [number, number];
function dotValues(scene: unknown): {
  min: number;
  max: number;
  values: number[];
} {
  const el = (scene as { elements: Record<string, unknown>[] }).elements[0]!;
  assert.equal(el.type, "dotPlot");
  const groups = el.groups as { values: number[] }[];
  return {
    min: el.min as number,
    max: el.max as number,
    values: groups[0]!.values,
  };
}
function stats(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  const median = (s[(n - 1) >> 1]! + s[n >> 1]!) / 2;
  return {
    n,
    min: s[0]!,
    max: s[n - 1]!,
    median,
    mean: s.reduce((a, b) => a + b, 0) / n,
  };
}
function graphOf(scene: unknown) {
  const el = (scene as { elements: Record<string, unknown>[] }).elements[0]!;
  assert.equal(el.type, "graph");
  const sc = el.scatter as { points: Pt[]; fit: { m: number; b: number } };
  return { points: sc.points, line: sc.fit, x: el.x as Pt, y: el.y as Pt };
}
function ls(points: Pt[]) {
  const n = points.length;
  const mx = points.reduce((a, p) => a + p[0], 0) / n;
  const my = points.reduce((a, p) => a + p[1], 0) / n;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (const [x, y] of points) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  const m = sxy / sxx;
  return { m, b: my - m * mx, r: sxy / Math.sqrt(sxx * syy) };
}
const dist = (points: Pt[], l: { m: number; b: number }) =>
  points.reduce((a, [x, y]) => a + Math.abs(y - (l.m * x + l.b)), 0);
const sideCounts = (points: Pt[], l: { m: number; b: number }) => ({
  above: points.filter(([x, y]) => y - (l.m * x + l.b) > 1e-9).length,
  below: points.filter(([x, y]) => y - (l.m * x + l.b) < -1e-9).length,
});
const keyOf = (p: GeneratedProblem) =>
  JSON.parse(p.answer) as Record<string, string>;
const labelOf = (p: GeneratedProblem, blank: string, key = keyOf(p)) => {
  const r = p.public.response;
  assert.equal(r.kind, "multi-part-choice");
  if (r.kind !== "multi-part-choice") throw new Error("parts");
  const b = r.blanks.find((x) => x.id === blank)!;
  return b.options.find((o) => o.id === key[blank])!.label;
};

test("every template is schema-valid and deterministic", () => {
  for (const id of IDS)
    for (let i = 0; i < 60; i++) {
      const p = gen(id, `det-${i}`);
      assert.ok(generatedProblemSchema.safeParse(p).success, `${id} det-${i}`);
      assert.deepEqual(gen(id, `det-${i}`), p);
      assert.equal(
        p.public.skillId,
        distributionShapeFitTemplates.find((t) => t.id === id)!.skillId,
      );
    }
});

test("the engine serves every template", async () => {
  const { generateProblem, templates } = await import("../src/math/engine");
  for (const id of IDS) {
    assert.ok(
      templates.some((t) => t.id === id),
      id,
    );
    assert.deepEqual(
      generateProblem(id, "engine-1").answer,
      gen(id, "engine-1").answer,
    );
  }
});

test("every dot-plot pattern has a whole middle value, 13 to 22 dots and a spread of 8 or 10", () => {
  for (const family of shapeFamilies)
    for (const pattern of PATTERNS[family]) {
      const values = pattern.flatMap((c, i) =>
        Array.from({ length: c }, () => i),
      );
      const s = stats(values);
      assert.ok(Number.isInteger(s.median), `${family} ${pattern}`);
      assert.ok(s.n >= 13 && s.n <= 22, `${family} ${pattern} n=${s.n}`);
      assert.ok([8, 10].includes(s.max - s.min), `${family} ${pattern}`);
      assert.ok(Math.max(...pattern) <= 6);
      // The eyeballed balance point is nearest the middle value.
      assert.ok(Math.abs(s.mean - s.median) < 1.5, `${family} ${pattern} mean`);
      const interiorZero = pattern.slice(1, -1).includes(0);
      assert.equal(
        interiorZero,
        family === "two-clusters",
        `${family} ${pattern}`,
      );
      if (family === "two-clusters") {
        const first = pattern.indexOf(0),
          last = pattern.lastIndexOf(0);
        assert.equal(s.median, (first + last) / 2, "center in the gap");
      }
    }
});

test("describe: center, spread and shape keyed from the plotted values", () => {
  const seen = new Set<string>();
  for (const p of sample("distribution-describe-dot-plot", 300)) {
    const fig = p.public.figure as { kind: "scene"; scene: unknown };
    const { min: lo, max: hi, values } = dotValues(fig.scene);
    const s = stats(values);
    const ctx = distributionContexts.find(
      (c) => c.id === p.variant!.axes!.context,
    )!;
    assert.ok(
      s.min >= ctx.low && s.max <= ctx.high,
      "inside the story's window",
    );
    assert.ok(
      lo >= 0 && lo < s.min && hi > s.max && hi - lo + 1 <= 17,
      "scale",
    );
    assert.equal(Number(labelOf(p, "center")), s.median);
    const r = p.public.response;
    if (r.kind !== "multi-part-choice") throw new Error("parts");
    for (const o of r.blanks[0]!.options)
      if (Number(o.label) !== s.median) {
        assert.ok(
          Math.abs(Number(o.label) - s.median) >= 3,
          "center distractor 3 away",
        );
        assert.ok(
          Math.abs(s.mean - Number(o.label)) > Math.abs(s.mean - s.median),
        );
      }
    assert.equal(
      labelOf(p, "spread"),
      `The values go from ${s.min} to ${s.max}, so they spread over ${s.max - s.min} ${ctx.unit}.`,
    );
    const claims = r.blanks[1]!.options.map((o) => {
      const m = /spread over (\d+)|spread is (\d+)/.exec(o.label)!;
      return Number(m[1] ?? m[2]);
    });
    assert.equal(new Set(claims).size, 4, "four different spread numbers");
    const family = p.variant!.axes!.shape as keyof typeof SHAPE_PHRASE;
    assert.equal(labelOf(p, "shape"), `The data are ${SHAPE_PHRASE[family]}.`);
    seen.add(`${family}/${ctx.id}`);
  }
  for (const f of shapeFamilies)
    for (const c of distributionContexts)
      assert.ok(seen.has(`${f}/${c.id}`), `${f}/${c.id}`);
});

test("match: one plot fits; the others are shifted by 3, narrower, or reshaped", () => {
  const families = new Set<string>();
  for (const p of sample("distribution-match-description", 300)) {
    const r = p.public.response;
    if (r.kind !== "figure-choice") throw new Error("figure choice");
    assert.equal(r.noun, "Graph");
    const m =
      /centered around (\d+), spread from (\d+) to (\d+), and (.+)\. Which dot plot/.exec(
        p.public.prompt,
      )!;
    const [c, a, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const plots = r.options.map((o) => ({
      id: o.id,
      ...dotValues(o.scene),
      s: stats(dotValues(o.scene).values),
    }));
    assert.equal(
      new Set(plots.map((x) => `${x.min}-${x.max}`)).size,
      1,
      "one scale",
    );
    assert.ok(plots[0]!.max - plots[0]!.min + 1 <= 14, "at most 14 ticks");
    const key = plots.find((x) => x.id === p.answer)!;
    assert.deepEqual([key.s.median, key.s.min, key.s.max], [c, a, b]);
    const others = plots.filter((x) => x.id !== p.answer);
    const sortedKey = [...key.values].sort((x, y) => x - y);
    assert.ok(
      others.some(
        (x) =>
          JSON.stringify(
            [...x.values].sort((u, v) => u - v).map((v) => v - 3),
          ) === JSON.stringify(sortedKey),
      ),
      "D1 is the same plot shifted by 3",
    );
    assert.ok(
      others.some((x) => x.s.median === c && b - a - (x.s.max - x.s.min) >= 3),
      "D2 is narrower with the same center",
    );
    assert.ok(
      others.some(
        (x) => x.s.min === a && x.s.max === b && x.s.median !== c + 3,
      ),
      "D3 keeps the ends",
    );
    families.add(p.variant!.axes!.shape!);
  }
  assert.equal(families.size, 5);
});

test("read and answer: exactly one complete description, lengths matched, key position spread", () => {
  const slots = new Map<string, number>();
  for (const p of sample("distribution-read-description", 400)) {
    const r = p.public.response;
    if (r.kind !== "choice") throw new Error("choice");
    const { values } = dotValues((p.public.figure as { scene: unknown }).scene);
    const s = stats(values);
    const family = p.variant!.axes!.shape as keyof typeof SHAPE_PHRASE;
    const right = `Centered around ${s.median}, spread from ${s.min} to ${s.max}, and ${SHAPE_PHRASE[family]}.`;
    assert.equal(r.options.filter((o) => o.label === right).length, 1);
    assert.equal(r.options.find((o) => o.id === p.answer)!.label, right);
    const lengths = r.options.map((o) => o.label.length);
    assert.ok(Math.max(...lengths) - Math.min(...lengths) <= 12);
    slots.set(p.answer, (slots.get(p.answer) ?? 0) + 1);
  }
  for (const id of ["option-a", "option-b", "option-c", "option-d"])
    assert.ok((slots.get(id) ?? 0) >= 60, id);
  for (const p of sample("statistical-question-distribution-answer", 300)) {
    const r = p.public.response;
    if (r.kind !== "multi-part-choice") throw new Error("parts");
    const { values } = dotValues((p.public.figure as { scene: unknown }).scene);
    const s = stats(values);
    assert.notEqual(s.n, s.median);
    assert.match(
      labelOf(p, "question"),
      /\beach (student|player|bean plant)\b/,
    );
    assert.ok(
      labelOf(p, "answer").startsWith(
        `Centered near ${s.median}, spread from ${s.min} to ${s.max}, `,
      ),
    );
    const lengths = r.blanks[1]!.options.map((o) => o.label.length);
    assert.ok(
      Math.max(...lengths) - Math.min(...lengths) <= 12,
      "answers within 12 characters",
    );
    for (const b of r.blanks)
      for (const o of b.options) assert.ok(o.label.length <= 80);
  }
});

test("best fit: one line near least squares, every distractor clearly worse and tagged", () => {
  const tags = new Map<string, number>();
  const slots = new Map<string, number>();
  const N = 300;
  for (const p of sample("trend-line-best-fit-choice", N)) {
    const r = p.public.response;
    if (r.kind !== "figure-choice") throw new Error("figure choice");
    const graphs = r.options.map((o) => ({ id: o.id, ...graphOf(o.scene) }));
    const points = graphs[0]!.points;
    assert.ok(
      points.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y)),
    );
    assert.ok(points.length >= 9 && points.length <= 12);
    for (const g of graphs) assert.deepEqual(g.points, points);
    const fit = ls(points);
    const ctx = scatterContexts.find((c) => c.id === p.variant!.axes!.context)!;
    assert.equal(Math.sign(fit.m), ctx.sign, "slope matches the story");
    assert.ok(Math.abs(fit.r) >= 0.85);
    const best = dist(points, fit);
    const key = graphs.find((g) => g.id === p.answer)!;
    const keySae = dist(points, key.line);
    assert.ok(keySae <= 1.2 * best + 1e-9);
    assert.equal(
      graphs.filter((g) => dist(points, g.line) <= 1.2 * best + 1e-9).length,
      1,
    );
    const s = sideCounts(points, key.line);
    assert.ok(Math.abs(s.above - s.below) <= 2);
    for (const g of graphs)
      if (g.id !== p.answer)
        assert.ok(dist(points, g.line) >= 1.8 * keySae - 1e-9);
    for (const t of p
      .variant!.id.split(
        /-(?=ceiling|floor|pivot-steep|pivot-flat|connect-dots|mean-line|origin|wrong-sign)/,
      )
      .slice(1))
      tags.set(t, (tags.get(t) ?? 0) + 1);
    slots.set(p.answer, (slots.get(p.answer) ?? 0) + 1);
  }
  for (const t of [
    "ceiling",
    "floor",
    "pivot-steep",
    "pivot-flat",
    "connect-dots",
    "mean-line",
    "origin",
    "wrong-sign",
  ])
    assert.ok((tags.get(t) ?? 0) > 0, t);
  assert.ok(
    (tags.get("wrong-sign") ?? 0) <= N / 5,
    "wrong sign at most 1 in 5",
  );
  for (const id of ["option-a", "option-b", "option-c", "option-d"])
    assert.ok((slots.get(id) ?? 0) >= 40, id);
});

test("fit assess: each variant's line has its property, and statements share a frame", () => {
  const counts = new Map<string, number>();
  const N = 400;
  for (const p of sample("trend-line-fit-assess", N)) {
    const r = p.public.response;
    if (r.kind !== "choice") throw new Error("choice");
    const { points, line } = graphOf(
      (p.public.figure as { scene: unknown }).scene,
    );
    const fit = ls(points);
    const s = sideCounts(points, line);
    const kind = p.variant!.axes!.fit!;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    if (kind === "good-fit") {
      assert.ok(dist(points, line) <= 1.2 * dist(points, fit) + 1e-9);
      assert.ok(Math.abs(s.above - s.below) <= 2);
    } else if (kind === "shifted")
      assert.ok(Math.max(s.above, s.below) >= points.length - 1);
    else if (kind === "tilted") {
      assert.ok(dist(points, line) >= 1.8 * dist(points, fit));
      assert.ok(Math.max(s.above, s.below) < points.length - 1);
    } else {
      assert.ok(
        Math.abs(line.m - fit.m) < 1e-9 && Math.abs(line.b - fit.b) < 1e-6,
        "curved clouds show the least-squares line",
      );
      assert.notEqual(p.variant!.axes!.context, "arm-span");
    }
    const lengths = r.options.map((o) => o.label.length);
    assert.ok(
      Math.max(...lengths) <= 1.25 * Math.min(...lengths),
      "lengths within 25%",
    );
  }
  const share = (k: string) => (counts.get(k) ?? 0) / N;
  assert.ok(Math.abs(share("good-fit") - 0.35) < 0.1);
  assert.ok(Math.abs(share("shifted") - 0.2) < 0.1);
  assert.ok(Math.abs(share("tilted") - 0.2) < 0.1);
  assert.ok(Math.abs(share("no-line") - 0.25) < 0.1);
});

test("the independent oracle reviews 256 seeds of every template", () => {
  const cases = IDS.flatMap((id) =>
    Array.from({ length: 256 }, (_, i) => gen(id, `independent-${i}`)),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      String.raw`
import json, sys
sys.path.insert(0, 'scripts')
import distribution_shape_fit_math_oracle as oracle
print(oracle.self_test())
cases = json.load(sys.stdin)
for problem in cases:
    assert oracle.review_problem(problem) == problem['answer'], problem['public']['seed']
    assert oracle.solve(problem['public']) == problem['answer']
print({'cases': len(cases)})
`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr || String(result.error));
  assert.match(result.stdout, /'cases': 1536/);
  assert.match(result.stdout, /'mutations': 7/);
});
