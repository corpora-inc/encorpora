import { dropCapability } from "../../capability-entry";
import { carriedLink, carryLink, dropCarry } from "../../lib/link-carry";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import {
  approvalLookupSchema,
  approvalRowSchema,
  approvalViewSchema,
} from "../../../family/approval-contracts";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { invalidateAccount } from "../../lib/query";

/** Children from other families in this family's class, under the account's
 * key, so every change to the account refreshes them with `/me`. */
export const approvalsOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: ["account", session.accountId, "family-approvals"],
    queryFn: ({ signal }) =>
      request(
        "/family/approvals",
        z.object({ approvals: z.array(approvalRowSchema) }),
        { token: session.token, signal },
      ).then((data) => data.approvals),
  });

/** The approving parent's page about one child. */
export const approvalOptions = (session: AuthSession, id: string) =>
  queryOptions({
    queryKey: ["account", session.accountId, "family-approval", id],
    queryFn: ({ signal }) =>
      request(
        `/family/approvals/${encodeURIComponent(id)}`,
        z.object({ approval: approvalViewSchema }),
        { token: session.token, signal },
      ).then((data) => data.approval),
  });

const sent = z.object({ id: z.string().optional(), mailed: z.boolean() });
export const approvals = {
  send: (
    session: AuthSession,
    body: { personId?: string; parentEmail: string },
  ) =>
    request("/family/approvals", sent, { token: session.token, body }).finally(
      () => invalidateAccount(session.accountId),
    ),
  resend: (session: AuthSession, id: string) =>
    request(`/family/approvals/${id}/resend`, sent, {
      token: session.token,
      body: {},
    }).finally(() => invalidateAccount(session.accountId)),
  remove: (session: AuthSession, id: string) =>
    request(`/family/approvals/${id}/remove`, z.unknown(), {
      token: session.token,
      body: {},
    }).finally(() => invalidateAccount(session.accountId)),
  /** Public: the token is the permission. */
  lookup: (token: string) =>
    request(
      "/family/approvals/lookup",
      z.object({ approval: approvalLookupSchema }),
      { body: { token } },
    ).then((data) => data.approval),
  open: (session: AuthSession, body: { token: string; proof?: string }) =>
    request("/family/approvals/open", z.object({ id: z.string() }), {
      token: session.token,
      body,
    }),
  approve: (
    session: AuthSession,
    id: string,
    name: string,
    birthYear?: number,
  ) =>
    request(
      `/family/approvals/${id}/approve`,
      z.object({ learnerId: z.string() }),
      {
        token: session.token,
        body: birthYear === undefined ? { name } : { name, birthYear },
      },
    ),
};

const SIGNUP_COOKIE = "amp.family-approval";
/** Carried while the parent signs in, creates an account or switches account
 * from it (`lib/link-carry.ts`); `null` lets it go, held and carried alike.
 * Only the fragment and this carry hold the token, so it stays out of every
 * URL a server or report sees; the cookie tells account creation a mailed
 * link proved the address. */
export function rememberApproval(
  fragment: string | null,
  { switching = false } = {},
) {
  if (fragment) carryLink("/family/approve", fragment, { switching });
  else {
    dropCapability("/family/approve");
    dropCarry("/family/approve");
  }
  approvalSignup(fragment);
}
/** The proof account creation reads, for an hour at most. */
export function approvalSignup(fragment: string | null) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = fragment
    ? `${SIGNUP_COOKIE}=${encodeURIComponent(fragment)}; Path=/api/auth; Max-Age=3600; SameSite=Lax${secure}`
    : `${SIGNUP_COOKIE}=; Path=/api/auth; Max-Age=0; SameSite=Lax${secure}`;
}
export const rememberedApproval = () => carriedLink("/family/approve");
