import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";
import {
  CONVENTIONAL,
  goodInterval,
  graphChoiceFamily,
  inverseFamily,
  oneToOneFamily,
  piecesFor,
  restrictionFamily,
  whyFamily,
  whyParts,
  type Fn,
  type Interval,
} from "../src/math/trig-inverse-restriction-practice";

/** HSF.TF.B.6 types: monotonicity, ranges and inverse values recomputed by
 * sampling the functions themselves. */
const N = 1000;
const seeds = Array.from({ length: N }, (_, i) => `tir-${i}`);
const tally = (m: Map<string, number>, k: string) =>
  m.set(k, (m.get(k) ?? 0) + 1);
const F: Record<Fn, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
};
const HALF = Math.PI / 2;

/** Strictly monotonic on the open interval, with no asymptote inside. */
function monotonic(fn: Fn, lo: number, hi: number): boolean {
  const n = 4000;
  const xs = Array.from(
    { length: n - 1 },
    (_, i) => lo + ((hi - lo) * (i + 1)) / n,
  );
  if (
    fn === "tan" &&
    xs.some(
      (x, i) =>
        i > 0 && Math.sign(Math.cos(x)) !== Math.sign(Math.cos(xs[i - 1]!)),
    )
  )
    return false;
  const ys = xs.map(F[fn]);
  const up = ys.every((y, i) => i === 0 || y > ys[i - 1]!);
  const down = ys.every((y, i) => i === 0 || y < ys[i - 1]!);
  return up || down;
}
/** Takes every value of the function's range on the interval. */
function onto(fn: Fn, lo: number, hi: number): boolean {
  if (fn === "tan") {
    const a = Math.tan(lo + 1e-7),
      b = Math.tan(hi - 1e-7);
    return Math.min(a, b) < -1e5 && Math.max(a, b) > 1e5;
  }
  const ys = Array.from({ length: 4001 }, (_, i) =>
    F[fn](lo + ((hi - lo) * i) / 4000),
  );
  return Math.max(...ys) > 1 - 1e-6 && Math.min(...ys) < -1 + 1e-6;
}
const works = (fn: Fn, i: Interval) =>
  monotonic(fn, i.lo * HALF, i.hi * HALF) && onto(fn, i.lo * HALF, i.hi * HALF);

/** A multiple of π in TeX: "-\\frac{3\\pi}{2}", "2\\pi", "0". */
function piValue(tex: string): number {
  const s = tex.trim();
  if (s === "0") return 0;
  const sign = s.startsWith("-") ? -1 : 1;
  const body = s.replace(/^-/, "");
  const f = /^\\frac\{(\d*)\\pi\}\{(\d+)\}$/.exec(body);
  if (f) return (sign * Number(f[1] || 1) * Math.PI) / Number(f[2]);
  const w = /^(\d*)\\pi$/.exec(body);
  if (w) return sign * Number(w[1] || 1) * Math.PI;
  throw new Error(`Not a multiple of π: ${tex}`);
}
/** An interval written "$\\left[a, b\\right]$" or with open ends. */
function intervalOf(label: string) {
  const m = /^\$\\left([[(])(.*), (.*)\\right([\])])\$$/.exec(label);
  if (!m) throw new Error(`Not an interval: ${label}`);
  return {
    lo: piValue(m[2]!),
    hi: piValue(m[3]!),
    loOpen: m[1] === "(",
    hiOpen: m[4] === ")",
  };
}
/** A special value in TeX: "-\\frac{\\sqrt{3}}{2}", "\\sqrt{3}", "1". */
function specialValue(tex: string): number {
  const s = tex.replace(/\\left\(|\\right\)|[$()]/g, "").trim();
  const sign = s.startsWith("-") ? -1 : 1;
  const body = s.replace(/^-/, "");
  const sq = (t: string) => {
    const r = /^\\sqrt\{(\d)\}$/.exec(t);
    return r ? Math.sqrt(Number(r[1])) : Number(t);
  };
  const f = /^\\frac\{([^}]*\}?)\}\{(\d+)\}$/.exec(body);
  return sign * (f ? sq(f[1]!) / Number(f[2]) : sq(body));
}

test("the same seed gives the same problem", () => {
  for (const id of [
    "trig-restriction-domain",
    "trig-restriction-domain-graph",
    "trig-one-to-one-intervals",
    "restricted-trig-inverse",
    "trig-inverse-why-restrict",
  ])
    for (const seed of ["a", "b", "17"])
      assert.deepEqual(generateProblem(id, seed), generateProblem(id, seed));
});

