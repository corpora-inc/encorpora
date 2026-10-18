import { createHash } from "node:crypto";
import { templates } from "../../src/math/engine";
import { skills } from "../../src/curriculum/catalog";
import {
  estimateExperimentalFrontier as estimateFrontier,
  strandEstimate,
  targetGrade,
} from "../../src/learning/experimental-frontier";
import {
  templateCalibration,
  templateGrade,
  itemSuccess,
  gradeCalibration,
} from "../../src/learning/item-calibration";
import { planExperimentalMixedPractice as planMixedPractice } from "../../src/server/experimental-mixed-practice";
import { projectSkillEvidence } from "../../src/server/evidence";
import type { Outcome } from "../../src/server/repository";
import { SyntheticLearner, type Population } from "./synthetic-learner";

// Explicit input contract: a new required planner field must cause a type
// error here until the fixture schema and baseline comparison are reviewed.
export type SimulationDataset = {
  templates: Parameters<typeof planMixedPractice>[0]["templates"];
  skills: readonly Pick<
    Parameters<typeof planMixedPractice>[0]["skills"][number],
    "id" | "prerequisites" | "strand" | "gradeBand"
  >[];
};
const currentDataset: SimulationDataset = { templates, skills };
/** Identify the actual supplied planning metadata; generators and lessons are
 * not executed. Fixed regression fixtures and live catalogs have separate IDs. */
export function describeSimulationCatalog(dataset: SimulationDataset) {
  return {
    format: "template-and-skill-json-v1",
    sha256: createHash("sha256")
      .update(
        JSON.stringify({
          templates: dataset.templates,
          skills: dataset.skills,
        }),
      )
      .digest("hex"),
    templateCount: dataset.templates.length,
    skillCount: dataset.skills.length,
  };
}
export const simulationCatalog = describeSimulationCatalog(currentDataset);

const startAt = Date.parse("2026-01-01T12:00:00Z");
const DAY = 86400000;
export const defaultTargetBand = [0.7, 0.85] as const;

type SimulationPolicy = {
  estimate: typeof estimateFrontier;
  plan: (
    options: Parameters<typeof planMixedPractice>[0],
  ) => Pick<
    ReturnType<typeof planMixedPractice>[number],
    "template" | "strand" | "reason"
  >[];
  calibrated: boolean;
};

