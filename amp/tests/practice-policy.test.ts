import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPracticePolicy,
  DEFAULT_PRACTICE_POLICY,
  practiceParameters,
  type PracticePolicy,
} from "../src/learning/practice-policy.js";
import { selectionDistribution } from "../src/learning/selection-policy.js";
import { planMixedPractice } from "../src/server/mixed-practice.js";
import { estimateFrontier } from "../src/learning/frontier.js";
import { defaultSelectionDigest } from "./practice-policy-fixture.js";
import { buildApp } from "../src/server/app.js";
import type { Repository } from "../src/server/repository.js";
import { skills } from "../src/curriculum/catalog.js";
import { templates } from "../src/math/engine.js";

const candidates = [
  {
    template: { id: "linear-equation", skillId: "linear-equations" },
    score: 100,
  },
  {
    template: { id: "equation-solution-count", skillId: "linear-equations" },
    score: 88,
  },
];
const alternate = () => {
  const parameters = practiceParameters();
  parameters.version = "test-hypothesis";
  return parameters;
};
test("parameter extraction preserves the fixed pre-refactor selection corpus", () => {
  assert.equal(
    defaultSelectionDigest(),
    "5ac07d00c9e6501de52f1a18e13fd45a5de222c735487e1fe8f581374cc7ba4f",
  );
});
test("temperature, window and family weights are independently injectable", () => {
  const base = selectionDistribution(candidates);
  const p = alternate();
  p.sampling.temperature = 120;
  const warm = selectionDistribution(
    candidates,
    undefined,
    createPracticePolicy(p),
  );
  assert.ok(warm[1]!.trace.probability > base[1]!.trace.probability);
  p.sampling.utilityWindow = 0;
  assert.equal(
    selectionDistribution(candidates, undefined, createPracticePolicy(p))
      .length,
    1,
  );
  p.sampling.utilityWindow = 24;
  p.weights.families["equation-solution-count"] = 100;
  assert.ok(
    selectionDistribution(candidates, undefined, createPracticePolicy(p))[1]!
      .trace.probability > 0.9,
  );
  assert.deepEqual(
    selectionDistribution(candidates),
    base,
    "alternate runs cannot mutate the default",
  );
});
test("objective and skill weights affect their own conditional allocation", () => {
  const pool = [
    candidates[0]!,
    { template: { id: "step", skillId: "one-step-equations" }, score: 100 },
    { template: { id: "fraction", skillId: "fraction-division" }, score: 100 },
  ];
  const p = alternate();
  p.weights.objectives["linear-equations"] = 1;
  p.weights.objectives["fraction-operations"] = 9;
  p.weights.skills["linear-equations"] = 9;
  p.weights.skills["one-step-equations"] = 1;
  const distribution = selectionDistribution(
    pool,
    undefined,
    createPracticePolicy(p),
  );
  const linear = distribution.find(
    (e) => e.candidate.template.id === "linear-equation",
  )!;
  assert.ok(Math.abs(linear.trace.objectiveProbability - 0.1) < 1e-12);
  assert.ok(Math.abs(linear.trace.skillProbability - 0.9) < 1e-12);
});
test("policy compilation validates, deep freezes and fingerprints effective parameters", () => {
  const source = alternate();
  const policy = createPracticePolicy(source);
  const reordered = Object.fromEntries(Object.entries(source).reverse());
  assert.equal(createPracticePolicy(reordered).fingerprint, policy.fingerprint);
  assert.equal(
    createPracticePolicy(JSON.parse(JSON.stringify(source))).fingerprint,
    policy.fingerprint,
  );
  source.scoring.uncertaintyWeight = 200;
  source.variety.skillPenalty[1] = 0;
  assert.equal(policy.scoring.uncertaintyWeight, 14);
  assert.equal(policy.variety.skillPenalty[1], 200);
  assert.notEqual(
    createPracticePolicy(source).fingerprint,
    policy.fingerprint,
    "same label with different values must be distinguishable",
  );
  assert.throws(() => {
    (policy.variety.skillPenalty as number[])[1] = 0;
  }, TypeError);
  assert.throws(
    () =>
      selectionDistribution(candidates, undefined, {
        ...policy,
      } as PracticePolicy),
    /createPracticePolicy/,
  );
  const invalid = [
    { ...source, surpriseTypo: 1 },
    { ...source, sampling: { ...source.sampling, temperature: 0 } },
    { ...source, sampling: { ...source.sampling, temperature: NaN } },
    { ...source, scoring: { ...source.scoring, unseenBonus: Infinity } },
    { ...source, variety: { ...source.variety, templateFade: 0 } },
    {
      ...source,
      support: { ...source.support, errorWindow: 2, errorsToRepair: 3 },
    },
    { ...source, support: { ...source.support, demonstratedSuccesses: 6 } },
    { ...source, weights: { ...source.weights, families: { bad: -1 } } },
  ];
  for (const input of invalid) assert.throws(() => createPracticePolicy(input));
});

