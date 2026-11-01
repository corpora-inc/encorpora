import { randomUUID } from "node:crypto";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
} from "../math/engine.js";
import {
  ApiError,
  type LearnerTransaction,
  type Outcome,
  type SavedProblem,
} from "../server/repository.js";
import type { SectionKind } from "./compose.js";
import type { WorkbookRecord } from "./contracts.js";
import type { GeneratedProblem } from "../math/contracts.js";

/**
 * Founder decision (2026-11, #1776): how much paper results count.
 * A typed answer, checked by the same exact grader as the app, is an
 * independent attempt. A parent's right / not-yet mark without the answer
 * counts at half weight: it informs the level estimate, a "right" mark never
 * confirms a band or earns independent credit, and a "not yet" is a miss.
 * Change these only with the founder.
 */
export const PAPER_GRADED_WEIGHT = 1;
export const PAPER_MARK_WEIGHT = 0.5;

/** Responses a parent can type or pick exactly as printed; every other kind
 * (multi-part, plotting, ordered steps, several choices) is marked. */
const answerable = (problem: GeneratedProblem) =>
  problem.public.response.kind === "number" ||
  problem.public.response.kind === "fraction" ||
  problem.public.response.kind === "choice";
const letters = "ABCDEFGH";

export type PaperEntry =
  | { n: number; answer: string; mark?: undefined }
  | { n: number; mark: "right" | "not-yet"; answer?: undefined };

/** Ids are stable per workbook and problem number, so entering the same
 * results again finds what was recorded and never adds a second attempt. */
export const paperProblemId = (workbookId: string, n: number) =>
  `paper:${workbookId}:${n}`;

function numbered(record: WorkbookRecord) {
  let n = 0;
  return record.spec.sections.flatMap((section) =>
    section.items.map((item) => ({
      n: ++n,
      section: section.kind as SectionKind,
      item,
      problem: generateProblem(item.templateId, item.seed),
    })),
  );
}

export interface ResultRow {
  n: number;
  section: SectionKind;
  skillId: string;
  prompt: string;
  /** How the parent enters the result: type the answer, pick the printed
   * letter, or mark only. */
  entry: "number" | "choice" | "mark";
  options?: { id: string; letter: string; label: string }[];
  recorded: null | {
    method: "answer" | "mark";
    correct: boolean;
    /** What was entered: the typed answer or the chosen letter. */
    response: string | null;
  };
}

function letterOf(problem: GeneratedProblem, optionId: string) {
  const r = problem.public.response;
  if (r.kind !== "choice") return optionId;
  const index = r.options.findIndex((o) => o.id === optionId);
  return index >= 0 ? letters[index]! : optionId;
}

export async function resultRows(
  tx: LearnerTransaction,
  record: WorkbookRecord,
): Promise<ResultRow[]> {
  const rows: ResultRow[] = [];
  for (const { n, section, item, problem } of numbered(record)) {
    const attempt = await tx.attemptByRequest(paperProblemId(record.id, n));
    const r = problem.public.response;
    rows.push({
      n,
      section,
      skillId: item.skillId,
      prompt: problem.public.prompt,
      entry: !answerable(problem)
        ? "mark"
        : r.kind === "choice"
          ? "choice"
          : "number",
      ...(r.kind === "choice"
        ? {
            options: r.options.map((o, i) => ({
              id: o.id,
              letter: letters[i]!,
              label: o.label,
            })),
          }
        : {}),
      recorded: attempt
        ? {
            method:
              (attempt.evidenceWeight ?? 1) < 1 ? "mark" : ("answer" as const),
            correct: attempt.correct,
            response:
              (attempt.evidenceWeight ?? 1) < 1
                ? null
                : letterOf(problem, attempt.response),
          }
        : null,
    });
  }
  return rows;
}

/** A row the server cannot accept, named by problem number. */
export class PaperEntryError extends Error {
  constructor(
    readonly problem: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Records paper results as attempts with evidence source `paper`. A problem
 * already recorded is kept as it is (attempts are immutable), so entering a
 * workbook again is safe. Returns how many results were new.
 */
export async function recordPaperResults(
  tx: LearnerTransaction,
  record: WorkbookRecord,
  entries: readonly PaperEntry[],
  now: Date,
): Promise<number> {
  const items = new Map(numbered(record).map((entry) => [entry.n, entry]));
  const seen = new Set<number>();
  const pending: { entry: PaperEntry; problem: GeneratedProblem }[] = [];
  for (const entry of entries) {
    const found = items.get(entry.n);
    if (!found)
      throw new PaperEntryError(
        entry.n,
        `This workbook has no problem ${entry.n}.`,
      );
    if (seen.has(entry.n))
      throw new PaperEntryError(
        entry.n,
        `Problem ${entry.n} is entered twice.`,
      );
    seen.add(entry.n);
    if (entry.answer !== undefined) {
      if (!answerable(found.problem))
        throw new PaperEntryError(
          entry.n,
          `Mark problem ${entry.n} right or not yet.`,
        );
      if (!isValidResponse(found.problem.public, entry.answer))
        throw new PaperEntryError(
          entry.n,
          found.problem.public.response.kind === "choice"
            ? `Choose one of the printed letters for problem ${entry.n}.`
            : `Enter a number, decimal or fraction such as 3/4 for problem ${entry.n}.`,
        );
    }
    pending.push({ entry, problem: found.problem });
  }
  const practice = await tx.practiceSettings();
  let added = 0;
  for (const { entry, problem } of pending) {
    const id = paperProblemId(record.id, entry.n);
    if (await tx.attemptByRequest(id)) continue;
    const saved: SavedProblem = {
      ...problem,
      public: { ...problem.public, id },
      practiceEpoch: practice.epoch,
      practiceRevision: practice.revision,
      selection: {
        reason: "paper",
        workbookId: record.id,
        workbookDate: record.date,
        problemNumber: entry.n,
      },
    };
    if (await tx.attemptByProblem(id))
      throw new ApiError(409, `Problem ${entry.n} was already recorded`);
    await tx.saveProblem(saved);
    const graded = entry.answer !== undefined;
    const outcome: Outcome = {
      id: randomUUID(),
      problemId: id,
      requestId: id,
      skillId: problem.public.skillId,
      templateId: problem.public.templateId,
      response: graded ? entry.answer!.trim() : "",
      correct: graded
        ? gradeAnswer(problem, entry.answer!.trim())
        : entry.mark === "right",
      // Paper is done apart from the app: "working together" (an app
      // setting) does not describe it.
      assisted: false,
      explanation: problem.explanation,
      answer: problem.answer,
      createdAt: now.toISOString(),
      evidenceSource: "paper",
      ...(graded ? {} : { evidenceWeight: PAPER_MARK_WEIGHT }),
      ...(problem.variant ? { variant: problem.variant } : {}),
    };
    if (graded && PAPER_GRADED_WEIGHT < 1)
      outcome.evidenceWeight = PAPER_GRADED_WEIGHT;
    await tx.saveAttempt(outcome);
    added++;
  }
  return added;
}

/** Templates printed in recent workbooks, which mixed practice holds back
 * that day so the app does not repeat the paper. */
export function workbookTemplateIds(
  records: readonly WorkbookRecord[],
): Set<string> {
  return new Set(
    records.flatMap((r) =>
      r.spec.sections.flatMap((s) => s.items.map((i) => i.templateId)),
    ),
  );
}
