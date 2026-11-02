import { z } from "zod";
import type { WorkbookSpec } from "./compose";

/** Shared by the API and the parent screens. The spec stays on the server;
 * clients see a summary and download the printed workbook. */
export const workbookPapers = ["letter", "a4"] as const;
export type WorkbookPaper = (typeof workbookPapers)[number];
export const workbookDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      value >= "2000-01-01" &&
      value <= "2100-12-31" &&
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Use a calendar date such as 2026-11-01");
export const workbookMinutesSchema = z.union([
  z.literal(30),
  z.literal(45),
  z.literal(60),
]);
export const workbookRequestSchema = z
  .object({
    date: workbookDateSchema,
    minutes: workbookMinutesSchema,
    paper: z.enum(workbookPapers),
    /** Omitted: the next number for this date ("Another one"). */
    number: z.number().int().min(1).max(999).optional(),
  })
  .strict();
export type WorkbookRequest = z.infer<typeof workbookRequestSchema>;

export interface WorkbookRecord {
  id: string;
  date: string;
  number: number;
  minutes: z.infer<typeof workbookMinutesSchema>;
  paper: WorkbookPaper;
  spec: WorkbookSpec;
  code: string;
  createdAt: string;
}

export const workbookSectionKinds = [
  "warm-up",
  "lesson",
  "practice",
  "review",
  "challenge",
] as const;
export const workbookSummarySchema = z.object({
  id: z.string(),
  date: z.string(),
  number: z.number().int(),
  minutes: workbookMinutesSchema,
  paper: z.enum(workbookPapers),
  code: z.string(),
  createdAt: z.string(),
  /** The composer's estimate, which can differ a little from `minutes`. */
  estimatedMinutes: z.number(),
  problems: z.number().int(),
  sections: z.array(
    z.object({
      kind: z.enum(workbookSectionKinds),
      problems: z.number().int(),
      /** The lesson taught in "Today's idea"; null for other sections. */
      title: z.string().nullable(),
    }),
  ),
});
export type WorkbookSummary = z.infer<typeof workbookSummarySchema>;
export const workbookHistorySchema = z.object({
  workbooks: z.array(workbookSummarySchema),
  /** True when the server renders PDFs; false: download the printable
   * document and print it from the browser. */
  pdf: z.boolean().default(false),
});

/** One printed problem on the results screen. */
export const workbookResultRowSchema = z.object({
  n: z.number().int(),
  section: z.enum(workbookSectionKinds),
  skillId: z.string(),
  /** The problem type's authored title, as printed on the results page. */
  label: z.string().optional(),
  prompt: z.string(),
  /** Type the answer, pick the printed letter, or mark only. */
  entry: z.enum(["number", "choice", "mark"]),
  options: z
    .array(z.object({ id: z.string(), letter: z.string(), label: z.string() }))
    .optional(),
  recorded: z
    .object({
      method: z.enum(["answer", "mark"]),
      correct: z.boolean(),
      response: z.string().nullable(),
    })
    .nullable(),
});
export type WorkbookResultRow = z.infer<typeof workbookResultRowSchema>;
export const workbookResultsSchema = z.object({
  workbook: workbookSummarySchema,
  rows: z.array(workbookResultRowSchema),
  /** On save: how many results were new. */
  recorded: z.number().int().optional(),
});
export type WorkbookResults = z.infer<typeof workbookResultsSchema>;
export type WorkbookResultEntry =
  { n: number; answer: string } | { n: number; mark: "right" | "not-yet" };
