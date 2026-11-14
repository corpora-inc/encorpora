import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  activityPeopleResponse,
  activityResponse,
  eraseResponse,
  integrationsResponse,
  overviewResponse,
  practiceResponse,
  privacyResponse,
  rolloverOptionsResponse,
  rolloverResponse,
  schoolsResponse,
  transferOptionsResponse,
  transferResponse,
  yearsResponse,
  type ActivityKind,
  type RolloverInput,
} from "../../../../schools/org-contracts";
import { schoolActions } from "../../../../schools/contracts";
import type { AuthSession } from "../../../auth";
import { AppError } from "../../../lib/AppError";
import { call, keyFor } from "../api";

export const overviewOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "overview"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/overview`, overviewResponse, session, { signal }),
  });
/** The heat map and dose-response, beside the overview: its own read, so the
 * overview never waits on the term's weeks. */
export const practiceOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "practice"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/practice`, practiceResponse, session, { signal }),
  });
export const schoolsOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "schools"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/schools`, schoolsResponse, session, { signal }),
  });
export const yearsOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "years"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/years`, yearsResponse, session, { signal }).then(
        (data) => data.years,
      ),
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
  /** The server's clock at this answer: the device's is never trusted. */
  serverNow: z.string().optional(),
  /** When this answer arrived, on this page's monotonic clock. */
  receivedAt: z.number().optional(),
});
export type ClassYear = z.infer<typeof classYearResource>;
export const classYearOptions = (session: AuthSession, classId: string) =>
  queryOptions({
    queryKey: keyFor(session, "class-year", classId),
    queryFn: ({ signal }) =>
      call(`/classes/${classId}/year`, classYearResource, session, {
        signal,
      }).then(
        (year): ClassYear => ({ ...year, receivedAt: performance.now() }),
      ),
  });
export const rolloverOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "year"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/year`, rolloverOptionsResponse, session, { signal }),
  });
export const rolloverPlanOptions = (
  session: AuthSession,
  orgId: string,
  input: RolloverInput,
) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "year", "plan", input),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/year/plan`, rolloverResponse, session, {
        body: input,
        signal,
      }),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
export const applyRollover = (
  session: AuthSession,
  orgId: string,
  input: RolloverInput,
) =>
  call(`/orgs/${orgId}/year/apply`, rolloverResponse, session, { body: input });

export const transferOptionsQuery = (session: AuthSession, student: string) =>
  queryOptions({
    queryKey: keyFor(session, "student", student, "transfer"),
    queryFn: ({ signal }) =>
      call(`/students/${student}/transfer`, transferOptionsResponse, session, {
        signal,
      }),
  });
export const moveStudent = (
  session: AuthSession,
  student: string,
  body: { to: string; classId?: string },
) => call(`/students/${student}/transfer`, transferResponse, session, { body });

export const integrationsOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "integrations"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/integrations`, integrationsResponse, session, {
        signal,
      }),
  });
export const setSignInProvider = (
  session: AuthSession,
  orgId: string,
  body: { provider: "google" | "microsoft"; enabled: boolean },
) =>
  call(`/orgs/${orgId}/integrations/sign-in`, integrationsResponse, session, {
    body,
  });
export const requestIntegration = (
  session: AuthSession,
  orgId: string,
  id: string,
) =>
  call(`/orgs/${orgId}/integrations/request`, integrationsResponse, session, {
    body: { id },
  });

export const privacyOptions = (session: AuthSession, orgId: string) =>
  queryOptions({
    queryKey: keyFor(session, "org", orgId, "privacy"),
    queryFn: ({ signal }) =>
      call(`/orgs/${orgId}/privacy`, privacyResponse, session, { signal }),
  });
export const eraseNextBatch = (
  session: AuthSession,
  orgId: string,
  confirm: string,
) =>
  call(`/orgs/${orgId}/privacy/erase`, eraseResponse, session, {
    body: { confirm },
  });
/** The whole school's data. The server streams it, a batch at a time. */
export async function downloadSchoolExport(
  session: AuthSession,
  orgId: string,
): Promise<string> {
  const response = await fetch(
    `/api/v1/school/orgs/${orgId}/privacy/export.zip`,
    {
      headers: { Authorization: `Bearer ${session.token}` },
    },
  );
  if (!response.ok)
    throw new AppError(
      "unavailable",
      "The export didn’t download. Check your connection and try again.",
      true,
      response.headers.get("x-request-id"),
      null,
      response.status,
    );
  const name =
    /filename="([^"]+)"/.exec(
      response.headers.get("content-disposition") ?? "",
    )?.[1] ?? "student-data.zip";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

export type ActivityFilters = {
  person?: string;
  kind?: ActivityKind;
  from?: string;
  to?: string;
};
export const fetchActivity = (
  session: AuthSession,
  orgId: string,
  filters: ActivityFilters,
  before: string | undefined,
  signal?: AbortSignal,
) => {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries({ ...filters, before }))
    if (value) query.set(name, value);
  const suffix = query.size ? `?${query}` : "";
  return call(`/orgs/${orgId}/activity${suffix}`, activityResponse, session, {
    signal,
  });
};
export const activityKey = (
  session: AuthSession,
  orgId: string,
  filters: ActivityFilters,
) => keyFor(session, "org", orgId, "activity", filters);
export const searchActivityPeople = (
  session: AuthSession,
  orgId: string,
  q: string,
) =>
  call(`/orgs/${orgId}/activity/people`, activityPeopleResponse, session, {
    body: { q },
  }).then((data) => data.people);
