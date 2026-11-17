import { queryOptions } from "@tanstack/react-query";
import { qk } from "../../lib/keys";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { invalidateAccount, queryClient } from "../../lib/query";

/*
 * The family's learning consent (src/parent-consent): its state and the
 * direct notice (GET /api/v1/consent), the parent's request (POST
 * /consent/requests) and withdrawal (POST /family/consent/withdraw). The
 * same routes the account's consent screen uses; nothing new.
 */

const notice = z.object({
  version: z.string(),
  operator: z.object({
    name: z.string(),
    address: z.string(),
    telephone: z.string(),
    email: z.string(),
  }),
  privacyUrl: z.string(),
  childData: z.array(
    z.object({
      category: z.string(),
      purpose: z.string(),
      retention: z.string(),
    }),
  ),
  processors: z.array(
    z.object({
      name: z.string(),
      service: z.string(),
      data: z.string(),
      purpose: z.string(),
      retention: z.string(),
    }),
  ),
  reviewAndDeletion: z.string(),
  pendingContactDays: z.number(),
  withdrawnEvidenceDays: z.number(),
  evidenceRetentionPurpose: z.string(),
});
export type ConsentNoticeText = z.infer<typeof notice>;

const consentView = z.object({
  consentActive: z.boolean(),
  available: z.boolean(),
  notice: notice.nullable(),
  noticeDigest: z.string().nullable(),
  request: z
    .object({
      id: z.string(),
      phase: z.string(),
      delivery: z.string().nullable(),
    })
    .nullable(),
});
export type ConsentState = z.infer<typeof consentView>;

/** Under the account's key: every account change refreshes it. */
export const consentOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: qk.account(session.accountId, "consent"),
    queryFn: ({ signal }) =>
      request("/consent", consentView, { token: session.token, signal }),
    enabled: !!session.token,
  });

/** Whether a new request may start: none yet, or the last one ended. */
export const canRequestConsent = (state: ConsentState) =>
  state.available &&
  !state.consentActive &&
  (!state.request ||
    ["withdrawn", "expired", "replaced", "policy-changed"].includes(
      state.request.phase,
    ));

/**
 * The parent's yes, sent: the direct notice goes to the address they give,
 * and its link records consent (16 CFR 312.5(b)(2)(vi), email plus; the
 * delayed confirmatory message follows on its own). `requestId` is kept by
 * the caller so a retry is the same request.
 */
export async function requestConsent(
  session: AuthSession,
  input: { email: string; noticeDigest: string; requestId: string },
) {
  const state = await request("/consent/requests", consentView, {
    token: session.token,
    body: { ...input, parentAttestation: true },
  });
  queryClient.setQueryData(consentOptions(session).queryKey, state);
  await invalidateAccount(session.accountId);
  return state;
}

/** Withdraws the family's consent: new learning pauses for children under
 * 13 (16 CFR 312.6(a)(2)). */
export async function withdrawConsent(session: AuthSession) {
  await request("/family/consent/withdraw", z.unknown(), {
    token: session.token,
    body: {},
  });
  await invalidateAccount(session.accountId);
}
