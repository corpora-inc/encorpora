import { skills } from "../src/curriculum/catalog";
import { areaOf, type AreaId } from "../src/curriculum/areas";
import {
  advanceFrontierState,
  createFrontierState,
  gradeNumber,
  readFrontierState,
  strandEstimate,
  STRAND_FREEZE,
  type Frontier,
} from "../src/learning/frontier";
import {
  DEFAULT_FRONTIER_POLICY,
  EVIDENCE_CLIMB_FRONTIER_POLICY,
  type FrontierPolicy,
} from "../src/learning/frontier-policy";
import {
  DEFAULT_PRACTICE_POLICY,
  FAST_CLIMB_PRACTICE_POLICY,
  type PracticePolicy,
} from "../src/learning/practice-policy";
import { reportEstimate } from "../src/learning/frontier-report";
import { templates } from "../src/math/engine";
import { guessChanceOf } from "../src/math/guess-chance";
import {
  clientCanDraw,
  figureCapabilities,
  responseCapabilities,
} from "../src/math/contracts";
import { chanceOfRight } from "../src/schools/demo/personas";
import { projectSkillEvidence } from "../src/server/evidence";
import { frontierCatalog } from "../src/server/learner-frontier";
import {
  planMixedPractice,
  templateGrade,
  workingCoverage,
} from "../src/server/mixed-practice";
import type { Outcome } from "../src/server/repository";
import { hash, normalCdf } from "./placement-simulation.fixture";

/* The first answers of a new learner, problem by problem, through the real
   planner and estimator as the API runs them: one problem per request, the
   last 12 answers as recent history, skill evidence from every answer, the
   frontier state folded forward answer by answer.

   The learners answer by the placement simulation's response model
   (placement-simulation.fixture.ts): a probit curve in the distance between
   the learner's level and the item's grade, with per-family difficulty noise,
   a chance pick on choice items and a small slip. Not the estimator's own
   curve. Synthetic regression scenarios, not evidence about real learners. */

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const byId = new Map(templates.map((template) => [template.id, template]));
/** What the current web client declares it can draw: everything. */
const webTemplates = templates.filter((template) =>
  clientCanDraw(template, {
    responseCapabilities: [...responseCapabilities],
    figureCapabilities: [...figureCapabilities],
  }),
);
const gradeOfTemplate = (id: string) => templateGrade(byId.get(id)!, nodes);
export const PACE_EPOCH = Date.parse("2026-10-19T12:00:00Z");
const ANSWER_GAP_MS = 40_000;
/** The catalog's hardest and easiest material: a learner beyond either end
 * works at that end. */
const CATALOG_TOP = Math.max(...webTemplates.map((t) => gradeOfTemplate(t.id)));
const CATALOG_FLOOR = Math.min(
  ...webTemplates.map((t) => gradeOfTemplate(t.id)),
);

/** How a simulated learner answers. `probit`: the chance of knowing an item
 * falls as its grade rises above the learner's level; `slip` is the share of
 * known items answered wrong anyway. `flat`: right this often on anything. */
export type PaceModel =
  | { kind: "probit"; slip: number }
  | { kind: "flat"; right: number }
  /** The demo personas' curve (`chanceOfRight`), as the climb simulation
   * uses it: a second response model, with more lucky right answers. */
  | { kind: "persona" };
export type PaceLearner = {
  type: PaceType;
  /** The grade the roster or birth year gives: where practice starts. */
  expected: number;
  /** The true working level on the grade axis (K = 0 … Precalculus = 12). */
  level: number;
  model: PaceModel;
};
export const paceTypes = [
  "at grade",
  "two below",
  "two above",
  "four above",
  "always right",
  "careless at grade",
] as const;
export type PaceType = (typeof paceTypes)[number];
export const paceExpected = [0, 3, 6, 9] as const;

/** The learners of the pace study: six kinds at each of four expected grades.
 * Two below kindergarten is below the catalog (−1, the estimator's floor);
 * four above Algebra 1 is past the catalog (13). */
export function paceLearners(): PaceLearner[] {
  const careful: PaceModel = { kind: "probit", slip: 0.03 };
  return paceExpected.flatMap((expected) => [
    { type: "at grade", expected, level: expected, model: careful },
    {
      type: "two below",
      expected,
      level: Math.max(-1, expected - 2),
      model: careful,
    },
    { type: "two above", expected, level: expected + 2, model: careful },
    {
      type: "four above",
      expected,
      level: Math.min(13, expected + 4),
      model: careful,
    },
    {
      type: "always right",
      expected,
      level: 13,
      model: { kind: "flat", right: 0.97 },
    },
    {
      type: "careless at grade",
      expected,
      level: expected,
      model: { kind: "probit", slip: 0.2 },
    },
  ]);
}

