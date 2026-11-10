import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";
import {
  CLAIMS,
  claimFamily,
  derivationFamily,
  periodFamily,
  targetOf,
} from "../src/math/trig-symmetry-reasoning-practice";

/** HSF.TF.A.4 types: points, identities and counterexamples recomputed
 * numerically at the generated angle. */
const N = 1000;
const seeds = Array.from({ length: N }, (_, i) => `tsr-${i}`);
const tally = (m: Map<string, number>, k: string) =>
  m.set(k, (m.get(k) ?? 0) + 1);
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Evaluate a TeX expression in θ, a and b (and π). */
function evalTex(tex: string, env: { theta: number; a: number; b: number }) {
  let s = tex;
  const frac = /\\frac\{([^{}]*)\}\{([^{}]*)\}/g;
  while (frac.test(s)) s = s.replace(frac, "(($1)/($2))");
  s = s
    .replace(/\\(sin|cos|tan)\\theta/g, "Math.$1(θ)")
    .replace(/\\(sin|cos|tan)\s*\(/g, "Math.$1(")
    .replace(/\\theta/g, "θ")
    .replace(/\\pi/g, "π")
    .replace(/(\d)\s*π/g, "$1*π")
    .replace(/π/g, "Math.PI")
    .replace(/θ/g, `(${env.theta})`)
    .replace(/\ba\b/g, `(${env.a})`)
    .replace(/\bb\b/g, `(${env.b})`);
  return Function(`return (${s});`)() as number;
}
/** Every equation in every math span of a label holds. */
function equationsHold(
  label: string,
  env: { theta: number; a: number; b: number },
) {
  const spans = [...label.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!);
  const eqs = spans.filter((s) => s.includes("="));
  assert.ok(eqs.length > 0, label);
  return eqs.every((eq) => {
    const sides = eq.split("=").map((side) => evalTex(side, env));
    return sides.every((v) => close(v, sides[0]!));
  });
}
/** Apply a named motion to a point. */
const motions: [RegExp, (p: [number, number]) => [number, number]][] = [
  [/across the \$x\$-axis/, ([x, y]) => [x, -y]],
  [/across the \$y\$-axis/, ([x, y]) => [-x, y]],
  [/half turn/, ([x, y]) => [-x, -y]],
  [/y = x/, ([x, y]) => [y, x]],
];
const motionOf = (label: string) => motions.find(([re]) => re.test(label))![1];

test("the same seed gives the same problem", () => {
  for (const id of [
    "unit-circle-symmetry-derivation",
    "trig-periodicity-explanation",
    "unit-circle-claim-check",
  ])
    for (const seed of ["a", "b", "17"])
      assert.deepEqual(generateProblem(id, seed), generateProblem(id, seed));
});

test("derivations key the motion and coordinates of the target point and a conclusion true at the generated angle", () => {
  const variants = new Map<string, number>();
  for (const seed of seeds) {
    const { model: m, problem: p } = derivationFamily.generate(seed);
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    tally(variants, p.variant!.id);
    const { p: P, family } = m;
    // θ is never a special angle: no multiple of π/12 within 0.01.
    assert.ok(
      Math.abs(
        P.theta * (12 / Math.PI) - Math.round(P.theta * (12 / Math.PI)),
      ) > 0.01 || P.tier === "concrete",
    );
    assert.ok(close(P.a, Math.cos(P.theta)) && close(P.b, Math.sin(P.theta)));
    const target = targetOf[family].angle(P.theta);
    const Q: [number, number] = [Math.cos(target), Math.sin(target)];
    const r = p.public.response as MultiPartChoiceResponse;
    const key = JSON.parse(p.answer) as Record<string, string>;
    const blank = (id: string) => r.blanks.find((b) => b.id === id)!;
    for (const o of blank("motion").options) {
      const [x, y] = motionOf(o.label)([P.a, P.b]);
      assert.equal(
        close(x, Q[0]) && close(y, Q[1]),
        o.id === key.motion,
        o.label,
      );
    }
    const env = { theta: P.theta, a: P.a, b: P.b };
    for (const o of blank("coords").options) {
      const [x, y] = o.label
        .replace(/[$()]/g, "")
        .split(",")
        .map((s) => evalTex(s.trim(), env));
      assert.equal(
        close(x!, Q[0]) && close(y!, Q[1]),
        o.id === key.coords,
        o.label,
      );
    }
    for (const o of blank("result").options) {
      if (family === "pi-minus-theta") {
        // The key refuses evenness with the true value of sin(−θ).
        if (o.id === key.result) {
          assert.match(o.label, /^No: /);
          assert.ok(close(-Math.sin(P.theta), Math.sin(-P.theta)));
        } else
          assert.ok(
            /^Yes: /.test(o.label) || !equationsHold(o.label, env),
            o.label,
          );
      } else
        assert.equal(equationsHold(o.label, env), o.id === key.result, o.label);
    }
  }
  for (const f of [
    "neg-theta",
    "neg-theta-tan",
    "pi-plus-theta",
    "pi-minus-theta",
  ])
    for (const tier of ["concrete", "general"])
      assert.ok(
        (variants.get(`${f}-${tier}`) ?? 0) / N >= 0.02,
        `${f}-${tier}`,
      );
});

/** Exact value of a multiple of π written in TeX, such as "-\\frac{3\\pi}{4}". */
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

test("periodicity items key the unit-circle reason, the flawed step, and a true counterexample", () => {
  const variants = new Map<string, number>();
  const positions = new Map<string, number>();
  for (const seed of seeds) {
    const { model: m, problem: p } = periodFamily.generate(seed);
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    tally(variants, p.variant!.id);
    tally(positions, p.answer);
    const r = p.public.response;
    if (r.kind !== "choice") assert.fail("single choice");
    const key = r.options.find((o) => o.id === p.answer)!.label;
    assert.doesNotMatch(key, /^Nothing is wrong/);
    if (m.family === "counterexample") {
      const f = m.pair.fn === "sin" ? Math.sin : Math.cos;
      const c = (m.pair.c * Math.PI) / 12;
      for (const o of r.options) {
        const theta = piValue(/\\theta = (.*)\$$/.exec(o.label)![1]!);
        // Every listed angle is a multiple of π/6 or π/4.
        const twelfths = Math.round((theta * 12) / Math.PI);
        assert.ok(twelfths % 2 === 0 || twelfths % 3 === 0);
        const differs = Math.abs(f(theta + c) - f(theta)) > 1e-9;
        assert.equal(differs, o.id === p.answer, o.label);
      }
      continue;
    }
    // Key length within 25% of the mean distractor length.
    const others = r.options.filter((o) => o.id !== p.answer);
    const mean = others.reduce((s, o) => s + o.label.length, 0) / others.length;
    assert.ok(
      Math.abs(key.length / mean - 1) <= 0.25,
      `${p.variant!.id}: ${key}`,
    );
    if (m.family === "full-turn") assert.match(key, /full turn/);
    if (m.family === "tan-half-turn") assert.match(key, /\(-a, -b\)/);
    if (m.family === "find-the-flaw")
      assert.match(
        key,
        {
          "cos-half-turn": /^Step 2:/,
          "sine-additive": /^Step 2:/,
          "tan-two-pi": /^Step 3:/,
          diameter: /^Step 1:/,
        }[m.argument],
      );
  }
  for (const v of [
    "full-turn",
    "tan-half-turn",
    "flaw-cos-half-turn",
    "flaw-sine-additive",
    "flaw-tan-two-pi",
    "flaw-diameter",
    "counterexample-cos-pi",
    "counterexample-sin-pi",
    "counterexample-sin-half-pi",
    "counterexample-cos-half-pi",
  ])
    assert.ok((variants.get(v) ?? 0) / N >= 0.02, v);
  for (const id of ["option-a", "option-b", "option-c", "option-d"])
    assert.ok((positions.get(id) ?? 0) / N > 0.15, id);
});

test("each claim's truth matches the unit-circle facts it states", () => {
  // Independent judgments: does every equation hold for every θ, and does
  // the stated reason really give the stated conclusion?
  const thetas = Array.from({ length: 40 }, (_, i) => -3 + 0.153 * i).filter(
    (t) => Math.abs(Math.cos(t)) > 1e-3 && Math.abs(Math.sin(t)) > 1e-3,
  );
  const always = (eq: (t: number) => boolean) => thetas.every(eq);
  const expected: Record<string, boolean> = {
    "cos-even": always((t) => close(Math.cos(-t), Math.cos(t))),
    "sin-odd": always((t) => close(Math.sin(-t), -Math.sin(t))),
    "tan-odd": always((t) => close(Math.tan(-t), -Math.tan(t))),
    "tan-period": always((t) => close(Math.tan(t + Math.PI), Math.tan(t))),
    "cos-full-turn": always((t) =>
      close(Math.cos(t + 2 * Math.PI), Math.cos(t)),
    ),
    "sin-not-pi": always((t) => close(Math.sin(Math.PI + t), -Math.sin(t))),
    // sin(π − θ) = sin θ holds, but sine is even only if sin(−θ) = sin θ.
    "sin-even": always((t) => close(Math.sin(-t), Math.sin(t))),
    "cos-odd": always((t) => close(Math.cos(-t), -Math.cos(t))),
    "sin-pi-period": always((t) => close(Math.sin(t + Math.PI), Math.sin(t))),
    "tan-even": always((t) => close(Math.tan(-t), Math.tan(t))),
    // Tangent is odd, so "neither odd nor even" is false.
    "tan-asymptotes": !always((t) => close(Math.tan(-t), -Math.tan(t))),
    "cos-sign": always((t) => close(Math.cos(-t), -Math.cos(t))),
    "sin-arc-length": always((t) => close(Math.sin(-t), Math.sin(t))),
  };
  for (const c of CLAIMS) assert.equal(c.holds, expected[c.id], c.id);
  const counts = new Map<string, number>();
  for (const seed of seeds.slice(0, 400)) {
    const { problem: p } = claimFamily.generate(seed);
    assert.ok(generatedProblemSchema.safeParse(p).success, seed);
    const r = p.public.response;
    if (r.kind !== "multi-select") assert.fail("multi-select");
    const keyed = new Set(JSON.parse(p.answer) as string[]);
    tally(counts, String(keyed.size));
    assert.equal(r.options.length, 6);
    for (const o of r.options) {
      const claim = CLAIMS.find((c) => c.label === o.label)!;
      assert.equal(keyed.has(o.id), claim.holds, o.label);
    }
  }
  for (const k of ["2", "3", "4"]) assert.ok((counts.get(k) ?? 0) > 40, k);
});
