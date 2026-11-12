/**
 * One student's term of practice, the way the live serve path would leave it.
 *
 * Each sitting, the production planner picks the problem and the misspecified
 * learner answers from their true level that day. The stored problem is the
 * one the generator returned, including its template version. The level days
 * are the production estimator replayed over those answers.
 */
import { createHash } from "node:crypto";
import { skills } from "../../curriculum/catalog.js";
import type { AnswerHelp } from "../help-contracts.js";
import { problemDigest } from "../work-replay.js";
import {
  clientCanDraw,
  figureCapabilities,
  responseCapabilities,
  type PublicProblem,
} from "../../math/contracts.js";
import { generateProblem, templates, type GeneratedProblem } from "../../math/engine.js";
import { projectSkillEvidence } from "../../server/evidence.js";
import {
  advanceLearnerFrontier,
  newLearnerFrontier,
  readLearnerFrontier,
} from "../../server/learner-frontier.js";
import { planMixedPractice } from "../../server/mixed-practice.js";
import type { Outcome } from "../../server/repository.js";
import {
  levelDocuments,
  misspecifiedCorrect,
  type LevelAnswer,
} from "./engine-levels.js";
import { hash, wrongResponse } from "./personas.js";
import { doseTruth, personaTruth, type LearnerTruth, type Sitting } from "./truth.js";
import type { Persona } from "./personas.js";

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const strandNames = [...new Set(skills.map((skill) => skill.strand))].sort();
const webTemplates = templates.filter((template) =>
  clientCanDraw(template, {
    responseCapabilities: [...responseCapabilities],
    figureCapabilities: [...figureCapabilities],
  }),
);
const strandOf = new Map(
  webTemplates.map((template) => [
    template.id,
    nodes.get(template.skillId)?.strand ?? template.skillId,
  ]),
);

const problemCache = new Map<string, GeneratedProblem>();
function drawn(templateId: string, seed: string): GeneratedProblem | null {
  const key = `${templateId}\0${seed}`;
  const cached = problemCache.get(key);
  if (cached) return cached;
  try {
    const problem = generateProblem(templateId, seed);
    if (!problem.public.prompt) return null;
    problemCache.set(key, problem);
    return problem;
  } catch {
    return null;
  }
}

/** A wrong answer in the shape the problem asked for. Choice and numeric
 * items use the shared distractor; anything else moves one part. */
export function plausibleWrong(problem: GeneratedProblem): string {
  const basic = wrongResponse(problem as never);
  if (basic !== "99999" && basic !== "99998") return basic;
  const answer = problem.answer;
  if (answer.startsWith("[") || answer.startsWith("{")) {
    try {
      return JSON.stringify(nudge(JSON.parse(answer)));
    } catch {
      return basic;
    }
  }
  return basic;
}
function nudge(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) return value + 1;
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) {
    const places = value.split(".")[1]?.length ?? 0;
    return (Number(value) + 10 ** -places).toFixed(places);
  }
  if (Array.isArray(value) && value.length) {
    const copy = [...value];
    copy[copy.length - 1] = nudge(copy[copy.length - 1]);
    return copy;
  }
  if (value && typeof value === "object") {
    const copy = { ...(value as Record<string, unknown>) };
    const key = Object.keys(copy).at(-1);
    if (key) copy[key] = nudge(copy[key]);
    return copy;
  }
  return value;
}

/**
 * A simulation has no identity: the same job gives the same term for any
 * learner. Ids are placeholders here and become the learner's own in
 * `identify`, from (learner id, serial), so a computed term can be cached and
 * written for a fresh roster (`snapshot.ts`).
 */
export const INSTANCE_ID = "@amp-demo-instance@";
export const ATTEMPT_ID = "@amp-demo-attempt@";
export const REQUEST_ID = "@amp-demo-request@";
/** The outcome's `createdAt`, which is the answer's `at`: without it, the
 * outcomes of a term repeat, and a snapshot stores each once. */
export const ANSWERED_AT = "@amp-demo-at@";

export type SimAnswer = {
  serial: number;
  /** The stored problem, with `INSTANCE_ID` for its id. */
  content: string;
  /** The stored outcome, with the placeholder ids. */
  outcome: string;
  at: string;
  day: string;
  skillId: string;
  templateId: string;
  correct: boolean;
  assisted: boolean;
};
export type SimActive = {
  day: string;
  surface: "practice" | "hint" | "lesson";
  skillId: string;
  ms: number;
};
export type SimHelp = {
  serial: number;
  at: string;
  day: string;
  kind: "hint" | "lesson";
  skillId: string;
  ref: string;
  step: number | null;
};
export type Simulation = {
  answers: SimAnswer[];
  active: SimActive[];
  help: SimHelp[];
  levels: { day: string; frontier: string }[];
  truth: Pick<LearnerTruth, "startOffset" | "growth" | "hoursPerWeek">;
};

