import { test } from "node:test";
import assert from "node:assert/strict";
import { planMixedPractice, templateGrade } from "../src/server/mixed-practice";
import {
  estimateFrontier,
  targetGrade,
  strandEstimate,
} from "../src/learning/frontier";
import { projectSkillEvidence } from "../src/server/evidence.js";
import { trialProgress } from "../src/server/trial-progress";
import { trialLimits } from "../src/server/trials";
import {
  SKIP_USES_FREE_PROBLEM,
  type PracticeSkip,
} from "../src/learning/skip";
import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { guessChanceOf } from "../src/math/guess-chance";
import {
  runAttempts,
  simulateTrial,
  trialLearners,
} from "./trial-simulation.fixture";
import type { Outcome } from "../src/server/repository";

const now = Date.parse("2026-10-20T12:00:00Z");
const nodes = new Map(skills.map((s) => [s.id, s]));
const byId = new Map(templates.map((t) => [t.id, t]));
const at = (i: number) => new Date(now - (40 - i) * 60000).toISOString();
function answer(templateId: string, i: number, correct = true): Outcome {
  return {
    id: `a${i}`,
    problemId: `p${i}`,
    requestId: `r${i}`,
    templateId,
    skillId: byId.get(templateId)!.skillId,
    correct,
    assisted: false,
    response: "1",
    answer: "1",
    explanation: [],
    createdAt: at(i),
  };
}
const skipOf = (templateId: string, i: number): PracticeSkip => ({
  templateId,
  skillId: byId.get(templateId)!.skillId,
  createdAt: at(i),
});
// A placed learner: 24 answers across the catalog around grade 6.
const history = templates
  .filter((t) => templateGrade(t, nodes) === 6)
  .slice(0, 24)
  .filter((t) => t.skillId !== "integer-powers")
  .map((t, i) => answer(t.id, i));
const frontierOf = (attempts: Outcome[], start = 6) =>
  estimateFrontier({
    start,
    observations: attempts,
    gradeOf: (id) => templateGrade(byId.get(id)!, nodes),
    strandOf: (id) => nodes.get(byId.get(id)!.skillId)!.strand,
    guessOf: guessChanceOf,
    now,
  });
function plan(
  skips: PracticeSkip[],
  seed: string,
  attempts = history,
  start = 6,
) {
  return planMixedPractice({
    templates,
    skills,
    attempts: attempts.slice(-12),
    evidence: projectSkillEvidence(attempts),
    frontier: frontierOf(attempts, start),
    skips,
    count: 1,
    seed,
    now,
    learnerKey: "skip-learner",
  })[0]!;
}

test("a skip never reaches the estimator, the evidence or mastery", () => {
  // Skips are stored on the problem record, not as attempts: the estimate
  // and evidence are functions of attempts alone, before and after.
  const before = frontierOf(history);
  plan([skipOf("integer-power", 30)], "estimate");
  assert.deepEqual(frontierOf(history), before);
  assert.deepEqual(
    projectSkillEvidence(history),
    projectSkillEvidence([...history]),
  );
});

test("the skipped template does not come back in the session", () => {
  for (let i = 0; i < 40; i++) {
    const skipped = history.at(-1 - (i % 5))!.templateId;
    const choice = plan([skipOf(skipped, 30)], `recency-${i}`);
    assert.notEqual(choice.template.id, skipped);
  }
});

test("the next two problems after a skip step slightly easier", (t) => {
  // Realistic sessions: 30 simulated trial problems per learner, then the
  // next problem with and without a skip of the last one served.
  let eased = 0,
    usual = 0,
    n = 0;
  for (const learner of trialLearners(2)) {
    const served = simulateTrial({ ...learner, count: 30 });
    const { attempts, last } = runAttempts(learner.key, served);
    const frontier = estimateFrontier({
      start: learner.start,
      observations: attempts,
      gradeOf: (id) => templateGrade(byId.get(id)!, nodes),
      strandOf: (id) => nodes.get(byId.get(id)!.skillId)!.strand,
      guessOf: guessChanceOf,
      now: last + 30000,
    });
    const next = (skips: PracticeSkip[], seed: string) =>
      planMixedPractice({
        templates,
        skills,
        attempts: attempts.slice(-12),
        evidence: projectSkillEvidence(attempts),
        frontier,
        skips,
        count: 1,
        seed,
        now: last + 30000,
        learnerKey: learner.key,
      })[0]!;
    const skip: PracticeSkip = {
      templateId: "power-compare",
      skillId: "integer-powers",
      createdAt: new Date(last + 20000).toISOString(),
    };
    for (let i = 0; i < 5; i++) {
      eased += templateGrade(
        next([skip], `${learner.key}:${i}`).template,
        nodes,
      );
      usual += templateGrade(next([], `${learner.key}:${i}`).template, nodes);
      n++;
    }
  }
  t.diagnostic(`mean grade after a skip ${eased / n}, without ${usual / n}`);
  assert.ok(eased / n < usual / n - 0.15, `${eased / n} vs ${usual / n}`);
});

test("the skipped skill returns later through another template", () => {
  const skipped = "integer-power";
  const attempts = [
    ...history,
    answer("percent-of", 31),
    answer("integer-addition", 32),
    answer("ratio-missing", 33),
    answer("decimal-addition", 34),
  ];
  const returns = Array.from({ length: 40 }, (_, i) =>
    plan([skipOf(skipped, 30)], `return-${i}`, attempts),
  ).filter((c) => c.template.skillId === "integer-powers");
  assert.ok(returns.length > 0, "the skill comes back");
  assert.ok(returns.every((c) => c.template.id !== skipped));
});

test("a skip uses a free problem by default, without changing correct or assisted", () => {
  const limits = trialLimits(100);
  const progress = trialProgress(history.slice(0, 5), limits, 2);
  assert.equal(progress.totals.answered, SKIP_USES_FREE_PROBLEM ? 7 : 5);
  assert.equal(progress.totals.skipped, 2);
  assert.equal(
    progress.totals.correct,
    trialProgress(history.slice(0, 5), limits).totals.correct,
  );
  assert.equal(
    strandEstimate(frontierOf(history), "algebra").answered,
    strandEstimate(frontierOf(history), "algebra").answered,
  );
  assert.ok(Number.isFinite(targetGrade(frontierOf(history).overall)));
});
