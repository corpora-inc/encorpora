import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateFrontier,
  initialLevel,
  overallPriorSd,
  type FrontierObservation,
} from "../src/learning/frontier";
import {
  AGE_PRIOR_SD,
  DEFAULT_FRONTIER_POLICY,
  PREVIOUS_FRONTIER_POLICY,
  type FrontierPolicy,
} from "../src/learning/frontier-policy";
import { reportFrontier } from "../src/learning/frontier-report";
import { frontierCatalog } from "../src/server/learner-frontier";

/* A ten-year-old (born 2016, read in the fall of 2026) answers three
   on-grade problems right. Under v4 the map guessed grade 6 overall and in
   every area; three answers must not carry an age-anchored start that far. */
const now = Date.parse("2026-10-15T15:00:00Z");
const threeRight = [
  "compare-decimals-hundredths",
  "fraction-equivalence-choice",
  "fraction-line-plot",
];
const answers = (
  families: readonly string[],
  correct = true,
): FrontierObservation[] =>
  families.map((templateId, i) => ({
    templateId,
    correct,
    assisted: false,
    createdAt: new Date(now - (families.length - i) * 60_000).toISOString(),
  }));
const shown = (
  observations: readonly FrontierObservation[],
  policy: FrontierPolicy = DEFAULT_FRONTIER_POLICY,
  start = initialLevel({ birthYear: 2016, now }),
  fromAge = true,
) =>
  reportFrontier(
    estimateFrontier({
      ...frontierCatalog,
      start,
      fromAge,
      observations,
      now,
      policy,
    }),
  );

test("the three-answer case: the catalog facts it rests on", () => {
  assert.equal(initialLevel({ birthYear: 2016, now }), 4);
  assert.deepEqual(
    threeRight.map((id) => [
      frontierCatalog.gradeOf(id),
      frontierCatalog.strandOf(id),
      frontierCatalog.guessOf(id),
    ]),
    [
      [4, "decimals", 0],
      [4, "fractions", 0.25],
      [3, "data", 0],
    ],
  );
});

test("three right answers keep a ten-year-old within a grade of their age", () => {
  const before = shown(answers(threeRight), PREVIOUS_FRONTIER_POLICY);
  // What v4 showed: about grade 6 overall and in every area.
  assert.ok(before.overall.level > 5.8, String(before.overall.level));
  const after = shown(answers(threeRight));
  // Up, because three right answers are evidence; under a grade, because
  // three answers are not much of it.
  assert.ok(
    after.overall.level > 4.3 && after.overall.level < 4.8,
    String(after.overall.level),
  );
  // Each area has one answer of its own on top of the pooled start, and
  // reacts faster on purpose (scheduling reads it), but no longer near 6.
  for (const [area, estimate] of Object.entries(after.strands)) {
    assert.ok(
      estimate.level > 4.3 && estimate.level < 5.5,
      `${area} ${estimate.level}`,
    );
    assert.ok(
      before.strands[area]!.level - estimate.level > 0.7,
      `${area} ${before.strands[area]!.level} → ${estimate.level}`,
    );
  }
  // The range is honest about how little three answers say.
  assert.ok(after.overall.sd > 0.7, String(after.overall.sd));
});

test("a ten-year-old who is truly two grades ahead is shown there with evidence", () => {
  // Grade-6 typed work, four of five right: what a grade-6 learner does.
  const grade6 = ["divide-fractions", "percent-of", "one-step-equation"]
    .map((id) => frontierCatalog.gradeOf(id))
    .every((grade) => grade === 6);
  assert.ok(grade6, "grade-6 families moved");
  const work = Array.from({ length: 30 }, (_, i) => ({
    templateId: ["divide-fractions", "percent-of", "one-step-equation"][i % 3]!,
    correct: i % 5 !== 4,
    assisted: false,
    createdAt: new Date(now - (30 - i) * 60_000).toISOString(),
  }));
  const level = (n: number) => shown(work.slice(0, n)).overall.level;
  assert.ok(level(10) > 5, String(level(10)));
  assert.ok(level(30) > 5.6, String(level(30)));
});

test("a start someone chose keeps the wide prior; the adult prior is unchanged", () => {
  const adult = initialLevel({ adult: true });
  assert.equal(adult, 7);
  assert.equal(
    overallPriorSd(adult, DEFAULT_FRONTIER_POLICY),
    PREVIOUS_FRONTIER_POLICY.prior.overallSd,
  );
  assert.deepEqual(
    shown([], DEFAULT_FRONTIER_POLICY, adult, false).overall,
    shown([], PREVIOUS_FRONTIER_POLICY, adult, false).overall,
  );
  // A birth year narrows it to how spread out that age is.
  assert.equal(overallPriorSd(4, DEFAULT_FRONTIER_POLICY, true), 1.05);
  assert.ok(overallPriorSd(1, DEFAULT_FRONTIER_POLICY, true) < 1);
  assert.equal(overallPriorSd(12, DEFAULT_FRONTIER_POLICY, true), 2.5);
  // Never wider than before, so no learner's start moves faster than it did.
  for (const [, sd] of AGE_PRIOR_SD)
    assert.ok(sd <= PREVIOUS_FRONTIER_POLICY.prior.overallSd);
});
