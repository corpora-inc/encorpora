import { test } from "node:test";
import assert from "node:assert/strict";
import { planMixedPractice, reviewDueAt } from "../src/server/mixed-practice";
import { summarize } from "../src/server/progress";
import { projectSkillEvidence } from "../src/server/evidence.js";
import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import type { Outcome } from "../src/server/repository";
const now = Date.parse("2026-10-17T12:00:00Z");
function answer(
  templateId: string,
  index: number,
  correct = true,
  assisted = false,
  at = now + index * 60000,
): Outcome {
  const template = templates.find((entry) => entry.id === templateId)!;
  return {
    id: String(index).padStart(6, "0"),
    problemId: `problem-${index}`,
    requestId: `request-${index}`,
    templateId,
    skillId: template.skillId,
    correct,
    assisted,
    response: "1",
    answer: "1",
    explanation: [],
    createdAt: new Date(at).toISOString(),
  };
}
function plan(attempts: Outcome[], count = 3, seed = "fixed", time = now) {
  return planMixedPractice({
    templates,
    skills,
    attempts,
    count,
    seed,
    now: time,
    evidence: projectSkillEvidence(attempts),
  });
}
test("fresh sessions mix distinct strands and reserve different skills within a batch", () => {
  for (let seed = 0; seed < 100; seed++) {
    const choices = plan([], 3, String(seed));
    assert.equal(new Set(choices.map((choice) => choice.strand)).size, 3);
    assert.equal(
      new Set(choices.map((choice) => choice.template.skillId)).size,
      3,
    );
    assert.ok(choices.every((choice) => choice.template.gradeBand === "K–2"));
  }
  assert.deepEqual(plan([], 3, "same"), plan([], 3, "same"));
});
test("a mistake does not trap the learner in immediate same-family retry", () => {
  const attempts = [answer("integer-power", 0, false)];
  const choices = plan(attempts);
  assert.notEqual(choices[0].template.id, "integer-power");
  assert.ok(choices[0].strand !== "algebra");
});
test("independent success widens challenge sampling without granting prerequisite mastery", () => {
  const attempts = [
    answer("integer-power", 0),
    answer("ratio-missing", 1),
    answer("line-slope", 2),
  ];
  const choices = plan(attempts, 5);
  assert.ok(new Set(choices.map((choice) => choice.strand)).size >= 3);
  assert.ok(
    choices.some(
      (choice) =>
        choice.template.gradeBand === "6–8" ||
        choice.template.gradeBand === "9–12",
    ),
  );
  assert.ok(choices.some((choice) => choice.reason === "explore"));
  assert.equal(summarize(attempts, ["powers-of-ten"])[0].attempts, 0);
});
test("spacing credits separated retrievals, not a burst of same-minute answers", () => {
  const burst = Array.from({ length: 5 }, (_, index) =>
    answer("multiply-facts", index),
  );
  assert.equal(
    reviewDueAt(burst),
    Date.parse(burst.at(-1)!.createdAt) + 6 * 3600000,
  );
  const spaced = [
    answer("multiply-facts", 0, true, false, now),
    answer("multiply-facts", 1, true, false, now + 86400000),
  ];
  assert.equal(reviewDueAt(spaced), now + 2 * 86400000);
  const assisted = [
    ...spaced,
    answer("multiply-facts", 2, true, true, now + 3 * 86400000),
  ];
  assert.equal(reviewDueAt(assisted), now + 3 * 86400000);
});
test("missed skills return after intervening work and successful old strands return for review", () => {
  const attempts = [
    answer("add-within-20", 0, false),
    answer("count-objects", 1),
    answer("bar-chart-total", 2),
  ];
  const choices = plan(attempts, 3);
  assert.ok(
    choices.some(
      (choice) =>
        choice.template.skillId === "addition-within-20" &&
        choice.reason === "revisit",
    ),
  );
  const old = [
    answer("fraction-model", 0, true, false, now - 5 * 86400000),
    answer("integer-power", 1, true, false, now - 60000),
  ];
  assert.ok(
    plan(old, 5).some(
      (choice) =>
        choice.template.skillId === "fraction-model" &&
        choice.reason === "review",
    ),
  );
});
test("long independent-success sessions traverse strands and do not remain a single-topic drill", () => {
  const attempts: Outcome[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < 60; index++) {
    const choice = plan(
      attempts,
      1,
      `session-${index}`,
      now + index * 60000,
    )[0];
    if (index)
      assert.notEqual(choice.template.skillId, attempts.at(-1)!.skillId);
    seen.add(choice.strand);
    attempts.push(answer(choice.template.id, index));
  }
  const entryStrands = new Set(
    templates
      .filter((t) => t.gradeBand === "K–2")
      .map((t) => skills.find((s) => s.id === t.skillId)!.strand),
  );
  assert.ok(seen.size >= entryStrands.size, `Only visited ${[...seen]}`);
  // Sixty correct answers spread across strands do not establish high-school readiness.
  assert.ok(new Set(attempts.map((attempt) => attempt.skillId)).size >= 10);
});
test("mixed planning rejects invalid bounds and supports a one-template catalog", () => {
  assert.throws(() => plan([], 0), /batch size/);
  assert.throws(() => plan([], 6), /batch size/);
  const choices = planMixedPractice({
    templates: templates.slice(0, 1),
    skills,
    attempts: [],
    evidence: [],
    count: 3,
    seed: "only",
    now,
  });
  assert.equal(choices.length, 3);
});
test("remediation traverses unimplemented intermediate nodes and terminates cycles", () => {
  const target = templates.find((t) => t.id === "integer-power")!;
  const ancestor = templates.find((t) => t.id === "multiply-facts")!;
  const graph = [
    { id: target.skillId, strand: "algebra", prerequisites: ["gap"] },
    {
      id: "gap",
      strand: "algebra",
      prerequisites: ["cycle", ancestor.skillId],
    },
    { id: "cycle", strand: "algebra", prerequisites: ["gap"] },
    { id: ancestor.skillId, strand: "arithmetic", prerequisites: [] },
  ];
  const choices = planMixedPractice({
    templates,
    skills: graph,
    attempts: [answer(target.id, 0, false)],
    evidence: [],
    count: 3,
    seed: "ancestor",
    now,
  });
  assert.ok(
    choices.some(
      (choice) =>
        choice.template.id === ancestor.id && choice.reason === "prerequisite",
    ),
  );
});
