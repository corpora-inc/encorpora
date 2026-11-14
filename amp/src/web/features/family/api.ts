import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  familyChildProgressSchema,
  familyPlacesSchema,
  familyProjectionSchema,
  familyTeachingSchema,
  type FamilyChildProgress,
  type FamilyPlaces,
  type FamilyProjection,
  type FamilyTeaching,
} from "../../../family/projection-contracts";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { invalidateAccount } from "../../lib/query";

/*
 * A family's reads (docs/architecture/family-api.md): the places this account
 * belongs to as a parent, one family's projection (its own children and
 * nothing else), one child's progress, and a mixed class's teaching side.
 * Every key sits under the account, so a sign-out, an account change or any
 * mutation that invalidates the account refreshes all of them at once, and an
 * answer for another account is never read.
 */

export type { FamilyChildProgress, FamilyPlaces, FamilyProjection };
export type FamilyChild = FamilyProjection["children"][number];
export type FamilyPlace = FamilyPlaces["families"][number];

const key = (session: AuthSession, ...rest: unknown[]) =>
  ["account", session.accountId, "families", ...rest] as const;

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
