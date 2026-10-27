import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";

type P = ReturnType<typeof generateProblem>;
const options = (p: P) => {
  const r = p.public.response;
  return r.kind === "choice" || r.kind === "figure-choice" ? r.options : [];
};
const fnsOf = (json: unknown) =>
  [...JSON.stringify(json).matchAll(/"fn":(\{[^}]*\})/g)].map(
    (m) => JSON.parse(m[1]!) as Record<string, any>,
  );
const horner = (c: number[], x: number) =>
  c.reduceRight((acc, k) => acc * x + k, 0);

test("log base fraction graph", () => {
  checkTemplate("log-base-fraction-graph", { variants: [""], hintsMin: 3 });
  for (let i = 0; i < 100; i++) {
    const p = generateProblem("log-base-fraction-graph", `l:${i}`);
    const d = Number(p.public.prompt.match(/\\log_\{1\/(\d)\}/)![1]);
    for (const o of options(p)) {
      const [f] = fnsOf(o);
      const isKey = f!.f === "log" && Math.abs(f!.base - 1 / d) < 1e-12;
      assert.equal(isKey, o.id === p.answer);
    }
  }
});

test("remainder zero graph", () => {
  checkTemplate("remainder-zero-graph", { variants: [""], hintsMin: 5 });
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("remainder-zero-graph", `z:${i}`);
    const m = p.public.prompt.match(/divided by \$x ([+-]) (\d+)\$/)!;
    const root = m[1] === "-" ? Number(m[2]) : -Number(m[2]);
    for (const o of options(p)) {
      const [f] = fnsOf(o);
      assert.equal(
        Math.abs(horner(f!.c, root)) < 1e-9,
        o.id === p.answer,
        o.label,
      );
    }
  }
});

test("repeated zero rule", () => {
  checkTemplate("repeated-zero-rule", {
    variants: ["double-left", "double-right"],
    axes: { order: ["double-left", "double-right"] },
    hintsMin: 5,
  });
  const evalRule = (label: string, x: number) => {
    const js = label
      .replace(/^\$y = /, "")
      .replace(/\$$/, "")
      .replace(/\^2/g, "**2")
      .replace(/\)\(/g, ")*(")
      .replace(/(\d)\(/g, "$1*(")
      .replace(/^-/, "-1*");
    return new Function("x", `return ${js};`)(x) as number;
  };
  for (let i = 0; i < 100; i++) {
    const p = generateProblem("repeated-zero-rule", `r:${i}`);
    const [f] = fnsOf(p.public.figure);
    for (const o of options(p)) {
      const same = [-3.5, -1, 0.5, 2, 4.5].every(
        (x) => Math.abs(horner(f!.c, x) - evalRule(o.label, x)) < 1e-6,
      );
      assert.equal(same, o.id === p.answer, o.label);
    }
  }
});

test("sinusoid compare", () => {
  checkTemplate("sinusoid-compare-rule", {
    variants: ["greater-max-greater-frequency", "lesser-max-lesser-frequency"],
    hintsMin: 20,
  });
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("sinusoid-compare-rule", `s:${i}`);
    const [f] = fnsOf(p.public.figure);
    const g = p.public.prompt.match(
      /g\(x\) = (\d+)\\sin\\left\(\\frac\{2\\pi\}\{(\d+)\}x\\right\)/,
    )!;
    const maxG = Number(g[1]) > f!.a;
    const freqG =
      f!.b / (2 * Math.PI) < (2 * Math.PI) / (2 * Math.PI) / Number(g[2]);
    const want = `$g$ has a ${maxG ? "greater" : "smaller"} maximum value and a ${freqG ? "greater" : "smaller"} frequency than $f$`;
    assert.equal(options(p).find((o) => o.id === p.answer)!.label, want);
  }
});

test("tide cosine", () => {
  checkTemplate("tide-cosine-equation", {
    variants: ["maximum-period-8", "minimum-period-12"],
    axes: { start: ["maximum", "minimum"] },
    hintsMin: 10,
  });
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("tide-cosine-equation", `t:${i}`);
    const [f] = fnsOf(p.public.figure);
    for (const o of options(p)) {
      const m = o.label.match(
        /y = (-?)(\d+)\\(cos|sin)\\left\(\\frac\{(\\pi|2\\pi)\}\{(\d+)\}x\\right\) \+ (\d+)/,
      )!;
      const amp = (m[1] ? -1 : 1) * Number(m[2]);
      const trig = m[3] === "cos" ? Math.cos : Math.sin;
      const per = m[4] === "\\pi" ? Math.PI : 2 * Math.PI;
      const B = per / Number(m[5]);
      const D = Number(m[6]);
      const same = [0, 1.3, 3, 5.5, 9, 14].every(
        (x) =>
          Math.abs(f!.a * Math.cos(f!.b * x) + f!.k - (amp * trig(B * x) + D)) <
          1e-6,
      );
      assert.equal(same, o.id === p.answer, o.label);
    }
  }
});

test("cubic graph statement", () => {
  checkTemplate("cubic-graph-statement", {
    variants: ["positive-lead", "negative-lead"],
    axes: { lead: ["positive", "negative"] },
    hintsMin: 8,
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("cubic-graph-statement", `c:${i}`);
    const [f] = fnsOf(p.public.figure);
    const c = f!.c as number[];
    const val = (x: number) => horner(c, x);
    const deriv = (x: number) => (val(x + 1e-6) - val(x - 1e-6)) / 2e-6;
    const mult = (z: number) => {
      // order of the zero: smallest derivative order that is nonzero at z
      let k = 0;
      let poly = [...c];
      while (Math.abs(horner(poly, z)) < 1e-6 && k < 4) {
        poly = poly.slice(1).map((v, j) => v * (j + 1));
        k++;
      }
      return k;
    };
    const truth = (s: string) => {
      let m = s.match(/^As \$x \\to \\infty\$, \$f\(x\) \\to (-?)\\infty\$$/);
      if (m) return (m[1] ? -1 : 1) === Math.sign(c[3]!);
      m = s.match(/^\$x = (-?\d+)\$ is a zero of multiplicity (\d)$/);
      if (m) return mult(Number(m[1])) === Number(m[2]);
      m = s.match(
        /^\$f\$ is (increasing|decreasing) on the interval \$\((-\\infty|-?\d+), (-?\d+)\)\$$/,
      );
      if (m) {
        const lo = m[2] === "-\\infty" ? -50 : Number(m[2]);
        const hi = Number(m[3]);
        const want = m[1] === "increasing" ? 1 : -1;
        return [0.1, 0.3, 0.5, 0.7, 0.9].every(
          (t) => Math.sign(deriv(lo + t * (hi - lo))) === want,
        );
      }
      throw new Error(s);
    };
    for (const o of options(p))
      assert.equal(truth(o.label), o.id === p.answer, o.label);
  }
});
