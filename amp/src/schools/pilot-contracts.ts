import { z } from "zod";
import { plainName, timezone, gradeLevelSchema } from "./contracts.js";

export const startSchoolClassSchema = z.strictObject({
  requestId: z.uuid(),
  schoolName: z.string().trim().min(1).max(200),
  orgId: z.uuid().optional(),
  newSchool: z.boolean().default(false),
  className: plainName,
  timezone,
  signerName: plainName,
  signerTitle: plainName,
  agreementVersion: z.string(),
  authorized: z.literal(true),
  names: z.array(plainName).max(500).default([]),
  gradeLevel: gradeLevelSchema.optional(),
});
export type StartSchoolClass = z.infer<typeof startSchoolClassSchema>;
export const pilotStateSchema = z.object({
  status: z.enum(["ready", "active", "grace", "expired"]),
  startedAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  graceEndsAt: z.string().nullable(),
  eligible: z.boolean().default(true),
  authorized: z.boolean().default(false),
  coverage: z
    .object({
      students: z.number().int(),
      covered: z.number().int(),
      paid: z.number().int(),
    })
    .optional(),
});
export type PilotState = z.infer<typeof pilotStateSchema>;
export const schoolPurchaseSchema = z.strictObject({
  orgId: z.uuid(),
  classIds: z.array(z.uuid()).min(1).max(500),
  seats: z.number().int().min(1).max(1_000_000),
  note: z.string().trim().max(1000).default(""),
});
export const buyerHandoffSchema = z.object({
  id: z.uuid(),
  schoolName: z.string(),
  seats: z.number().int(),
  status: z.string(),
  /** The teacher's note for the buyer, as they wrote it. */
  note: z.string().default(""),
  /** Who sent it. */
  teacher: z.string().nullable().default(null),
  classCount: z.number().int(),
  students: z.number().int(),
  participating: z.number().int(),
  pilots: z.array(pilotStateSchema),
});
