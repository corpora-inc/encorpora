import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem, type GeneratedProblem } from "../src/math/engine.js";

/** Generated worked steps must state each rule exactly, with its conditions. */
const sample = (id: string, n = 40, version?: number) =>
  Array.from({ length: n }, (_, i) =>
    generateProblem(id, `exact-${i}`, version),
  );
const text = (p: GeneratedProblem) => [p.hint, ...p.explanation].join("\n");
const options = (p: GeneratedProblem) => {
  const r = p.public.response;
  return "options" in r ? r.options.map((o) => o.label) : [];
};

test("scaling both parts of a fraction or ratio excludes 0", () => {
  for (const id of ["equivalent-fractions-select", "equivalent-ratios-select"])
    for (const p of sample(id))
      assert.match(
        p.explanation[0]!,
        /same number, other than 0/,
        `${id}: multiplying both parts by 0 does not keep the amount`,
      );
});

test("rounding names both boundaries, including the halfway value that rounds up to the target", () => {
  for (const p of sample("rounds-to-select")) {
    const m =
      /round to \$([\d.]+)\$ at the nearest (whole number|tenth|hundredth)/.exec(
        p.public.prompt,
      )!;
    const places = { "whole number": 0, tenth: 1, hundredth: 2 }[m[2]!]!;
    const half = 5 / 10 ** (places + 1);
    const fmt = (v: number) => String(Number(v.toFixed(places + 1)));
    const low = fmt(Number(m[1]) - half);
    const high = fmt(Number(m[1]) + half);
    const rule = p.explanation[1]!;
    assert.ok(
      rule.includes(`at least $${low}$`) &&
        rule.includes(`less than $${high}$`),
      `${p.public.prompt}: ${rule}`,
    );
  }
});

test("perpendicular sides need not meet: the shape-sides steps say so", () => {
  const perpendicular = sample("shape-sides-select", 60).filter((p) =>
    /perpendicular/.test(p.public.prompt),
  );
  assert.ok(perpendicular.length > 0);
  for (const p of perpendicular)
    assert.match(
      text(p),
      /extended/,
      "An octagon has perpendicular sides that never touch; the steps must cover sides that meet only when extended",
    );
});

test("a choice called a number sentence has an equals or comparison sign", () => {
  for (const id of ["area-tiling-distributive"])
    for (const p of sample(id))
      if (/number sentence/.test(p.public.prompt))
        for (const label of options(p))
          assert.match(label, /[=<>]/, `${id}: "${label}" is not a sentence`);
});

const feedbacks = (p: GeneratedProblem) =>
  Object.values(p.choiceFeedback ?? {});

test("equal groups: adding one copy per group counts them, so steps never say adding cannot", () => {
  for (const p of sample("operation-sentence-choice", 80)) {
    const all = text(p);
    assert.doesNotMatch(all, /Adding, taking away or sharing would not count/);
    const m = /Adding (\d+) once for each group does: \$([\d+]+)=(\d+)\$/.exec(
      all,
    );
    if (!m) continue;
    const terms = m[2]!.split("+").map(Number);
    assert.ok(terms.every((t) => t === Number(m[1])));
    assert.equal(
      terms.reduce((a, b) => a + b, 0),
      Number(m[3]),
    );
  }
});

test("a power is copies multiplied, never a number multiplied by itself n times", () => {
  for (const p of sample("rg-exponent-monomial-power", 60)) {
    const all = [text(p), ...feedbacks(p)].join("\n");
    assert.doesNotMatch(all, /multiplied by itself \d+ times/);
    for (const m of all.matchAll(
      /(\d+) copies of (-?\d+) multiplied, \$([^$]+)\$/g,
    )) {
      const factors = m[3]!.split("\\times");
      assert.equal(factors.length, Number(m[1]));
      assert.ok(
        factors.every((f) => Number(f.replace(/[()]/g, "")) === Number(m[2])),
      );
    }
  }
});

test("a factored polynomial's zeros: one factor can give more than one zero", () => {
  for (const p of sample("rg-polynomial-zeros-forms", 10))
    assert.doesNotMatch(text(p), /each factor that can equal 0 gives one zero/);
});

test("absolute value: 'within' is used only for at most, never for strictly less than", () => {
  const seen = new Set<string>();
  for (const p of sample("absolute-compound-inequality", 80))
    for (const step of p.explanation) {
      const m = /^\$\|[^|]+\|(<|>|\\le |\\ge )(\d+)\$ means/.exec(step);
      if (!m) continue;
      seen.add(m[1]!);
      const words = {
        "<": `less than ${m[2]} away`,
        "\\le ": `within ${m[2]} of 0, ${m[2]} or less away`,
        ">": `more than ${m[2]} away`,
        "\\ge ": `at least ${m[2]} away`,
      }[m[1]!]!;
      assert.ok(step.includes(words), step);
    }
  assert.equal(seen.size, 4, "every inequality sign was sampled");
});

test("least squares: each shown residual total is the sum of the shown squares", () => {
  // This checks the original model-choice explanation; construction and
  // interpretation surfaces have their own independent clause oracle.
  for (const p of sample("nonlinear-data-model", 30, 1)) {
    const pairs = [...p.public.prompt.matchAll(/\((\d+),(\d+)\)/g)].map((m) =>
      Number(m[2]),
    );
    let seen = 0;
    for (const step of p.explanation) {
      const m =
        /the predicted amounts are \$([^$]+)\$\. The residuals are \$([^$]+)\$, and their squares add to \$[^=]+=(\d+)\$/.exec(
          step,
        );
      if (!m) continue;
      seen++;
      const predicted = m[1]!.split(", ").map(Number);
      const residuals = m[2]!.split(", ").map(Number);
      residuals.forEach((e, i) => assert.equal(e, pairs[i]! - predicted[i]!));
      assert.equal(
        residuals.reduce((s, e) => s + e * e, 0),
        Number(m[3]),
      );
    }
    assert.equal(seen, 4, p.public.prompt);
  }
});

test("mixed-number cost: whole units plus the fraction, each part exact and adding to the total", () => {
  for (const p of sample("mixed-quantity-discount", 60)) {
    const step = p.explanation[1]!;
    const m = /Together: \$([\d.]+)\+([\d.]+)=([\d.]+)\$/.exec(step)!;
    assert.ok(m, step);
    const cents = (s: string) => Math.round(Number(s) * 100);
    assert.equal(cents(m[1]!) + cents(m[2]!), cents(m[3]!));
    for (const [, a, op, b, c] of step.matchAll(
      /\$([\d.]+)\\(times|div)([\d.]+)=([\d.]+)\$/g,
    )) {
      const exact =
        op === "times" ? Number(a) * Number(b) : Number(a) / Number(b);
      assert.equal(Math.round(exact * 1e6), Math.round(Number(c) * 1e6), step);
    }
  }
});

test("vector conditions name the nonzero case", () => {
  for (const id of ["fl-vector-dot-product", "fl-vector-angle"])
    for (const p of sample(id, 30))
      for (const line of text(p).split("\n"))
        if (/perpendicular (exactly )?when|parallel when/.test(line))
          assert.match(line, /nonzero|other than/, `${id}: ${line}`);
});
