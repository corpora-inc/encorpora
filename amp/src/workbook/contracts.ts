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
});
