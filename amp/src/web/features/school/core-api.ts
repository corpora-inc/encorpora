import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  classResource,
  orgResource,
  schoolActions,
} from "../../../schools/contracts";
import { pilotStateSchema } from "../../../schools/pilot-contracts";
import type { AuthSession } from "../../auth";
import { AppError, keepRefusal } from "../../lib/AppError";
import { request } from "../../lib/api";
import { qk } from "../../lib/keys";
import {
  invalidateAccount,
  queryClient,
  sessionOptions,
} from "../../lib/query";
import { logAhead } from "../../lib/ahead";

/* The little of the school's API the app shell reads on every screen (the
   spaces resolver, the route table): an account's schools, one school, its
   classes, the request wrapper and the keys. Everything else is in api.ts,
   which only school screens load (the entry's budget,
   scripts/check-bundle-budget.ts). */

/** What a failed school action means, and what to do about it. */
const messages: Record<string, string> = {
  not_found:
    "This isn’t available to your account. Check the link, or open your schools.",
  agreement_changed:
    "The agreement was just updated. Read the new version, then accept it.",
  agreement_required: "Accept the data agreement first, then continue.",
  confirm_email: "Confirm your email address, then set up your class.",
  pilot_teacher_required: "Only this class’s teacher can start practice.",
  practice_closed:
    "Practice isn’t running for this class, so its code and cards wait. Start practice, or request seats.",
  students_required: "Add students to this class first.",
  school_selection_required: "Choose the school for this class.",
  purchase_scope_conflict: "This class is already on another buyer link.",
  real_school_required: "Not available in a demo.",
  class_import_students_only: "A class import adds students only.",
  duplicate_roster_identity: "Two rows have the same Student ID.",
  setting_locked:
    "Your district set this and locked it, so it can’t be changed here.",
  last_admin:
    "A school needs at least one admin. Invite another admin first, then end this access.",
  invite_used:
    "This invitation has already been used. Ask your school’s admin for a new link.",
  invite_expired:
    "This invitation has expired. Ask your school’s admin to send it again.",
  invite_not_found:
    "This invitation link isn’t valid. Open the link from your email again, or ask your school’s admin for a new one.",
  invite_already_accepted: "This person has already accepted.",
  invite_wrong_account:
    "This invitation is for another email address. Use another account to sign in with it.",
  invite_email_unconfirmed:
    "Confirm your email address first, then open this invitation again.",
  class_staff_must_teach: "Only teachers and aides can be given classes.",
  mail_unavailable:
    "The request couldn’t be sent. Email support@corpora.inc and we’ll add the seats.",
  import_needs_school: "Open one of your schools to import its roster.",
  invalid_school_request: "Check the details and try again.",
  school_service_unavailable: "That didn’t save. Try again in a moment.",
  too_many_requests: "Too many requests just now. Wait a minute and try again.",
  year_overlaps:
    "Those dates overlap a year already on the calendar. Choose dates after it.",
  student_not_found:
    "That student is no longer here. Refresh the list and try again.",
  school_not_found: "That school isn’t available to your account.",
  confirm_mismatch: "Type the school’s name exactly as it’s shown.",
};
function explained(error: unknown): unknown {
  if (error instanceof AppError && error.code && messages[error.code])
    return new AppError(
      error.kind,
      messages[error.code]!,
      error.retry,
      error.requestId,
      error.code,
      error.status,
      error.validationPaths,
      error.body,
    );
  return error;
}
export const call = <T>(
  path: string,
  schema: z.ZodType<T>,
  session: AuthSession | null,
  options: { body?: unknown; signal?: AbortSignal } = {},
) =>
  request(`/school${path}`, schema, {
    token: session?.token,
    ...options,
  }).catch((error) => {
    throw explained(error);
  });

export const keyFor = (session: AuthSession, ...rest: unknown[]) =>
  qk.account(session.accountId, "school", ...rest);

export const orgsOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: keyFor(session, "orgs"),
    queryFn: ({ signal }) =>
      call("/orgs", z.object({ orgs: z.array(orgResource) }), session, {
        signal,
      }).then((data) => data.orgs),
  });
