import test from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import {
  equationAfterOneStep,
  expressionAfterFirstStep,
  factorOutChoice,
  oneStepResultGenerate,
  oneStepResultTemplates,
  stepReasonTable,
} from "../src/math/one-step-result-practice";
import { family } from "../src/families/one-step-result";
import { enumerateAxes } from "../src/math/variation/axes";

const SEEDS = 400;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Gen = { family: { axes: any }; generate: (s: string, f?: any) => any };
const gens: Record<string, Gen> = {
  "equation-after-one-step": equationAfterOneStep,
  "expression-after-first-step": expressionAfterFirstStep,
  "factor-out-choice": factorOutChoice,
  "step-reason-table": stepReasonTable,
} as unknown as Record<string, Gen>;

for (const [id, g] of Object.entries(gens)) {
  test(`${id}: contract, one correct, distinct choices, no leaks`, () => {
    const hints = new Set<string>();
    const variants = new Set<string>();
    for (let i = 0; i < SEEDS; i++) {
      const p = g.generate(`os:${i}`).problem;
      assert.deepEqual(g.generate(`os:${i}`).problem, p, "deterministic");
      generatedProblemSchema.parse(p);
      assert.deepEqual(oneStepResultGenerate(id, `os:${i}`), p);
      const r = p.public.response;
      assert.equal(r.kind, "choice");
      const labels = r.options.map((o: { label: string }) => o.label);
      assert.equal(labels.length, 4);
      assert.equal(new Set(labels).size, 4, labels.join(" | "));
      for (const l of labels) assert.ok(l.length <= 120, l);
      const correct = r.options.find((o: { id: string }) => o.id === p.answer);
      assert.ok(correct);
      assert.equal(Object.keys(p.choiceFeedback).length, 3);
      // A line label is part of the shown work, not a leak.
      if (!/^Line \d$/.test(correct.label))
        assert.ok(!p.public.prompt.includes(correct.label), p.public.prompt);
      if (/^Line \d$/.test(correct.label))
        assert.ok(!/line \d/i.test(p.hint), p.hint);
      else assert.ok(!p.hint.includes(correct.label), p.hint);
      assert.ok(!p.hint.includes(`$${correct.label}`));
      hints.add(p.hint);
      variants.add(p.variant.id);
      assert.match(p.variant.id, /^[a-z0-9][a-z0-9-]{0,63}$/);
    }
    assert.ok(hints.size > 20, "hints vary by seed");
    // Every axis combination renders.
    const combos = enumerateAxes(g.family.axes);
    for (const force of combos)
      for (let i = 0; i < 40; i++)
        generatedProblemSchema.parse(g.generate(`ax:${i}`, force).problem);
    assert.ok(variants.size >= 1);
  });
}

test("variant ids cover each structural case", () => {
  const seen = (g: Gen) =>
    new Set(
      Array.from(
        { length: SEEDS },
        (_, i) => g.generate(`v:${i}`).problem.variant.id,
      ),
    );
  assert.equal(seen(factorOutChoice).size, 4);
  assert.equal(seen(stepReasonTable).size, 3);
  assert.equal(seen(expressionAfterFirstStep).size, 2);
});

test("first-wrong-line reaches lines 2, 3 and 4", () => {
  const answers = new Set<string>();
  for (let i = 0; i < SEEDS; i++) {
    const c = expressionAfterFirstStep.generate(`w:${i}`, {
      ask: "first-wrong-line",
    });
    const r = c.problem.public.response as unknown as {
      options: { id: string; label: string }[];
    };
    answers.add(r.options.find((o) => o.id === c.problem.answer)!.label);
  }
  assert.deepEqual([...answers].sort(), ["Line 2", "Line 3", "Line 4"]);
});

test("the family descriptor is complete", () => {
  for (const t of oneStepResultTemplates) {
    assert.ok(family.methods[t.id]?.watch, t.id);
    assert.ok(family.principles[t.id], t.id);
    assert.ok(
      (family.archetypeLinks as Record<string, string[]>)[t.id]?.length,
      t.id,
    );
    assert.ok(
      family.facetMappings.some(
        (f) => f.templateId === t.id && f.extent === "partial",
      ),
    );
    assert.equal(
      family.lessons.filter((l) => l.templateIds.includes(t.id)).length,
      1,
    );
  }
  for (const l of family.lessons) {
    assert.ok(l.objectives.length >= 2 && l.pitfalls.length >= 2);
  }
  for (const m of Object.values(family.methods))
    assert.ok(m.goal.length <= 140);
});