test("every good interval is monotonic and onto; every half piece, turning piece and full period fails", () => {
  const ks: Record<Fn, number[]> = {
    sin: [-1, 0, 1],
    cos: [-2, -1, 0, 1],
    tan: [-1, 0, 1],
  };
  for (const fn of ["sin", "cos", "tan"] as const) {
    assert.ok(works(fn, CONVENTIONAL[fn]));
    for (const k of ks[fn]) {
      for (const p of piecesFor(fn, k)) {
        const i = p.interval;
        assert.ok(
          i.lo >= (fn === "tan" ? -3 : -4) && i.hi <= (fn === "tan" ? 3 : 4),
        );
        assert.equal(works(fn, i), p.kind === "good", `${fn} ${k} ${p.kind}`);
        if (p.kind === "half")
          assert.ok(monotonic(fn, i.lo * HALF, i.hi * HALF));
        // Turning pieces and full periods are not one-to-one.
        if (p.kind === "turning" || p.kind === "period")
          assert.equal(monotonic(fn, i.lo * HALF, i.hi * HALF), false);
      }
    }
  }
});

test("interval choices key a working, non-usual interval or the convention", () => {
  const variants = new Map<string, number>();
  for (const seed of seeds.slice(0, 600)) {
    const { model: m, problem: p } = restrictionFamily.generate(seed);
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    tally(variants, p.variant!.id);
    const r = p.public.response;
    if (r.kind !== "choice") assert.fail("single choice");
    const key = r.options.find((o) => o.id === p.answer)!.label;
    if (m.family === "another-interval") {
      assert.notEqual(m.k, 0);
      for (const o of r.options) {
        const i = intervalOf(o.label);
        const ok = monotonic(m.fn, i.lo, i.hi) && onto(m.fn, i.lo, i.hi);
        assert.equal(ok, o.id === p.answer, o.label);
      }
    } else {
      const usual = {
        sin: [-HALF, HALF],
        cos: [0, Math.PI],
        tan: [-HALF, HALF],
      }[m.fn];
      const i = intervalOf(key);
      assert.ok(
        Math.abs(i.lo - usual[0]!) < 1e-12 &&
          Math.abs(i.hi - usual[1]!) < 1e-12,
      );
      assert.equal(i.loOpen && i.hiOpen, m.fn === "tan");
    }
  }
  for (const v of [
    "another-interval-sin",
    "another-interval-cos",
    "another-interval-tan",
    "convention-sin",
    "convention-cos",
    "convention-tan",
  ])
    assert.ok((variants.get(v) ?? 0) / 600 >= 0.03, v);
});

test("graph choices key the working piece; the usual interval is keyed in at most 35% of problems", () => {
  const variants = new Map<string, number>();
  let usual = 0;
  for (const seed of seeds.slice(0, 600)) {
    const { model: m, problem: p } = graphChoiceFamily.generate(seed);
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    tally(variants, p.variant!.id);
    const r = p.public.response;
    if (r.kind !== "figure-choice") assert.fail("figure choice");
    if (m.k === 0) usual++;
    // The keyed card describes the good interval; every other card a piece
    // that fails the monotonic-and-onto check.
    const pieces = piecesFor(m.fn, m.k);
    for (const o of r.options) {
      const piece = pieces.find(
        (pc) =>
          o.label.includes(`${describe(pc.interval)} highlighted`) ||
          o.label.includes(`${describe(pc.interval)},`),
      )!;
      assert.ok(piece, o.label);
      assert.equal(works(m.fn, piece.interval), o.id === p.answer, o.label);
    }
  }
  assert.ok(usual / 600 <= 0.35);
  for (const fn of ["sin", "cos", "tan"])
    for (const kind of ["usual", "other"])
      assert.ok(
        (variants.get(`${fn}-${kind}`) ?? 0) / 600 >= 0.03,
        `${fn}-${kind}`,
      );
});
/** The interval words a figure description uses. */
function describe(i: Interval) {
  const plain = (h: number) => {
    if (h === 0) return "0";
    const n = Math.abs(h),
      sign = h < 0 ? "−" : "";
    return n % 2 === 0
      ? `${sign}${n / 2 === 1 ? "" : n / 2}π`
      : `${sign}${n === 1 ? "" : n}π/2`;
  };
  return `from ${plain(i.lo)} to ${plain(i.hi)}`;
}

test("one-to-one selections key exactly the intervals with no turning point inside", () => {
  const counts = new Map<string, number>();
  for (const seed of seeds.slice(0, 600)) {
    const { problem: p } = oneToOneFamily.generate(seed);
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    tally(counts, p.variant!.id);
    const fn = /\\(sin|cos) x/.exec(p.public.prompt)![1] as "sin" | "cos";
    const r = p.public.response;
    if (r.kind !== "multi-select") assert.fail("multi-select");
    const keyed = new Set(JSON.parse(p.answer) as string[]);
    for (const o of r.options) {
      const i = intervalOf(o.label);
      assert.equal(monotonic(fn, i.lo, i.hi), keyed.has(o.id), o.label);
    }
  }
  for (const v of ["sin-2", "sin-3", "cos-2", "cos-3"])
    assert.ok((counts.get(v) ?? 0) / 600 >= 0.03, v);
});

