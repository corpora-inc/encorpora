import {
  LmsError,
  type AssignmentState,
  type LmsType,
  type SubmissionState,
} from "./lms-model.js";

/**
 * What AMP sends to each LMS through Clever, and in what order. Pure, so each
 * documented provider difference is a unit test
 * (https://dev.clever.com/docs/lms-connect-output-behavior,
 * https://dev.clever.com/docs/api-reference):
 *
 * - Canvas ignores assignment `state` and `term_id`, needs `submission_types`
 *   (or its submit view is blank) and a positive `max_attempts` (it defaults
 *   to -1). It cannot set submission `state`, but SpeedGrader needs it sent.
 *   Submissions on a draft (unpublished) assignment are refused.
 * - Google Classroom ignores `submission_types`, `max_attempts` and `term_id`,
 *   takes link attachments on create only, and moves a submission out of
 *   `created` only when a `state` is sent. `returned` and `reclaimed` are
 *   reachable only from `submitted`; nothing returns to `created`. Submissions
 *   can be listed and written only while the assignment is `open`.
 * - Schoology requires the Clever `term_id`, writes only `text` attachments
 *   (no `url`), treats an update's `attachments` as the full set (omitting it
 *   deletes them), ignores `max_attempts`, and sets submission state itself:
 *   a grade makes it `returned`; `reclaimed` does not exist there.
 */
export type AssignmentBody = {
  title: string;
  description: string;
  due_date: string;
  points_possible: number;
  grading_type: "points";
  assignee_mode: "all";
  submission_types?: "link"[];
  max_attempts?: number;
  term_id?: string;
  attachments?: (
    | { type: "link"; url: string; title: string }
    | { type: "text"; text: string; title: string }
  )[];
};
export type SubmissionBody = {
  state?: SubmissionState;
  grade_points?: number;
};

/** An AMP assignment as an LMS gradebook column. */
export type AssignmentDraft = {
  title: string;
  description: string;
  dueAt: Date;
  pointsPossible: number;
  /** Where a student opens AMP. HTTPS only. */
  link: string;
  /** The section's Clever term, required by Schoology. */
  termId: string | null;
};
const LINK_TITLE = "Open AMP";

/** Clever refuses a due date in the past on create and on update. A create
 * needs one; an update after the due date leaves the LMS's date alone. */
function base(draft: AssignmentDraft, now: Date, update = false) {
  const future = draft.dueAt.getTime() > now.getTime();
  if (!future && !update) throw new LmsError("lms_due_date_past");
  const link = new URL(draft.link);
  if (link.protocol !== "https:" && link.hostname !== "127.0.0.1")
    throw new LmsError("lms_bad_request");
  return {
    title: draft.title,
    description: draft.description,
    ...(future ? { due_date: draft.dueAt.toISOString() } : {}),
    points_possible: draft.pointsPossible,
  };
}
function attachments(
  lms: LmsType,
  draft: AssignmentDraft,
): NonNullable<AssignmentBody["attachments"]> {
  return lms === "schoology"
    ? [{ type: "text", text: draft.link, title: LINK_TITLE }]
    : [{ type: "link", url: draft.link, title: LINK_TITLE }];
}
function schoologyTerm(draft: AssignmentDraft) {
  if (!draft.termId) throw new LmsError("lms_term_required");
  return draft.termId;
}

export function assignmentCreateBody(
  lms: LmsType,
  draft: AssignmentDraft,
  now: Date,
): AssignmentBody {
  const body: AssignmentBody = {
    ...(base(draft, now) as ReturnType<typeof base> & { due_date: string }),
    grading_type: "points",
    assignee_mode: "all",
    attachments: attachments(lms, draft),
  };
  if (lms === "canvas") {
    body.submission_types = ["link"];
    body.max_attempts = 1;
  }
  if (lms === "schoology") body.term_id = schoologyTerm(draft);
  return body;
}

/** The fields AMP owns, sent whole on every update so a retry converges. */
export function assignmentUpdateBody(
  lms: LmsType,
  draft: AssignmentDraft,
  now: Date,
): Partial<AssignmentBody> {
  const body: Partial<AssignmentBody> = base(draft, now, true);
  if (lms === "schoology") {
    body.term_id = schoologyTerm(draft);
    // Omitting attachments on a Schoology update deletes them.
    body.attachments = attachments(lms, draft);
  }
  return body;
}

