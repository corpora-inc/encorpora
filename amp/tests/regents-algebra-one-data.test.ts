import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { generateProblem } from "../src/math/engine";

type P = ReturnType<typeof generateProblem>;
const options = (p: P) =>
  p.public.response.kind === "choice" ? p.public.response.options : [];
const key = (p: P) => options(p).find((o) => o.id === p.answer)!.label;
const nums = (s: string) =>
  [...s.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

test("exponential initial value", () => {
  checkTemplate("exponential-initial-value", {
    variants: ["growth", "decay"],
    axes: { form: ["factor", "percent-rate", "shifted-exponent"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("exponential-initial-value", `e:${i}`);
    const rule = p.public.prompt.match(
      /\$[A-Z]\(t\) = (\d+)(?:\(([^)]+)\)|\\cdot(\d+))\^(\{t \+ (\d)\}|t)\$/,
    );
    if (rule) {
      const a = Number(rule[1]);
      const raw = rule[2] ?? rule[3]!;
      const base = raw.startsWith("1 ")
        ? 1 + (raw.includes("-") ? -1 : 1) * Number(raw.split(" ").pop())
        : Number(raw);
      const k = rule[5] ? Number(rule[5]) : 0;
      const init = a * base ** k;
      assert.ok(
        Math.abs(Number(key(p).replaceAll("$", "")) - init) < 1e-6,
        `${rule[0]} ${key(p)}`,
      );
    } else assert.fail(p.public.prompt);
  }
});

test("exponential decay table", () => {
  checkTemplate("exponential-decay-table", {
    variants: ["ratio-1-2", "ratio-2-3", "ratio-3-4"],
    axes: { spacing: ["one-step", "two-step"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("exponential-decay-table", `d:${i}`);
    for (const o of options(p)) {
      const v = nums(o.label);
      const ratios = [v[1]! / v[0]!, v[2]! / v[1]!, v[3]! / v[2]!];
      const decay =
        ratios.every((q) => Math.abs(q - ratios[0]!) < 1e-9) &&
        ratios[0]! < 1 &&
        ratios[0]! > 0;
      assert.equal(decay, o.id === p.answer, o.label);
    }
  }
});

test("exponential passes linear", () => {
  checkTemplate("exponential-passes-linear", {
    variants: ["crosses-at-early", "crosses-at-late"],
    axes: { order: ["exponential-first", "linear-first"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("exponential-passes-linear", `x:${i}`);
    const f = p.public.prompt.match(
      /f\(x\) = (\d+)(?:\(([\d.]+)\)|\\cdot(\d+))\^x/,
    )!;
    const g = p.public.prompt.match(/g\(x\) = (\d+)x \+ (\d+)/)!;
    const a = Number(f[1]);
    const b = Number(f[2] ?? f[3]);
    const first = (() => {
      for (let x = 0; x < 60; x++)
        if (a * b ** x > Number(g[1]) * x + Number(g[2])) return x;
      return -1;
    })();
    assert.equal(first, Number(p.answer));
  }
});

test("two-way share", () => {
  checkTemplate("two-way-share", {
    variants: ["cell-0-0", "cell-1-1"],
    axes: { kind: ["conditional-row", "conditional-column", "joint"] },
  });
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("two-way-share", `w:${i}`);
    const fig = JSON.stringify(p.public.figure);
    assert.match(fig, /"type":"table"/);
    const scene = (
      p.public.figure as {
        scene: { components?: unknown[]; children?: unknown[] };
      }
    ).scene;
    assert.ok(scene);
    const pct = nums(key(p))[0]!;
    assert.ok(Number.isInteger(pct) && pct > 0 && pct < 100);
  }
});

test("quartile list", () => {
  checkTemplate("quartile-list", {
    variants: ["n-8", "n-10", "n-12"],
    axes: { ask: ["upper-quartile", "lower-quartile"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("quartile-list", `q:${i}`);
    const values = p.public.prompt
      .match(/values: \$([^$]+)\$/)![1]!
      .split(/,\\ /)
      .map(Number);
    const s = [...values].sort((x, y) => x - y);
    const upper = p.public.prompt.includes("What is the upper");
    const half = upper ? s.slice(s.length / 2) : s.slice(0, s.length / 2);
    const mid = half.length >> 1;
    const q = half.length % 2 ? half[mid]! : (half[mid - 1]! + half[mid]!) / 2;
    assert.equal(Number(p.answer), q);
    assert.ok(new Set(values).size < values.length, "has repeats");
  }
});

test("average rate table", () => {
  checkTemplate("average-rate-table-rounded", {
    variants: ["increasing", "decreasing"],
    axes: { context: ["population-growth", "value-decay"] },
  });
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("average-rate-table-rounded", `a:${i}`);
    const fig = JSON.stringify(p.public.figure);
    const rows = [
      ...fig.matchAll(/"label":"(\d{1,4})","cells":\["([\d,]+)"\]/g),
    ].map((m) => [Number(m[1]), Number(m[2]!.replaceAll(",", ""))] as const);
    assert.ok(rows.length >= 5, fig);
    const years = p.public.prompt.match(
      /(?:from|year) (\d+) to (?:year )?(\d+)/,
    )!;
    const y1 = Number(years[1]);
    const y2 = Number(years[2]);
    const v1 = rows.find(([y]) => y === y1)![1];
    const v2 = rows.find(([y]) => y === y2)![1];
    const rate = (v2 - v1) / (y2 - y1);
    const expected = p.public.prompt.includes("nearest whole")
      ? String(Math.round(rate))
      : (Math.round(rate * 10) / 10).toFixed(1);
    assert.equal(Number(p.answer), Number(expected));
  }
});

test("correlation causation", () => {
  checkTemplate("correlation-causation-choice", {
    variants: [
      "positive-causal",
      "negative-causal",
      "positive-not-causal",
      "negative-not-causal",
    ],
    hintsMin: 8,
  });
});

test("budget whole items", () => {
  checkTemplate("budget-whole-items", {
    variants: ["leftover", "exact-fit"],
    axes: { fit: ["leftover", "exact-fit"] },
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("budget-whole-items", `b:${i}`);
    const [budget, fixed, price] = [
      ...p.public.prompt.matchAll(/\$([\d.]+)\$ dollars/g),
    ].map((m) => Math.round(Number(m[1]) * 100));
    assert.equal(Math.floor((budget! - fixed!) / price!), Number(p.answer));
  }
});

test("abs equals linear", () => {
  checkTemplate("abs-equals-linear-unique", {
    variants: ["right-branch", "left-branch"],
    axes: { slope: ["positive", "negative"] },
    hintsMin: 10,
  });
  for (let i = 0; i < 300; i++) {
    const p = generateProblem("abs-equals-linear-unique", `l:${i}`);
    const f = p.public.prompt.match(
      /f\(x\) = (\d*)\|x(?: ([+-]) (\d+))?\|(?: ([+-]) (\d+))?\$/,
    )!;
    const g = p.public.prompt.match(/g\(x\) = (-?\d*)x ([+-]) (\d+)\$/)!;
    const k = f[1] === "" ? 1 : Number(f[1]);
    const a = f[2] ? (f[2] === "+" ? -1 : 1) * Number(f[3]) : 0;
    const b = f[4] ? (f[4] === "+" ? 1 : -1) * Number(f[5]) : 0;
    const c = g[1] === "" ? 1 : g[1] === "-" ? -1 : Number(g[1]);
    const d = (g[2] === "+" ? 1 : -1) * Number(g[3]);
    const solutions: number[] = [];
    for (let x = -60; x <= 60; x++)
      if (k * Math.abs(x - a) + b === c * x + d) solutions.push(x);
    assert.deepEqual(solutions, [Number(p.answer)], p.public.prompt);
  }
});
