import { test } from "node:test";
import assert from "node:assert/strict";
import { skills } from "../src/curriculum/catalog.js";
import { templates } from "../src/math/engine.js";
import {
  auditSelectionCatalog,
  selectionObjectives,
  skillEmphasis,
  familyEmphasis,
} from "../src/curriculum/selection.js";
import {
  selectNextCandidate,
  selectionDistribution,
  type SelectionCandidate,
  type SelectionBudget,
} from "../src/learning/selection-policy.js";
import { estimateFrontier } from "../src/learning/frontier.js";
import { projectSkillEvidence } from "../src/server/evidence.js";
import type { Outcome } from "../src/server/repository.js";
import { planMixedPractice } from "../src/server/mixed-practice.js";

const candidate = (
  id: string,
  skillId: string,
  score = 100,
): SelectionCandidate => ({ template: { id, skillId }, score });
const base = [candidate("ordinary", "mainstream"), candidate("rare", "niche")];
const budget = (c: SelectionCandidate): SelectionBudget => ({
  objectiveId: c.template.skillId === "mainstream" ? "core" : "extension",
  importance: c.template.skillId === "mainstream" ? 6 : 1,
  skillWeight: 1,
  familyWeight: 1,
});
const probability = (
  entries: ReturnType<typeof selectionDistribution>,
  predicate: (e: (typeof entries)[number]) => boolean,
) => entries.filter(predicate).reduce((sum, e) => sum + e.trace.probability, 0);
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test("all curriculum nodes have exactly one explicit budget and all weights resolve", () => {
  assert.deepEqual(
    auditSelectionCatalog(
      skills.map((s) => s.id),
      templates.map((t) => t.id),
    ),
    [],
  );
  assert.equal(
    new Set(selectionObjectives.map((o) => o.id)).size,
    selectionObjectives.length,
  );
  for (const n of [
    ...selectionObjectives.flatMap((o) => [o.importance, o.assessmentEmphasis]),
    ...Object.values(skillEmphasis),
    ...Object.values(familyEmphasis),
  ])
    assert.ok(Number.isFinite(n) && n > 0 && n <= 100);
  assert.ok(
    auditSelectionCatalog(
      [...skills.map((s) => s.id), "unassigned-new-node"],
      templates.map((t) => t.id),
    ).includes("Unbudgeted skill: unassigned-new-node"),
  );
});

test("a hundred niche generators share the same objective probability as one", () => {
  for (const count of [1, 10, 100]) {
    const pool = [
      base[0]!,
      ...Array.from({ length: count }, (_, i) =>
        candidate(`rare-${i}`, "niche"),
      ),
    ];
    const distribution = selectionDistribution(pool, budget);
    close(
      probability(distribution, (e) => e.trace.objectiveId === "extension"),
      1 / 7,
    );
    close(
      probability(distribution, () => true),
      1,
    );
    for (const e of distribution)
      close(
        e.trace.probability,
        e.trace.objectiveProbability *
          e.trace.skillProbability *
          e.trace.familyProbability,
      );
  }
});

test("splitting graph nodes within one objective cannot increase its allocation", () => {
  const pool = [
    base[0]!,
    ...Array.from({ length: 100 }, (_, i) =>
      candidate(`step-${i}`, `niche-step-${i}`),
    ),
  ];
  const distribution = selectionDistribution(pool, budget);
  close(
    probability(distribution, (e) => e.trace.objectiveId === "extension"),
    1 / 7,
  );
});

test("generator count cannot change another equally important skill's allocation", () => {
  const pool = [
    base[0]!,
    ...Array.from({ length: 100 }, (_, i) => candidate(`rare-${i}`, "niche")),
  ];
  const distribution = selectionDistribution(pool, (c) => ({
    ...budget(c),
    objectiveId: "shared",
    importance: 1,
  }));
  close(
    probability(
      distribution,
      (e) => e.candidate.template.skillId === "mainstream",
    ),
    0.5,
  );
});

test("family weights change only the conditional distribution within their skill", () => {
  const pool = [base[0]!, base[1]!, candidate("rare-special", "niche")];
  const distribution = selectionDistribution(pool, (c) => ({
    ...budget(c),
    familyWeight: c.template.id === "rare" ? 3 : 1,
  }));
  close(
    probability(distribution, (e) => e.trace.objectiveId === "extension"),
    1 / 7,
  );
  close(
    distribution.find((e) => e.candidate.template.id === "rare-special")!.trace
      .familyProbability,
    0.25,
  );
});

test("frontier fit can exclude an important but inappropriate skill", () => {
  const distribution = selectionDistribution(
    [candidate("ordinary", "mainstream", 70), base[1]!],
    budget,
  );
  assert.equal(distribution.length, 1);
  assert.equal(distribution[0]!.candidate.template.id, "rare");
  close(distribution[0]!.trace.probability, 1);
});

