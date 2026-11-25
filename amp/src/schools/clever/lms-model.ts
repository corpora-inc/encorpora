import { z } from "zod";
import { cleverId, CleverSyncError } from "./model.js";

/**
 * Clever LMS Connect (grade passback) objects, as Clever documents them for API
 * v3.1: https://dev.clever.com/docs/api-reference and the v3.1 OpenAPI spec
 * (github.com/Clever/swagger-api, full-v3.yml). One adapter serves Google
 * Classroom, Canvas and Schoology; the per-LMS rules live in `lms-payloads.ts`.
 *
 * Every schema strips unknown keys. Submissions can carry student attachments
 * and teacher comments; AMP keeps only state and points.
 */
export const lmsTypes = ["canvas", "schoology", "google_classroom"] as const;
export type LmsType = (typeof lmsTypes)[number];
export const lmsTypeNames: Record<LmsType, string> = {
  canvas: "Canvas",
  schoology: "Schoology",
  google_classroom: "Google Classroom",
};

/** `lms_state` from `GET /districts/{id}`. The API reference lists success,
 * matching_in_progress, disconnected, error and ""; the spec adds
 * initial_sync_processing and pending_authorization. Anything else is kept as
 * "unknown" rather than failing the read. */
export const lmsStates = [
  "success",
  "matching_in_progress",
  "initial_sync_processing",
  "pending_authorization",
  "disconnected",
  "error",
  "",
] as const;
export type LmsState = (typeof lmsStates)[number] | "unknown";
const lmsState = z
  .string()
  .nullable()
  .optional()
  .transform((value): LmsState | null =>
    value == null
      ? null
      : (lmsStates as readonly string[]).includes(value)
        ? (value as LmsState)
        : "unknown",
  );
const lmsType = z
  .string()
  .nullable()
  .optional()
  .transform((value): LmsType | null =>
    (lmsTypes as readonly string[]).includes(value ?? "")
      ? (value as LmsType)
      : null,
  );
export const lmsDistrictSchema = z.object({
  id: cleverId,
  lms_state: lmsState,
  lms_type: lmsType,
  last_lms_sync: z.string().nullable().optional(),
});
export type LmsDistrict = z.infer<typeof lmsDistrictSchema>;

/** Writes are allowed only once matching is complete (certification guide). */
export const lmsReady = (district: Pick<LmsDistrict, "lms_state">) =>
  district.lms_state === "success";

/** The spec puts it in `lms_status`; the quickstart names a bare
 * `synced_in_lms`. Either is accepted, and absence means not synced. */
export const lmsSectionSchema = z
  .object({
    id: cleverId,
    district: cleverId,
    term_id: cleverId.nullable().optional(),
    lms_status: z
      .object({ synced_in_lms: z.boolean().nullable().optional() })
      .nullable()
      .optional(),
    synced_in_lms: z.boolean().nullable().optional(),
  })
  .transform(({ lms_status, synced_in_lms, ...section }) => ({
    ...section,
    synced: (lms_status?.synced_in_lms ?? synced_in_lms) === true,
  }));
export type LmsSection = z.infer<typeof lmsSectionSchema>;

export const assignmentStates = [
  "draft",
  "scheduled",
  "open",
  "locked",
] as const;
export const submissionStates = [
  "created",
  "submitted",
  "returned",
  "reclaimed",
] as const;
export type AssignmentState = (typeof assignmentStates)[number];
export type SubmissionState = (typeof submissionStates)[number];

const datetime = z.string().nullable().optional();
const attachment = z.object({
  type: z.string(),
  url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
});
export const assignmentSchema = z.object({
  /** UUID; the only handle there will ever be (no list endpoint exists). */
  id: z.string().min(1).max(100),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  state: z.enum(assignmentStates).nullable().optional(),
  due_date: datetime,
  points_possible: z.number().nullable().optional(),
  grading_type: z.string().nullable().optional(),
  max_attempts: z.number().nullable().optional(),
  submission_types: z.array(z.string()).nullable().optional(),
  attachments: z.array(attachment).nullable().optional(),
  term_id: z.string().nullable().optional(),
  created: datetime,
  last_modified: datetime,
});
export type CleverAssignment = z.infer<typeof assignmentSchema>;

