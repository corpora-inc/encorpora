import assert from "node:assert/strict";
import test from "node:test";
import { publicUiFailureProblem } from "../scripts/ui-failure-receipt";

test("UI failure metadata includes only the exact rendered public problem", () => {
  const publicProblem = {
    id: "shown",
    templateId: "quadratic-from-data",
    seed: "replay-seed",
    prompt: "Which equation fits the points?",
    response: { kind: "choice", private: "omit" },
    answer: "omit",
    account: "omit",
    headers: { authorization: "omit" },
  };
  assert.deepEqual(publicUiFailureProblem(publicProblem, "shown"), {
    id: "shown",
    templateId: "quadratic-from-data",
    seed: "replay-seed",
    prompt: "Which equation fits the points?",
    responseKind: "choice",
  });
  assert.equal(publicUiFailureProblem(publicProblem, "prefetched-other"), null);
  assert.equal(publicUiFailureProblem(publicProblem, null), null);
  assert.equal(
    publicUiFailureProblem({ ...publicProblem, seed: undefined }, "shown"),
    null,
  );
  assert.equal(publicUiFailureProblem(null, "shown"), null);
});
