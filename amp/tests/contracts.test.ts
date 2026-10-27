import { test } from "node:test";
import assert from "node:assert/strict";
import { templates, generateProblem } from "../src/math/engine";
import {
  publicProblemSchema,
  generatedProblemSchema,
} from "../src/math/contracts";
// Contract limits (label length, figure bounds, ids) depend on the seed, so a
// single seed misses families whose output only breaks on some seeds.
const CONTRACT_SEEDS = [
  "contract",
  ...Array.from({ length: 24 }, (_, i) => String(i)),
];
test("every generated family satisfies the runtime contract on a deterministic sample of seeds and answer-bearing public payloads are rejected", () => {
  const failures: string[] = [];
  for (const t of templates) {
    for (const seed of CONTRACT_SEEDS) {
      const p = generateProblem(t.id, seed);
      const generated = generatedProblemSchema.safeParse(p);
      const issue = generated.success
        ? publicProblemSchema.safeParse(p.public).error?.issues[0]
        : generated.error.issues[0];
      if (issue) {
        failures.push(
          `${t.id} seed ${seed}: ${issue.path.join(".")}: ${issue.message}`,
        );
        continue;
      }
      assert.deepEqual(generated.data, p);
      assert.equal(
        publicProblemSchema.safeParse({ ...p.public, answer: p.answer })
          .success,
        false,
        `${t.id} seed ${seed} accepted an answer-bearing public payload`,
      );
    }
  }
  assert.deepEqual(failures, []);
});
test("malformed figures and unsupported versions fail closed", () => {
  const p = generateProblem("fraction-model", "contract").public;
  assert.equal(
    publicProblemSchema.safeParse({ ...p, templateVersion: 2 }).success,
    false,
  );
  assert.equal(
    publicProblemSchema.safeParse({
      ...p,
      figure: { kind: "fraction", selected: 10, parts: 2 },
    }).success,
    false,
  );
  assert.equal(
    publicProblemSchema.safeParse({
      ...p,
      figure: { kind: "html", content: "<script/>" },
    }).success,
    false,
  );
});
