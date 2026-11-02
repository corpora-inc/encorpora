import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem, type GeneratedProblem } from "../src/math/engine.js";

/** Generated worked steps must state each rule exactly, with its conditions. */
const sample = (id: string, n = 40) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `exact-${i}`));
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
