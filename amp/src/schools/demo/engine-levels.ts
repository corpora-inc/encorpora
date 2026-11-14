/**
 * Demo level days from the production estimator.
 *
 * Each stored row is the posterior mean and the calibrated reported sd after
 * the answers that exist for that student, drawn from the misspecified learner
 * in `src/learning/synthetic-response.ts`. Scheduling is not involved: nothing
 * here chooses the next problem.
 */
import type { Estimate } from "../../learning/frontier.js";
import { DEFAULT_FRONTIER_POLICY } from "../../learning/frontier-policy.js";
import {
  REPORTED_SD_VERSION,
  reportedSd,
} from "../../learning/frontier-report.js";
import {
  MISSPECIFIED_RESPONSE,
  misspecifiedSuccessProbability,
} from "../../learning/synthetic-response.js";
import {
  advanceLearnerFrontier,
  frontierCatalog,
  newLearnerFrontier,
  readLearnerFrontier,
} from "../../server/learner-frontier.js";
import { hash } from "./personas.js";

export { DEFAULT_FRONTIER_POLICY, REPORTED_SD_VERSION };

/** N(0, 0.5²) difficulty noise for one template, stable for the process. */
const itemOffsets = new Map<string, number>();
export function itemOffset(templateId: string): number {
  let offset = itemOffsets.get(templateId);
  if (offset === undefined) {
    const u = Math.max(hash(`${templateId} offset`), 1e-12);
    const v = hash(`${templateId} offset2`);
    offset =
      Math.sqrt(-2 * Math.log(u)) *
      Math.cos(2 * Math.PI * v) *
      MISSPECIFIED_RESPONSE.itemSd;
    itemOffsets.set(templateId, offset);
  }
  return offset;
}

/** One learner's slip and guess, inside the misspecified ranges. */
export function learnerNoise(name: string): { slip: number; guess: number } {
  const { slipMin, slipMax, guessMin, guessMax } = MISSPECIFIED_RESPONSE;
  return {
    slip: slipMin + hash(`${name} slip`) * (slipMax - slipMin),
    guess: guessMin + hash(`${name} guess`) * (guessMax - guessMin),
  };
}

/** Whether this answer is right under the misspecified model. `key` picks the
 * draw, so the same student and item replay the same answer. */
export function misspecifiedCorrect(options: {
  key: string;
  theta: number;
  templateId: string;
  slip: number;
  guess: number;
}): boolean {
  const grade = frontierCatalog.gradeOf(options.templateId);
  if (grade === undefined) return hash(options.key) < 0.7;
  return (
    hash(options.key) <
    misspecifiedSuccessProbability({
      theta: options.theta,
      catalogGrade: grade,
      itemOffset: itemOffset(options.templateId),
      slip: options.slip,
      guess: options.guess,
    })
  );
}

export type LevelAnswer = {
  templateId: string;
  correct: boolean;
  assisted: boolean;
  at: string;
  /** School calendar day. The timestamp can fall on another UTC date. */
  day?: string;
};

function stored(estimate: Estimate, scope: "overall" | "strand") {
  return {
    level: estimate.level,
    sd: reportedSd(estimate.sd, { answered: estimate.answered, scope }),
    answered: estimate.answered,
    independent: estimate.independent,
  };
}

/** Level-day documents for the days in `days` that have an answer. The
 * posterior is read at the end of that day, after every earlier answer. */
export function levelDocuments(options: {
  start: number;
  answers: readonly LevelAnswer[];
  days: readonly string[];
}): { day: string; frontier: string }[] {
  const wanted = new Set(options.days);
  // Demo students have birth years (`build.ts`), so their start is age's.
  const state = newLearnerFrontier({
    epoch: 0,
    start: options.start,
    fromAge: true,
    strandStarts: {},
  });
  const rows: { day: string; frontier: string }[] = [];
  let serial = 0;
  let lastDay = "";
  const snapshot = (day: string) => {
    if (!wanted.has(day)) return;
    const frontier = readLearnerFrontier(state, Date.parse(`${day}T23:00:00Z`));
    rows.push({
      day,
      frontier: JSON.stringify({
        sdVersion: REPORTED_SD_VERSION,
        overall: stored(frontier.overall, "overall"),
        strands: Object.fromEntries(
          Object.entries(frontier.strands).map(([id, estimate]) => [
            id,
            stored(estimate, "strand"),
          ]),
        ),
      }),
    });
  };
  const ordered = [...options.answers].sort((a, b) => a.at.localeCompare(b.at));
  for (const answer of ordered) {
    const day = answer.day ?? answer.at.slice(0, 10);
    if (lastDay && day !== lastDay) snapshot(lastDay);
    serial += 1;
    advanceLearnerFrontier(state, [
      {
        templateId: answer.templateId,
        correct: answer.correct,
        assisted: answer.assisted,
        createdAt: answer.at,
        practiceRevision: 0,
        sequence: String(serial),
      },
    ]);
    lastDay = day;
  }
  if (lastDay) snapshot(lastDay);
  return rows;
}
