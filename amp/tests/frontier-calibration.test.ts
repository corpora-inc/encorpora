import { test } from "node:test";
import assert from "node:assert/strict";
import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import type { TemplateMetadata } from "../src/math/contracts";
import {
  templateCalibration,
  gradeCalibration,
  itemSuccess,
  itemInformation,
  editorialCalibration,
} from "../src/learning/item-calibration";
import { estimateExperimentalFrontier as estimateFrontier } from "../src/learning/experimental-frontier";
import { projectSkillEvidence } from "../src/server/evidence";
import { planExperimentalMixedPractice as planMixedPractice } from "../src/server/experimental-mixed-practice";
import { simulateFrontier } from "../scripts/frontier/simulation";
import {
  evaluationPopulations,
  developmentPopulations,
} from "../scripts/frontier/synthetic-learner";
import { fitSyntheticItem } from "../scripts/frontier/calibration-fit";

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
test("calibration covers every active template and future IDs without modifying the registry", () => {
  for (const key of Object.keys(editorialCalibration))
    assert.ok(
      templates.some(
        (template) => `${template.id}@${template.version}` === key,
      ),
      key,
    );
  for (const template of templates) {
    const item = templateCalibration(template, nodes);
    assert.ok(Number.isFinite(item.difficulty));
    assert.ok(item.discrimination > 0 && item.discrimination <= 3);
    assert.ok(item.guess >= 0 && item.guess + item.slip < 1);
    assert.ok(itemSuccess(-1, item) < itemSuccess(13, item));
    assert.ok(Number.isFinite(itemInformation({ level: 6, sd: 2 }, item)));
  }
  const future = {
    ...templates[0]!,
    id: "future-unregistered-template",
    skillId: "future-skill",
    gradeBand: "6–8" as const,
  };
  assert.deepEqual(templateCalibration(future, new Map()), gradeCalibration(7));
  assert.equal(
    templateCalibration(
      { ...future, requiredResponseCapability: "single-choice-v1" },
      nodes,
    ).guess,
    0.25,
  );
});

test("item difficulty changes the estimator likelihood", () => {
  const estimate = (difficulty: number) =>
    estimateFrontier({
      start: 4,
      observations: [{ templateId: "example", correct: true, assisted: false }],
      gradeOf: () => 4,
      strandOf: () => "example",
      itemOf: () => ({ ...gradeCalibration(4), difficulty }),
    });
  assert.ok(estimate(6).overall.level > estimate(2).overall.level + 0.5);
});

test("the target band is configurable, validated, and independent of catalog ordering", () => {
  const catalog: TemplateMetadata[] = [3, 4, 5].map((grade) => ({
    ...templates[0]!,
    id: `item-${grade}`,
    skillId: `skill-${grade}`,
    gradeBand: "3–5",
  }));
  const graph = [3, 4, 5].map((grade) => ({
    id: `skill-${grade}`,
    strand: "number",
    prerequisites: [],
    gradeBand: String(grade) as "3" | "4" | "5",
  }));
  const select = (targetBand: readonly [number, number], reversed = false) =>
    planMixedPractice({
      templates: reversed ? [...catalog].reverse() : catalog,
      skills: graph,
      attempts: [],
      evidence: [],
      count: 1,
      seed: "fixed",
      now: 0,
      targetBand,
      frontier: {
        expected: 4,
        overall: { level: 4, sd: 0.3, answered: 20, independent: 15 },
        strands: {},
      },
    })[0]!;
  assert.equal(select([0.65, 0.75]).template.id, "item-4");
  assert.equal(select([0.85, 0.95]).template.id, "item-3");
  assert.deepEqual(select([0.65, 0.75]), select([0.65, 0.75], true));
  for (const band of [
    [0.8, 0.7],
    [NaN, 0.8],
    [0.7, 1],
    [0.5, 0.8],
  ] as const)
    assert.throws(() => select(band), /target success band/);
});