/** Whether an assignment in this LMS state takes submission reads/writes. */
export function submissionsOpen(
  lms: LmsType,
  state: AssignmentState | null | undefined,
): boolean {
  if (lms === "google_classroom") return state === "open";
  if (lms === "canvas") return state !== "draft";
  return true;
}

/** What AMP's evidence says for one student: a score, or no work yet, and
 * whether the window has closed (the grade is final and handed back). */
export type DesiredGrade = { points: number | null; final: boolean };
/** What the LMS last reported. `null`: the student has no submission there
 * (not enrolled, not matched, or never listed). */
export type ObservedSubmission = {
  state: SubmissionState | null;
  points: number | null;
} | null;
export type SubmissionPlan =
  | { kind: "none" }
  | { kind: "write"; bodies: SubmissionBody[] }
  /** The LMS can't express this change; nothing is sent. */
  | { kind: "unsupported"; code: "lms_reclaim_unsupported" };

const samePoints = (a: number | null, b: number | null) =>
  a !== null && b !== null && Math.abs(a - b) < 0.005;

/**
 * The fewest writes that bring one submission to AMP's grade.
 *
 * - No work: nothing is sent, ever, before or after the due date. AMP does not
 *   write a zero for missing practice; the teacher decides that in the LMS.
 * - Work before the due date: the grade so far, with the submission turned in
 *   where the LMS allows (`submitted`).
 * - Final: the grade, handed back (`returned`) where the LMS allows.
 * - Work AMP had turned in that no longer counts (a narrower window, a changed
 *   target): Google Classroom reclaims it; elsewhere it is left for the teacher.
 */
export function planSubmission(
  lms: LmsType,
  observed: ObservedSubmission,
  desired: DesiredGrade,
  sent: { points: number | null } | null,
): SubmissionPlan {
  const state = observed?.state ?? null;
  const points = observed?.points ?? null;
  if (desired.points === null) {
    if (sent?.points == null) return { kind: "none" };
    if (lms === "google_classroom" && state === "submitted")
      return { kind: "write", bodies: [{ state: "reclaimed" }] };
    return lms === "google_classroom" && state !== "returned"
      ? { kind: "none" }
      : { kind: "unsupported", code: "lms_reclaim_unsupported" };
  }
  const grade = Math.round(desired.points * 100) / 100;
  const graded = samePoints(points, grade);
  if (lms === "canvas") {
    return graded && state !== "created" && state !== null
      ? { kind: "none" }
      : {
          kind: "write",
          bodies: [{ grade_points: grade, state: "submitted" }],
        };
  }
  if (lms === "schoology") {
    return graded
      ? { kind: "none" }
      : { kind: "write", bodies: [{ grade_points: grade }] };
  }
  // Google Classroom.
  const turnedIn = state === "submitted" || state === "returned";
  if (!desired.final) {
    if (!turnedIn)
      return {
        kind: "write",
        bodies: [{ state: "submitted", grade_points: grade }],
      };
    return graded
      ? { kind: "none" }
      : { kind: "write", bodies: [{ grade_points: grade }] };
  }
  if (state === "returned")
    return graded
      ? { kind: "none" }
      : { kind: "write", bodies: [{ grade_points: grade }] };
  if (state === "submitted")
    return {
      kind: "write",
      bodies: [{ grade_points: grade, state: "returned" }],
    };
  return {
    kind: "write",
    bodies: [
      { state: "submitted", grade_points: grade },
      { state: "returned" },
    ],
  };
}

/** Points for a practice goal: the share of the target minutes practised,
 * capped at the full score. Only measured on-screen minutes count. */
export function practicePoints(
  activeMinutes: number,
  targetMinutes: number,
  pointsPossible: number,
): number | null {
  if (!(activeMinutes > 0) || !(targetMinutes > 0)) return null;
  const share = Math.min(1, activeMinutes / targetMinutes);
  return Math.round(share * pointsPossible * 100) / 100;
}

/** A teacher's final grade as points: numeric finals only (B+ or Pass has no
 * point value an LMS column can take), scaled from 0-100. */
export function finalGradePoints(
  final: string | null,
  pointsPossible: number,
): number | null {
  if (final === null || !/^\d+(\.\d+)?$/.test(final.trim())) return null;
  const value = Number(final.trim());
  if (!(value >= 0 && value <= 100)) return null;
  return Math.round((value / 100) * pointsPossible * 100) / 100;
}