export const orgOptions = (session: AuthSession, orgId: string) => {
  const queryKey = keyFor(session, "org", orgId);
  return queryOptions({
    queryKey,
    // A refusal stands until a successful read (CP-3 r8).
    queryFn: ({ signal }) =>
      keepRefusal(queryKey, () =>
        call(`/orgs/${orgId}`, z.object({ org: orgResource }), session, {
          signal,
        }),
      ).then((data) => data.org),
  });
};
export const classesOptions = (
  session: AuthSession,
  orgId: string,
  year?: string,
) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "classes", year ?? "in-use"),
    queryFn: ({ signal }) =>
      call(
        `/orgs/${orgId}/classes?limit=500${year ? `&year=${year}` : ""}`,
        z.object({ classes: z.array(classResource) }),
        session,
        { signal },
      ).then((data) => data.classes),
  });
/** A change: everything this account sees of its schools refreshes, so no
 * screen shows the old answer after it. */
export const refreshSchool = (session: AuthSession) =>
  invalidateAccount(session.accountId);

/** The session a staff route already made sure of. */
export const currentSession = () =>
  queryClient.getQueryData(sessionOptions.queryKey) as AuthSession;

/** Loads what a screen needs before it paints, so it never builds up in front
 * of the person. A failure is left for the screen, which says so in place. */
export const preload = (options: { queryKey: readonly unknown[] }) =>
  queryClient
    .ensureQueryData(options as never)
    // In the entry bundle: it logs itself, never through lib/report-error
    // (a chunk of its own; docs/architecture/frontend-patterns.md).
    .catch((error) => {
      logAhead("School data didn’t load ahead", error);
      return undefined;
    });

/** A class's year and what binds it to a place (its org, the orgs above
 * it, its name, this person's actions there). The binding is optional: an
 * older server answers the year alone. */
export const classYearResource = z.object({
  past: z.boolean(),
  orgId: z.uuid().optional(),
  path: z.array(z.uuid()).optional(),
  name: z.string().nullable().optional(),
  can: z.array(z.enum(schoolActions)).optional(),
  /** Whether the class's students can practice, for anyone who reads the
   * class (SPEC R14): its sign-in tools follow this, whatever the role. */
  practice: z.enum(["open", "waiting", "ended"]).optional(),
  /** When anything deciding practice can next change (null: nothing
   * dated ahead): ask again then. */
  recheckAt: z.string().nullable().optional(),
  /** Why practice ended, when it has (CP-3 r7): the school year, the
   * roster, or the coverage. Older servers don't say. */
  practiceEnd: z.enum(["session", "roster", "coverage"]).nullable().optional(),
  /** What a waiting class waits for: its students, or its teacher's Start
   * (no pilot, no license). Older servers don't say. */
  practiceWait: z.enum(["students", "start"]).nullable().optional(),
  /** The server's clock at this answer: the device's is never trusted. */
  serverNow: z.string().optional(),
  /** When this answer was asked for, on this page's monotonic clock. */
  receivedAt: z.number().optional(),
});
export type ClassYear = z.infer<typeof classYearResource>;
export const classYearOptions = (session: AuthSession, classId: string) => {
  const queryKey = keyFor(session, "class-year", classId);
  return queryOptions({
    queryKey,
    queryFn: ({ signal }) => {
      // Anchored when asked, not when answered: the server's clock was
      // read after this, so counting from here never postpones a moment
      // by however long the answer took (CP-3 r5).
      const asked = performance.now();
      // A refusal stands until a successful read (CP-3 r8).
      return keepRefusal(queryKey, () =>
        call(`/classes/${classId}/year`, classYearResource, session, {
          signal,
        }),
      ).then((year): ClassYear => ({ ...year, receivedAt: asked }));
    },
  });
};

export const pilotOptions = (session: AuthSession, classId: string) =>
  queryOptions({
    queryKey: keyFor(session, "class", classId, "pilot"),
    queryFn: ({ signal }) =>
      call(`/classes/${classId}/pilot`, pilotStateSchema, session, { signal }),
    // A failed read is asked again by Try again or a change, never by each
    // screen that mounts: a wait that holds a screen would ask forever.
    retryOnMount: false,
  });
