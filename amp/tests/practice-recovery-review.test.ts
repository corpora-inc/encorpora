import assert from "node:assert/strict";
import test from "node:test";
import { skills } from "../src/curriculum/catalog";
import { satPracticeEligible } from "../src/curriculum/sat";
import { estimateFrontier, type Frontier } from "../src/learning/frontier";
import { defaultPracticeSettings } from "../src/learning/practice-settings";
import { clientCanDraw, figureCapabilities } from "../src/math/contracts";
import { templates } from "../src/math/engine";
import { buildApp } from "../src/server/app";
import { projectSkillEvidence } from "../src/server/evidence";
import { planMixedPractice, templateGrade } from "../src/server/mixed-practice";
import type { Repository, SavedProblem } from "../src/server/repository";

test("due advanced review cannot consume a needed foundation slot", () => {
  const now = Date.parse("2026-10-30T12:00:00Z");
  const nodes = new Map(skills.map((skill) => [skill.id, skill]));
  const advanced = templates.find(
    (template) => template.id === "linear-equation",
  )!;
  const foundation = templates.find(
    (template) => template.id === "multiply-facts",
  )!;
  const advancedStrand = nodes.get(advanced.skillId)!.strand;
  const foundationStrand = nodes.get(foundation.skillId)!.strand;
  const estimate = (level: number) => ({
    level,
    sd: 0,
    answered: 24,
    independent: 24,
  });
  const frontier: Frontier = {
    expected: 4,
    overall: estimate(8),
    adaptive: estimate(8),
    strands: {
      [advancedStrand]: estimate(templateGrade(advanced, nodes) + 0.5),
      [foundationStrand]: estimate(4.5),
    },
    confirmation: {
      [advancedStrand]: { level: 9, foundationConfirmed: true },
      [foundationStrand]: { level: 5, foundationConfirmed: false },
    },
    unconfirmedCeiling: 5,
  };
  const evidence = projectSkillEvidence([
    {
      id: "synthetic-review",
      skillId: advanced.skillId,
      templateId: advanced.id,
      correct: true,
      assisted: false,
      createdAt: new Date(now - 86400000).toISOString(),
    },
  ]);
  assert.ok(evidence[0]!.reviewDueAt! < now);
  for (const seed of ["review-a", "review-b", "review-c"]) {
    const choice = planMixedPractice({
      templates: [advanced, foundation],
      skills,
      frontier,
      attempts: [],
      evidence,
      count: 1,
      seed,
      now,
      openers: [],
    })[0]!;
    assert.equal(
      choice.template.id,
      foundation.id,
      "a confirmed strand's advanced review must leave the reserved foundation opportunity available",
    );
    assert.equal(choice.selection?.purpose, "foundation");
  }
});

test("a persisted focus unsupported by an older client cannot block mixed or explicit practice", async () => {
  const state = { ...defaultPracticeSettings(), focusSkillId: "volume-cubes" };
  const oldClient = { responseCapabilities: [], figureCapabilities: [] };
  const focused = templates.filter(
    (template) => template.skillId === state.focusSkillId,
  );
  assert.ok(focused.length > 0);
  assert.ok(
    focused.every((template) => !clientCanDraw(template, oldClient)),
    "the regression requires an entirely unsupported persisted skill",
  );
  let satFocus = false;
  const saved: SavedProblem[] = [];
  const tx = {
    satMathFocus: async () => satFocus,
    trialRemaining: async () => null,
    recentAttempts: async () => [],
    recentSkips: async () => [],
    skillEvidence: async () => [],
    practiceSettings: async () => state,
    frontier: async () =>
      estimateFrontier({
        start: 4,
        observations: [],
        gradeOf: () => 4,
        strandOf: () => "math",
        guessOf: () => 0,
      }),
    saveProblem: async (problem: SavedProblem) => {
      saved.push(problem);
    },
  };
  const repository = {
    transaction: async (
      _account: string,
      _learner: string,
      run: (transaction: typeof tx) => unknown,
    ) => run(tx),
  } as unknown as Repository;
  const app = buildApp({
    repository,
    authenticate: async () => "synthetic-family",
    development: true,
  });
  const url = "/api/v1/learners/00000000-0000-4000-8000-000000000001/batches";
  try {
    for (const sat of [false, true]) {
      satFocus = sat;
      const response = await app.inject({
        method: "POST",
        url,
        payload: { count: 1, ...oldClient },
      });
      assert.equal(response.statusCode, 200, response.body);
      const selected = templates.find(
        (template) => template.id === response.json().problems[0].templateId,
      )!;
      assert.ok(clientCanDraw(selected, oldClient));
      if (sat)
        assert.ok(
          satPracticeEligible(selected),
          "capability fallback must preserve SAT selection",
        );
    }
    satFocus = false;
    const explicit = await app.inject({
      method: "POST",
      url,
      payload: { count: 1, templateId: "multiply-facts", ...oldClient },
    });
    assert.equal(explicit.statusCode, 200, explicit.body);
    assert.equal(explicit.json().problems[0].templateId, "multiply-facts");

    const capable = await app.inject({
      method: "POST",
      url,
      payload: {
        count: 1,
        responseCapabilities: [],
        figureCapabilities: [...figureCapabilities],
      },
    });
    assert.equal(capable.statusCode, 200, capable.body);
    assert.equal(
      capable.json().problems[0].skillId,
      state.focusSkillId,
      "a client-specific fallback must preserve the focus for capable clients",
    );
    assert.equal(saved.length, 4);
  } finally {
    await app.close();
  }
});
