import test from "node:test";
import assert from "node:assert/strict";
import { texasHsCase, texasHsTemplates } from "../src/math/texas-hs-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";
import { actualFacetMappings } from "../src/content/facet-mappings";

const SEEDS = 400;
const ids = texasHsTemplates.map((t) => t.id);

type Generated = ReturnType<typeof generateProblem>;
function parts(g: Generated) {
  const response = g.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice expected");
  const labels = response.options.map((o) => o.label);
  const correct = response.options.find((o) => o.id === g.answer)!.label;
  const wrong = response.options
    .filter((o) => o.id !== g.answer)
    .map((o) => o.label);
  return { labels, correct, wrong, prompt: g.public.prompt };
}
const maths = (text: string) =>
  [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!);

/** Minimal TeX-to-JavaScript evaluator for the small expressions these prompts contain. */
function js(tex: string): string {
  let s = tex.replace(/\\left|\\right/g, "").replace(/\\cdot/g, "*");
  const frac = /\\d?frac\{([^{}]*)\}\{([^{}]*)\}/;
  while (frac.test(s)) s = s.replace(frac, "(($1)/($2))");
  s = s.replace(/(\d)\s*(?=[xyk(])/g, "$1*");
  s = s.replace(/\)\s*(?=[xyk(\d])/g, ")*");
  s = s.replace(/([xyk])\s*(?=[(xyk\d])/g, "$1*");
  s = s.replace(/(\([^()]*\)|[xyk\d.]+)\^\{([^{}]*)\}/g, "Math.pow($1,$2)");
  s = s.replace(/(\([^()]*\)|[xyk\d.]+)\^(\d)/g, "Math.pow($1,$2)");
  return s;
}
const fn = (tex: string) =>
  new Function("x", "y", "k", `return (${js(tex)});`) as (
    x: number,
    y: number,
    k: number,
  ) => number;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test("every Texas high-school template is registered, deterministic and has four distinct choices with one correct", () => {
  for (const id of ids) {
    const template = templates.find((t) => t.id === id);
    assert.ok(template, id);
    assert.equal(template.requiredResponseCapability, "single-choice-v1");
    for (let seed = 0; seed < SEEDS; seed++) {
      const a = generateProblem(id, `tx:${seed}`);
      const b = generateProblem(id, `tx:${seed}`);
      assert.deepEqual(a, b, `${id} ${seed}`);
      assert.equal(a.public.seed, `tx:${seed}`);
      assert.equal(a.public.skillId, template.skillId);
      const { labels, correct, prompt } = parts(a);
      assert.equal(labels.length, 4, `${id} ${seed}`);
      assert.equal(new Set(labels).size, 4, `${id} ${seed}: ${labels}`);
      assert.equal(labels.filter((l) => l === correct).length, 1);
      assert.ok(!prompt.includes(correct), `${id} ${seed}: prompt leaks`);
      assert.ok(!a.hint.includes(correct), `${id} ${seed}: hint leaks`);
      assert.ok(a.hint.length > 20 && a.explanation.length >= 2);
      assert.equal(Object.keys(a.choiceFeedback ?? {}).length, 3);
      for (const text of Object.values(a.choiceFeedback ?? {}))
        assert.ok(text.length > 10);
      if (id === "graph-estimate-system-solution")
        assert.equal(a.public.figure?.kind, "scene", `${id} ${seed}`);
    }
  }
});

const expectedVariants: Record<string, string[]> = {
  "line-equation-forms": [
    "point-slope",
    "slope-intercept-from-point",
    "slope-intercept-from-two-points",
    "standard-form-from-two-points",
    "standard-form-from-slope-intercept",
    "point-slope-from-two-points",
  ],
  "line-relationship-equations": [
    "parallel-slope-intercept",
    "perpendicular-slope-intercept",
    "parallel-standard-form",
    "perpendicular-standard-form",
    "horizontal-through-point",
    "vertical-through-point",
    "slope-of-vertical",
    "slope-of-horizontal",
    "axis-parallel-relationship",
  ],
  "system-equation-choice": [
    "system-from-description",
    "system-from-tables",
    "system-from-graph",
    "system-from-counts",
  ],
  "graph-estimate-system-solution": [
    "crossing-between-gridlines",
    "crossing-on-gridlines",
  ],
  "exponential-domain-range": [
    "shifted-exponential",
    "reflected-exponential",
    "growth-model-domain",
    "decay-model-domain",
  ],
  "absolute-value-equation-formulate": [
    "distance-on-number-line",
    "equation-from-solutions",
    "tolerance-situation",
  ],
  "rational-equation-formulate": [
    "work-together",
    "current-speed",
    "two-speeds",
  ],
  "rational-exponent-equation": [
    "even-numerator-two-solutions",
    "single-solution",
    "even-root-domain",
    "negative-right-side",
  ],
  "transformation-composition-image": [
    "rigid-then-dilation",
    "dilation-then-rigid",
  ],
  "counterexample-choice": [
    "rhombus-not-square",
    "equal-area-triangles",
    "equal-perimeter-rectangles",
    "ssa-ambiguous",
    "equal-diagonals",
  ],
  "spherical-geometry-compare": [
    "parallel-lines",
    "angle-sum",
    "shortest-path",
    "right-angles",
  ],
  "regular-polygon-area": [
    "hexagon-from-side",
    "hexagon-apothem",
    "square-from-apothem",
    "triangle-from-side",
    "decimal-polygon-area",
    "missing-side-from-area",
  ],
  "curved-solid-surface-area": [
    "cone-given-slant",
    "cone-given-height",
    "cylinder-with-hemisphere",
    "cone-on-cylinder",
    "cone-with-hemisphere",
  ],
  "area-probability": [
    "circle-in-square",
    "rectangle-in-rectangle",
    "ring-region",
    "triangle-in-rectangle",
    "outside-the-circle",
  ],
  "composition-order-choice": [
    "linear-pair",
    "linear-quadratic",
    "scalings-commute",
    "shifts-commute",
  ],
  "one-sided-behavior-choice": [
    "odd-multiplicity-asymptote",
    "even-multiplicity-asymptote",
    "hole",
    "jump",
  ],
  "parametric-rectangular-convert": [
    "linear-eliminate",
    "parabola-eliminate",
    "circle-eliminate",
    "write-parametric",
  ],
  "angular-velocity-problem": [
    "angular-speed-from-rpm",
    "linear-speed-of-rim",
    "angular-speed-from-linear",
    "distance-in-time",
    "rpm-to-radians-per-second",
  ],
  "reference-angle-standard-position": [
    "reference-degrees",
    "reference-radians",
    "quadrant-degrees",
    "quadrant-radians",
    "coterminal",
  ],
  "bearing-trig-problem": [
    "bearing-east-west",
    "bearing-north-south",
    "bearing-from-legs",
    "compass-bearing-component",
  ],
  "sigma-notation-represent": ["arithmetic-series", "geometric-series"],
  "infinite-geometric-sum": [
    "listed-series",
    "sigma-series",
    "sigma-starting-at-second-term",
    "ratio-too-large",
    "bouncing-ball",
  ],
  "polynomial-inequality-solve": [
    "two-roots",
    "three-roots",
    "repeated-root",
    "factor-then-solve",
  ],
  "rational-inequality-solve": [
    "single-fraction",
    "two-numerator-factors",
    "two-denominator-factors",
    "squared-denominator",
  ],
};

test("every variant of every template is reachable over seeds", () => {
  for (const id of ids) {
    const seen = new Set<string>();
    for (let seed = 0; seed < SEEDS; seed++)
      seen.add(texasHsCase(id, `tx:${seed}`).variant);
    assert.deepEqual([...seen].sort(), [...expectedVariants[id]!].sort(), id);
  }
});

// ----- Independent oracles ---------------------------------------------------

test("line equations: the correct choice contains the given geometry and every other choice fails it", () => {
  const id = "line-equation-forms";
  for (let seed = 0; seed < SEEDS; seed++) {
    const g = generateProblem(id, `line:${seed}`);
    const { correct, wrong, prompt } = parts(g);
    // Points the line must contain, from the prompt or from the given equation.
    const required: [number, number][] = [];
    let slope: number | null = null;
    const pts = [...prompt.matchAll(/\((-?\d+), (-?\d+)\)/g)].map(
      (m) => [Number(m[1]), Number(m[2])] as [number, number],
    );
    const given = /A line is \$y=([^$]+)\$/.exec(prompt);
    if (given) {
      const f = fn(given[1]!);
      for (const x of [0, 3, -3]) required.push([x, f(x, 0, 0)]);
    } else required.push(...pts.slice(0, 2));
    const m = /slope \$(-?\d+)\$/.exec(prompt);
    if (m) slope = Number(m[1]);
    const holds = (label: string) => {
      const [left, right] = label.replace(/^\$|\$$/g, "").split("=");
      const e = (x: number, y: number) =>
        fn(left!)(x, y, 0) - fn(right!)(x, y, 0);
      const zero = required.every(([x, y]) => near(e(x, y), 0));
      if (!zero) return false;
      if (slope !== null)
        return near(e(required[0]![0] + 1, required[0]![1] + slope), 0);
      return true;
    };
    // Standard form must be scaled to have the same zero set; compare ratios for the pass-through check.
    assert.ok(holds(correct), `${seed}: ${prompt} => ${correct}`);
    for (const w of wrong)
      assert.ok(!holds(w), `${seed}: ${prompt} wrong ${w}`);
  }
});

type Seg = [number, number, boolean, boolean];
function parseIntervals(label: string): Seg[] {
  const body = label.replace(/^\$|\$$/g, "");
  if (body === "\\varnothing") return [];
  return body.split("\\cup").map((part) => {
    const point = /^\\\{(-?\d+)\\\}$/.exec(part);
    if (point) return [Number(point[1]), Number(point[1]), true, true] as Seg;
    const m = /^([(\[])(-?\\infty|-?\d+),(-?\\infty|-?\d+)([)\]])$/.exec(part)!;
    const num = (t: string) =>
      t === "-\\infty" ? -Infinity : t === "\\infty" ? Infinity : Number(t);
    return [num(m[2]!), num(m[3]!), m[1] === "[", m[4] === "]"] as Seg;
  });
}
const inSegs = (segs: Seg[], x: number) =>
  segs.some(
    ([lo, hi, lc, hc]) =>
      (x > lo || (lc && x === lo)) && (x < hi || (hc && x === hi)),
  );

test("polynomial and rational inequalities: solution sets match brute-force evaluation", () => {
  for (const id of [
    "polynomial-inequality-solve",
    "rational-inequality-solve",
  ]) {
    for (let seed = 0; seed < SEEDS; seed++) {
      const g = generateProblem(id, `ineq:${seed}`);
      const { correct, wrong, prompt } = parts(g);
      const stmt = /^Solve \$(.+?)(<|>|\\le|\\ge)0\$\./.exec(prompt)!;
      const rel = stmt[2]!;
      const f = fn(stmt[1]!);
      const sat = (x: number) => {
        const v = f(x, 0, 0);
        if (!Number.isFinite(v)) return false;
        return rel === "<"
          ? v < 0
          : rel === ">"
            ? v > 0
            : rel === "\\le"
              ? v <= 1e-12
              : v >= -1e-12;
      };
      const points: number[] = [];
      for (let x = -9; x <= 9; x += 0.5) points.push(x);
      for (let x = -9; x <= 9; x += 1) points.push(x);
      const mine = parseIntervals(correct);
      for (const x of points)
        assert.equal(
          inSegs(mine, x),
          sat(x),
          `${seed}: ${prompt} at ${x}: ${correct}`,
        );
      for (const w of wrong) {
        const segs = parseIntervals(w);
        assert.ok(
          points.some((x) => inSegs(segs, x) !== sat(x)),
          `${seed}: ${prompt} wrong ${w} is also correct`,
        );
      }
    }
  }
});

test("reference angles and coterminal angles match direct modular arithmetic", () => {
  let checked = 0;
  for (let seed = 0; seed < SEEDS; seed++) {
    const g = generateProblem(
      "reference-angle-standard-position",
      `ref:${seed}`,
    );
    const { correct, prompt } = parts(g);
    const deg = /angle of \$(-?\d+)\^\\circ\$, the acute/.exec(prompt);
    const co = /coterminal with \$(-?\d+)\^\\circ\$/.exec(prompt);
    if (deg) {
      const t = ((Number(deg[1]) % 360) + 360) % 360;
      const ref = Math.min(t % 180, 180 - (t % 180));
      assert.equal(correct, `$${ref}^\\circ$`);
      checked++;
    }
    if (co) {
      assert.equal(correct, `$${((Number(co[1]) % 360) + 360) % 360}^\\circ$`);
      checked++;
    }
  }
  assert.ok(checked > 50);
});

test("rational exponent equations: the correct choice is exactly the real solution set", () => {
  const power = (x: number, p: number, q: number) => {
    if (q % 2 === 0 && x < 0) return NaN;
    return (
      Math.pow(Math.cbrt(x), 1) &&
      (q % 2 === 1 ? Math.sign(x) * Math.abs(x) ** (1 / q) : x ** (1 / q)) ** p
    );
  };
  for (let seed = 0; seed < SEEDS; seed++) {
    const g = generateProblem("rational-exponent-equation", `rx:${seed}`);
    const { correct, prompt } = parts(g);
    const m = /x\^\{\\frac\{(\d+)\}\{(\d+)\}\}=(-?\d+)/.exec(prompt)!;
    const [p, q, k] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const truth: number[] = [];
    for (let x = -1300; x <= 1300; x++)
      if (Math.abs(power(x, p, q) - k) < 1e-6) truth.push(x);
    const label = [...correct.matchAll(/x=(-?\d+)/g)]
      .map((v) => Number(v[1]))
      .sort((a, b) => a - b);
    assert.deepEqual(label, truth, `${seed}: ${prompt}`);
  }
});

test("sigma notation: the correct choice reproduces the listed terms and every other choice does not", () => {
  const terms = (label: string) => {
    const m = /\\sum_\{k=(\d+)\}\^\{(\d+)\}(.+)\$$/.exec(label)!;
    let f: ReturnType<typeof fn>;
    try {
      f = fn(m[3]!);
    } catch (e) {
      throw new Error(`${label} -> ${js(m[3]!)}: ${e}`);
    }
    const out: number[] = [];
    for (let k = Number(m[1]); k <= Number(m[2]); k++) out.push(f(0, 0, k));
    return out;
  };
  for (let seed = 0; seed < SEEDS; seed++) {
    const g = generateProblem("sigma-notation-represent", `sg:${seed}`);
    const { correct, wrong, prompt } = parts(g);
    const series = /series \$(.+?)\$, which has (\d+) terms/.exec(prompt)!;
    const nums = [
      ...series[1]!.replace(/\\cdots/, "#").matchAll(/(-|\+)?\s*(\d+)|#/g),
    ];
    const listed: (number | "#")[] = [];
    let sign = 1;
    for (const t of nums) {
      if (t[0] === "#") listed.push("#");
      else
        listed.push(
          Number(t[2]) *
            ((t[1] ?? (listed.length ? "+" : "+")) === "-" ? -1 : 1),
        );
      void sign;
    }
    const n = Number(series[2]);
    const want = (arr: number[]) =>
      arr.length === n &&
      listed.every((v, i) =>
        v === "#"
          ? true
          : i < listed.indexOf("#")
            ? arr[i] === v
            : arr[n - (listed.length - i)] === v,
      );
    assert.ok(want(terms(correct)), `${seed}: ${prompt} => ${correct}`);
    for (const w of wrong)
      assert.ok(!want(terms(w)), `${seed}: ${prompt} wrong ${w}`);
  }
});

test("infinite geometric sums agree with long partial sums", () => {
  let checked = 0;
  for (let seed = 0; seed < SEEDS; seed++) {
    const g = generateProblem("infinite-geometric-sum", `ig:${seed}`);
    const { correct, prompt } = parts(g);
    const sig =
      /\\sum_\{k=(\d)\}\^\{\\infty\}(\d+)\\left\((-?)\\frac\{(\d+)\}\{(\d+)\}\\right\)\^\{(k-1|k)\}/.exec(
        prompt,
      );
    if (!sig) continue;
    const [lo, c, neg, a, b, expo] = [
      Number(sig[1]),
      Number(sig[2]),
      sig[3] === "-" ? -1 : 1,
      Number(sig[4]),
      Number(sig[5]),
      sig[6]!,
    ];
    const r = (neg * a) / b;
    let total = 0;
    for (let k = lo; k < lo + 400; k++)
      total += c * r ** (expo === "k" ? k : k - 1);
    const label = /^\$(-?)\\dfrac\{(\d+)\}\{(\d+)\}\$$|^\$(-?\d+)\$$/.exec(
      correct,
    )!;
    const value =
      label[4] !== undefined
        ? Number(label[4])
        : (label[1] ? -1 : 1) * (Number(label[2]) / Number(label[3]));
    assert.ok(
      Math.abs(value - total) < 1e-9,
      `${seed}: ${prompt} => ${correct} vs ${total}`,
    );
    checked++;
  }
  assert.ok(checked > 20);
});

test("lessons, principles and facet mappings are bound to every template", () => {
  for (const id of ids) {
    const template = templates.find((t) => t.id === id)!;
    const lesson = problemLesson(id, "seed");
    assert.ok(
      lesson.intuition &&
        lesson.method.length >= 2 &&
        lesson.watch &&
        lesson.principle,
      id,
    );
    assert.ok(lesson.example.steps.length >= 2);
    const mapping = actualFacetMappings.find((m) => m.templateId === id);
    assert.equal(mapping?.extent, "partial", id);
    assert.equal(mapping?.facetId, `${template.skillId}.core`);
    assert.match(mapping?.rationale ?? "", /Does not assess/);
  }
});
