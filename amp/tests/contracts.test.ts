import { test } from "node:test";
import assert from "node:assert/strict";
import {
  templates,
  generateProblem,
  generateProblemFor,
} from "../src/math/engine";
import {
  clientCanDraw,
  figureCapabilities,
  responseCapabilities,
  type ProblemResponse,
  publicProblemSchema,
  generatedProblemSchema,
} from "../src/math/contracts";
import { responseForClient } from "../src/math/multi-part-choice";

const needs = (r: ProblemResponse): string[] => {
  if (r.kind === "number" || r.kind === "fraction") return [];
  if (r.kind === "choice") return ["single-choice-v1"];
  if (r.kind === "multi-part-choice" && r.layout === "cards")
    return ["multi-part-choice-v1", "multi-part-cards-v1"];
  return [`${r.kind}-v1`];
};

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
      for (const capability of needs(p.public.response)) {
        assert.ok(
          responseCapabilities.some((c) => c === capability),
          `${t.id}: unknown ${capability}`,
        );
        const older = {
          figureCapabilities,
          responseCapabilities: responseCapabilities.filter(
            (c) => c !== capability,
          ),
        };
        if (!clientCanDraw(t, older)) continue;
        const fallback = generateProblemFor(
          t.id,
          seed,
          older.figureCapabilities,
          undefined,
          older.responseCapabilities,
        );
        const publicFallback = responseForClient(
          fallback.public,
          older.responseCapabilities,
        );
        publicProblemSchema.parse(publicFallback);
        assert.ok(
          needs(publicFallback.response).every((c) =>
            older.responseCapabilities.some((cap) => cap === c),
          ),
          `${t.id} ${seed}: client without ${capability} receives ${publicFallback.response.kind}`,
        );
      }
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
    publicProblemSchema.safeParse({ ...p, templateVersion: 0 }).success,
    false,
  );
  assert.equal(
    publicProblemSchema.safeParse({ ...p, templateVersion: 21 }).success,
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
