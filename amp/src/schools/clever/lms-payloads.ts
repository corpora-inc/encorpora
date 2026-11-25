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
 * - Schoology requires the Clever `term_id`, treats an update's `attachments`
 *   as the full set (omitting it deletes them), refuses the `link` submission
 *   type, and sets submission state itself: a grade makes it `returned`;
 *   `reclaimed` does not exist there. Clever's reference says Schoology
 *   attachments are `text` only, but the live sandbox (2026-11-25) keeps a
 *   `link` attachment on create and update, while a `text` one is folded
 *   into the description as "Attachments:<url>". AMP sends the link.
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
  attachments?: { type: "link"; url: string; title: string }[];
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
  if (!(
    link.protocol === "https:" ||
    (link.protocol === "http:" && link.hostname === "127.0.0.1")
  ))
    throw new LmsError("lms_bad_request");
  return {
    title: draft.title,
    description: draft.description,
    ...(future ? { due_date: draft.dueAt.toISOString() } : {}),
    points_possible: draft.pointsPossible,
  };
}
function attachments(
  draft: AssignmentDraft,
): NonNullable<AssignmentBody["attachments"]> {
  return [{ type: "link", url: draft.link, title: LINK_TITLE }];
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
    attachments: attachments(draft),
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
    body.attachments = attachments(draft);
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
/** What the LMS last reported. `null`: it lists no submission for the
 * student (not in its copy of the section, or not matched), so there is
 * nothing to write to. */
export type ObservedSubmission = {
  state: SubmissionState | null;
  points: number | null;
} | null;
/** What AMP last wrote: the points, and whether AMP itself turned the work in
 * (only then may AMP take it back). */
export type SentSubmission = {
  points: number | null;
  turnedIn: boolean;
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
 * - Work AMP turned in that no longer counts (a narrower window, a changed
 *   target): Google Classroom reclaims it; elsewhere it is left for the
 *   teacher. A student's own turn-in is never reclaimed.
 * - Converges on points: an LMS that keeps its own state (Canvas without an
 *   attachment) is not written again once the grade matches.
 */
export function planSubmission(
  lms: LmsType,
  observed: ObservedSubmission,
  desired: DesiredGrade,
  sent: SentSubmission,
): SubmissionPlan {
  if (observed === null) return { kind: "none" };
  const { state, points } = observed;
  if (desired.points === null) {
    if (sent?.points == null) return { kind: "none" };
    if (lms !== "google_classroom")
      return { kind: "unsupported", code: "lms_reclaim_unsupported" };
    if (state === "submitted" && sent.turnedIn)
      return { kind: "write", bodies: [{ state: "reclaimed" }] };
    return state === "returned"
      ? { kind: "unsupported", code: "lms_reclaim_unsupported" }
      : { kind: "none" };
  }
  const grade = Math.round(desired.points * 100) / 100;
  if (samePoints(points, grade)) {
    // Classroom alone has a hand-back AMP must still make.
    if (lms !== "google_classroom" || !desired.final || state === "returned")
      return { kind: "none" };
  }
  if (lms === "canvas")
    // Canvas sets state itself; SpeedGrader needs it sent.
    return {
      kind: "write",
      bodies: [{ grade_points: grade, state: "submitted" }],
    };
  if (lms === "schoology")
    return { kind: "write", bodies: [{ grade_points: grade }] };
  // Google Classroom.
  const graded = samePoints(points, grade);
  if (state === "returned")
    return { kind: "write", bodies: [{ grade_points: grade }] };
  if (state === "submitted")
    return desired.final
      ? {
          kind: "write",
          bodies: [{ grade_points: grade, state: "returned" }],
        }
      : graded
        ? { kind: "none" }
        : { kind: "write", bodies: [{ grade_points: grade }] };
  // created or reclaimed: AMP turns it in.
  return {
    kind: "write",
    bodies: desired.final
      ? [{ state: "submitted", grade_points: grade }, { state: "returned" }]
      : [{ state: "submitted", grade_points: grade }],
  };
}

/** Whether a write left the work turned in by AMP. */
export const turnsIn = (plan: SubmissionPlan) =>
  plan.kind === "write" &&
  plan.bodies.some((body) => body.state === "submitted");

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