test("seeded draws follow weights, ignore input ordering, and preserve objective draws after duplication", () => {
  const expanded = [
    base[0]!,
    ...Array.from({ length: 20 }, (_, i) => candidate(`rare-${i}`, "niche")),
  ];
  let rare = 0;
  for (let i = 0; i < 4000; i++) {
    const seed = String(i);
    const selected = selectNextCandidate(base, seed, budget);
    const duplicate = selectNextCandidate(expanded, seed, budget);
    assert.equal(selected.trace.objectiveId, duplicate.trace.objectiveId);
    assert.deepEqual(
      duplicate,
      selectNextCandidate([...expanded].reverse(), seed, budget),
    );
    rare += Number(selected.trace.objectiveId === "extension");
  }
  assert.ok(Math.abs(rare / 4000 - 1 / 7) < 0.02, String(rare / 4000));
});

test("invalid policy inputs fail explicitly", () => {
  assert.deepEqual(selectionDistribution([]), []);
  assert.throws(
    () => selectNextCandidate([], "empty"),
    /No selection candidates/,
  );
  assert.throws(() => selectionDistribution([base[0]!, base[0]!]), /Duplicate/);
  for (const score of [NaN, Infinity, -Infinity])
    assert.throws(
      () => selectionDistribution([candidate("bad", "bad", score)]),
      /utility/,
    );
  for (const value of [0, -1, NaN, Infinity, 101])
    assert.throws(
      () =>
        selectionDistribution(base, (c) => ({
          ...budget(c),
          importance: value,
        })),
      /budget/,
    );
  assert.throws(
    () =>
      selectionDistribution(base, (c) => ({
        ...budget(c),
        objectiveId: "same",
      })),
    /Inconsistent objective/,
  );
});

test("production planner preserves skill exposure when an equally fitting family is duplicated", () => {
  const nodes = ["mainstream", "niche"].map((id) => ({
    id,
    prerequisites: [],
    strand: "algebra",
    gradeBand: "8" as const,
  }));
  const family = (id: string, skillId: string) => ({
    id,
    skillId,
    version: 1 as const,
    gradeBand: "6–8" as const,
    title: id,
    description: id,
  });
  const common = family("ordinary", "mainstream");
  const request = {
    skills: nodes,
    attempts: [],
    evidence: [],
    count: 1,
    openers: [],
    now: 0,
  };
  let niche = 0;
  for (let i = 0; i < 500; i++) {
    const seed = String(i);
    const single = planMixedPractice({
      ...request,
      seed,
      templates: [common, family("rare", "niche")],
    })[0]!;
    const many = planMixedPractice({
      ...request,
      seed,
      templates: [
        common,
        ...Array.from({ length: 20 }, (_, j) => family(`rare-${j}`, "niche")),
      ],
    })[0]!;
    assert.equal(single.template.skillId, many.template.skillId);
    close(single.selection!.probability, 0.5);
    niche += Number(many.template.skillId === "niche");
  }
  assert.ok(niche / 500 > 0.4 && niche / 500 < 0.6);
});

test("family recency cannot inflate skill probability when a fresh duplicate is added", () => {
  const old = { ...base[0]!, familyScore: 40 };
  const duplicate = {
    ...candidate("ordinary-copy", "mainstream"),
    familyScore: 100,
  };
  const before = selectionDistribution([old, base[1]!], budget);
  const after = selectionDistribution([old, duplicate, base[1]!], budget);
  close(
    probability(before, (e) => e.trace.objectiveId === "core"),
    probability(after, (e) => e.trace.objectiveId === "core"),
  );
  assert.ok(
    after.find((e) => e.candidate.template.id === "ordinary-copy")!.trace
      .familyProbability > 0.99,
  );
});

test("production history: extra fresh family does not evade curriculum recency", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  const nodes = ["aa", "bb", "other"].map((id) => ({
    id,
    prerequisites: [],
    strand: id === "other" ? "geometry" : "algebra",
    gradeBand: "8" as const,
  }));
  const family = (id: string, skillId: string) => ({
    id,
    skillId,
    version: 1 as const,
    gradeBand: "6–8" as const,
    title: id,
    description: id,
  });
  const attempts: Outcome[] = Array.from({ length: 9 }, (_, i) => ({
    id: String(i),
    problemId: String(i),
    requestId: String(i),
    templateId: i === 0 ? "a" : "other",
    skillId: i === 0 ? "aa" : "other",
    correct: true,
    assisted: false,
    response: "1",
    answer: "1",
    explanation: [],
    createdAt: new Date(now - (10 - i) * 60000).toISOString(),
  }));
  const frontier = estimateFrontier({
    start: 8,
    observations: [],
    gradeOf: () => 8,
    strandOf: () => "algebra",
    guessOf: () => 0,
  });
  const request = {
    skills: nodes,
    attempts,
    evidence: projectSkillEvidence(attempts),
    frontier,
    count: 1,
    openers: [],
    now,
  };
  let selectedA = 0;
  for (let i = 0; i < 1000; i++) {
    const seed = String(i);
    const before = planMixedPractice({
      ...request,
      seed,
      templates: [family("a", "aa"), family("b", "bb")],
    })[0]!;
    const after = planMixedPractice({
      ...request,
      seed,
      templates: [
        family("a", "aa"),
        family("a-clone", "aa"),
        family("b", "bb"),
      ],
    })[0]!;
    assert.equal(before.template.skillId, after.template.skillId);
    close(
      before.selection!.objectiveProbability,
      after.selection!.objectiveProbability,
    );
    selectedA += Number(after.template.skillId === "aa");
  }
  assert.ok(selectedA > 100 && selectedA < 500, String(selectedA));
});
