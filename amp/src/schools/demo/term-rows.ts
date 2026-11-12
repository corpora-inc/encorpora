/**
 * What a simulated term is (`simulate.ts` makes one; the server only writes
 * the shipped ones, `snapshot.ts`), and the ids its rows take for a learner.
 * No engine here: the API bundle reaches this file, never the simulation.
 */
import { createHash } from "node:crypto";
import type { LearnerTruth } from "./truth.js";

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

const hexId = (text: string) => createHash("sha256").update(text).digest("hex");
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
