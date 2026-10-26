import { z } from "zod";

/** "Report a problem": the reasons a learner can choose, in display order. */
export const flagReasons = [
  "wrong-answer",
  "confusing-wording",
  "figure-wrong",
  "tedious",
  "other",
] as const;
export type FlagReason = (typeof flagReasons)[number];
/** Short labels: the interface is translated into about 50 languages. */
export const flagReasonLabels: Record<FlagReason, string> = {
  "wrong-answer": "The answer is wrong",
  "confusing-wording": "Confusing wording",
  "figure-wrong": "Figure looks wrong",
  tedious: "Too tedious",
  other: "Other",
};
export const flagOutcomes = ["correct", "incorrect", "skipped"] as const;
export type FlagOutcome = (typeof flagOutcomes)[number];
export const clientKinds = ["web", "ios", "android", "native"] as const;
export const FLAG_NOTE_MAX = 280;
/** The server's error when this learner already reported the problem. */
export const ALREADY_REPORTED = "This problem was already reported";
/** Reports per hour per credential. A learner reports one problem once. */
export const FLAG_RATE_LIMIT = 30;

/**
 * Free text from a child can carry personal information, so the note field
 * is offered only to a learner in a parent's consented account whose birth
 * year shows they are at least 13 on every day of this year. Anonymous trials
 * and younger learners (or no birth year) choose reasons only. The server
 * enforces the same rule.
 */
export const NOTE_MIN_AGE = 13;
export function noteAllowed(
  learner: { trial: boolean; birthYear: number | null | undefined },
  now = new Date(),
): boolean {
  if (learner.trial || learner.birthYear == null) return false;
  // Born late in the year, a learner is a year younger than the difference.
  return now.getUTCFullYear() - learner.birthYear - 1 >= NOTE_MIN_AGE;
}

const commit = z.string().regex(/^[0-9a-f]{40}$/);
export const problemFlagSchema = z
  .object({
    problemId: z.string().min(1).max(160),
    requestId: z.string().uuid(),
    reasons: z
      .array(z.enum(flagReasons))
      .min(1)
      .max(flagReasons.length)
      .refine((list) => new Set(list).size === list.length, "Duplicate reason"),
    note: z.string().trim().max(FLAG_NOTE_MAX).optional(),
    /** The learner skipped the problem (it has no attempt). An attempt, when
     * one exists, decides the outcome instead. */
    skipped: z.boolean().optional(),
    webCommit: commit.nullable().optional(),
    client: z
      .object({
        kind: z.enum(clientKinds),
        viewport: z
          .object({
            width: z.number().int().min(1).max(20000),
            height: z.number().int().min(1).max(20000),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();
export type ProblemFlagInput = z.infer<typeof problemFlagSchema>;

/** One stored report, as written by the server. */
export type ProblemFlag = {
  id: string;
  requestId: string;
  problemId: string;
  templateId: string;
  templateVersion: number;
  seed: string;
  skillId: string;
  prompt: string;
  figureKind: string | null;
  responseKind:
    | "number"
    | "fraction"
    | "choice"
    | "multi-select"
    | "point-plot"
    | "figure-choice";
  response: string | null;
  outcome: FlagOutcome;
  assisted: boolean;
  reasons: FlagReason[];
  note: string | null;
  webCommit: string | null;
  apiCommit: string | null;
  clientKind: (typeof clientKinds)[number];
  viewport: { width: number; height: number };
};
