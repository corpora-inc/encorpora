import { z } from "zod";

/** A class's workbook tab, shareable and restored on refresh. `students` and
 * `skill` are how another screen links a group sheet; anything malformed is
 * dropped rather than refused. */
export const stackSearchSchema = z.object({
  date: z.iso.date().optional().catch(undefined),
  minutes: z
    .union([z.literal(30), z.literal(45), z.literal(60)])
    .optional()
    .catch(undefined),
  paper: z.enum(["letter", "a4"]).optional().catch(undefined),
  /** The workbook number, fixed once a print starts. */
  set: z.number().int().min(1).max(999).optional().catch(undefined),
  /** Comma-separated person ids. Absent: everyone with a seat. */
  students: z.string().max(9000).optional().catch(undefined),
  skill: z.string().max(120).optional().catch(undefined),
});
export type StackSearch = z.infer<typeof stackSearchSchema>;

/** A printed page's QR code lands here, on the student it belongs to. */
export const marksSearchSchema = z.object({
  set: z.number().int().min(1).max(999).optional().catch(undefined),
  student: z.uuid().optional().catch(undefined),
});
export type MarksSearch = z.infer<typeof marksSearchSchema>;

export const standingsSearchSchema = z.object({
  class: z.uuid().optional().catch(undefined),
});
