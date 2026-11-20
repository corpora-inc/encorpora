import { z } from "zod";

/** What the server and the teacher's screens share about LMS Connect
 * (docs/clever-lms-connect.md). */
export const lmsKinds = ["canvas", "schoology", "google_classroom"] as const;
export type LmsKind = (typeof lmsKinds)[number];
export const lmsNames: Record<LmsKind, string> = {
  canvas: "Canvas",
  schoology: "Schoology",
  google_classroom: "Google Classroom",
};

/** A class that is a Clever section of a district with LMS Connect. `type`
 * is null until Clever has said which LMS; `failureCode` is the district's
 * last refusal (a 401/403 is `lms_unauthorized`/`lms_forbidden`). */
export const lmsSummary = z.object({
  type: z.enum(lmsKinds).nullable(),
  state: z.string().nullable(),
  failureCode: z.string().nullable(),
});
export type LmsSummary = z.infer<typeof lmsSummary>;

const day = z.iso.date();
export const lmsAssignmentStatus = z.enum([
  "pending",
  "creating",
  "unknown",
  "published",
  "deleting",
  "deleted",
  "missing",
]);
export const lmsAssignmentResource = z.object({
  id: z.uuid(),
  kind: z.enum(["practice", "term_grade"]),
  title: z.string(),
  pointsPossible: z.number(),
  targetMinutes: z.number().nullable(),
  opensOn: day.nullable(),
  dueOn: day,
  termId: z.uuid().nullable(),
  termName: z.string().nullable(),
  status: lmsAssignmentStatus,
  lmsState: z.string().nullable(),
  failureCode: z.string().nullable(),
  finalized: z.boolean(),
  syncRequested: z.boolean(),
  lastPassbackAt: z.string().nullable(),
  graded: z.number(),
  blocked: z.number(),
  blockedBy: z.record(z.string(), z.number()),
  createdAt: z.string(),
});
export type LmsAssignmentResource = z.infer<typeof lmsAssignmentResource>;

export const lmsResponse = z.object({
  lms: lmsSummary,
  canEdit: z.boolean(),
  /** Today in the school's time zone: the earliest due day. */
  today: day,
  terms: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      startsOn: day,
      endsOn: day,
      state: z.enum(["open", "closed", "upcoming"]),
    }),
  ),
  assignments: z.array(lmsAssignmentResource),
});
export type LmsResponse = z.infer<typeof lmsResponse>;

const title = z.string().trim().min(1).max(120);
const points = z.number().finite().positive().max(1000);
/** A teacher's new or edited assignment. */
export const lmsAssignmentInput = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("practice"),
    title,
    pointsPossible: points,
    targetMinutes: z.number().int().min(1).max(6000),
    opensOn: day,
    dueOn: day,
  }),
  z.strictObject({
    kind: z.literal("term_grade"),
    title,
    pointsPossible: points,
    termId: z.uuid(),
    dueOn: day,
  }),
]);
export type LmsAssignmentInput = z.infer<typeof lmsAssignmentInput>;