/** `GET …/submissions` returns no reliable `id` (deprecated, always empty for
 * Google Classroom). `user_id` identifies the student; Google Classroom omits
 * it for an LMS user Clever couldn't match. */
export const submissionSchema = z.object({
  user_id: cleverId.nullable().optional(),
  state: z.enum(submissionStates).nullable().optional(),
  grade_points: z.number().nullable().optional(),
  flags: z.array(z.string()).nullable().optional(),
  last_modified: datetime,
});
export type CleverSubmission = z.infer<typeof submissionSchema>;

/** Safe codes for every documented failure (clever-lms-connect-api-errors and
 * the provider-differences page). Raw provider messages are never stored or
 * logged: they can name people and echo identifiers. */
export const lmsErrorCodes = [
  "lms_unauthorized",
  "lms_forbidden",
  "lms_bad_request",
  "lms_missing_field",
  "lms_due_date_past",
  "lms_invalid_id",
  "lms_no_valid_users",
  "lms_grader_not_found",
  "lms_assignment_missing",
  "lms_user_not_found",
  "lms_not_found",
  "lms_method_not_allowed",
  "lms_assignment_unpublished",
  "lms_field_ignored",
  "lms_attachment_unsupported",
  "lms_submission_update_failed",
  "lms_rate_limited",
  "lms_unavailable",
  "lms_network_failed",
  "lms_create_outcome_unknown",
  "lms_invalid_response",
  "lms_pagination_expired",
  "lms_budget_exhausted",
  /** AMP-side: Schoology needs the section's Clever term, and it has none. */
  "lms_term_required",
] as const;
export type LmsErrorCode = (typeof lmsErrorCodes)[number];

export class LmsError extends CleverSyncError {
  constructor(
    readonly lmsCode: LmsErrorCode,
    readonly status: number | null = null,
  ) {
    super(lmsCode);
    this.name = "LmsError";
  }
  /** 401/403: the token or the app's LMS Connect access was refused. Never an
   * empty result, never retried as if it were transient. */
  get capability() {
    return (
      this.lmsCode === "lms_unauthorized" || this.lmsCode === "lms_forbidden"
    );
  }
}

/** Maps an HTTP failure and Clever's `{message}` to one safe code. */
export function lmsErrorCode(status: number, message: string): LmsErrorCode {
  const text = message.toLowerCase();
  if (status === 401) return "lms_unauthorized";
  if (status === 403) return "lms_forbidden";
  if (status === 405) return "lms_method_not_allowed";
  if (status === 429) return "lms_rate_limited";
  // An assignment Clever no longer has, as the live sandbox answers it
  // (2026-11-25): Google Classroom 404 "Could not find assignment … in Google
  // Classroom"; Schoology 500 "… Assignment mapping not found …", which is
  // not an outage and must not be retried as one.
  if (
    text.includes("could not find assignment") ||
    text.includes("assignment mapping not found")
  )
    return "lms_assignment_missing";
  if (text.includes("unsupported_operation") || text.includes("unpublished"))
    return "lms_assignment_unpublished";
  if (text.includes("field_ignored")) return "lms_field_ignored";
  if (text.includes("does not support submission type"))
    return "lms_attachment_unsupported";
  if (text.includes("error updating submission"))
    return "lms_submission_update_failed";
  if (status === 404) {
    if (text.includes("assignment does not exist"))
      return "lms_assignment_missing";
    if (text.includes("user not found")) return "lms_user_not_found";
    return "lms_not_found";
  }
  if (status >= 500) return "lms_unavailable";
  if (
    text.includes("must be in the future") ||
    text.includes("day out of range")
  )
    return "lms_due_date_past";
  if (text.includes("invalid_id")) return "lms_invalid_id";
  if (text.includes("no valid users")) return "lms_no_valid_users";
  if (text.includes("person with id") && text.includes("not found"))
    return "lms_grader_not_found";
  if (
    text.includes("missing_required_field") ||
    text.includes("missing required field") ||
    text.includes("request body is required")
  )
    return "lms_missing_field";
  return "lms_bad_request";
}