function runSimulation(
  population: Population,
  seed: number,
  total = 180,
  policy: SimulationPolicy = {
    estimate: estimateFrontier,
    plan: planMixedPractice,
    calibrated: true,
  },
  dataset: SimulationDataset = currentDataset,
) {
  const { templates, skills } = dataset;
  const nodes = new Map(skills.map((skill) => [skill.id, skill]));
  const byId = new Map(templates.map((template) => [template.id, template]));
  const items = new Map(
    templates.map((t) => [t.id, templateCalibration(t, nodes)]),
  );
  const gradeOf = (id: string) => templateGrade(byId.get(id)!, nodes);
  const strandOf = (id: string) => nodes.get(byId.get(id)!.skillId)!.strand;
  const strands = [...new Set(templates.map((t) => strandOf(t.id)))].sort();
  const jumpAt = Math.floor((total * 0.4) / 3) * 3;
  const learner = new SyntheticLearner(population, jumpAt, seed);
  const attempts: Outcome[] = [];
  const observations: {
    strand: string;
    predicted: number;
    actual: number;
    reason: string;
  }[] = [];
  const visits = new Map<string, number>();
  const convergence = new Map<
    string,
    { streak: number; attempts: number | null }
  >();
  const detection = new Map<string, { streak: number; delay: number | null }>();
  const beforeJump = new Map<string, number>();
  const visitsBeforeJump = new Map<string, number>();
  const trajectory: { attempts: number; meanAbsoluteError: number }[] = [];
  const checkpoints: {
    attempts: number;
    levels: Record<string, number>;
    visits: Record<string, number>;
  }[] = [];
  let dueBatches = 0,
    reviewBatches = 0,
    reviews = 0,
    delayDays = 0;
  const nowFor = (n: number) =>
    startAt + Math.floor(n / 6) * DAY + (n % 6) * 60000;
  let bandOpportunities = 0,
    missedBandOpportunities = 0,
    supportBandMisses = 0,
    probeBandMisses = 0;
  const predict = (
    templateId: string,
    frontier: ReturnType<typeof estimateFrontier>,
  ) =>
    itemSuccess(
      strandEstimate(frontier, strandOf(templateId)).level,
      policy.calibrated
        ? items.get(templateId)!
        : gradeCalibration(gradeOf(templateId)),
    );
  const estimate = (n: number) =>
    policy.estimate({
      start: population.start,
      observations: attempts,
      gradeOf,
      strandOf,
      itemOf: policy.calibrated ? (id) => items.get(id) : undefined,
      now: nowFor(n),
    });
  for (let batch = 0; attempts.length < total; batch++) {
    const n = attempts.length;
    const now = nowFor(n);
    const frontier = estimate(n);
    const evidence = projectSkillEvidence(attempts);
    // Count all due successful retrievals, including ones the lowered frontier
    // cannot reach. This exposes review debt instead of hiding it in eligibility.
    const due = evidence.filter(
      (entry) =>
        entry.reviewDueAt! <= now &&
        entry.recentOutcomes.at(-1)?.correct &&
        !entry.recentOutcomes.at(-1)?.assisted,
    );
    if (due.length) dueBatches++;
    const choices = policy.plan({
      templates,
      skills,
      attempts: attempts.slice(-12),
      evidence,
      frontier,
      count: Math.min(3, total - n),
      seed: `${seed}:${batch}`,
      now,
      targetBand: defaultTargetBand,
    });
    if (choices.length !== Math.min(3, total - n))
      throw new Error(
        "Simulation policy must return a complete three-answer batch",
      );
    let reviewed = false;
    if (n === jumpAt)
      for (const strand of strands) {
        beforeJump.set(strand, strandEstimate(frontier, strand).level);
        visitsBeforeJump.set(strand, visits.get(strand) ?? 0);
      }
    const recentSkills = attempts
      .filter((a) => now - Date.parse(a.createdAt) < 30 * 60000)
      .slice(-2)
      .map((a) => a.skillId);
    const batchSkills = new Set<string>();
    const batchStrands = new Set<string>();
    for (const choice of choices) {
      const lastStrand = attempts.length
        ? strandOf(attempts.at(-1)!.templateId)
        : null;
      const available = templates.some((t) => {
        const strand = strandOf(t.id);
        const p = predict(t.id, frontier);
        return (
          gradeOf(t.id) <= targetGrade(strandEstimate(frontier, strand)) + 1 &&
          !recentSkills.includes(t.skillId) &&
          !batchSkills.has(t.skillId) &&
          strand !== lastStrand &&
          !batchStrands.has(strand) &&
          p >= defaultTargetBand[0] &&
          p <= defaultTargetBand[1]
        );
      });
      const predicted = predict(choice.template.id, frontier);
      if (available) {
        bandOpportunities++;
        if (
          predicted < defaultTargetBand[0] ||
          predicted > defaultTargetBand[1]
        ) {
          missedBandOpportunities++;
          if (["review", "revisit", "prerequisite"].includes(choice.reason))
            supportBandMisses++;
          if (choice.reason === "probe") probeBandMisses++;
        }
      }
      batchSkills.add(choice.template.skillId);
      batchStrands.add(choice.strand);
      const index = attempts.length;
      const dueEntry = due.find(
        (entry) => entry.skillId === choice.template.skillId,
      );
      if (dueEntry) {
        reviewed = true;
        reviews++;
        delayDays += (now - dueEntry.reviewDueAt!) / DAY;
      }
      const outcome = learner.answer(
        choice.template,
        choice.strand,
        gradeOf(choice.template.id),
        index,
      );
      observations.push({
        strand: choice.strand,
        predicted,
        actual: outcome.probability,
        reason: choice.reason,
      });
      visits.set(choice.strand, (visits.get(choice.strand) ?? 0) + 1);
      attempts.push({
        id: String(index),
        problemId: `p${index}`,
        requestId: `r${index}`,
        templateId: choice.template.id,
        skillId: choice.template.skillId,
        correct: outcome.correct,
        assisted: false,
        response: "",
        answer: "",
        explanation: [],
        createdAt: new Date(nowFor(index)).toISOString(),
      });
    }
    if (reviewed) reviewBatches++;
    const after = estimate(attempts.length);
    checkpoints.push({
      attempts: attempts.length,
      levels: Object.fromEntries(
        strands.map((s) => [s, strandEstimate(after, s).level]),
      ),
      visits: Object.fromEntries(visits),
    });
    let totalError = 0;
    for (const strand of strands) {
      const error = Math.abs(
        strandEstimate(after, strand).level -
          learner.ability(strand, attempts.length),
      );
      totalError += error;
      // Three successive batches within tolerance, with strand evidence. Null
      // is a censored failure to converge; it must not disappear from averages.
      const c = convergence.get(strand) ?? { streak: 0, attempts: null };
      c.streak =
        error <= 0.5 && (visits.get(strand) ?? 0) >= 3 ? c.streak + 1 : 0;
      if (c.attempts === null && c.streak >= 3) c.attempts = attempts.length;
      convergence.set(strand, c);
      if (population.jump && n >= jumpAt) {
        const d = detection.get(strand) ?? { streak: 0, delay: null };
        const movement =
          (strandEstimate(after, strand).level - beforeJump.get(strand)!) *
          Math.sign(population.jump);
        d.streak =
          movement >= Math.abs(population.jump) / 2 &&
          (visits.get(strand) ?? 0) - visitsBeforeJump.get(strand)! >= 3
            ? d.streak + 1
            : 0;
        if (d.delay === null && d.streak >= 2)
          d.delay = attempts.length - jumpAt;
        detection.set(strand, d);
      }
    }
    if (attempts.length % 30 === 0 || attempts.length === total)
      trajectory.push({
        attempts: attempts.length,
        meanAbsoluteError: totalError / strands.length,
      });
  }
  const inside = (p: number) =>
    p >= defaultTargetBand[0] && p <= defaultTargetBand[1];
  let longestRun = 0,
    run = 0,
    previous = "";
  for (const observation of observations) {
    run = observation.strand === previous ? run + 1 : 1;
    longestRun = Math.max(longestRun, run);
    previous = observation.strand;
  }
  const final = estimate(attempts.length);
  return {
    checkpoints,
    catalog: describeSimulationCatalog(dataset),
    finalStrands: Object.fromEntries(
      strands.map((strand) => [
        strand,
        {
          estimate: strandEstimate(final, strand),
          ability: learner.ability(strand, attempts.length),
        },
      ]),
    ),
    population: population.name,
    seed,
    attempts: attempts.length,
    jumpAt: population.jump ? jumpAt : null,
    trajectory,
    finalMeanAbsoluteError: trajectory.at(-1)!.meanAbsoluteError,
    convergence: Object.fromEntries(
      strands.map((s) => [s, convergence.get(s)!.attempts]),
    ),
    postJumpStrandVisits: population.jump
      ? Object.fromEntries(
          strands.map((s) => [
            s,
            (visits.get(s) ?? 0) - (visitsBeforeJump.get(s) ?? 0),
          ]),
        )
      : null,
    jumpDetection: population.jump
      ? Object.fromEntries(
          strands.map((s) => [s, detection.get(s)?.delay ?? null]),
        )
      : null,
    bandOpportunities,
    missedBandOpportunities,
    supportBandMisses,
    probeBandMisses,
    probesServed: observations.filter((o) => o.reason === "probe").length,
    predictedBandShare:
      observations.filter((o) => inside(o.predicted)).length / attempts.length,
    syntheticTrueBandShare:
      observations.filter((o) => inside(o.actual)).length / attempts.length,
    meanProbabilityError:
      observations.reduce(
        (sum, o) => sum + Math.abs(o.predicted - o.actual),
        0,
      ) / attempts.length,
    dueReviewBatches: dueBatches,
    servedReviewBatches: reviewBatches,
    reviewAdherence: dueBatches ? reviewBatches / dueBatches : null,
    reviewsServed: reviews,
    meanReviewDelayDays: reviews ? delayDays / reviews : null,
    maxStrandShare: Math.max(...visits.values()) / attempts.length,
    longestStrandRun: longestRun,
    strandVisits: Object.fromEntries(visits),
  };
}

