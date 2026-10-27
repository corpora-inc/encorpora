import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";
import { erf, normalCdf } from "../src/math/regents-algebra-two-kit";

test("normal cdf matches table values", () => {
  assert.ok(Math.abs(normalCdf(1) - 0.8413447461) < 1e-9);
  assert.ok(Math.abs(normalCdf(1.96) - 0.9750021049) < 1e-9);
  assert.ok(Math.abs(normalCdf(-0.5) - 0.3085375387) < 1e-9);
  assert.ok(Math.abs(normalCdf(3.5) - 0.9997673709) < 1e-9);
  assert.ok(Math.abs(erf(0.5) - 0.5204998778) < 1e-9);
});
test("geometric series total", () => {
  checkTemplate("geometric-series-total", {
    variants: ["fraction-ratio", "percent-growth"],
  });
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("geometric-series-total", `s${i}`);
    const r = p.public.response;
    if (r.kind !== "choice") throw new Error("choice");
    const label = r.options.find((o) => o.id === p.answer)!.label;
    const m = /first (\d+) payments/.exec(p.public.prompt);
    if (m) {
      const pay = /is ([\d,]+) dollars and each payment is (\d+)%/.exec(
        p.public.prompt,
      )!;
      const a = Number(pay[1]!.replace(",", ""));
      const g = 1 + Number(pay[2]) / 100;
      let sum = 0;
      for (let k = 0; k < Number(m[1]); k++) sum += a * g ** k;
      assert.equal(label, `${Math.round(sum).toLocaleString("en-US")} dollars`);
    }
  }
});
test("common base exponential: stated solution satisfies the equation", () => {
  checkTemplate("common-base-exponential", {
    variants: ["base-2", "base-3", "base-5"],
    axes: { order: ["bigger-left", "smaller-left"] },
    hintsMin: 8,
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("common-base-exponential", `c${i}`);
    const r = p.public.response;
    if (r.kind !== "choice") throw new Error("choice");
    const x = Number(
      /x=(-?\d+)/.exec(r.options.find((o) => o.id === p.answer)!.label)![1],
    );
    const eq = /\$(\d+)\^\{([^}]*)\}=(\d+)\^\{([^}]*)\}\$/.exec(
      p.public.prompt,
    )!;
    const ev = (e: string) => {
      const m = /^(\d*)x(?: ([+-]) (\d+))?$/.exec(e)!;
      return (
        (m[1] ? Number(m[1]) : 1) * x +
        (m[2] ? (m[2] === "-" ? -1 : 1) * Number(m[3]) : 0)
      );
    };
    const lhs = Number(eq[1]) ** ev(eq[2]!);
    const rhs = Number(eq[3]) ** ev(eq[4]!);
    assert.ok(
      Math.abs(lhs - rhs) <= 1e-9 * Math.abs(lhs),
      `${p.public.prompt} x=${x}`,
    );
    // exactly one choice satisfies it
    const sat = r.options.filter((o) => {
      const v = Number(/x=(-?\d+)/.exec(o.label)![1]);
      const e = (s: string) => {
        const m = /^(\d*)x(?: ([+-]) (\d+))?$/.exec(s)!;
        return (
          (m[1] ? Number(m[1]) : 1) * v +
          (m[2] ? (m[2] === "-" ? -1 : 1) * Number(m[3]) : 0)
        );
      };
      return (
        Math.abs(Number(eq[1]) ** e(eq[2]!) - Number(eq[3]) ** e(eq[4]!)) <
        1e-9 * Math.abs(Number(eq[1]) ** e(eq[2]!))
      );
    });
    assert.equal(sat.length, 1);
  }
});
test("exponential parameter log", () => {
  checkTemplate("exponential-parameter-log", {
    variants: ["first-letters", "other-letters"],
    axes: {
      form: ["coefficient", "exponent-factor"],
      values: ["symbolic", "numeric"],
    },
  });
});
test("exponential target time: independent check", () => {
  checkTemplate("exponential-target-time", {
    variants: ["base-b", "continuous"],
    axes: {
      model: ["base-b", "continuous"],
      setting: ["crowd", "bacteria", "savings"],
    },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("exponential-target-time", `t${i}`);
    const pr = p.public.prompt;
    const t = Number(p.answer);
    const target = Number(/reach (\d+)\?/.exec(pr)![1]);
    const cont = /e\^\{([\d.]+)t\}/.exec(pr);
    const a = Number(/\$N\(t\)=(\d+)/.exec(pr)![1]);
    const value = cont
      ? a * Math.exp(Number(cont[1]) * t)
      : a * Number(/\\cdot([\d.]+)\^\{t\}/.exec(pr)![1]) ** t;
    // bisection: the model is increasing, so the answer rounds the exact root
    assert.ok(
      Math.abs(value - target) / target < 0.02,
      `${pr} ${p.answer} ${value}`,
    );
    const step = cont
      ? a * Math.exp(Number(cont[1]) * (t + 0.005))
      : a * Number(/\\cdot([\d.]+)\^\{t\}/.exec(pr)![1]) ** (t + 0.005);
    const lo = cont
      ? a * Math.exp(Number(cont[1]) * (t - 0.005))
      : a * Number(/\\cdot([\d.]+)\^\{t\}/.exec(pr)![1]) ** (t - 0.005);
    assert.ok(lo <= target && target <= step, pr);
  }
});
test("growth model rewrite", () => {
  checkTemplate("growth-model-rewrite", {
    variants: ["rewrite"],
    axes: {
      kind: ["monthly-from-annual", "half-life"],
      direction: ["growth", "decay"],
    },
  });
});
test("depreciation recursion", () => {
  checkTemplate("depreciation-recursion", {
    variants: ["percent-loss"],
    axes: { wording: ["loses", "worth"] },
  });
});
test("nonlinear recursion: independent recomputation", () => {
  checkTemplate("nonlinear-recursion-term", {
    variants: ["term-3", "term-4"],
    hintsMin: 8,
    axes: {
      rule: ["square-plus", "square-minus-previous", "double-square-minus"],
    },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("nonlinear-recursion-term", `n${i}`);
    const a1 = Number(/a_1=(-?\d+)/.exec(p.public.prompt)![1]);
    const k = Number(/What is \$a_(\d)\$/.exec(p.public.prompt)![1]);
    const rule = p.public.prompt.includes("2a_{n-1}")
      ? (x: number, c: number) => 2 * x * x - c
      : p.public.prompt.includes("-a_{n-1}$")
        ? (x: number) => x * x - x
        : (x: number, c: number) => x * x + c;
    const c = Number(/\^\{2\}[+-](\d+)/.exec(p.public.prompt)?.[1] ?? 0);
    let v = a1;
    for (let j = 2; j <= k; j++) v = rule(v, c);
    assert.equal(String(v), p.answer);
  }
});