const hexId = (text: string) =>
  createHash("sha256").update(text).digest("hex");
/** The ids a learner's answer `serial` is stored under. */
export const answerIds = (learnerId: string, serial: number) => ({
  instanceId: hexId(`${learnerId}:${serial}`),
  attemptId: hexId(`${learnerId}:${serial}:a`),
  requestId: hexId(`${learnerId}:${serial}:r`),
});

/** One learner's rows from a simulation, under that learner's own ids. */
export function identify(simulation: Simulation, learnerId: string) {
  const ids = new Map<number, ReturnType<typeof answerIds>>();
  const idsOf = (serial: number) => {
    let found = ids.get(serial);
    if (!found) ids.set(serial, (found = answerIds(learnerId, serial)));
    return found;
  };
  return {
    answers: simulation.answers.map((row) => {
      const { instanceId, attemptId, requestId } = idsOf(row.serial);
      return {
        learnerId,
        instanceId,
        content: row.content.replaceAll(INSTANCE_ID, instanceId),
        outcome: row.outcome
          .replaceAll(ATTEMPT_ID, attemptId)
          .replaceAll(INSTANCE_ID, instanceId)
          .replaceAll(REQUEST_ID, requestId)
          .replaceAll(ANSWERED_AT, row.at),
        at: row.at,
        day: row.day,
        skillId: row.skillId,
        templateId: row.templateId,
        correct: row.correct,
        assisted: row.assisted,
      };
    }),
    active: simulation.active.map((row) => ({ learnerId, ...row })),
    help: simulation.help.map(({ serial, ...row }) => ({
      learnerId,
      ...row,
      problemId: idsOf(serial).instanceId,
    })),
    levels: simulation.levels.map((row) => ({ learnerId, ...row })),
  };
}

function helpFor(key: string): AnswerHelp[] | undefined {
  const roll = hash(`${key} help`);
  if (roll < 0.07) return ["hint"];
  if (roll < 0.09) return ["lesson"];
  return undefined;
}

function simulateTruth(
  name: string,
  grade: number,
  truth: LearnerTruth,
  now: number,
  today: string,
): Simulation {
  const state = newLearnerFrontier({
    epoch: 0,
    start: grade,
    strandStarts: {},
  });
  const attempts: Outcome[] = [];
  const answers: SimAnswer[] = [];
  const levelAnswers: LevelAnswer[] = [];
  const active = new Map<string, SimActive>();
  const help: SimHelp[] = [];
  let serial = 0;
  const addActive = (
    day: string,
    surface: SimActive["surface"],
    skillId: string,
    ms: number,
  ) => {
    const key = `${day}\0${surface}\0${skillId}`;
    const row = active.get(key);
    if (row) row.ms += ms;
    else active.set(key, { day, surface, skillId, ms });
  };
  for (const sitting of truth.sittings)
    playSitting({
      sitting,
      name,
      grade,
      truth,
      now,
      today,
      state,
      attempts,
      answers,
      levelAnswers,
      help,
      addActive,
      serial: () => serial++,
    });
  const levels = levelDocuments({
    start: grade,
    answers: levelAnswers,
    days: truth.sittings.map((sitting) => sitting.day),
  });
  return {
    answers,
    active: [...active.values()],
    help,
    levels,
    truth: {
      startOffset: truth.startOffset,
      growth: truth.growth,
      hoursPerWeek: truth.hoursPerWeek,
    },
  };
}

