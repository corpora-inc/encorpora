import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine";
import { MENTAL_POWERS, powerTemplates } from "../src/math/power-practice";
import { calculatorAllowed } from "../src/math/calculator";
import { lessons } from "../src/content/lessons";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";

const seeds = (n: number) => Array.from({ length: n }, (_, i) => `power-${i}`);

test("integer-power stays in mental-math range and is typeset", () => {
  const allowed = new Set(MENTAL_POWERS.map(([b, e]) => `${b}^${e}`));
  let fifth = 0;
  for (const seed of seeds(2000)) {
    const p = generateProblem("integer-power", seed);
    const m = /\$(\d+)\^\{(\d+)\}\$/.exec(p.public.prompt);
    assert.ok(m, p.public.prompt);
    assert.doesNotMatch(p.public.prompt, /raised to the power/);
    const [b, e] = [Number(m[1]), Number(m[2])];
    assert.ok(e <= 1 || allowed.has(`${b}^${e}`), `${b}^${e}`);
    assert.equal(p.answer, String(b ** e));
    assert.ok(b ** e <= 1_000_000);
    if (e === 5) fifth++;
  }
  // 9⁵ and 7⁵ are gone; a fifth power is 2⁵, 3⁵ or 10⁵ (3 of 32 pairs).
  assert.ok(fifth / 2000 < 0.12, `P(exponent 5) = ${fifth / 2000}`);
  for (const id of ["9^5", "7^5", "8^4", "6^4", "5^5", "4^5"])
    assert.equal(allowed.has(id), false, id);
});

test("exponents 0 and 1 stay, but rarely", () => {
  const low = seeds(2000).filter((seed) =>
    /\^\{[01]\}/.test(generateProblem("integer-power", seed).public.prompt),
  ).length;
  assert.ok(low > 100 && low < 320, `${low} of 2000`);
});

test("the hint builds from a smaller power instead of listing factors", () => {
  const strategic = seeds(400)
    .map((seed) => generateProblem("integer-power", seed))
    .filter((p) => /\^\{([4-9]|10)\}\$/.test(p.public.prompt));
  assert.ok(strategic.length > 50);
  for (const p of strategic) assert.match(p.hint, /\\cdot|zero/, p.hint);
});

test("every powers family is deterministic, calculator-free and taught", () => {
  for (const t of powerTemplates) {
    assert.ok(templates.some((x) => x.id === t.id));
    assert.equal(calculatorAllowed(t, "algebra", 6), false, t.id);
    assert.ok(methods[t.id] && principles[t.id], t.id);
    assert.equal(
      lessons.filter((l) => l.templateIds.includes(t.id)).length,
      1,
      t.id,
    );
    const prompts = new Set<string>();
    for (const seed of seeds(200)) {
      const p = generateProblem(t.id, seed);
      assert.deepEqual(generateProblem(t.id, seed), p);
      prompts.add(p.public.prompt);
      if (p.public.response.kind === "choice") {
        const labels = p.public.response.options.map((o) => o.label);
        assert.equal(new Set(labels).size, labels.length);
        assert.ok(labels.length >= 3);
      }
    }
    assert.ok(prompts.size >= 12, `${t.id}: ${prompts.size} distinct prompts`);
  }
});

test("a doubling story's bars show the givens, never the answer", () => {
  for (const seed of seeds(200)) {
    const p = generateProblem("power-doubling-story", seed);
    assert.equal(p.public.figure?.kind, "scene");
    const values = JSON.stringify(p.public.figure).match(/\d+/g)!.map(Number);
    assert.equal(values.includes(Number(p.answer)), false, p.public.prompt);
  }
});

test("the parentheses trap covers both readings of an exponent", () => {
  const forms = new Set(
    seeds(200).map((seed) => {
      const prompt = generateProblem("power-order-trap", seed).public.prompt;
      return prompt.includes("(") ? "grouped" : "bare";
    }),
  );
  assert.deepEqual([...forms].sort(), ["bare", "grouped"]);
});
