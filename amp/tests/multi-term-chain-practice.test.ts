import test from "node:test";
import assert from "node:assert/strict";
import {
  multiTermChainFamilies,
  multiTermChainTemplates,
  multiTermChainGenerate,
} from "../src/math/multi-term-chain-practice";
import { generatedProblemSchema } from "../src/math/contracts";
import { enumerateAxes } from "../src/math/variation/axes";

const SEEDS = 400;
test("every kit template generates, deterministically, over seeds 0..399", () => {
  for (const t of multiTermChainTemplates) {
    for (let i = 0; i < SEEDS; i++) {
      const a = multiTermChainGenerate(t.id, `k:${i}`);
      const b = multiTermChainGenerate(t.id, `k:${i}`);
      assert.deepEqual(a, b);
      generatedProblemSchema.parse(a);
    }
  }
});
test("every axis value is reachable and hints never state the answer", () => {
  for (const [id, fam] of Object.entries(multiTermChainFamilies)) {
    const seen = new Set<string>();
    for (let i = 0; i < SEEDS; i++) {
      const g = (fam as any).generate(`k:${i}`);
      seen.add(JSON.stringify(g.axes));
      const hint: string = g.problem.hint;
      assert.ok(!hint.includes(`= ${g.problem.answer}`), id);
    }
    const all = enumerateAxes((fam as any).family.axes).map((a) =>
      JSON.stringify(a),
    );
    for (const combo of all)
      assert.ok(seen.has(combo), `${id} missing ${combo}`);
  }
});