function playSitting(bag: {
  sitting: Sitting;
  name: string;
  grade: number;
  truth: LearnerTruth;
  now: number;
  today: string;
  state: ReturnType<typeof newLearnerFrontier>;
  attempts: Outcome[];
  answers: SimAnswer[];
  levelAnswers: LevelAnswer[];
  help: SimHelp[];
  addActive: (
    day: string,
    surface: SimActive["surface"],
    skillId: string,
    ms: number,
  ) => void;
  serial: () => number;
}) {
  const { sitting, truth, name, grade } = bag;
  // Today's sitting ends at `now`; an earlier day's sits mid-morning.
  const origin =
    sitting.day === bag.today
      ? bag.now - sitting.problems * sitting.msEach
      : Date.parse(`${sitting.day}T14:30:00Z`);
  let placed = 0;
  for (let slot = 0; slot < sitting.problems; slot++) {
    const serial = bag.serial();
    const atMs = origin + placed * sitting.msEach + sitting.msEach;
    const at = new Date(atMs).toISOString();
    const frontier = readLearnerFrontier(bag.state, atMs);
    const [choice] = planMixedPractice({
      templates: webTemplates,
      skills,
      attempts: bag.attempts.slice(-12),
      evidence: projectSkillEvidence(bag.attempts),
      frontier,
      count: 1,
      seed: `${name}:${serial}`,
      now: atMs,
      learnerKey: name,
    });
    if (!choice) break;
    const template = choice.template;
    const problem = drawn(template.id, `demo-${template.id}-${serial % 3}`);
    if (!problem) continue;
    placed++;
    const strand = strandOf.get(template.id) ?? choice.strand;
    const theta =
      grade +
      truth.startOffset +
      truth.growth * sitting.progress +
      (truth.strandOffsets.get(strand) ?? 0);
    const correct = misspecifiedCorrect({
      key: `${name}${sitting.day}${template.id}${serial}`,
      theta,
      templateId: template.id,
      slip: truth.slip,
      guess: truth.guess,
    });
    const assistedHelp = helpFor(`${name}${serial}`);
    const assisted = !!assistedHelp;
    const instanceId = INSTANCE_ID;
    const publicProblem: PublicProblem = { ...problem.public, id: instanceId };
    const response = correct ? problem.answer : plausibleWrong(problem);
    const attemptId = ATTEMPT_ID;
    const requestId = REQUEST_ID;
    const outcome = {
      id: attemptId,
      problemId: instanceId,
      requestId,
      skillId: problem.public.skillId,
      templateId: template.id,
      response,
      correct,
      assisted,
      ...(assistedHelp ? { help: assistedHelp } : {}),
      explanation: problem.explanation,
      answer: problem.answer,
      createdAt: ANSWERED_AT,
      ...(problem.variant ? { variant: problem.variant } : {}),
    };
    const content = {
      ...problem,
      public: publicProblem,
      practiceEpoch: 0,
      practiceRevision: 0,
      selection: { reason: choice.reason, strand: choice.strand },
      digest: problemDigest(publicProblem),
    };
    bag.answers.push({
      serial,
      content: JSON.stringify(content),
      outcome: JSON.stringify(outcome),
      at,
      day: sitting.day,
      skillId: problem.public.skillId,
      templateId: template.id,
      correct,
      assisted,
    });
    bag.attempts.push({
      id: attemptId,
      problemId: instanceId,
      requestId,
      skillId: problem.public.skillId,
      templateId: template.id,
      response,
      correct,
      assisted,
      explanation: [],
      answer: problem.answer,
      createdAt: at,
    });
    bag.levelAnswers.push({
      templateId: template.id,
      correct,
      assisted,
      at,
      day: sitting.day,
    });
    const helpMs = assistedHelp?.includes("lesson")
      ? 70_000
      : assistedHelp?.includes("hint")
        ? 25_000
        : 0;
    const practiceMs = Math.max(15_000, sitting.msEach - helpMs);
    bag.addActive(sitting.day, "practice", problem.public.skillId, practiceMs);
    if (assistedHelp?.includes("hint")) {
      bag.addActive(sitting.day, "hint", problem.public.skillId, 25_000);
      bag.help.push({
        serial,
        at,
        day: sitting.day,
        kind: "hint",
        skillId: problem.public.skillId,
        ref: template.id,
        step: 1,
      });
    }
    if (assistedHelp?.includes("lesson")) {
      bag.addActive(sitting.day, "lesson", problem.public.skillId, 70_000);
      bag.help.push({
        serial,
        at,
        day: sitting.day,
        kind: "lesson",
        skillId: problem.public.skillId,
        ref: template.id,
        step: null,
      });
    }
    advanceLearnerFrontier(bag.state, [
      {
        templateId: template.id,
        correct,
        assisted,
        createdAt: at,
        practiceRevision: 0,
        sequence: String(serial + 1),
      },
    ]);
  }
}

export function simulateDose(options: {
  name: string;
  grade: number;
  termStart: string;
  today: string;
  weekShape: readonly number[];
  now: number;
  workToday: boolean;
  joined?: string;
}): Simulation {
  const truth = doseTruth({
    name: options.name,
    grade: options.grade,
    termStart: options.termStart,
    today: options.today,
    weekShape: options.weekShape,
    strands: strandNames,
    workToday: options.workToday,
    joined: options.joined,
  });
  return simulateTruth(
    options.name,
    options.grade,
    truth,
    options.now,
    options.today,
  );
}

export function simulatePersona(options: {
  name: string;
  grade: number;
  persona: Persona;
  termStart: string;
  today: string;
  weekShape: readonly number[];
  now: number;
  workToday: boolean;
}): Simulation {
  const truth = personaTruth({
    name: options.name,
    grade: options.grade,
    persona: options.persona,
    termStart: options.termStart,
    today: options.today,
    weekShape: options.weekShape,
    strands: strandNames,
    workToday: options.workToday,
  });
  return simulateTruth(
    options.name,
    options.grade,
    truth,
    options.now,
    options.today,
  );
}

export type SimJob =
  | { kind: "dose"; options: Parameters<typeof simulateDose>[0] }
  | { kind: "persona"; options: Parameters<typeof simulatePersona>[0] };

export function runSimulation(job: SimJob): Simulation {
  return job.kind === "persona"
    ? simulatePersona(job.options)
    : simulateDose(job.options);
}