export type PaceStep = {
  templateId: string;
  skillId: string;
  /** The skill's own grade (whole), and the item's on the engine's axis. */
  skillGrade: number;
  grade: number;
  strand: string;
  area: AreaId;
  reason: string;
  purpose?: string;
  opener: boolean;
  correct: boolean;
  /** Before the problem: the strand's estimate and width, the ceiling the
   * planner worked under, and whether the learner was still climbing. */
  strandLevel: number;
  strandSd: number;
  ceiling?: number;
  /** The highest grade covered before the problem (learning/coverage.ts);
   * null before any, absent where coverage does not apply. */
  covered?: number | null;
  /** Coverage held the ceiling below what the answers alone allow. */
  coverageBinds: boolean;
  climbing?: boolean;
  /** Before the problem: the level an adult is shown, with its range. */
  shownBefore: number;
  /** After the answer: the level an adult is shown, with its range. */
  shown: number;
  low: number;
  high: number;
  sd: number;
};
export type PaceRun = { learner: PaceLearner; seed: string; steps: PaceStep[] };

/** An estimator and a planner to run the learners through. */
export type PaceEngine = {
  frontierPolicy: FrontierPolicy;
  practicePolicy: PracticePolicy;
};
/** `before`: the engine up to 2026-11-24, where the start was a guess for
 * everyone and the ceiling stood two grades above any two right answers.
 * `after`: the current one. */
export const paceEngines: Record<"before" | "after", PaceEngine> = {
  before: {
    frontierPolicy: EVIDENCE_CLIMB_FRONTIER_POLICY,
    practicePolicy: FAST_CLIMB_PRACTICE_POLICY,
  },
  after: {
    frontierPolicy: DEFAULT_FRONTIER_POLICY,
    practicePolicy: DEFAULT_PRACTICE_POLICY,
  },
};
export type PaceOptions = Partial<PaceEngine> & {
  seed: string;
  count: number;
  /** The reported level's prior width (`startingSd`): absent for a child. */
  startSd?: number;
  /** The start is the learner's grade (`startFromGrade`), as it is for a
   * child with a birth year or on a roster. False: a guessed start. */
  gradeStart?: boolean;
  /** Answers already on record before the run, oldest first. */
  record?: readonly PaceStep[];
};

/** Runs `count` problems for one learner with one seed. */
export function simulatePace(
  learner: PaceLearner,
  options: PaceOptions,
): PaceRun {
  const policy = options.frontierPolicy ?? DEFAULT_FRONTIER_POLICY;
  const state = createFrontierState(
    learner.expected,
    policy,
    options.startSd,
    options.gradeStart ?? true,
  );
  const attempts: Outcome[] = [];
  const steps: PaceStep[] = [];
  const key = `pace:${learner.type}:${learner.expected}:${options.seed}`;
  const record = options.record ?? [];
  record.forEach((step, i) => {
    const createdAt = new Date(PACE_EPOCH + i * ANSWER_GAP_MS).toISOString();
    attempts.push({
      id: `${key}:r${i}`,
      problemId: `${key}:rp${i}`,
      requestId: `${key}:rr${i}`,
      skillId: step.skillId,
      templateId: step.templateId,
      response: "",
      correct: step.correct,
      assisted: false,
      explanation: [],
      answer: "",
      createdAt,
    });
    advanceFrontierState(
      state,
      {
        templateId: step.templateId,
        correct: step.correct,
        assisted: false,
        createdAt,
      },
      frontierCatalog,
      policy,
      STRAND_FREEZE,
    );
  });
  const shownOf = (frontier: Frontier) => reportEstimate(frontier.overall);
  // Each answer's time and seed come from its place in the whole history, so
  // a run that continues a record asks what a longer run would have asked.
  for (let i = record.length; i < record.length + options.count; i++) {
    const at = PACE_EPOCH + i * ANSWER_GAP_MS;
    const frontier = readFrontierState(state, at, policy);
    const evidence = projectSkillEvidence(attempts);
    const coverage = workingCoverage({
      frontier,
      skills,
      evidence,
      policy: options.practicePolicy,
    });
    const [choice] = planMixedPractice({
      policy: options.practicePolicy,
      templates: webTemplates,
      skills,
      attempts: attempts.slice(-12),
      evidence,
      frontier,
      count: 1,
      seed: `${key}:${i}`,
      now: at,
      learnerKey: key,
    });
    const template = choice!.template;
    const skill = nodes.get(template.skillId)!;
    const grade = gradeOfTemplate(template.id);
    const guess = Math.max(0.03, guessChanceOf(template.id));
    let chance: number;
    if (learner.model.kind === "flat") chance = learner.model.right;
    else if (learner.model.kind === "persona") {
      const lucky = guessChanceOf(template.id);
      chance =
        lucky + (1 - lucky) * chanceOfRight(learner.level, template.skillId);
    } else {
      const difficulty = grade - 0.4 + (hash(template.id) - 0.5);
      const knows = normalCdf((learner.level - difficulty) / 0.8);
      chance = guess + (1 - guess - learner.model.slip) * knows;
    }
    // Common random numbers: luck depends on the learner, the item and how
    // often they have seen it, never on what was asked before, so two engines
    // that ask the same item see the same answer.
    const seen = attempts.filter((a) => a.templateId === template.id).length;
    const correct = hash(`${key}:${template.id}:${seen}`) < chance;
    const createdAt = new Date(at).toISOString();
    attempts.push({
      id: `${key}:a${i}`,
      problemId: `${key}:p${i}`,
      requestId: `${key}:r${i}`,
      skillId: template.skillId,
      templateId: template.id,
      response: "",
      correct,
      assisted: false,
      explanation: [],
      answer: "",
      createdAt,
    });
    advanceFrontierState(
      state,
      { templateId: template.id, correct, assisted: false, createdAt },
      frontierCatalog,
      policy,
      STRAND_FREEZE,
    );
    const before = shownOf(frontier);
    const after = shownOf(readFrontierState(state, at, policy));
    const strand = strandEstimate(frontier, choice!.strand);
    steps.push({
      templateId: template.id,
      skillId: template.skillId,
      skillGrade: gradeNumber[skill.gradeBand],
      grade,
      strand: choice!.strand,
      area: areaOf(skill),
      reason: choice!.reason,
      purpose: choice!.selection?.purpose,
      opener: !choice!.selection,
      correct,
      strandLevel: strand.level,
      strandSd: strand.sd,
      ceiling: Math.min(
        frontier.confirmation?.[choice!.strand]?.level ??
          frontier.unconfirmedCeiling ??
          Infinity,
        coverage?.ceiling ?? Infinity,
      ),
      ...(coverage ? { covered: coverage.covered } : {}),
      coverageBinds:
        !!coverage &&
        coverage.ceiling <
          (frontier.confirmation?.[choice!.strand]?.level ??
            frontier.unconfirmedCeiling ??
            Infinity),
      climbing: frontier.climbing,
      shownBefore: before.level,
      shown: after.level,
      low: after.low ?? after.level,
      high: after.high ?? after.level,
      sd: after.sd,
    });
  }
  return { learner, seed: options.seed, steps };
}