test("independent synthetic evaluation scenarios bound error, review debt, diversity and detection", () => {
  const runs = evaluationPopulations.flatMap((population) =>
    [101, 307].map((seed) => simulateFrontier(population, seed)),
  );
  // Bounds characterize this fixed experiment, not a monotonic guarantee or
  // evidence of efficacy. Curriculum additions may warrant a reviewed update.
  for (const run of runs) {
    const label = `${run.population}:${run.seed}`;
    assert.equal(run.attempts, 180);
    assert.equal(run.trajectory.length, 6);
    assert.ok(
      run.finalMeanAbsoluteError < 1.25,
      `${label}: estimate error ${run.finalMeanAbsoluteError}`,
    );
    assert.equal(
      run.missedBandOpportunities,
      run.supportBandMisses + run.probeBandMisses,
      `${label}: target-band exception accounting`,
    );
    assert.ok(
      run.syntheticTrueBandShare > 0.025,
      `${label}: independently modeled band share`,
    );
    assert.ok(run.meanProbabilityError < 0.3, `${label}: probability error`);
    assert.ok(
      run.dueReviewBatches >= 40 && run.reviewsServed >= 40,
      `${label}: no vacuous review check`,
    );
    assert.ok(run.reviewAdherence! >= 0.8, `${label}: review adherence`);
    assert.ok(run.maxStrandShare <= 0.36, `${label}: strand concentration`);
    assert.ok(
      run.longestStrandRun <= 2,
      `${label}: consecutive strand drilling`,
    );
    assert.ok(
      Object.values(run.convergence).filter((n) => n !== null).length >= 4,
      `${label}: convergence`,
    );
    if (run.jumpDetection)
      assert.ok(
        Object.values(run.jumpDetection).filter((n) => n !== null).length >= 4,
        `${label}: change detection`,
      );
  }
  assert.ok(
    runs
      .flatMap((r) => Object.values(r.jumpDetection ?? {}))
      .filter((n) => n !== null).length >= 29,
    "match baseline detection coverage, including censored strands",
  );
  assert.ok(
    runs.every((r) => r.probesServed <= 30),
    "bounded probes",
  );
  assert.ok(
    runs.reduce((sum, r) => sum + r.predictedBandShare, 0) / runs.length >=
      0.35,
    "aggregate predicted-band coverage",
  );
  assert.deepEqual(
    simulateFrontier(evaluationPopulations[0]!, 101, 30),
    simulateFrontier(evaluationPopulations[0]!, 101, 30),
  );
});

test("offline calibration fits training responses and scores separate held-out responses", () => {
  const template = templates.find((t) => t.id === "multiply-facts")!;
  const initial = { ...gradeCalibration(3), difficulty: 4.8 };
  const original = { ...initial };
  const fit = fitSyntheticItem(
    template,
    3,
    initial,
    evaluationPopulations[0]!,
    49,
  );
  assert.equal(fit.trainingCount, 400);
  assert.equal(fit.validationCount, 400);
  assert.ok(fit.fittedValidationLoss < fit.initialValidationLoss);
  assert.ok(fit.fittedProbabilityError < fit.initialProbabilityError);
  assert.deepEqual(
    fit,
    fitSyntheticItem(template, 3, initial, evaluationPopulations[0]!, 49),
  );
  assert.deepEqual(
    initial,
    original,
    "fit must not mutate production assumptions",
  );
});

test("historical versions have separate likelihood caches and unknown calibrations are not substituted", () => {
  const first = gradeCalibration(2),
    second = gradeCalibration(7);
  const observations = [
    { templateId: "same", templateVersion: 1, correct: true, assisted: false },
    { templateId: "same", templateVersion: 2, correct: false, assisted: false },
  ];
  const run = (
    input: typeof observations,
    itemOf: (id: string, version: number) => typeof first | undefined,
  ) =>
    estimateFrontier({
      start: 4,
      observations: input,
      gradeOf: () => 4,
      strandOf: () => "strand",
      itemOf,
    });
  const versioned = run(observations, (_, version) =>
    version === 1 ? first : second,
  );
  const distinctIds = run(
    observations.map((o) => ({ ...o, templateId: String(o.templateVersion) })),
    (id) => (id === "1" ? first : second),
  );
  assert.deepEqual(versioned, distinctIds);
  assert.equal(run(observations, () => undefined).overall.answered, 0);
  assert.equal(
    run(observations, (_, version) => (version === 1 ? first : undefined))
      .overall.answered,
    1,
  );
});

