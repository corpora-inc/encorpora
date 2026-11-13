import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  classResource,
  orgResource,
  studentResource,
} from "../../../schools/contracts";
import {
  inviteViewSchema,
  licenseViewSchema,
  sessionResource,
  setupStateSchema,
  staffResource,
  type RosterSource,
} from "../../../schools/setup-contracts";
import type { RosterRow } from "../../../schools/sources/rows";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { request } from "../../lib/api";
import {
  invalidateAccount,
  queryClient,
  sessionOptions,
} from "../../lib/query";
import {
  applyResultSchema,
  planResultSchema,
} from "../../../schools/setup-contracts";

/** What a failed school action means, and what to do about it. */
const messages: Record<string, string> = {
  not_found:
    "This isn’t available to your account. Check the link, or open your schools.",
  agreement_changed:
    "The agreement was just updated. Read the new version, then accept it.",
  agreement_required: "Accept the data agreement first, then continue.",
  confirm_email: "Confirm your email address, then set up your class.",
  pilot_teacher_required: "Only this class’s teacher can start practice.",
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
  ["account", session.accountId, "school", ...rest] as const;

export const orgsOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: keyFor(session, "orgs"),
    queryFn: ({ signal }) =>
      call("/orgs", z.object({ orgs: z.array(orgResource) }), session, {
        signal,
      }).then((data) => data.orgs),
  });
export const orgOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}`, z.object({ org: orgResource }), session, {
        signal,
      }).then((data) => data.org),
  });
export const setupOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "setup"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/setup`, setupStateSchema, session, { signal }),
  });
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
const studentsPage = z.object({
  students: z.array(studentResource),
  total: z.number().int(),
  nextOffset: z.number().int().nullable(),
});
export type StudentStatus = "needs-seat" | "never-signed-in";
export const studentsKey = (
  session: AuthSession,
  orgId: string,
  q: string,
  status?: StudentStatus,
) => keyFor(session, "org", orgId, "students", q, status ?? "all");
export function fetchStudents(
  session: AuthSession,
  orgId: string,
  q: string,
  offset: number,
  signal?: AbortSignal,
  status?: StudentStatus,
) {
  const query = new URLSearchParams({
    limit: "500",
    offset: String(offset),
    ...(q ? { q } : {}),
    ...(status ? { status } : {}),
  });
  return call(`/orgs/${orgId}/students?${query}`, studentsPage, session, {
    signal,
  });
}
export const staffOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "staff"),
    queryFn: ({ signal }) =>
      call(
        `/orgs/${orgId}/staff`,
        z.object({ staff: z.array(staffResource) }),
        session,
        { signal },
      ).then((data) => data.staff),
  });
export const calendarOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "calendar"),
    queryFn: ({ signal }) =>
      call(
        `/orgs/${orgId}/calendar`,
        z.object({ sessions: z.array(sessionResource) }),
        session,
        { signal },
      ).then((data) => data.sessions),
  });
/** The school's grading periods, set once for every class
 * (schools/grading-default.ts): what they are, whether the school chose
 * them, and how many classes use their own. */
const schoolGradingSchema = z.object({
  kind: z.enum(["year", "semester", "trimester", "quarter", "custom"]),
  chosen: z.boolean(),
  classes: z.number().int(),
  own: z.number().int(),
});
export type SchoolGrading = z.infer<typeof schoolGradingSchema>;
export const schoolGradingOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "grading"),
    queryFn: ({ signal }) =>
      call(
        `/orgs/${orgId}/grading`,
        z.object({ grading: schoolGradingSchema }),
        session,
        { signal },
      ).then((data) => data.grading),
  });
export const licenseOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "license"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/license`, licenseViewSchema, session, { signal }),
  });
const signInHelp = z.object({
  origin: z.string(),
  google: z.string().nullable(),
  microsoft: z
    .object({ clientId: z.string(), adminConsentUrl: z.string() })
    .nullable(),
});
export const signInHelpOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "sign-in-help"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/sign-in-help`, signInHelp, session, { signal }),
  });

/** A change: everything this account sees of its schools refreshes, so no
 * screen shows the old answer after it. */
export const refreshSchool = (session: AuthSession) =>
  invalidateAccount(session.accountId);

