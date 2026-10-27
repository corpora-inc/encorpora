import assert from "node:assert/strict";
import { generatedProblemSchema } from "../../src/math/contracts";
import { generateProblem, type GeneratedProblem } from "../../src/math/engine";
import { revealsAnswer } from "./hint-rules";

/** Seeds 0..399 of one template through the public engine, with the checks
 * every choice family shares: determinism, the public/private contract on
 * every seed, four distinct options with exactly one key and a corrective
 * message on each wrong one, and a hint that never states the key. */
export function sweep(templateId: string, count = 400): GeneratedProblem[] {
  const out: GeneratedProblem[] = [];
  for (let i = 0; i < count; i++) {
    const seed = `kit-${i}`;
    const p = generateProblem(templateId, seed);
    generatedProblemSchema.parse(p);
    assert.equal(p.public.templateId, templateId);
    assert.deepEqual(p, generateProblem(templateId, seed), `${seed} repeats`);
    const r = p.public.response;
    if (r.kind === "choice") {
      assert.equal(r.options.length, 4, seed);
      assert.equal(new Set(r.options.map((o) => o.label)).size, 4, seed);
      assert.ok(
        r.options.some((o) => o.id === p.answer),
        seed,
      );
      for (const o of r.options) {
        assert.equal(
          Boolean(p.choiceFeedback?.[o.id]),
          o.id !== p.answer,
          `${seed} ${o.id} feedback`,
        );
        assert.ok(o.label.length <= 120, `${seed} label length`);
      }
    }
    assert.ok(!revealsAnswer(p, false), `${seed} hint states the answer`);
    assert.ok(p.hint.length > 20, seed);
    out.push(p);
  }
  return out;
}

export const optionLabel = (p: GeneratedProblem) => {
  const r = p.public.response;
  if (r.kind !== "choice") throw new Error("choice expected");
  return r.options.find((o) => o.id === p.answer)!.label;
};

export const variantsOf = (problems: GeneratedProblem[]) =>
  new Set(problems.map((p) => p.variant?.id));