/** Compare changed learners with a no-jump control using common random numbers.
 * Before the intervention the histories are identical. Afterwards selection and
 * practice can diverge; the contrast includes that policy-mediated response. */
export function simulateFrontier(
  population: Population,
  seed: number,
  total = 180,
  policy: SimulationPolicy = {
    estimate: estimateFrontier,
    plan: planMixedPractice,
    calibrated: true,
  },
  dataset: SimulationDataset = currentDataset,
) {
  if (!Number.isInteger(total) || total < 9 || total % 3 !== 0)
    throw new Error(
      "Simulation length must be a multiple of three, at least nine",
    );
  const { checkpoints, ...run } = runSimulation(
    population,
    seed,
    total,
    policy,
    dataset,
  );
  if (!population.jump)
    return {
      ...run,
      rawDirectionalMovement: run.jumpDetection,
      oppositeDirectionCrossings: null,
    };
  const control = runSimulation(
    { ...population, jump: 0 },
    seed,
    total,
    policy,
    dataset,
  );
  const strands = Object.keys(run.finalStrands);
  const detected = new Map<string, { streak: number; delay: number | null }>();
  const opposite = new Map<string, { streak: number; delay: number | null }>();
  const pre = checkpoints.find((c) => c.attempts === run.jumpAt)!;
  for (const [i, checkpoint] of checkpoints.entries()) {
    if (control.checkpoints[i]?.attempts !== checkpoint.attempts)
      throw new Error(
        "Paired simulation checkpoints must have matching answer counts",
      );
    if (checkpoint.attempts <= run.jumpAt!) continue;
    for (const strand of strands) {
      const d = detected.get(strand) ?? { streak: 0, delay: null };
      const contrast =
        (checkpoint.levels[strand]! - control.checkpoints[i]!.levels[strand]!) *
        Math.sign(population.jump);
      const exposures =
        (checkpoint.visits[strand] ?? 0) - (pre.visits[strand] ?? 0);
      d.streak =
        contrast >= Math.abs(population.jump) / 2 && exposures >= 3
          ? d.streak + 1
          : 0;
      if (d.delay === null && d.streak >= 2)
        d.delay = checkpoint.attempts - run.jumpAt!;
      detected.set(strand, d);
      const wrong = opposite.get(strand) ?? { streak: 0, delay: null };
      wrong.streak =
        contrast <= -Math.abs(population.jump) / 2 && exposures >= 3
          ? wrong.streak + 1
          : 0;
      if (wrong.delay === null && wrong.streak >= 2)
        wrong.delay = checkpoint.attempts - run.jumpAt!;
      opposite.set(strand, wrong);
    }
  }
  return {
    ...run,
    rawDirectionalMovement: run.jumpDetection,
    oppositeDirectionCrossings: Object.fromEntries(
      strands.map((s) => [s, opposite.get(s)?.delay ?? null]),
    ),
    jumpDetection: Object.fromEntries(
      strands.map((s) => [s, detected.get(s)?.delay ?? null]),
    ),
  };
}
