import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize, chooseTemplate } from "../src/server/progress";
import type { Outcome } from "../src/server/repository";
function attempt(i: number, correct = true, assisted = false): Outcome {
  return {
    id: String(i),
    requestId: String(i),
    problemId: String(i),
    skillId: "add",
    templateId: "add",
    correct,
    assisted,
    response: "2",
    answer: "2",
    explanation: [],
    createdAt: new Date(1700000000000 + i * 1000).toISOString(),
  };
}
test("assistance does not establish independent review readiness", () => {
  assert.equal(
    summarize(
      Array.from({ length: 5 }, (_, i) => attempt(i, true, true)),
      ["add"],
    )[0].status,
    "practicing",
  );
  assert.equal(
    summarize(
      Array.from({ length: 5 }, (_, i) => attempt(i)),
      ["add"],
    )[0].status,
    "review-ready",
  );
});
test("misses select implemented prerequisites and delayed reviews return", () => {
  const templates = [
      { id: "add", skillId: "add" },
      { id: "multiply", skillId: "multiply" },
    ],
    prereqs = new Map([["multiply", ["add"]]]);
  const missed = {
    ...attempt(0, false),
    templateId: "multiply",
    skillId: "multiply",
  };
  assert.equal(chooseTemplate(templates, [missed], prereqs).id, "add");
  assert.equal(
    chooseTemplate(
      templates,
      Array.from({ length: 5 }, (_, i) => attempt(i)),
      prereqs,
      1701000000000,
    ).id,
    "add",
  );
});
