import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  familyChildTimeSchema,
  familyChildProgressSchema,
  familyDashboardSchema,
  familyPlacesSchema,
  familyProjectionSchema,
  familyTeachingSchema,
  type FamilyChildProgress,
  type FamilyDashboard,
  type FamilyPlaces,
  type FamilyProjection,
  type FamilyTeaching,
} from "../../../family/projection-contracts";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { qk } from "../../lib/keys";
import { invalidateAccount, queryClient } from "../../lib/query";

/*
 * A family's reads (docs/architecture/family-api.md): the places this account
 * belongs to as a parent, one family's projection (its own children and
 * nothing else), one child's progress, and a mixed class's teaching side.
 * Every key sits under the account, so a sign-out, an account change or any
 * mutation that invalidates the account refreshes all of them at once, and an
 * answer for another account is never read.
 */

export type {
  FamilyChildProgress,
  FamilyDashboard,
  FamilyPlaces,
  FamilyProjection,
};
export type FamilyChild = FamilyProjection["children"][number];
export type DashboardChild = FamilyDashboard["children"][number];
export type DashboardArea = DashboardChild["areas"][number];
export type { FocusKey } from "../../../family/projection-contracts";
export type FamilyPlace = FamilyPlaces["families"][number];

const key = (session: AuthSession, ...rest: unknown[]) =>
  qk.account(session.accountId, "families", ...rest);

/** A student's session never reads a parent's family. */
const adult = (session: AuthSession | null | undefined) =>
  !!session?.accountId && !session.accountId.startsWith("school:");

/** Every family this account belongs to as a parent or co-teacher, first
 * page (50 at most: more than anyone has). */
export const familyPlacesOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: key(session, "places"),
    enabled: adult(session),
    queryFn: ({ signal }) =>
      request("/families", familyPlacesSchema, {
        token: session.token,
        signal,
      }),
  });

/** One family: its own children, their week, what's next and what this
 * reader may do with each. */
export const familyOptions = (session: AuthSession, family: string) =>
  queryOptions({
    queryKey: key(session, family),
    enabled: adult(session) && !!family,
    queryFn: ({ signal }) =>
      request(
        `/families/${encodeURIComponent(family)}`,
        familyProjectionSchema,
        { token: session.token, signal },
      ),
  });

/** One family's dashboard: per own child, the week (days, minutes,
 * problems, right answers), each day of it, the five areas with what was
 * checked below each, and why AMP picked the recent problems; the children's
 * code when this reader may manage devices. A child's actions and access
 * stay on `familyOptions` (same learner IDs, same order). */
export const familyDashboardOptions = (session: AuthSession, family: string) =>
  queryOptions({
    queryKey: key(session, family, "dashboard"),
    enabled: adult(session) && !!family,
    queryFn: ({ signal }) =>
      request(
        `/families/${encodeURIComponent(family)}/dashboard`,
        familyDashboardSchema,
        { token: session.token, signal },
      ),
  });

/** One child's record: levels, the weeks, skills earned and recent work. */
export const childProgressOptions = (
  session: AuthSession,
  family: string,
  learner: string,
) =>
  queryOptions({
    queryKey: key(session, family, "children", learner, "progress"),
    enabled: adult(session) && !!family && !!learner,
    queryFn: ({ signal }) =>
      request(
        `/families/${encodeURIComponent(family)}/children/${encodeURIComponent(learner)}/progress`,
        familyChildProgressSchema,
        { token: session.token, signal },
      ),
  });

/** A tutoring group's side of a family class: the whole class, its approvals
 * and co-teachers. */
export const familyTeachingOptions = (session: AuthSession, family: string) =>
  queryOptions({
    queryKey: key(session, family, "teaching"),
    enabled: adult(session) && !!family,
    queryFn: ({ signal }): Promise<FamilyTeaching> =>
      request(
        `/families/${encodeURIComponent(family)}/teaching`,
        familyTeachingSchema,
        { token: session.token, signal },
      ),
  });

const profileSchema = z.object({
  givenName: z.string().nullable(),
  familyName: z.string().nullable(),
  displayName: z.string().nullable(),
});
/** The adult's own name, shown wherever another person sees them. */
export const saveProfile = (
  session: AuthSession,
  name: { givenName: string | null; familyName: string | null },
) =>
  request("/me/profile", profileSchema, {
    token: session.token,
    method: "PATCH",
    body: name,
  }).finally(() => invalidateAccount(session.accountId));

/** Whether an address segment is a family's id (a UUID), not one of the
 * account's older `/family/<section>` addresses. */
export const isFamilyId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** A child's own page, when the learner is a child of a family this
 * account holds: where a paid "Continue with AMP" lands when nothing on
 * this device remembers where it began. Null otherwise (their own practice,
 * or nobody's here). */
export async function childPagePath(
  session: AuthSession,
  learnerId: string,
): Promise<string | null> {
  const places = await queryClient
    .fetchQuery(familyPlacesOptions(session))
    .catch((error: unknown) => {
      console.warn("The account's families didn't load", error);
      return null;
    });
  for (const place of places?.families ?? []) {
    if (place.role !== "holder") continue;
    const family = await queryClient
      .fetchQuery(familyOptions(session, place.familyId))
      .catch((error: unknown) => {
        console.warn("A family didn't load", error);
        return null;
      });
    if (family?.children.some((child) => child.id === learnerId))
      return `/family/${place.familyId}/kids/${learnerId}`;
  }
  return null;
}

const timePeriod = (period: "week" | "month" | "term") =>
  period === "month" ? "weeks" : period;

/** One child's daily time over a period, from a given first day: the same
 * aggregation and calendar as the family class's Time, so the two sum. */
export const childTimeOptions = (
  session: AuthSession,
  family: string,
  learner: string,
  period: "week" | "month" | "term",
  from: string,
) =>
  ({
    queryKey: key(session, family, "children", learner, "time", period, from),
    enabled: adult(session) && !!from,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      request(
        `/families/${encodeURIComponent(family)}/children/${encodeURIComponent(learner)}/time?period=${timePeriod(period)}&from=${from}`,
        familyChildTimeSchema,
        { token: session.token, signal },
      ),
  }) as const;

/** The address of one child's time export, for the same period and day. */
export const childTimeCsvPath = (
  family: string,
  learner: string,
  period: "week" | "month" | "term",
  from: string,
) =>
  `/families/${encodeURIComponent(family)}/children/${encodeURIComponent(learner)}/time.csv?period=${timePeriod(period)}&from=${from}`;