const ok = z.unknown();
export const school = {
  updateSchool: (
    session: AuthSession,
    orgId: string,
    body: { name: string; shape: "class" | "school"; timezone: string },
  ) => call(`/orgs/${orgId}/setup/school`, setupStateSchema, session, { body }),
  setSchoolGrading: (
    session: AuthSession,
    orgId: string,
    kind: "year" | "semester" | "trimester" | "quarter",
  ) =>
    call(
      `/orgs/${orgId}/grading`,
      z.object({ grading: schoolGradingSchema }),
      session,
      { body: { kind } },
    ),
  setCalendar: (
    session: AuthSession,
    orgId: string,
    body: {
      startsOn: string;
      endsOn: string;
      division: "semester" | "trimester" | "quarter" | null;
    },
  ) => call(`/orgs/${orgId}/calendar`, ok, session, { body }),
  defaultCalendar: (session: AuthSession, orgId: string) =>
    call(`/orgs/${orgId}/setup/default-calendar`, setupStateSchema, session, {
      body: {},
    }),
  setExperience: (session: AuthSession, orgId: string, preset: string) =>
    call(`/orgs/${orgId}/setup/experience`, setupStateSchema, session, {
      body: { preset },
    }),
  acceptAgreement: (
    session: AuthSession,
    orgId: string,
    body: { version: string; signerName: string; signerTitle: string },
  ) =>
    call(`/orgs/${orgId}/setup/agreement`, setupStateSchema, session, { body }),
  finish: (
    session: AuthSession,
    orgId: string,
    body: { className?: string; names?: string[]; gradeLevel?: number },
  ) =>
    call(
      `/orgs/${orgId}/setup/finish`,
      z.object({ classId: z.uuid().nullable(), solo: z.boolean() }),
      session,
      { body },
    ),
  addDivision: (session: AuthSession, orgId: string, kind: string) =>
    call(`/orgs/${orgId}/calendar/divisions`, ok, session, { body: { kind } }),
  updateSession: (
    session: AuthSession,
    orgId: string,
    sessionId: string,
    body: { startsOn: string; endsOn: string },
  ) =>
    call(`/orgs/${orgId}/calendar/sessions/${sessionId}`, ok, session, {
      body,
    }),
  addClass: (
    session: AuthSession,
    orgId: string,
    body: { name: string; gradingKind?: string; courseBands?: string[] },
  ) =>
    call(
      `/orgs/${orgId}/classes`,
      z.object({ class: classResource }),
      session,
      { body },
    ).then((data) => data.class),
  updateClass: (
    session: AuthSession,
    orgId: string,
    classId: string,
    body: { name?: string; gradingKind?: string; courseBands?: string[] },
  ) => call(`/orgs/${orgId}/classes/${classId}`, ok, session, { body }),
  addStudent: (
    session: AuthSession,
    orgId: string,
    body: {
      givenName: string;
      familyName?: string;
      gradeLevel?: number;
      classId?: string;
    },
  ) =>
    call(
      `/orgs/${orgId}/students`,
      z.object({
        student: z.object({ personId: z.uuid(), seated: z.boolean() }),
      }),
      session,
      { body },
    ).then((data) => data.student),
  updateStudent: (
    session: AuthSession,
    orgId: string,
    studentId: string,
    body: { displayName?: string | null; gradeLevel?: number | null },
  ) => call(`/orgs/${orgId}/students/${studentId}`, ok, session, { body }),
  setStudentClasses: (
    session: AuthSession,
    orgId: string,
    studentId: string,
    classIds: string[],
  ) =>
    call(`/orgs/${orgId}/students/${studentId}/classes`, ok, session, {
      body: { classIds },
    }),
  removeStudent: (session: AuthSession, orgId: string, studentId: string) =>
    call(`/orgs/${orgId}/students/${studentId}/remove`, ok, session, {
      body: { confirm: "remove" },
    }),
  invite: (
    session: AuthSession,
    orgId: string,
    body: { email: string; role: string; classIds?: string[] },
  ) =>
    call(
      `/orgs/${orgId}/staff/invites`,
      z.object({
        personId: z.uuid(),
        linked: z.boolean(),
        mailed: z.boolean(),
      }),
      session,
      { body },
    ),
  resendInvite: (session: AuthSession, orgId: string, personId: string) =>
    call(
      `/orgs/${orgId}/staff/${personId}/invite`,
      z.object({ mailed: z.boolean() }),
      session,
      { body: {} },
    ),
  setStaffClasses: (
    session: AuthSession,
    orgId: string,
    personId: string,
    classIds: string[],
  ) =>
    call(`/orgs/${orgId}/staff/${personId}/classes`, ok, session, {
      body: { classIds },
    }),
  endStaff: (session: AuthSession, orgId: string, personId: string) =>
    call(`/orgs/${orgId}/staff/${personId}/end`, ok, session, { body: {} }),
  lookupInvite: (token: string) =>
    call("/invites/lookup", z.object({ invite: inviteViewSchema }), null, {
      body: { token },
    }).then((data) => data.invite),
  acceptInvite: (
    session: AuthSession,
    body: { token: string; proof?: string; name?: string },
  ) =>
    call(
      "/invites/accept",
      z.object({
        accepted: z.literal(true),
        orgId: z.uuid().nullable(),
        /** The school's admin, still to set it up. */
        setup: z.boolean(),
        /** A family's second parent: its class. */
        familyClassId: z.uuid().optional(),
      }),
      session,
      { body },
    ),
  requestSeats: (
    session: AuthSession,
    orgId: string,
    body: { seats: number; note?: string },
  ) => call(`/orgs/${orgId}/license/request`, ok, session, { body }),
  plan: (
    session: AuthSession,
    orgId: string,
    source: RosterSource,
    rows: RosterRow[],
    classId?: string,
  ) =>
    call(
      classId
        ? `/classes/${classId}/roster/plan`
        : `/orgs/${orgId}/roster/plan`,
      z.object({ results: z.array(planResultSchema) }),
      session,
      { body: { source, rows } },
    ).then((data) => data.results),
  apply: (
    session: AuthSession,
    orgId: string,
    source: RosterSource,
    rows: RosterRow[],
    resolutions: Record<string, "same" | "new">,
    classId?: string,
  ) =>
    call(
      classId
        ? `/classes/${classId}/roster/apply`
        : `/orgs/${orgId}/roster/apply`,
      z.object({
        results: z.array(applyResultSchema),
        invited: z.number().int(),
      }),
      session,
      { body: { source, rows, resolutions } },
    ),
};

/** The session a staff route already made sure of. */
export const currentSession = () =>
  queryClient.getQueryData(sessionOptions.queryKey) as AuthSession;

/** Loads what a screen needs before it paints, so it never builds up in front
 * of the person. A failure is left for the screen, which says so in place. */
export const preload = (options: { queryKey: readonly unknown[] }) =>
  queryClient.ensureQueryData(options as never).catch(() => undefined);