test("restricted inverses key the one input in D with the given value, and the swapped domain and range", () => {
  const variants = new Map<string, number>();
  let other = 0;
  for (const seed of seeds) {
    const { model: m, problem: p } = inverseFamily.generate(seed);
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    tally(variants, `${m.fn}-${m.k}`);
    if (m.k !== 0) other++;
    const D = goodInterval(m.fn, m.k);
    const lo = D.lo * HALF,
      hi = D.hi * HALF;
    const inD = (x: number) =>
      (D.loOpen ? x > lo + 1e-12 : x >= lo - 1e-12) &&
      (D.hiOpen ? x < hi - 1e-12 : x <= hi + 1e-12);
    const r = p.public.response as MultiPartChoiceResponse;
    const key = JSON.parse(p.answer) as Record<string, string>;
    const keyed = (id: string) =>
      r.blanks.find((b) => b.id === id)!.options.find((o) => o.id === key[id])!
        .label;
    const valueBlank = r.blanks.find((b) => b.id === "value")!;
    const v = specialValue(/g\^\{-1\}(.*)\$$/.exec(valueBlank.label)![1]!);
    // Exactly one option is in D with f(x) = v, and it is the key.
    for (const o of valueBlank.options) {
      const x = piValue(o.label.replace(/\$/g, ""));
      const solves = Math.abs(F[m.fn](x) - v) < 1e-12 && inD(x);
      assert.equal(solves, o.id === key.value, o.label);
    }
    // The usual value is offered whenever the restriction is not the usual one.
    if (m.k !== 0) {
      const usual =
        m.fn === "sin"
          ? Math.asin(v)
          : m.fn === "cos"
            ? Math.acos(v)
            : Math.atan(v);
      assert.ok(
        valueBlank.options.some(
          (o) => Math.abs(piValue(o.label.replace(/\$/g, "")) - usual) < 1e-12,
        ),
      );
    }
    // Direction from samples; domain = range of f; range = D.
    const rising = F[m.fn](lo + 0.01 + (hi - lo) / 2) > F[m.fn](lo + 0.01);
    assert.equal(keyed("trend"), rising ? "increasing" : "decreasing");
    assert.equal(
      keyed("domain"),
      m.fn === "tan" ? "$(-\\infty, \\infty)$" : "$[-1, 1]$",
    );
    const range = intervalOf(keyed("range"));
    assert.ok(
      Math.abs(range.lo - lo) < 1e-12 && Math.abs(range.hi - hi) < 1e-12,
    );
  }
  assert.ok(other / N >= 0.6);
  for (const k of [-1, 0, 1, 2])
    assert.ok((variants.get(`sin-${k}`) ?? 0) / N >= 0.02, `sin ${k}`);
  for (const k of [-1, 0, 1])
    assert.ok((variants.get(`cos-${k}`) ?? 0) / N >= 0.02, `cos ${k}`);
  for (const k of [-1, 1])
    assert.ok((variants.get(`tan-${k}`) ?? 0) / N >= 0.02, `tan ${k}`);
});

test("why-restrict items show four distinct misconceptions and key the true reason", () => {
  const variants = new Map<string, number>();
  const positions = new Map<string, number>();
  for (const seed of seeds) {
    const { model: m, problem: p } = whyFamily.generate(seed);
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    tally(variants, `${m.family}-${m.fn}`);
    tally(positions, p.answer);
    const parts = whyParts(m);
    assert.equal(new Set(parts.options.map((o) => o.tag)).size, 4);
    assert.equal(parts.options.filter((o) => o.correct).length, 1);
    const f = F[m.fn];
    const prompt = p.public.prompt;
    if (m.family !== "justify-step") {
      // a and b: two different inputs with the same output v.
      const a = piValue(/\$a = ([^$]+)\$/.exec(prompt)![1]!.replace(/,$/, ""));
      const b = piValue(/\$b = ([^$]+)\$/.exec(prompt)![1]!.replace(/,$/, ""));
      assert.ok(Math.abs(a - b) > 1e-9);
      assert.ok(Math.abs(f(a) - f(b)) < 1e-12);
      if (m.family === "two-values") {
        const conv = CONVENTIONAL[m.fn];
        const inConv = (x: number) =>
          x >= conv.lo * HALF - 1e-12 &&
          x <= conv.hi * HALF + 1e-12 &&
          !(conv.loOpen && Math.abs(x - conv.lo * HALF) < 1e-12) &&
          !(conv.hiOpen && Math.abs(x - conv.hi * HALF) < 1e-12);
        assert.ok(inConv(a) && !inConv(b));
      }
    } else {
      const I = m.interval;
      assert.ok(works(m.fn, I));
      const key = parts.options.find((o) => o.correct)!.label;
      assert.match(
        key,
        m.step === "one-to-one" ? /no output repeats/ : /is an output/,
      );
    }
  }
  for (const fam of ["no-inverse", "two-values", "justify-step"])
    for (const fn of ["sin", "cos", "tan"])
      assert.ok(
        (variants.get(`${fam}-${fn}`) ?? 0) / N >= 0.02,
        `${fam}-${fn}`,
      );
  for (const id of ["option-a", "option-b", "option-c", "option-d"])
    assert.ok((positions.get(id) ?? 0) / N > 0.15, id);
});
