import { skills } from "../src/curriculum/catalog";
import {
  initialLevel,
  strandEstimate,
  type Frontier,
} from "../src/learning/frontier";
import type { StartingChoice } from "../src/learning/starting-point";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { guessChanceOf } from "../src/math/guess-chance";
import {
  clientCanDraw,
  figureCapabilities,
  responseCapabilities,
} from "../src/math/contracts";
import { chanceOfRight, wrongResponse } from "../src/schools/demo/personas";
import { projectSkillEvidence } from "../src/server/evidence";
import {
  advanceLearnerFrontier,
  newLearnerFrontier,
  readLearnerFrontier,
} from "../src/server/learner-frontier";
import { planMixedPractice, templateGrade } from "../src/server/mixed-practice";
import type { Outcome } from "../src/server/repository";
import type { PracticePolicy } from "../src/learning/practice-policy";

/* A simulated learner working through practice exactly as the API serves it:
   one problem per request (the web client asks for one), the last 12 answers
   as recent history, durable skill evidence from every answer, and the
   learner's stored frontier state folded forward answer by answer. Each
   problem is generated and graded by the engine. The learner answers right
   with the demo personas' chance of right (`chanceOfRight`) at their true
   level, plus the item's chance of guessing a choice. */

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const byId = new Map(templates.map((template) => [template.id, template]));
/** What the current web client declares it can draw: everything. */
const webTemplates = templates.filter((template) =>
  clientCanDraw(template, {
    responseCapabilities: [...responseCapabilities],
    figureCapabilities: [...figureCapabilities],
  }),
);
export const gradeOfTemplate = (id: string) =>
  templateGrade(byId.get(id)!, nodes);
/** Each strand's hardest material. */
const strandTop = new Map<string, number>();
for (const template of webTemplates) {
  const strand = nodes.get(template.skillId)?.strand ?? template.skillId;
  strandTop.set(
    strand,
    Math.max(strandTop.get(strand) ?? -Infinity, gradeOfTemplate(template.id)),
  );
}
/** A Monday morning in October, inside one school year. */
export const CLIMB_EPOCH = Date.parse("2026-10-19T12:00:00Z");
const ANSWER_GAP_MS = 40_000;

function uniform(text: string): number {
  let value = 2166136261;
  for (const char of text)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  value = Math.imul(value ^ (value >>> 15), 2246822507);
  value = Math.imul(value ^ (value >>> 13), 3266489909);
  return ((value ^ (value >>> 16)) >>> 0) / 0x100000000;
}

export type ClimbLearner = {
  /** The learner's true working level on the grade axis (K = 0 … Precalculus
   * = 12), the same in every strand unless `strands` says otherwise. */
  level: number;
  strands?: Readonly<Record<string, number>>;
  /** Where practice starts, through the app's own `initialLevel`: a child's
   * birth year, or an adult's chosen start; neither is the default start. */
  birthYear?: number;
  band?: StartingChoice;
};
export type ClimbStep = {
  templateId: string;
  skillId: string;
  strand: string;
  grade: number;
  reason: string;
  purpose?: string;
  correct: boolean;
  /** The overall (displayed) estimate after this answer. */
  level: number;
  sd: number;
  /** Before this problem: its strand's estimate and working ceiling. */
  strandLevel: number;
  ceiling?: number;
  climbing?: boolean;
  /** Grade served minus the learner's level in its strand, or minus the
   * strand's hardest material when that is lower. */
  gap: number;
};
export type ClimbRun = { start: number; steps: ClimbStep[] };

