import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateFrontier,
  initialLevel,
  overallPriorSd,
  type FrontierObservation,
} from "../src/learning/frontier";
import {
  DEFAULT_FRONTIER_POLICY,
  NORMS_PRIOR_SD,
  PREVIOUS_FRONTIER_POLICY,
  type FrontierPolicy,
} from "../src/learning/frontier-policy";
import {
  reportFrontier,
  shownAreaLevel,
  shownLevel,
  startingWeight,
} from "../src/learning/frontier-report";
import { frontierCatalog } from "../src/server/learner-frontier";
import { planMixedPractice } from "../src/server/mixed-practice";
import { projectSkillEvidence } from "../src/server/evidence";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import type { Outcome } from "../src/server/repository";
import {
  AGES,
  simulateEarly,
} from "../scripts/frontier/early-anchor-simulation";

/* A constructed case: a ten-year-old (born 2016, read in the fall of 2026)
   answers three on-grade problems right. Under v4 the readout showed about
   grade 6 overall and in every area. */
const now = Date.parse("2026-10-15T15:00:00Z");
const threeRight = [
  "tenths-as-hundredths",
  "angle-classify",
  "scaled-bar-graph",
];
const answers = (families: readonly string[], correct = true) =>
  families.map((templateId, i): FrontierObservation => ({
    templateId,
    correct,
    assisted: false,
    createdAt: new Date(now - (families.length - i) * 60_000).toISOString(),
  }));
const estimate = (
  observations: readonly FrontierObservation[],
  policy: FrontierPolicy = DEFAULT_FRONTIER_POLICY,
  options: { start?: number; fromAge?: boolean } = {},
) =>
  estimateFrontier({
    ...frontierCatalog,
    start: options.start ?? initialLevel({ birthYear: 2016, now }),
    fromAge: options.fromAge ?? true,
    observations,
    now,
    policy,
  });
const shown = (...args: Parameters<typeof estimate>) =>
  reportFrontier(estimate(...args));

/** A long, consistent history across areas: a learner working at about
 * grade 5, on grade-4 to grade-6 families twelve a day for two weeks. */
const byGrade = (grade: number) =>
  templates
    .filter(
      (t) =>
        frontierCatalog.gradeOf(t.id) === grade &&
        frontierCatalog.guessOf(t.id) === 0,
    )
    .map((t) => t.id);
const families = [byGrade(4), byGrade(5), byGrade(6)] as const;
const longHistory = Array.from({ length: 168 }, (_, i): FrontierObservation => {
  const band = i % 3;
  const list = families[band]!;
  return {
    templateId: list[(i * 7) % list.length]!,
    // Grade 4 nearly always right, grade 5 two in three, grade 6 one in three.
    correct: band === 0 ? i % 10 !== 9 : band === 1 ? i % 3 !== 0 : i % 3 === 0,
    assisted: false,
    createdAt: new Date(
      now + Math.floor(i / 12) * 86_400_000 + (i % 12) * 120_000,
    ).toISOString(),
  };
});

test("the three-answer case: the catalog facts it rests on", () => {
  assert.equal(initialLevel({ birthYear: 2016, now }), 4);
  assert.deepEqual(
    threeRight.map((id) => [
      frontierCatalog.gradeOf(id),
      frontierCatalog.guessOf(id),
    ]),
    [
      [4, 0],
      [4, 0.25],
      [3, 0],
    ],
  );
});

test("three right answers keep a ten-year-old's shown level at the edge of their age", () => {
  const before = shown(answers(threeRight), PREVIOUS_FRONTIER_POLICY);
  // What v4 showed: about grade 6 overall and in every area.
  assert.ok(before.overall.level > 5.8, String(before.overall.level));
  const after = shown(answers(threeRight));
  // Up from 4, because three right answers are evidence; not out of the
  // age band by much, because three answers are not much of it.
  assert.ok(
    after.overall.level > 4.3 && after.overall.level < 4.75,
    String(after.overall.level),
  );
  for (const [area, value] of Object.entries(after.strands))
    assert.ok(value.level > 4.3 && value.level < 4.9, `${area} ${value.level}`);
  // The range stays honest about how little three answers say.
  assert.ok(after.overall.sd > 0.9, String(after.overall.sd));
  // The readout's own estimate moves less, too: a narrower age prior.
  assert.ok(
    estimate(answers(threeRight)).overall.level <
      estimate(answers(threeRight), PREVIOUS_FRONTIER_POLICY).overall.level -
        0.5,
  );
});

