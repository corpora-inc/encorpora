import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import {
  absoluteValueLinear,
  circleLineSystem,
  cubicQuotientRemainder,
  inverseExponentialRoot,
  nonmonicComplexQuadratic,
  powersOfISum,
  rationalExponentProduct,
  rationalTwoDenominators,
  shiftedTrinomialFactor,
  trinomialProduct,
  twoRadicalEquation,
} from "../src/math/regents-algebra-two-algebra-practice";

type Problem = { public: { response: unknown }; answer: string };
const SEEDS = Array.from({ length: 300 }, (_, i) => `alg:${i}`);
const label = (p: Problem) => {
  const r = p.public.response as {
    kind: string;
    options: { id: string; label: string }[];
  };
  return r.options.find((o) => o.id === p.answer)!.label;
};
const labels = (p: Problem) =>
  (p.public.response as { options: { label: string }[] }).options.map(
    (o) => o.label,
  );

/** Evaluate a polynomial in x (or the given variable) written like "2x^{2} - 3x + 1". */
function evalPoly(text: string, x: number, v = "x"): number {
  const t = text.replace(/\s+/g, "");
  const re = new RegExp(`([+-]?)(\\d*)(${v})?(?:\\^\\{(\\d+)\\})?`, "y");
  let pos = 0;
  let sum = 0;
  while (pos < t.length) {
    re.lastIndex = pos;
    const m = re.exec(t);
    if (!m || m[0] === "") throw new Error(`cannot parse ${text} at ${pos}`);
    const sign = m[1] === "-" ? -1 : 1;
    const coef = m[2] ? Number(m[2]) : m[3] ? 1 : 0;
    sum += sign * (m[3] ? coef * x ** Number(m[4] ?? 1) : coef);
    pos += m[0].length;
  }
  return sum;
}

test("nonmonic complex quadratic: label roots satisfy the equation", () => {
  checkTemplate("nonmonic-complex-quadratic", {
    variants: ["a-2", "a-3", "a-5"],
    axes: { arrangement: ["zero-right", "constant-right"] },
    hintsMin: 15,
  });
  for (const s of SEEDS) {
    const { model: m, problem: p } = nonmonicComplexQuadratic.generate(s);
    const lab = label(p as Problem);
    const g = /x=\\dfrac\{(-?\d+)\\pm i\\sqrt\{(\d+)\}\}\{(\d+)\}/.exec(lab)!;
    const re = Number(g[1]) / Number(g[3]);
    const im = Math.sqrt(Number(g[2])) / Number(g[3]);
    assert.ok(Math.abs(m.a * (re * re - im * im) + m.b * re + m.c) < 1e-9);
    assert.ok(Math.abs(2 * m.a * re * im + m.b * im) < 1e-9);
  }
});

test("inverse of exponential or cube root: f(g(x)) = x", () => {
  checkTemplate("inverse-exponential-root", {
    variants: ["base-2", "base-3", "base-4", "base-5"],
    axes: {
      kind: [
        "exponential",
        "scaled-exponential",
        "shifted-exponential",
        "from-cube-root",
      ],
    },
    hintsMin: 8,
  });
  for (const s of SEEDS) {
    const { model: m, axes, problem: p } = inverseExponentialRoot.generate(s);
    const lab = label(p as Problem).replaceAll("$", "");
    const x = 5.3;
    if (axes.kind === "from-cube-root") {
      const c = /f\(x\)=(\d+)x\^\{3\}\s*([+-])\s*(\d+)/.exec(lab)!;
      const f = (v: number) =>
        Number(c[1]) * v ** 3 + (c[2] === "-" ? -1 : 1) * Number(c[3]);
      const g = (v: number) => Math.cbrt(v + m.k) / m.m;
      assert.ok(Math.abs(f(g(x)) - x) < 1e-9, lab);
      continue;
    }
    const base = Number(/\\log_\{(\d+)\}/.exec(lab)![1]);
    assert.equal(base, m.b);
    const arg = /\\log_\{\d+\}(?:\\left\()?(.*?)(?:\\right\))?$/.exec(
      lab
        .replace(/^f\^\{-1\}\(x\)=/, "f^{-1}(x)=")
        .split("=")
        .slice(1)
        .join("="),
    )![1]!;
    let inner = x;
    const frac = /^\\dfrac\{x\}\{(\d+)\}$/.exec(arg);
    const shift = /^x\s*([+-])\s*(\d+)$/.exec(arg);
    if (frac) inner = x / Number(frac[1]);
    else if (shift) inner = x + (shift[1] === "-" ? -1 : 1) * Number(shift[2]);
    else assert.equal(arg.trim(), "x");
    const g = Math.log(inner) / Math.log(base);
    const f = (v: number) =>
      axes.kind === "exponential"
        ? m.b ** v
        : axes.kind === "scaled-exponential"
          ? m.a * m.b ** v
          : m.b ** v + m.k;
    assert.ok(Math.abs(f(g) - x) < 1e-9, `${axes.kind} ${lab}`);
  }
});

