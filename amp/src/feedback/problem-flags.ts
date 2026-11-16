import { z } from "zod";
import { COPPA_CHILD_UNDER, pastCoppaAge } from "../privacy/coppa-age.js";

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
 * Free text from a child under 13 is personal information COPPA reaches
 * (16 CFR 312.2), so the note field is offered only to a learner whose birth
 * year shows they are at least 13 on every day of this year
 * (src/privacy/coppa-age.ts). Younger learners (or no birth year) and
 * anonymous trials choose reasons only. A family learner 13 or older needs no
 * consent for it. A school's unnamed student (`namePending` in a school
 * session) has a year from a roster or a tutor, never from a parent, so they
 * keep reasons only under the school's terms. The server enforces the same
 * rule.
 */
export const NOTE_MIN_AGE = COPPA_CHILD_UNDER;
export function noteAllowed(
  learner: {
    trial: boolean;
    birthYear: number | null | undefined;
    /** On a school's restricted roster basis. */
    schoolRestricted?: boolean;
  },
  now = new Date(),
): boolean {
  return (
    !learner.trial &&
    !learner.schoolRestricted &&
    pastCoppaAge(learner.birthYear, now.getUTCFullYear())
  );
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
    | "trend-line-fit"
    | "shape-composer"
    | "multi-part-choice"
    | "figure-choice"
    | "equal-addends"
    | "counter-builder"
    | "peg-board"
    | "structured-work"
    | "line-plot-build"
    | "unit-square-marking";
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
