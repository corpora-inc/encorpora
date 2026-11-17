import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { classResource, studentResource } from "../../../schools/contracts";
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
import { call, keyFor } from "./core-api";
import {
  applyResultSchema,
  planResultSchema,
} from "../../../schools/setup-contracts";

export const setupOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "setup"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/setup`, setupStateSchema, session, { signal }),
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
    body: { version: string; signerName: string },
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

// The shell's part, from its own small module (core-api.ts).
export {
  call,
  classesOptions,
  currentSession,
  keyFor,
  orgOptions,
  orgsOptions,
  preload,
  refreshSchool,
} from "./core-api";
