import { test } from "node:test";
import assert from "node:assert/strict";
import { templates, generateProblem } from "../src/math/engine";
import {
  publicProblemSchema,
  generatedProblemSchema,
} from "../src/math/contracts";
test("every generated family satisfies the runtime contract and answer-bearing public payloads are rejected", () => {
  for (const t of templates) {
    const p = generateProblem(t.id, "contract");
    assert.deepEqual(generatedProblemSchema.parse(p), p);
    assert.equal(
      publicProblemSchema.safeParse({ ...p.public, answer: p.answer }).success,
      false,
    );
  }
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