test("planner consumes custom target, placement and scoring parameters and reports identity", () => {
  const frontier = estimateFrontier({
    start: 8,
    observations: [],
    gradeOf: () => 8,
    strandOf: () => "algebra",
    guessOf: () => 0,
  });
  const options = {
    templates,
    skills,
    attempts: [],
    evidence: [],
    frontier,
    count: 1,
    seed: "policy",
    now: 0,
  };
  const p = alternate();
  p.placement.scriptedOpeners = false;
  p.target = { levelOffset: -8, uncertaintyWeight: 0, clampToAvailable: false };
  const policy = createPracticePolicy(p);
  const choice = planMixedPractice({ ...options, policy })[0]!;
  assert.equal(
    skills.find((s) => s.id === choice.template.skillId)!.gradeBand,
    "K",
  );
  assert.equal(choice.selection!.policyFingerprint, policy.fingerprint);
  assert.equal(choice.selection!.policyVersion, p.version);
  assert.ok(
    !planMixedPractice(options)[0]!.selection,
    "default scripted placement remains in effect",
  );
  const baseline = planMixedPractice({ ...options, openers: [] })[0]!;
  const adjusted = alternate();
  adjusted.scoring.base += 5;
  adjusted.placement.scriptedOpeners = false;
  const changed = planMixedPractice({
    ...options,
    policy: createPracticePolicy(adjusted),
  })[0]!;
  assert.equal(changed.template.id, baseline.template.id);
  assert.equal(changed.selection!.utility, baseline.selection!.utility + 5);
});

test("service injects a trusted policy; request bodies cannot choose one", async () => {
  const frontier = estimateFrontier({
    start: 8,
    observations: [],
    gradeOf: () => 8,
    strandOf: () => "algebra",
    guessOf: () => 0,
  });
  // This endpoint's transaction dependencies only; no database or real learner.
  const tx = {
    satMathFocus: async () => false,
    trialRemaining: async () => null,
    recentAttempts: async () => [],
    skillEvidence: async () => [],
    frontier: async () => frontier,
    practiceSettings: async () => ({
      revision: 0,
      epoch: 0,
      workingTogether: false,
      focusSkillId: null,
      startingLevel: null,
    }),
    recentSkips: async () => [],
    recentWorkbooks: async () => [],
    saveProblem: async () => {},
  };
  const repository = {
    transaction: async (
      _account: string,
      _learner: string,
      run: (value: typeof tx) => unknown,
    ) => run(tx),
  } as unknown as Repository;
  const p = alternate();
  p.placement.scriptedOpeners = false;
  p.target = { levelOffset: -8, uncertaintyWeight: 0, clampToAvailable: false };
  const app = buildApp({
    repository,
    authenticate: async () => "synthetic-account",
    development: true,
    practicePolicy: createPracticePolicy(p),
  });
  try {
    const url = "/api/v1/learners/00000000-0000-4000-8000-000000000001/batches";
    const response = await app.inject({
      method: "POST",
      url,
      payload: { count: 1 },
    });
    assert.equal(response.statusCode, 200, response.body);
    const problem = response.json().problems[0];
    assert.equal(skills.find((s) => s.id === problem.skillId)!.gradeBand, "K");
    const forbidden = await app.inject({
      method: "POST",
      url,
      payload: { count: 1, policy: p },
    });
    assert.equal(forbidden.statusCode, 400);
  } finally {
    await app.close();
  }
});

test("weight references are validated against the applicable catalog", () => {
  for (const kind of ["objectives", "skills", "families"] as const) {
    const p = alternate();
    p.weights[kind]["linear-equatoins"] = 99;
    assert.throws(() => createPracticePolicy(p), /Unknown .* weight/);
  }
  const p = alternate();
  p.weights = { objectives: { synthetic: 2 }, skills: {}, families: {} };
  const policy = createPracticePolicy(p, {
    objectives: ["synthetic"],
    skills: ["synthetic"],
    families: ["synthetic-family"],
  });
  assert.equal(policy.weights.objectives.synthetic, 2);
});

test("repair hypotheses change reservation without changing stored evidence", () => {
  const frontier = estimateFrontier({
    start: 8,
    observations: [],
    gradeOf: () => 8,
    strandOf: () => "algebra",
    guessOf: () => 0,
  });
  const now = Date.parse("2026-10-21T12:00:00Z");
  const family = (id: string, skillId: string) => ({
    id,
    skillId,
    version: 1 as const,
    title: id,
    description: id,
    gradeBand: "6–8" as const,
  });
  const nodes = [
    {
      id: "advanced",
      prerequisites: ["basic"],
      strand: "algebra",
      gradeBand: "8" as const,
    },
    {
      id: "basic",
      prerequisites: [],
      strand: "algebra",
      gradeBand: "7" as const,
    },
    {
      id: "ordinary",
      prerequisites: [],
      strand: "algebra",
      gradeBand: "8" as const,
    },
  ];
  const attempts = [
    {
      id: "miss",
      problemId: "miss",
      requestId: "miss",
      templateId: "advanced-family",
      skillId: "advanced",
      correct: false,
      assisted: false,
      response: "1",
      answer: "2",
      explanation: [],
      createdAt: new Date(now - 600000).toISOString(),
    },
  ];
  const request = {
    templates: [
      family("basic-family", "basic"),
      family("ordinary-family", "ordinary"),
    ],
    skills: nodes,
    frontier,
    attempts,
    evidence: [],
    now,
    count: 1,
    seed: "repair",
    openers: [],
  };
  const original = JSON.stringify(attempts);
  assert.equal(planMixedPractice(request)[0]!.selection!.mode, "adaptive");
  const p = alternate();
  p.support.errorsToRepair = 1;
  const repair = planMixedPractice({
    ...request,
    policy: createPracticePolicy(p),
  })[0]!;
  assert.equal(repair.template.skillId, "basic");
  assert.equal(repair.selection!.mode, "support");
  p.support.reserveSlot = false;
  assert.equal(
    planMixedPractice({ ...request, policy: createPracticePolicy(p) })[0]!
      .selection!.mode,
    "adaptive",
  );
  assert.equal(JSON.stringify(attempts), original);
});
