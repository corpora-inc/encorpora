import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";
import {
  completeSquareSteps,
  countRationalAbs,
  rationalAbsCount,
} from "../src/math/regents-algebra-two-reasoning-practice";

type P = ReturnType<typeof generateProblem>;
const options = (p: P) =>
  p.public.response.kind === "choice" ? p.public.response.options : [];
const key = (p: P) => options(p).find((o) => o.id === p.answer)!.label;
const evalExpr = (text: string, x: number) => {
  const js = text
    .replaceAll("$", "")
    .replace(/\^/g, "**")
    .replace(/(\d|\))\s*\(/g, "$1*(")
    .replace(/(\d)x/g, "$1*x");
  return new Function("x", `return ${js};`)(x) as number;
};

test("study design", () => {
  checkTemplate("study-design-classify", {
    variants: ["experiment-0", "observational-3"],
    axes: { kind: ["experiment", "observational"] },
    hintsMin: 6,
  });
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("study-design-classify", `s:${i}`);
    const assigned = /randomly (assigns|picks)|flips a coin/.test(
      p.public.prompt,
    );
    assert.equal(
      key(p).startsWith("Experiment, because the researcher assigned"),
      assigned,
    );
    if (!assigned)
      assert.match(
        key(p),
        /^Observational study, because the researcher only recorded/,
      );
  }
});

test("quartic factored form", () => {
  checkTemplate("quartic-factored-form", {
    variants: ["k-2", "k-3"],
    hintsMin: 6,
  });
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("quartic-factored-form", `q:${i}`);
    const target = p.public.prompt.match(/equivalent to \$([^$]+)\$/)![1]!;
    for (const o of options(p)) {
      let same = true;
      for (const x of [-3, -1, 2, 5, 7])
        if (
          Math.abs(
            evalExpr(
              target.replace(/(\d+)x\^4/, "$1*x**4").replace("^4", "**4"),
              x,
            ) - evalExpr(o.label, x),
          ) > 1e-9
        )
          same = false;
      assert.equal(same, o.id === p.answer, `${target} vs ${o.label}`);
    }
  }
});

test("cubic quotient", () => {
  checkTemplate("cubic-quotient-factored", {
    variants: ["lead-2", "lead-3", "lead-5"],
    axes: { lead: ["two", "three", "five"] },
    hintsMin: 20,
  });
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("cubic-quotient-factored", `c:${i}`);
    const m = p.public.prompt.match(/\\frac\{(.+)\}\{([^}]+)\}\$, where/)!;
    const num = m[1]!
      .replace(/(\d*)x\^\{3\}/, (_, c) => `${c || 1}*x**3`)
      .replace(/(\d*)x\^\{2\}/, (_, c) => `${c || 1}*x**2`);
    const f = (x: number) =>
      new Function(
        "x",
        `return ${num
          .replace(/(\d)x/g, "$1*x")
          .replace(/ - /g, " - ")
          .replace(/\^\{(\d)\}/g, "**$1")};`,
      )(x) as number;
    const den = (x: number) => evalExpr(m[2]!, x);
    for (const o of options(p)) {
      let same = true;
      for (const x of [-4.5, -1.5, 0.5, 2.5, 6.5])
        if (Math.abs(f(x) / den(x) - evalExpr(o.label, x)) > 1e-7) same = false;
      assert.equal(same, o.id === p.answer, `${m[1]} / ${m[2]} vs ${o.label}`);
    }
  }
});

test("complete the square steps", () => {
  checkTemplate("complete-square-first-steps", {
    variants: ["valid-1", "valid-2"],
    hintsMin: 20,
  });
  for (const a of [2, 3, 4])
    for (const b of [-8, 4, 12])
      for (const c of [-12, 4, 8]) {
        if (b % a || c % a) continue;
        for (const s of completeSquareSteps(a, b, c)) {
          if (s.poly) {
            const [A, B, C] = s.poly as [number, number, number];
            const same =
              Math.abs(A * b - a * B) < 1e-9 && Math.abs(A * c - a * C) < 1e-9;
            assert.equal(same, s.valid, s.text);
          } else assert.equal(s.valid, false);
        }
      }
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("complete-square-first-steps", `w:${i}`);
    assert.equal(options(p).length, 4);
  }
});

test("exponential points", () => {
  checkTemplate("exponential-points-statement", {
    variants: ["t-2", "t-5"],
    hintsMin: 8,
  });
  for (let i = 0; i < 100; i++) {
    const p = generateProblem("exponential-points-statement", `e:${i}`);
    const pts = [...p.public.prompt.matchAll(/\((\d+), (\d+)\)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    const T = pts[1]![0]!;
    assert.deepEqual(
      pts.map(([, y]) => y),
      [pts[0]![1], 2 * pts[0]![1]!, 4 * pts[0]![1]!],
    );
    assert.match(key(p), new RegExp(`doubles every } ${T} \\\\text\\{ units`));
    assert.ok(p.public.figure);
  }
});

test("rational abs count", () => {
  checkTemplate("rational-abs-solution-count", {
    variants: ["count-1", "count-3"],
    hintsMin: 20,
  });
  const seen = new Set<number>();
  for (let i = 0; i < 300; i++) {
    const { model: m, problem } = rationalAbsCount.generate(`r:${i}`);
    seen.add(m.count);
    // Independent scan: sign changes of f - g on each side of the asymptote, avoiding the pole.
    const d = (x: number) => m.a / (x - m.h) + m.k - (Math.abs(x - m.p) + m.q);
    let n = 0;
    for (const [lo, hi] of [
      [-60, m.h - 1e-4],
      [m.h + 1e-4, 60],
    ] as const) {
      let prev = d(lo);
      for (let x = lo + 0.001; x <= hi; x += 0.001) {
        const cur = d(x);
        if (prev * cur < 0 && Math.abs(prev) < 50 && Math.abs(cur) < 50) n++;
        prev = cur;
      }
    }
    assert.equal(n, m.count, JSON.stringify(m));
    assert.equal(countRationalAbs(m.a, m.h, m.k, m.p, m.q)!.count, m.count);
    assert.equal(
      options(problem).find((o) => o.id === problem.answer)!.label,
      String(m.count),
    );
  }
  assert.ok(seen.has(1) && seen.has(3));
});

test("cubic quotient: the factoring sentence names numbers that add to the middle coefficient", () => {
  let checked = 0;
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("cubic-quotient-factored", `sum:${i}`);
    const text = p.explanation.join(" ");
    const quad = /\$x\^\{2\} ([+-]) (\d*)x ([+-]) (\d+) =/.exec(text);
    const claim = /add to (-?\d+)/.exec(text);
    if (!quad || !claim) continue;
    checked++;
    const b = Number(quad[2] || "1") * (quad[1] === "-" ? -1 : 1);
    assert.equal(Number(claim[1]), b, text);
  }
  assert.ok(checked > 0);
});
