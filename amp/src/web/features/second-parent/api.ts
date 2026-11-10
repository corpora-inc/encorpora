import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { SignedInMe } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { AppError } from "../../lib/AppError";
import { invalidateAccount } from "../../lib/query";

/* A family's second parent (docs/families.md). The account holder's side is
   one resource under the account's key, so every change refreshes it with
   `/me`; the second parent's side is `me.secondParentOf`. */

const secondParentSchema = z.object({
  personId: z.string(),
  status: z.enum(["invited", "active"]),
  emailHint: z.string(),
  name: z.string().nullable(),
  inviteUrl: z.string().nullable(),
});
export type SecondParent = z.infer<typeof secondParentSchema>;

export const secondParentOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: ["account", session.accountId, "second-parent"],
    queryFn: ({ signal }) =>
      request(
        "/family/second-parent",
        z.object({ secondParent: secondParentSchema.nullable() }),
        { token: session.token, signal },
      ).then((data) => data.secondParent),
  });

const sent = z.object({ mailed: z.boolean() });
export const secondParent = {
  invite: (session: AuthSession, email: string) =>
    request("/family/second-parent", sent, {
      token: session.token,
      body: { email },
    }).finally(() => invalidateAccount(session.accountId)),
  resend: (session: AuthSession) =>
    request("/family/second-parent/resend", sent, {
      token: session.token,
      body: {},
    }).finally(() => invalidateAccount(session.accountId)),
  remove: (session: AuthSession) =>
    request("/family/second-parent/remove", z.unknown(), {
      token: session.token,
      body: {},
    }).finally(() => invalidateAccount(session.accountId)),
};

const failures: Record<string, string> = {
  second_parent_exists:
    "This family already has a second parent. Remove them first to invite someone else.",
  second_parent_is_you:
    "That’s your own address. Enter the other parent’s email.",
  second_parent_active: "They’ve already joined.",
  second_parent_not_found: "That invitation isn’t here now. Refresh the page.",
  family_holder_only: "The family’s account holder manages this.",
  too_many_requests: "That’s enough for now. Try again in an hour.",
};
/** What a failed action means, and what to do about it. */
export const secondParentFailure = (failure: unknown, fallback: string) =>
  (failure instanceof AppError && failure.code && failures[failure.code]) ||
  fallback;

type Child = SignedInMe["learners"][number];
/** Every child of the families this account is the second parent of. */
export function secondParentChildren(
  me: SignedInMe | null | undefined,
): Child[] {
  return (me?.secondParentOf ?? []).flatMap((family) => family.learners);
}
/** The child chosen, when it's one of a family this account is the second
 * parent of: its progress is read-only here. */
export function secondParentChild(
  me: SignedInMe | null | undefined,
  learnerId: string | null | undefined,
): (Child & { classPath: string; className: string }) | null {
  for (const family of me?.secondParentOf ?? []) {
    const child = family.learners.find((learner) => learner.id === learnerId);
    if (child)
      return {
        ...child,
        classPath: `school/${family.orgId}/classes/${family.classId}/today`,
        className: family.className,
      };
  }
  return null;
}
/** A second parent with no family of her own: the family's account holder
 * buys, consents and names. */
export function secondParentOnly(me: SignedInMe | null | undefined) {
  return (
    !!me?.secondParentOf?.length && !me.familyClass && me.learners.length === 0
  );
}
