import { queryOptions, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { request } from "../../lib/api";
import { invalidateAccount, meKey, queryClient } from "../../lib/query";
import {
  enrollmentViewSchema,
  offerViewSchema,
  type EnrollmentView,
} from "../../../billing/stripe/enrollment-contracts";
import type { AnnualOffer } from "../../../billing/stripe/purchase-contracts";
import { paymentUrl } from "./payment-url";
import { flush, analyticsVisitorHeaders } from "../../lib/analytics";

const billingKey = (identity: string) =>
  ["account", identity, "billing"] as const;
export const offerOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: [...billingKey(session.accountId), "offer"],
    queryFn: ({ signal }) =>
      request("/billing/offer", offerViewSchema, {
        token: session.token,
        signal,
      }),
    select: (view) => ({
      available: view.available,
      offers: view.offers ?? (view.offer ? [view.offer] : []),
    }),
  });
/** Polls only while a verified result is still pending. */
export const enrollmentOptions = (session: AuthSession, poll = false) =>
  queryOptions({
    queryKey: [...billingKey(session.accountId), "enrollment"],
    queryFn: ({ signal }) =>
      request("/billing/enrollment", enrollmentViewSchema, {
        token: session.token,
        signal,
      }),
    refetchInterval: (query) => {
      const phase = query.state.data?.purchase?.phase;
      if (!poll || (phase !== "processing" && phase !== "checkout-open"))
        return false;
      // Calm cadence: quick at first, then slower if the bank takes a while.
      return query.state.dataUpdateCount < 30 ? 2000 : 10000;
    },
  });
/** Email-plus availability; read only when purchase enrollment is unavailable. */
export const emailConsentOptions = (session: AuthSession) =>
  queryOptions({
    queryKey: ["account", session.accountId, "consent", "availability"],
    queryFn: ({ signal }) =>
      request("/consent", z.object({ available: z.boolean() }), {
        token: session.token,
        signal,
      }),
  });

export function refreshEnrollment(session: AuthSession) {
  return queryClient.invalidateQueries({
    queryKey: billingKey(session.accountId),
  });
}
/** A verified result changes what `/me` says comes next. */
export function refreshMeAfter(session: AuthSession, view: EnrollmentView) {
  const phase = view.purchase?.phase;
  if (phase === "paid" || phase === "assigned")
    void queryClient.invalidateQueries({ queryKey: meKey(session.accountId) });
}

function go(url: string, host: "checkout.stripe.com" | "billing.stripe.com") {
  let destination: string;
  try {
    destination = paymentUrl(url, host);
  } catch {
    const error = new AppError(
      "contract",
      "The payment page could not be verified. Try again.",
      true,
    );
    error.log();
    throw error;
  }
  // Send buffered funnel events before the page unloads.
  flush();
  window.location.assign(destination);
}

/** Opens Stripe Checkout for a parent-only enrollment. No child data is sent. */
export function useEnrollmentCheckout(session: AuthSession) {
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      offer: AnnualOffer;
      noticeDigest: string;
      /** Issues and remembers a replacement id for later retries. */
      renewRequestId: () => string;
    }) => {
      const send = (requestId: string) =>
        request("/billing/enrollment/checkout", z.object({ url: z.string() }), {
          token: session.token,
          // Attributes a verified purchase to this browser's funnel visit.
          headers: analyticsVisitorHeaders(),
          body: {
            requestId,
            offerId: input.offer.id,
            interval: input.offer.interval,
            acknowledgement: {
              noticeDigest: input.noticeDigest,
              parentAttestation: true,
            },
          },
        });
      let result: { url: string };
      try {
        result = await send(input.requestId);
      } catch (error) {
        // Stripe expired the previous session; the server has now closed it
        // and asks for a new request. That retry is safe and expected.
        if (
          !(error instanceof AppError) ||
          error.code !== "checkout_expired_retry_with_new_request"
        )
          throw error;
        result = await send(input.renewRequestId());
      }
      go(result.url, "checkout.stripe.com");
      return result;
    },
    // A changed notice, price or open checkout is reloaded for review.
    onError: () => void refreshEnrollment(session),
  });
}

/** Assigns the paid enrollment to the learner just created. */
export function useClaimEnrollment(session: AuthSession) {
  return useMutation({
    mutationFn: (input: { purchaseId: string; learnerId: string }) =>
      request(
        "/billing/enrollment/claim",
        z.object({ assigned: z.literal(true) }),
        { token: session.token, body: input },
      ),
    onSettled: () => invalidateAccount(session.accountId),
  });
}

export function useBillingPortal(session: AuthSession) {
  return useMutation({
    mutationFn: async () => {
      const result = await request(
        "/billing/portal",
        z.object({ url: z.string() }),
        { token: session.token, body: {} },
      );
      go(result.url, "billing.stripe.com");
      return result;
    },
  });
}