/** The level a learner can work at in this catalog: their own, held to the
 * catalog's ends. */
export const workingLevel = (learner: PaceLearner) =>
  Math.min(CATALOG_TOP, Math.max(CATALOG_FLOOR, learner.level));

/** The problem from which practice works within a grade of the learner's
 * level: of it and the nine after it, at least `enough` are within one grade.
 * Null if that never happens. */
export function answersToWork(run: PaceRun, enough = 6, window = 10) {
  const level = workingLevel(run.learner);
  const near = run.steps.map((step) => Math.abs(step.grade - level) <= 1);
  const at = near.findIndex(
    (_, i) =>
      i + window <= near.length &&
      near.slice(i, i + window).filter(Boolean).length >= enough,
  );
  return at < 0 ? null : at + 1;
}
/** Answers until the level shown comes within a grade of the true level and
 * holds for the next ten; null if it never does. */
export function answersToShow(run: PaceRun, hold = 10) {
  const level = Math.min(13, Math.max(-1, run.learner.level));
  const within = run.steps.map((step) => Math.abs(step.shown - level) <= 1);
  const at = within.findIndex(
    (_, i) =>
      i + hold <= within.length && within.slice(i, i + hold).every(Boolean),
  );
  return at < 0 ? null : at + 1;
}
export const highestOffered = (run: PaceRun, first: number) =>
  Math.max(...run.steps.slice(0, first).map((step) => step.grade));
/** Share of the first `first` problems more than two grades above the
 * expected grade. */
export const shareFarAbove = (run: PaceRun, first = 20) =>
  run.steps
    .slice(0, first)
    .filter((step) => step.grade > run.learner.expected + 2).length / first;
export const errorAt = (run: PaceRun, answered: number) =>
  Math.abs(
    run.steps[answered - 1]!.shown -
      Math.min(13, Math.max(-1, run.learner.level)),
  );
/** The expected grade's own skills met in the first `first` problems, and the
 * areas they cover. */
export function gradeCoverage(run: PaceRun, first = 40) {
  const own = run.steps
    .slice(0, first)
    .filter((step) => step.skillGrade === run.learner.expected);
  return {
    skills: new Set(own.map((step) => step.skillId)).size,
    areas: new Set(own.map((step) => step.area)).size,
    right: new Set(
      own.filter((step) => step.correct).map((step) => step.skillId),
    ).size,
  };
}
/** How many skills the catalog has at a grade, and in how many areas. */
export function gradeCatalog(grade: number) {
  const own = skills.filter(
    (skill) =>
      gradeNumber[skill.gradeBand] === grade &&
      webTemplates.some((template) => template.skillId === skill.id),
  );
  return {
    skills: own.length,
    areas: new Set(own.map((skill) => areaOf(skill))).size,
  };
}
