import test from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import {
  operationSentenceChoice,
  operationSentenceGenerate,
  operationSentenceTemplates,
  relatedDivisionSentence,
  relatedSubtractionSentence,
  trueEquationChoice,
} from "../src/math/operation-sentence-practice";
import { enumerateAxes } from "../src/math/variation/axes";

const SEEDS = 400;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gens: Record<string, any> = {
  "operation-sentence-choice": operationSentenceChoice,
  "related-division-sentence": relatedDivisionSentence,
  "related-subtraction-sentence": relatedSubtractionSentence,
  "whole-number-equality-choice": trueEquationChoice,
};
const run = (id: string) =>
  Array.from({ length: SEEDS }, (_, i) => gens[id].generate(`os:${i}`));

for (const t of operationSentenceTemplates)
  test(`${t.id}: deterministic, valid, one correct, no leaks`, () => {
    const hints = new Set<string>();
    const variants = new Set<string>();
    for (let i = 0; i < SEEDS; i++) {
      const seed = `os:${i}`;
      const a = operationSentenceGenerate(t.id, seed);
      assert.deepEqual(a, operationSentenceGenerate(t.id, seed));
      generatedProblemSchema.parse(a);
      const res = a.public.response;
      assert.equal(res.kind, "choice");
      if (res.kind !== "choice") return;
      assert.equal(res.options.length, 4);
      assert.equal(new Set(res.options.map((o) => o.label)).size, 4);
      for (const o of res.options) assert.ok(o.label.length <= 120);
      const correct = res.options.filter((o) => o.id === a.answer);
      assert.equal(correct.length, 1);
      const label = correct[0]!.label;
      assert.ok(!a.public.prompt.includes(label), `${seed} prompt`);
      assert.ok(!a.hint.includes(label), `${seed} hint`);
      for (const o of res.options)
        if (o.id !== a.answer)
          assert.ok(a.choiceFeedback?.[o.id], `${seed} feedback`);
      hints.add(a.hint);
      variants.add(a.variant!.id);
      assert.match(a.variant!.id, /^[a-z0-9][a-z0-9-]{0,63}$/);
    }
    assert.ok(hints.size > 20, "hints vary");
    const axes = gens[t.id].family.axes;
    const expected = enumerateAxes(axes);
    assert.ok(variants.size >= 2);
    const seen = new Set<string>();
    for (const c of run(t.id)) seen.add(JSON.stringify(c.axes));
    assert.equal(seen.size, expected.length, "every axis value is reached");
  });

test("an unknown template is rejected", () => {
  assert.throws(() => operationSentenceGenerate("nope", "x"));
});
