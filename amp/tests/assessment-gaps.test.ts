import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { templates, generateProblem, gradeAnswer } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { assessmentGapTemplates } from "../src/math/assessment-gap-practice";
import { assessmentGapLessons } from "../src/content/assessment-gap-lessons";
import { buildGapLedger } from "../src/curriculum/gap-ledger";
import { assessmentSample } from "../src/curriculum/assessment-sample";
import {
  SAT_BLUEPRINT,
  satObjectiveDomains,
  satPracticeConfiguration,
} from "../src/learning/assessment-profile";
import { selectionDistribution } from "../src/learning/selection-policy";
import {
  DEFAULT_PRACTICE_POLICY,
  practiceParameters,
} from "../src/learning/practice-policy";
import {
  objectiveExposureWeights,
  objectiveForSkill,
} from "../src/curriculum/selection";

test("three families are deterministic, exact, supported and checked independently from public givens", () => {
  const cases = [];
  for (const t of assessmentGapTemplates) {
    for (let i = 0; i < 256; i++) {
      const seed = `assessment-review-${i}`;
      const p = generateProblem(t.id, seed);
      generatedProblemSchema.parse(p);
      assert.deepEqual(p, generateProblem(t.id, seed));
      assert.equal(gradeAnswer(p, p.answer), true);
      if (p.public.response.kind === "choice") {
        assert.equal(
          new Set(p.public.response.options.map((o) => o.label)).size,
          4,
        );
        for (const option of p.public.response.options)
          assert.equal(gradeAnswer(p, option.id), option.id === p.answer);
      } else assert.equal(gradeAnswer(p, "999999"), false);
      cases.push(p);
    }
    const lesson = assessmentGapLessons.find((l) =>
      l.templateIds.includes(t.id),
    )!;
    assert.ok(lesson);
    assert.ok(lesson.closingSections?.some((s) => s.illustration));
    assert.equal(lesson.closingSections?.at(-1)?.title, "The precise rule");
  }
  const review = spawnSync(
    "python3",
    [
      "-c",
      `import sys,json
sys.path.insert(0,'scripts')
from assessment_gap_math_oracle import solve,review_problem,self_test
self_test()
for p in json.load(sys.stdin):
 expected=solve(p['public'])
 if str(expected)!=p['answer']: raise ValueError((p['public']['templateId'],expected,p['answer']))
 review_problem(p)
print('Independent public-givens oracle passed')`,
    ],
    { input: JSON.stringify(cases), encoding: "utf8", maxBuffer: 2_000_000 },
  );
  assert.equal(review.status, 0, review.stderr + review.stdout);
});

test("released-test sample is an explicit partial inventory with real registry references", () => {
  const known = new Set(templates.map((t) => t.id));
  for (const item of assessmentSample) {
    assert.ok(item.limitations.length > 30);
    for (const id of item.templateIds)
      assert.ok(known.has(id), `${item.item}: unknown ${id}`);
  }
  const audit = buildGapLedger();
  assert.equal(audit.valid, true, audit.errors.join("\n"));
  assert.equal(audit.targetComplete, false);
  assert.equal(audit.assessmentSample.frequencyEstimate, false);
  assert.ok(
    audit.assessmentSample.items.some((i) => i.status === "practice-gap"),
  );
  assert.ok(
    audit.assessmentSample.items.some((i) =>
      i.availableTemplateIds.includes("measurement-error-bound"),
    ),
  );
});

test("general learning blends editorial importance and assessment emphasis without changing central objectives", () => {
  const weights = DEFAULT_PRACTICE_POLICY.weights.objectives;
  assert.equal(weights["linear-equations"], 6);
  assert.equal(weights["geometry-constructions"], 1.5);
  assert.equal(weights["complex-numbers"], 1.5);
  assert.equal(objectiveExposureWeights(0)["geometry-constructions"], 2);
  assert.equal(objectiveExposureWeights(1)["geometry-constructions"], 1);
  assert.throws(() => objectiveExposureWeights(-1));
  assert.throws(() => objectiveExposureWeights(NaN));
});

test("SAT blueprint shares survive generator duplication and remain an opt-in learner policy", () => {
  const before = practiceParameters();
  const config = satPracticeConfiguration(templates);
  assert.deepEqual(
    practiceParameters(),
    before,
    "compilation does not mutate general practice",
  );
  assert.notEqual(
    config.policy.fingerprint,
    DEFAULT_PRACTICE_POLICY.fingerprint,
  );
  assert.ok(!config.templates.some((t) => t.id === "count-objects"));
  const pool = config.templates.map((t) => ({ template: t, score: 100 }));
  const distribution = selectionDistribution(pool, undefined, config.policy);
  const mass = (items: typeof distribution, domain: string) =>
    items
      .filter((x) => satObjectiveDomains[x.trace.objectiveId] === domain)
      .reduce((n, x) => n + x.trace.probability, 0);
  const domains = Object.entries(SAT_BLUEPRINT.domainPercent);
  for (const [domain, percent] of domains)
    assert.ok(
      Math.abs(mass(distribution, domain) - percent / 100) < 1e-10,
      `${domain}: ${mass(distribution, domain)}`,
    );
  const t = config.templates.find((t) => t.skillId === "radians-unit-circle")!;
  const expanded = [
    ...pool,
    ...Array.from({ length: 100 }, (_, i) => ({
      template: { ...t, id: `clone-${i}` },
      score: 100,
    })),
  ];
  const duplicated = selectionDistribution(expanded, undefined, config.policy);
  for (const [domain] of domains)
    assert.ok(
      Math.abs(mass(distribution, domain) - mass(duplicated, domain)) < 1e-10,
    );
  // Different learner readiness is allowed to change the final mix.
  const adapted = selectionDistribution(
    pool.map((c) => ({
      ...c,
      score:
        objectiveForSkill(c.template.skillId)?.id === "linear-equations"
          ? 200
          : 100,
    })),
    undefined,
    config.policy,
  );
  assert.ok(mass(adapted, "algebra") > mass(distribution, "algebra"));
});