test("the display rule: the age band for ten answers, then the estimate", () => {
  const anchor = estimate([]).anchor!;
  assert.deepEqual(anchor, {
    level: 4,
    band: 0.5,
    startingAnswers: 10,
    areaAnswers: 10,
  });
  assert.equal(startingWeight(0, anchor), 0);
  assert.equal(startingWeight(3, anchor), 0.3);
  assert.equal(startingWeight(10, anchor), 1);
  assert.equal(startingWeight(200, anchor), 1);
  // Inside the age band the estimate is shown as it is, at any weight.
  assert.equal(shownLevel(4.3, 0, anchor), 4.3);
  assert.equal(shownLevel(3.6, 0.2, anchor), 3.6);
  // Outside it, the band's edge plus the weight's share of the rest.
  assert.equal(shownLevel(6, 0, anchor), 4.5);
  assert.equal(shownLevel(6, 0.5, anchor), 5.25);
  assert.equal(shownLevel(1, 0.5, anchor), 2.25);
  assert.equal(shownLevel(6, 1, anchor), 6);
  // An area sits at the overall shown level plus its own answers' share of
  // its difference from the overall estimate.
  const overall = { estimate: 5.2, shown: 4.7 };
  const area = (level: number, answered: number) =>
    shownAreaLevel(
      { level, sd: 1, answered, independent: answered },
      overall,
      anchor,
    );
  assert.equal(area(6.2, 1), 4.8);
  assert.equal(area(6.2, 10), 5.7);
  assert.equal(area(3.2, 20), 2.7);
  // From ten answers on the overall shown level is the estimate, and an area
  // with ten answers of its own is shown as estimated.
  const settled = estimate(longHistory);
  const view = reportFrontier(settled);
  assert.equal(view.overall.level, settled.overall.level);
  for (const [name, value] of Object.entries(settled.strands))
    if (value.answered >= 10)
      assert.equal(view.strands[name]!.level, value.level, name);
});

test("practice is unchanged: selection reads exactly what it read under v4", () => {
  for (const observations of [answers(threeRight), longHistory]) {
    const v5 = estimate(observations);
    const v4 = estimate(observations, PREVIOUS_FRONTIER_POLICY);
    const { overall: _a, anchor, ...rest5 } = v5;
    const { overall: _b, ...rest4 } = v4;
    assert.ok(anchor);
    assert.deepEqual(rest5, rest4);
    assert.equal(v5.overall.answered, v4.overall.answered);
    const attempts: Outcome[] = observations.map((o, i) => ({
      id: `a${i}`,
      problemId: `p${i}`,
      requestId: `r${i}`,
      skillId: templates.find((t) => t.id === o.templateId)!.skillId,
      templateId: o.templateId,
      response: "",
      correct: o.correct,
      assisted: o.assisted,
      explanation: [],
      answer: "",
      createdAt: o.createdAt!,
    }));
    const plan = (frontier: typeof v5) =>
      planMixedPractice({
        templates,
        skills,
        attempts: attempts.slice(-12),
        evidence: projectSkillEvidence(attempts),
        frontier,
        count: 5,
        seed: "unchanged",
        now,
        learnerKey: "unchanged",
      }).map((choice) => choice.template.id);
    assert.deepEqual(plan(v5), plan(v4));
  }
});

test("a start someone chose, such as the adult default, is estimated and placed exactly as under v4", () => {
  const adult = initialLevel({ adult: true });
  assert.equal(adult, 7);
  assert.equal(
    overallPriorSd(adult, DEFAULT_FRONTIER_POLICY, false),
    PREVIOUS_FRONTIER_POLICY.prior.overallSd,
  );
  for (const [start, observations] of [
    [adult, []],
    [adult, answers(threeRight)],
    [2, longHistory],
  ] as const) {
    const v5 = estimate(observations, DEFAULT_FRONTIER_POLICY, {
      start,
      fromAge: false,
    });
    const v4 = estimate(observations, PREVIOUS_FRONTIER_POLICY, {
      start,
      fromAge: false,
    });
    // The whole estimate, and so every level shown, is v4's.
    assert.equal(v5.anchor, undefined);
    assert.deepEqual(v5, v4);
    // Only the reported width differs, as for every learner: sd-cal-v2
    // reads each estimate's own answer count (frontier-report.ts).
    const shown = reportFrontier(v5);
    assert.equal(shown.overall.level, v4.overall.level);
    for (const [name, value] of Object.entries(v4.strands))
      assert.equal(shown.strands[name]!.level, value.level, name);
  }
});

test("the age prior is national norms, and never wider than v4's", () => {
  assert.equal(overallPriorSd(4, DEFAULT_FRONTIER_POLICY, true), 1.6);
  assert.equal(overallPriorSd(0, DEFAULT_FRONTIER_POLICY, true), 0.7);
  assert.equal(overallPriorSd(10, DEFAULT_FRONTIER_POLICY, true), 2.5);
  for (const [, sd] of NORMS_PRIOR_SD)
    assert.ok(sd <= PREVIOUS_FRONTIER_POLICY.prior.overallSd);
});

test("a ten-year-old two grades ahead is shown within a grade of it by 20 answers", () => {
  // Decided before measuring: the display may lag the estimate while it is
  // unsettled, but not past twenty answers for a learner two grades ahead.
  const run = simulateEarly({
    policies: ["v5", "v4"],
    truth: "steep",
    age: AGES.find((age) => age.id === "grade-4")!,
    profile: "+2",
    rep: 0,
    seed: 1,
    itemOffsets: {},
  });
  assert.equal(run.practiceDiffers, 0);
  const error = (n: number) =>
    Math.abs(run.readings.v5![n]!.overall.level - run.theta);
  assert.ok(error(20) < 1, `shown ${run.readings.v5![20]!.overall.level}`);
  assert.ok(error(50) < 0.75, `shown ${run.readings.v5![50]!.overall.level}`);
});