test("circle and line: brute-force intersections and classification", () => {
  checkTemplate("circle-line-system", {
    variants: ["points", "classify"],
    axes: { ask: ["solve-points", "classify-solutions"] },
    hintsMin: 15,
  });
  for (const s of SEEDS) {
    const { model: m, problem: p } = circleLineSystem.generate(s);
    const lab = label(p as Problem);
    if (m.kind === "points") {
      const pts = [...lab.matchAll(/\((-?\d+),\\ (-?\d+)\)/g)].map((q) => [
        Number(q[1]),
        Number(q[2]),
      ]);
      const truth: number[][] = [];
      for (let x = -15; x <= 15; x++)
        for (let y = -15; y <= 15; y++)
          if (x * x + y * y === m.R ** 2 && m.A * x + m.B * y === m.C)
            truth.push([x, y]);
      assert.equal(truth.length, 2);
      assert.deepEqual(pts.map(String).sort(), truth.map(String).sort());
    } else {
      // (x-h)^2 + (y-k)^2 = R2 with x = h + d  ->  (y-k)^2 = R2 - d^2
      const disc = m.R2 - m.d * m.d;
      const want =
        disc < 0
          ? "nonreal"
          : disc === 0
            ? "one real"
            : Number.isInteger(Math.sqrt(disc))
              ? "rational"
              : "irrational";
      assert.ok(lab.toLowerCase().includes(want), `${disc} ${lab}`);
      // exactly one of the four options describes the system
      assert.equal(labels(p as Problem).length, 4);
    }
  }
});

test("rational equation with two denominators: scan for solutions", () => {
  checkTemplate("rational-two-denominators", {
    variants: ["positive-solution", "negative-solution"],
    axes: { order: ["plain", "swapped"] },
    hintsMin: 15,
  });
  for (const s of SEEDS) {
    const { model: m, problem: p } = rationalTwoDenominators.generate(s);
    const f = (x: number) =>
      x / (x + m.p) - m.s / (x - m.r) - m.M / ((x + m.p) * (x - m.r));
    const sols: number[] = [];
    for (let x = -40; x <= 40; x++)
      if (x + m.p !== 0 && x !== m.r && Math.abs(f(x)) < 1e-9) sols.push(x);
    assert.deepEqual(sols, [m.s]);
    assert.equal(label(p as Problem), `$x=${m.s}$ only`);
  }
});

test("trinomial product: label equals product at several points", () => {
  checkTemplate("trinomial-product", {
    variants: ["square", "product"],
    axes: { shape: ["trinomial-times-trinomial", "square-trinomial"] },
    hintsMin: 15,
  });
  for (const s of SEEDS) {
    const { model: m, problem: p } = trinomialProduct.generate(s);
    const lab = label(p as Problem).replaceAll("$", "");
    const f = (cs: number[], x: number) =>
      cs.reduce((acc, c) => acc * x + c, 0);
    for (const x of [-3, -1, 2, 5])
      assert.equal(evalPoly(lab, x) + 0, f(m.p, x) * f(m.q, x) + 0);
  }
});

test("cubic quotient with remainder: identity at several points", () => {
  checkTemplate("cubic-quotient-remainder", {
    variants: ["plus", "minus"],
    axes: { divisor: ["x-plus", "x-minus"] },
    hintsMin: 15,
  });
  for (const s of SEEDS) {
    const { model: m, problem: p } = cubicQuotientRemainder.generate(s);
    const lab = label(p as Problem).replaceAll("$", "");
    const parts = /^(.*?)\s*([+-])\s*\\dfrac\{(\d+)\}\{x([+-])(\d+)\}$/.exec(
      lab,
    )!;
    const R = (parts[2] === "-" ? -1 : 1) * Number(parts[3]);
    const k = m.k;
    const [q2, q1, q0] = m.q;
    const dividend = (x: number) => (x + k) * (q2 * x * x + q1 * x + q0) + m.R;
    for (const x of [-4, 0, 2, 3, 7]) {
      if (x + k === 0) continue;
      assert.ok(
        Math.abs(
          dividend(x) / (x + k) - (evalPoly(parts[1]!, x) + R / (x + k)),
        ) < 1e-9,
      );
    }
    assert.equal(R, m.R);
  }
});

