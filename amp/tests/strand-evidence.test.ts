import test from "node:test";
import assert from "node:assert/strict";
import { templates as catalog } from "../src/math/engine.js";
import type { TemplateMetadata } from "../src/math/contracts.js";
import {
  projectSkillEvidence,
  type PracticeObservation,
} from "../src/server/evidence.js";
import { planMixedPractice } from "../src/server/mixed-practice.js";
import type { Outcome } from "../src/server/repository.js";
const now = Date.parse("2026-10-17T12:00:00Z");
const day = 86400000;
const definitions = [
  ["algebra-entry", "algebra", "K–2"],
  ["advanced-algebra", "algebra", "9–12"],
  ["multiply", "operations", "3–5"],
  ["add", "operations", "K–2"],
  ["geometry-entry", "geometry", "K–2"],
  ["geometry-advanced", "geometry", "9–12"],
  ["data-entry", "data", "K–2"],
  ["data-advanced", "data", "9–12"],
  ["fraction-entry", "fractions", "K–2"],
  ["fraction-advanced", "fractions", "9–12"],
] as const;
const templates: TemplateMetadata[] = definitions.map(([id, , gradeBand]) => ({
  ...catalog[0]!,
  id,
  skillId: id,
  gradeBand,
}));
const skills = definitions.map(([id, strand]) => ({
  id,
  strand,
  prerequisites: [] as string[],
}));
function observation(
  skillId: string,
  index: number,
  correct = true,
  assisted = false,
  at = now - day + index * 60000,
): Outcome {
  return {
    id: String(index).padStart(8, "0"),
    problemId: `p${index}`,
    requestId: `r${index}`,
    skillId,
    templateId: skillId,
    correct,
    assisted,
    createdAt: new Date(at).toISOString(),
    response: "not retained in projection",
    answer: "private",
    explanation: ["private"],
  };
}
function select(history: Outcome[], seed = "case", count = 5) {
  return planMixedPractice({
    templates,
    skills,
    attempts: history.slice(-12),
    evidence: projectSkillEvidence(history),
    count,
    seed,
    now,
  });
}
test("misses and assistance in operations do not remove demonstrated algebra or grant ancestor evidence", () => {
  const history = [
    ...Array.from({ length: 5 }, (_, i) => observation("advanced-algebra", i)),
    observation("multiply", 5, false),
    observation("add", 6, true, true),
    observation("data-entry", 7),
  ];
  assert.ok(select(history).some((c) => c.template.id === "advanced-algebra"));
  const state = projectSkillEvidence(history);
  assert.equal(
    state.find((s) => s.skillId === "algebra-entry"),
    undefined,
  );
  assert.equal(state.find((s) => s.skillId === "add")!.independentCorrect, 0);
  assert.equal(state.find((s) => s.skillId === "add")!.creditedRetrievals, 0);
});
test("burst practice cannot fabricate spaced retrieval; errors reset it and derived records omit answers", () => {
  const history: PracticeObservation[] = Array.from({ length: 6 }, (_, i) =>
    observation("multiply", i, true, false, now + i * day),
  );
  for (let i = 10; i < 400; i++)
    history.push(observation("multiply", i, true, false, now + 5 * day + i));
  let state = projectSkillEvidence(history)[0]!;
  assert.equal(state.creditedRetrievals, 6);
  assert.equal(state.recentOutcomes.length, 5);
  assert.ok(!JSON.stringify(state).includes("private"));
  history.push(observation("multiply", 401, true, true, now + 6 * day));
  state = projectSkillEvidence(history)[0]!;
  assert.equal(state.creditedRetrievals, 0);
  assert.equal(state.reviewDueAt, now + 6 * day);
});

test("an assisted fifth answer cannot promote four independent successes into review readiness", () => {
  const independent = Array.from({ length: 4 }, (_, i) =>
    observation("multiply", i),
  );
  const assisted = projectSkillEvidence([
    ...independent,
    observation("multiply", 4, true, true),
  ])[0]!;
  assert.equal(assisted.status, "practicing");
  assert.equal(assisted.recentIndependentCorrect, 4);
  assert.equal(assisted.creditedRetrievals, 0);
  const missed = projectSkillEvidence([
    ...independent,
    observation("multiply", 4, false),
  ])[0]!;
  assert.equal(missed.status, "practicing");
});

