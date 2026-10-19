import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { ratioRateTemplates } from "../src/math/ratio-rate-practice";
import { rateLinePositions } from "../src/math/ratio-rate-models";

const seeds = Array.from({ length: 400 }, (_, i) => `ratio-rate-${i}`);

test("every ratio and rate family is deterministic and satisfies the contract", () => {
  for (const { id } of ratioRateTemplates)
    for (const seed of seeds.slice(0, 120)) {
      const p = generateProblem(id, seed);
      assert.deepEqual(p, generateProblem(id, seed));
      assert.deepEqual(generatedProblemSchema.parse(p), p);
      assert.ok(!JSON.stringify(p.public).includes(`"answer"`));
    }
});

test("figures show one unknown and true-scale, increasing marks", () => {
  for (const id of [
    "ratio-table-missing",
    "double-number-line-missing",
    "fraction-unit-rate",
  ])
    for (const seed of seeds) {
      const f = generateProblem(id, seed).public.figure;
      assert.ok(f, `${id} needs its figure`);
      if (f.kind === "ratio-table") {
        const cells = f.rows.flatMap((r) => r.values);
        assert.equal(cells.filter((v) => v === null).length, 1);
        continue;
      }
      assert.equal(f.kind, "double-number-line");
      const unknown = [...f.top.numerators, ...f.bottom.numerators].filter(
        (v) => v === null,
      );
      assert.equal(unknown.length, 1);
      const p = rateLinePositions(f);
      assert.equal(p[0], 0);
      assert.equal(Math.max(...p), 1);
      // Neighbouring marks keep room for their labels.
      for (let i = 1; i < p.length; i++) assert.ok(p[i]! - p[i - 1]! >= 1 / 13);
    }
});

test("choice answers are not given away by position or by a shortcut", () => {
  const winners = new Map<string, number>();
  let lowerTotalWins = 0,
    lowerTotalLoses = 0;
  for (const seed of seeds) {
    const p = generateProblem("better-buy", seed);
    const label = (
      p.public.response as { options: { id: string; label: string }[] }
    ).options.find((o) => o.id === p.answer)!.label;
    winners.set(
      label.startsWith("The same") ? "same" : label,
      (winners.get(label.startsWith("The same") ? "same" : label) ?? 0) + 1,
    );
    const totals = [...p.public.prompt.matchAll(/(\d+\.\d\d) dollars/g)].map((m) =>
      Number(m[1]),
    );
    if (label === "Store A" || label === "Store B") {
      const lower = totals[0]! < totals[1]! ? "Store A" : "Store B";
      if (lower === label) lowerTotalWins++;
      else lowerTotalLoses++;
    }
  }
  assert.ok(winners.get("Store A")! > 120 && winners.get("Store B")! > 120);
  assert.ok(winners.get("same")! > 20 && winners.get("same")! < 90);
  // "Pick the cheaper pack" must fail often, and not always.
  assert.ok(lowerTotalWins > 60 && lowerTotalLoses > 150);

  const positions = new Map<string, number>();
  for (const seed of seeds) {
    const p = generateProblem("story-operation-choice", seed);
    positions.set(p.answer, (positions.get(p.answer) ?? 0) + 1);
  }
  for (const id of ["option-a", "option-b", "option-c", "option-d"])
    assert.ok((positions.get(id) ?? 0) > 60, id);
});

test("stories cover every structure and stay within 100", () => {
  const seen = new Set<string>();
  for (const seed of seeds) {
    const p = generateProblem("multiplication-division-story", seed);
    const numbers = (p.public.prompt.match(/\d+/g) ?? []).map(Number);
    assert.ok(numbers.every((n) => n >= 2 && n <= 100));
    assert.ok(Number(p.answer) >= 2 && Number(p.answer) <= 100);
    seen.add(p.explanation[1]!.includes("×") ? "multiply" : "divide");
    seen.add(p.public.response.label);
  }
  assert.ok(seen.has("multiply") && seen.has("divide"));
  for (const label of [
    "Centimeters",
    "Liters",
    "Number of bags",
    "Number of rows",
  ])
    assert.ok(seen.has(label), label);
});