test("prerequisite repair is not starved by an overdue review", () => {
  const graph = [
    {
      id: "foundation",
      gradeBand: "3" as const,
      strand: "operations",
      prerequisites: [],
    },
    {
      id: "advanced",
      gradeBand: "4" as const,
      strand: "operations",
      prerequisites: ["foundation"],
    },
    {
      id: "review",
      gradeBand: "4" as const,
      strand: "geometry",
      prerequisites: [],
    },
    {
      id: "filler",
      gradeBand: "4" as const,
      strand: "measurement",
      prerequisites: [],
    },
  ];
  const catalog = graph.map((skill) => ({
    ...templates[0]!,
    id: skill.id,
    skillId: skill.id,
  }));
  const now = Date.parse("2026-01-10T12:00:00Z");
  const attempts = ["review", "advanced", "advanced"].map((skillId, i) => ({
    id: String(i),
    problemId: String(i),
    requestId: String(i),
    skillId,
    templateId: skillId,
    correct: skillId === "review",
    assisted: false,
    response: "",
    answer: "",
    explanation: [],
    createdAt: new Date(now - (3 - i) * 86400000).toISOString(),
  }));
  const request = {
    templates: catalog,
    skills: graph,
    attempts,
    evidence: projectSkillEvidence(attempts),
    count: 3,
    seed: "repair",
    now,
    frontier: {
      expected: 4,
      overall: { level: 4, sd: 0.5, answered: 3, independent: 1 },
      strands: {},
    },
  };
  const choices = planMixedPractice(request);
  assert.equal(choices[0]!.template.id, "foundation");
  assert.equal(choices[0]!.reason, "prerequisite");
  const reviewTurn = planMixedPractice({
    ...request,
    frontier: {
      ...request.frontier,
      overall: { ...request.frontier.overall, answered: 6 },
    },
  });
  assert.equal(reviewTurn[0]!.template.id, "review");
  assert.equal(reviewTurn[0]!.reason, "review");
});

test("fixed development experiment preserves baseline precision, detection, review and diversity", () => {
  const runs = developmentPopulations.flatMap((p) =>
    [11, 29].map((seed) => simulateFrontier(p, seed)),
  );
  const mean = (metric: "finalMeanAbsoluteError" | "maxStrandShare") =>
    runs.reduce((sum, r) => sum + r[metric], 0) / runs.length;
  // Baseline 86dfa922c with the same 142-template catalog. These are regression
  // checks on declared development scenarios, not an untouched efficacy test.
  assert.ok(mean("finalMeanAbsoluteError") <= 0.6375, "baseline mean error");
  assert.ok(mean("maxStrandShare") <= 0.2917, "baseline strand concentration");
  assert.ok(
    runs.reduce((sum, r) => sum + r.reviewAdherence!, 0) / runs.length >=
      0.8362,
    "baseline review adherence",
  );
  assert.ok(
    runs
      .flatMap((r) => Object.values(r.jumpDetection ?? {}))
      .filter((n) => n !== null).length >= 29,
    "baseline paired change detection",
  );
});

test("simulation rejects lengths without complete pre-intervention batches", () => {
  for (const total of [0, 3, 8, 10, 12.5, Infinity])
    assert.throws(
      () => simulateFrontier(developmentPopulations[0]!, 11, total),
      /multiple of three/,
    );
});

test("simulation rejects empty or incomplete custom policy batches", () => {
  assert.throws(
    () =>
      simulateFrontier(developmentPopulations[0]!, 11, 9, {
        estimate: estimateFrontier,
        plan: () => [],
        calibrated: true,
      }),
    /complete three-answer batch/,
  );
});

test("reserved review keeps its reason when it is also probe eligible", () => {
  const now = Date.parse("2026-01-10T12:00:00Z");
  const template = { ...templates[0]!, id: "reserved", skillId: "reserved" };
  const skill = {
    id: "reserved",
    gradeBand: "4" as const,
    strand: "number",
    prerequisites: [],
  };
  const attempts = [
    {
      id: "a",
      problemId: "p",
      requestId: "r",
      skillId: skill.id,
      templateId: template.id,
      correct: true,
      assisted: false,
      response: "",
      answer: "",
      explanation: [],
      createdAt: new Date(now - 2 * 86400000).toISOString(),
    },
  ];
  const request = {
    templates: [template],
    skills: [skill],
    attempts: [],
    evidence: projectSkillEvidence(attempts),
    count: 1,
    seed: "support-probe",
    now,
    frontier: {
      expected: 4,
      overall: { level: 4, sd: 1, answered: 6, independent: 6 },
      strands: {},
    },
  };
  assert.equal(planMixedPractice(request)[0]!.reason, "review");
  assert.equal(
    planMixedPractice({ ...request, evidence: [], attempts: [] })[0]!.reason,
    "probe",
    "positive control: the same item qualifies as a probe without support debt",
  );
  assert.notEqual(
    planMixedPractice({
      ...request,
      evidence: [],
      attempts: [],
      strictCeiling: true,
    })[0]!.reason,
    "probe",
  );
});