/** Runs `count` problems for one learner with one seed. */
export function simulateClimb(
  learner: ClimbLearner,
  options: { seed: string; count: number; policy?: PracticePolicy },
): ClimbRun {
  const start = initialLevel({
    birthYear: learner.birthYear,
    band: learner.band,
    now: CLIMB_EPOCH,
  });
  const state = newLearnerFrontier({ epoch: 0, start, strandStarts: {} });
  const attempts: Outcome[] = [];
  const steps: ClimbStep[] = [];
  const key = `climb:${options.seed}`;
  for (let i = 0; i < options.count; i++) {
    const at = CLIMB_EPOCH + i * ANSWER_GAP_MS;
    const frontier: Frontier = readLearnerFrontier(state, at);
    const [choice] = planMixedPractice({
      policy: options.policy,
      templates: webTemplates,
      skills,
      attempts: attempts.slice(-12),
      evidence: projectSkillEvidence(attempts),
      frontier,
      count: 1,
      seed: `${key}:${i}`,
      now: at,
      learnerKey: key,
    });
    const template = choice!.template;
    const problem = generateProblem(template.id, `${key}:p${i}`);
    const strand = nodes.get(template.skillId)?.strand ?? template.skillId;
    const strandLevel = strandEstimate(frontier, strand).level;
    const ceiling =
      frontier.confirmation?.[strand]?.level ?? frontier.unconfirmedCeiling;
    const ability = learner.strands?.[strand] ?? learner.level;
    const guess = guessChanceOf(template.id);
    const chance =
      guess + (1 - guess) * chanceOfRight(ability, template.skillId);
    const intends = uniform(`${key}:answer:${i}`) < chance;
    const correct = gradeAnswer(
      problem,
      intends ? problem.answer : wrongResponse(problem),
    );
    const createdAt = new Date(at).toISOString();
    const outcome: Outcome = {
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
    };
    attempts.push(outcome);
    advanceLearnerFrontier(state, [
      {
        templateId: template.id,
        correct,
        assisted: false,
        createdAt,
        practiceRevision: 0,
        sequence: String(i + 1),
      },
    ]);
    const after = readLearnerFrontier(state, at).overall;
    steps.push({
      templateId: template.id,
      skillId: template.skillId,
      strand: choice!.strand,
      grade: gradeOfTemplate(template.id),
      reason: choice!.reason,
      purpose: choice!.selection?.purpose,
      correct,
      level: after.level,
      sd: after.sd,
      strandLevel,
      ceiling,
      climbing: frontier.climbing,
      gap:
        gradeOfTemplate(template.id) -
        Math.min(ability, strandTop.get(strand) ?? ability),
    });
  }
  return { start, steps };
}

/** Answers until the displayed estimate comes within `tolerance` of the true
 * level and holds there for the next `hold` answers (or the rest of the run);
 * null if it never does. */
export function answersToEstimate(
  run: ClimbRun,
  level: number,
  tolerance = 0.5,
  hold = 10,
): number | null {
  const within = run.steps.map(
    (step) => Math.abs(step.level - level) <= tolerance,
  );
  const at = within.findIndex((_, i) =>
    within.slice(i, i + hold).every(Boolean),
  );
  return at < 0 ? null : at + 1;
}

/** Whether a problem is work near the learner's level: between a grade and a
 * half below it and a grade above it. A strand whose hardest material is
 * below the learner's level counts from that material: a grade-10 adult's
 * place-value work tops out at grade 5. */
export const nearLevel = (step: ClimbStep) => step.gap >= -1.5 && step.gap <= 1;

/** The problem from which practice works near the learner's level: of it and
 * the nine after it, at least seven are near the level (`nearLevel`). Null if
 * that never happens. */
export function answersToServe(run: ClimbRun, window = 10, enough = 7) {
  const near = run.steps.map(nearLevel);
  const at = near.findIndex(
    (_, i) =>
      i + window <= near.length &&
      near.slice(i, i + window).filter(Boolean).length >= enough,
  );
  return at < 0 ? null : at + 1;
}

export type ClimbCase = {
  name: string;
  learner: ClimbLearner;
};
/** The founder's cases (2026-11-10): adults whose start is a wrong guess in
 * either direction, and children whose birth year is right, too high or too
 * low. Birth years are for October 2026 (born 2016 → grade 4). */
export const climbCases: ClimbCase[] = [
  { name: "Adult at grade 10, starting at grade 2", learner: { level: 10 } },
  {
    name: "Adult at grade 10, starting at Precalculus (12)",
    learner: { level: 10, band: "precalculus" },
  },
  {
    name: "Adult at grade 10, starting at grade 7",
    learner: { level: 10, band: "middle-school" },
  },
  {
    name: "4th grader at level 4, from birth year",
    learner: { level: 4, birthYear: 2016 },
  },
  {
    name: "Struggling 7th grader at level 4, from birth year",
    learner: { level: 4, birthYear: 2013 },
  },
  {
    name: "Strong 3rd grader at level 6, from birth year",
    learner: { level: 6, birthYear: 2017 },
  },
];
