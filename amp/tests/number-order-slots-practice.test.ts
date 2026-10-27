import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import type { MultiPartChoiceResponse } from "../src/math/multi-part-choice";

/** The shown label of each slot's keyed option, in slot order. */
function keyed(id: string, seed: string) {
  const problem = generateProblem(id, seed);
  const response = problem.public.response as MultiPartChoiceResponse;
  const key = JSON.parse(problem.answer) as Record<string, string>;
  return {
    problem,
    slots: response.blanks.map((b) => ({
      label: b.label,
      chosen: b.options.find((o) => o.id === key[b.id])!.label,
    })),
  };
}
const leastFirst = (prompt: string) => /from (the smallest|least)/.test(prompt);
const numeric = (tex: string) => {
  const frac = tex.match(/^\$(-?)\\frac\{(\d+)\}\{(\d+)\}\$$/);
  if (frac) return (frac[1] ? -1 : 1) * (Number(frac[2]) / Number(frac[3]));
  return Number(tex.replaceAll("$", ""));
};

test("stadiums are listed in the order the prompt asks, read from the numbers in the prompt", () => {
  for (let i = 0; i < 200; i++) {
    const { problem, slots } = keyed("order-whole-numbers-slots", `w:${i}`);
    const crowds = [
      ...problem.public.prompt.matchAll(/([A-Z][A-Za-z ]+?) holds ([\d,]+) people/g),
    ].map((m) => ({ name: m[1]!, value: Number(m[2]!.replaceAll(",", "")) }));
    assert.equal(crowds.length, 3);
    const sorted = [...crowds].sort((a, b) => a.value - b.value);
    if (!leastFirst(problem.public.prompt)) sorted.reverse();
    assert.deepEqual(slots.map((s) => s.chosen), sorted.map((c) => c.name));
  }
});

test("fractions and signed numbers are keyed in the order of their values", () => {
  for (const id of ["order-fractions-slots", "order-rationals-slots"])
    for (let i = 0; i < 200; i++) {
      const { problem, slots } = keyed(id, `n:${i}`);
      const values = slots.map((s) => numeric(s.chosen));
      const ascending = leastFirst(problem.public.prompt);
      for (let k = 1; k < values.length; k++)
        assert.ok(ascending ? values[k - 1]! < values[k]! : values[k - 1]! > values[k]!, `${id} ${i}`);
      const listed = problem.public.prompt.split(": ")[1]!.replace(/\.$/, "").split(", ");
      assert.deepEqual([...listed.map(numeric)].sort((a, b) => a - b), [...values].sort((a, b) => a - b));
    }
});
