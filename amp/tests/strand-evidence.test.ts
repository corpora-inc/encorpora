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
test("advanced algebra coexists with multiplication support without lifting untouched strands", () => {
  const history = [
    ...Array.from({ length: 5 }, (_, i) => observation("advanced-algebra", i)),
    observation("multiply", 5, false),
    observation("data-entry", 6),
    observation("fraction-entry", 7),
  ];
  for (let i = 0; i < 100; i++) {
    const choices = select(history, String(i));
    assert.ok(choices.some((c) => c.template.id === "advanced-algebra"));
    assert.ok(
      choices.some(
        (c) => c.template.id === "multiply" && c.reason === "revisit",
      ),
    );
    assert.ok(
      choices.every(
        (c) =>
          !["geometry-advanced", "data-advanced", "fraction-advanced"].includes(
            c.template.id,
          ),
      ),
    );
  }
});
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
test("support and spaced review survive hundreds of intervening attempts in another strand", () => {
  const history = [
    observation("multiply", 0, false),
    ...Array.from({ length: 6 }, (_, i) =>
      observation("advanced-algebra", i + 1, true, false, now - (40 - i) * day),
    ),
  ];
  for (let i = 10; i < 310; i++)
    history.push(observation("data-entry", i, true, false, now - 1000000 + i));
  const state = projectSkillEvidence(history);
  assert.equal(
    state.find((s) => s.skillId === "advanced-algebra")!.creditedRetrievals,
    6,
  );
  assert.equal(
    state.find((s) => s.skillId === "advanced-algebra")!.reviewDueAt,
    now - 5 * day,
  );
  const choices = select(history);
  assert.ok(
    choices.some((c) => c.template.id === "multiply" && c.reason === "revisit"),
  );
  assert.ok(
    choices.some(
      (c) => c.template.id === "advanced-algebra" && c.reason === "review",
    ),
  );
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
test("a demonstrated prerequisite may open a different strand, but a correct probe does not mark ancestors", () => {
  const prerequisite = "data-entry";
  const target = templates.find((t) => t.id === "geometry-advanced")!;
  const graph = skills.map((s) =>
    s.id === target.skillId ? { ...s, prerequisites: [prerequisite] } : s,
  );
  const history = Array.from({ length: 5 }, (_, i) =>
    observation(prerequisite, i),
  );
  const choices = planMixedPractice({
    templates: [target, templates[0]!],
    skills: graph,
    attempts: history,
    evidence: projectSkillEvidence(history),
    count: 2,
    seed: "dag",
    now,
  });
  assert.ok(
    choices.some((c) => c.template.id === target.id && c.reason === "frontier"),
  );
  const probe = projectSkillEvidence([observation(target.id, 10)]);
  assert.equal(probe.length, 1);
  assert.equal(probe[0]!.skillId, target.skillId);
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

test("equal-time reverse IDs cannot turn a latest assisted answer into an independent challenge run", () => {
  const entry = templates.find((t) => t.id === "add")!;
  const probe = {
    ...templates.find((t) => t.id === "multiply")!,
    id: "new-probe",
    skillId: "new-probe",
  };
  const graph = [entry.skillId, probe.skillId, "other-operations"].map(
    (id) => ({ id, strand: "operations", prerequisites: [] }),
  );
  const history: Outcome[] = [
    ...Array.from({ length: 3 }, (_, i) => ({
      ...observation("add", i, true, false, now),
      id: `z${i}`,
    })),
    { ...observation("other-operations", 3, true, true, now), id: "a" },
  ];
  history.forEach((entry, index) => {
    entry.ingestionSequence = String(90071992547409930n + BigInt(index));
  });
  for (const attempts of [history, []]) {
    const result = planMixedPractice({
      templates: [entry, probe],
      skills: graph,
      attempts,
      evidence: projectSkillEvidence(history),
      count: 1,
      seed: "equal-time",
      now,
    });
    assert.equal(result[0]!.template.id, entry.id);
  }
  const independent = history.slice(0, 3);
  const challenge = planMixedPractice({
    templates: [entry, probe],
    skills: graph,
    attempts: [],
    evidence: projectSkillEvidence(independent),
    count: 1,
    seed: "equal-time",
    now,
  });
  assert.equal(challenge[0]!.template.id, probe.id);
});