test("powers of i: independent complex evaluation", () => {
  checkTemplate("powers-of-i-sum", {
    variants: ["3-terms", "4-terms"],
    axes: { terms: ["three", "four"] },
    hintsMin: 8,
  });
  for (const s of SEEDS) {
    const { model: m, problem: p } = powersOfISum.generate(s);
    const lab = label(p as Problem).replaceAll("$", "");
    for (const x of [2, -3, 5]) {
      let re = 0;
      let im = 0;
      for (const t of m.terms) {
        const c = t.c * (t.withVar ? x : 1);
        const [a, b] = [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ][t.e % 4]!;
        re += c * a;
        im += c * b;
      }
      const idx = lab.search(/ [+-] (\(|\d*[a-z]?i)/);
      const body = lab.slice(idx + 1);
      const sign = body[0] === "-" ? -1 : 1;
      const rest = body.slice(1).trim();
      const v = m.v;
      const imag = rest.startsWith("(")
        ? evalPoly(rest.slice(1, rest.lastIndexOf(")")), x, v)
        : (() => {
            const core = rest.replace(/i$/, "");
            return core === "" ? 1 : evalPoly(core, x, v);
          })();
      assert.equal(evalPoly(lab.slice(0, idx), x, v), re, lab);
      assert.equal(sign * imag, im, lab);
    }
  }
});

test("two radical equation: unique solution by scan", () => {
  checkTemplate("two-radical-equation", {
    variants: [
      "coefficient-2",
      "coefficient-3",
      "coefficient-4",
      "coefficient-5",
    ],
    axes: { arrangement: ["difference", "radical-isolated"] },
    hintsMin: 8,
  });
  for (const s of SEEDS) {
    const { model: m, problem: p } = twoRadicalEquation.generate(s);
    const ok = (x: number) =>
      m.p * x + m.a >= 0 &&
      x + m.b >= 0 &&
      Math.abs(Math.sqrt(m.p * x + m.a) - Math.sqrt(x + m.b) - m.c) < 1e-9;
    const sols: number[] = [];
    for (let x = -50; x <= 2000; x++) if (ok(x)) sols.push(x);
    assert.deepEqual(sols, [m.good]);
    assert.equal((p as Problem).answer, String(m.good));
    assert.ok(!ok(m.bad));
  }
});

test("absolute value equals linear: brute-force solution set", () => {
  checkTemplate("absolute-value-linear", {
    variants: ["two-solutions", "one-extraneous"],
    axes: { notation: ["equation", "functions"] },
    hintsMin: 15,
  });
  for (const s of SEEDS) {
    const { model: m, problem: p } = absoluteValueLinear.generate(s);
    const sols: number[] = [];
    for (let x = -300; x <= 300; x++)
      if (Math.abs(x - m.p) * m.qd === m.qn * x + m.r * m.qd) sols.push(x);
    const lab = label(p as Problem);
    const got =
      lab === "No solution"
        ? []
        : [...lab.matchAll(/x=(-?\d+)/g)]
            .map((t) => Number(t[1]))
            .sort((a, b) => a - b);
    assert.deepEqual(got, sols);
  }
});

test("shifted trinomial factor: factors multiply back", () => {
  checkTemplate("shifted-trinomial-factor", {
    variants: ["monic", "non-monic"],
    axes: { leading: ["monic", "non-monic"] },
    hintsMin: 15,
  });
  for (const s of SEEDS) {
    const { model: m, problem: p } = shiftedTrinomialFactor.generate(s);
    const lab = label(p as Problem).replaceAll("$", "");
    const bins = (lab.match(/\([^()]*\)|x/g) ?? []).map((q) =>
      q === "x" ? "x" : q.slice(1, -1),
    );
    assert.equal(bins.length, 2);
    const u = (x: number) => x - m.k;
    const f = (x: number) => (m.p * u(x) + m.q) * (m.r * u(x) + m.s);
    for (const x of [-3, 0, 2, 7])
      assert.equal(evalPoly(bins[0]!, x) * evalPoly(bins[1]!, x) + 0, f(x) + 0);
  }
});

test("rational exponent product: value and exponent check", () => {
  checkTemplate("rational-exponent-product", {
    variants: ["large-power", "small-power"],
    axes: { form: ["quotient-of-powers", "coefficient-radical"] },
    hintsMin: 8,
  });
  const val = (t: string) => {
    const f = /\\frac\{(-?\d+)\}\{(\d+)\}/.exec(t);
    return f ? Number(f[1]) / Number(f[2]) : Number(t);
  };
  for (const s of SEEDS) {
    const { model: m, axes, problem: p } = rationalExponentProduct.generate(s);
    const lab = label(p as Problem).replaceAll("$", "");
    const exp = /\^\{((?:\\frac\{-?\d+\}\{\d+\})|-?\d+)\}/.exec(lab);
    const e = exp ? val(exp[1]!) : 1;
    const x = 1.7;
    if (axes.form === "quotient-of-powers") {
      const expected = 1 / 3 + m.P12 / 12 - m.Q12 / 12;
      assert.ok(Math.abs(e - expected) < 1e-12, lab);
    } else {
      const c = Number(/^(\d+)/.exec(lab)![1]);
      const value = m.c * x ** m.P * Math.cbrt(m.d ** 3 * x ** m.m);
      assert.ok(Math.abs(c * x ** e - value) < 1e-9, lab);
    }
  }
});
