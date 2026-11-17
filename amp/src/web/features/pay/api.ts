import { queryOptions, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { analyticsVisitorHeaders, flush } from "../../lib/analytics";
import { request, requestFetch } from "../../lib/api";
import { invalidateAccount, refreshMe } from "../../lib/query";
import { paymentUrl } from "../billing/payment-url";
import { purchaseOfferSchema, type PurchaseOffer } from "../funding/invoice-resume";
import { invoiceDocumentSchema } from "../funding/invoice-document";
import { fundingRecordsKey } from "../funding/records";
import type { PayInterval } from "./store";

/* The pay flow's server state: every read is a query in the account's
   cache, every write a mutation that invalidates the account (its `/me`,
   Billing's plans and invoices), so each screen shows the new state the
   moment it lands. */

/** The education-funds offers on sale: public, the same list the guest
 * invoice and the pitch read. */
export const fundingOffersOptions = queryOptions({
  queryKey: ["funding", "invoice-offers"],
  queryFn: ({ signal }) =>
    request(
      "/funding/invoice-offers",
      z.object({ offers: z.array(purchaseOfferSchema) }),
      { signal },
    ),
  staleTime: 5 * 60_000,
  select: (view) => view.offers,
});

export type FundingOffer = PurchaseOffer;
export const offerInterval = (offer: Pick<FundingOffer, "termMonths">): PayInterval =>
  offer.termMonths === 1 ? "month" : "year";

/** One program per entry, in name order, from the offers on sale. */
export function fundingPrograms(offers: readonly FundingOffer[]) {
  const programs = new Map<string, FundingOffer[]>();
  for (const offer of offers)
    programs.set(offer.programId, [...(programs.get(offer.programId) ?? []), offer]);
  return [...programs.entries()]
    .map(([id, offers]) => ({
      id,
      name: offers[0]!.programName,
      jurisdiction: offers[0]!.jurisdiction,
      statusLabel: offers.find((offer) => offer.statusLabel)?.statusLabel,
      // The annual plan first, as everywhere prices are shown.
      offers: [...offers].sort(
        (a, b) => (b.termMonths ?? 12) - (a.termMonths ?? 12),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const purchaseStatusSchema = z.object({
  learnerId: z.string(),
  phase: z.enum([
    "ready",
    "licensed",
    "scheduled",
    "checkout-open",
    "checkout-expired",
    "payment-processing",
    "needs-review",
    "awaiting-payment",
    "consent-required",
    "deleted",
  ]),
  interval: z.enum(["year", "month"]).optional(),
  tier: z.enum(["full", "extra"]).optional(),
});
export type PurchasePhase = z.infer<typeof purchaseStatusSchema>["phase"];

/** A learner's card purchase as the server sees it; polled only while a
 * payment is being confirmed. */
export const purchaseStatusOptions = (
  session: AuthSession,
  learnerId: string,
  poll = false,
) =>
  queryOptions({
    queryKey: ["account", session.accountId, "billing", "status", learnerId],
    queryFn: ({ signal }) =>
      request(
        `/billing/status/${encodeURIComponent(learnerId)}`,
        purchaseStatusSchema,
        { token: session.token, signal },
      ),
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      if (!poll || phase === "licensed" || phase === "scheduled") return false;
      return query.state.dataUpdateCount < 30 ? 2000 : 10000;
    },
  });

/** The learner the paid checkout was for, from the server's record. */
export async function purchaseLearner(session: AuthSession, purchaseId: string) {
  const { learnerId } = await request(
    `/billing/purchase/${encodeURIComponent(purchaseId)}`,
    z.object({ learnerId: z.string().nullable() }),
    { token: session.token },
  );
  return learnerId;
}

/** Opens Stripe Checkout for one learner (a consented family or an adult). */
export function useLearnerCheckout(session: AuthSession) {
  return useMutation({
    mutationFn: async (input: {
      /** The learner, or how to start the adult's own one first. */
      learnerId: string | (() => Promise<string>);
      offer: { id: string; interval: PayInterval };
      requestId: () => string;
      renewRequestId: () => string;
    }) => {
      const learnerId =
        typeof input.learnerId === "string"
          ? input.learnerId
          : await input.learnerId();
      const send = (requestId: string) =>
        request("/billing/checkout", z.object({ url: z.string() }), {
          token: session.token,
          headers: analyticsVisitorHeaders(),
          body: {
            learnerId,
            requestId,
            offerId: input.offer.id,
            interval: input.offer.interval,
          },
        });
      let result: { url: string };
      try {
        result = await send(input.requestId());
      } catch (error) {
        // Stripe expired the previous session; the server closed it and
        // asks for a new request. That retry is safe and expected.
        if (
          !(error instanceof AppError) ||
          error.code !== "checkout_expired_retry_with_new_request"
        )
          throw error;
        result = await send(input.renewRequestId());
      }
      goToStripe(result.url);
      return result;
    },
    onError: (error) => {
      console.error("Checkout didn’t open", error);
      void invalidateAccount(session.accountId);
    },
  });
}

/** Only Stripe's Checkout may receive the parent. */
export function goToStripe(url: string) {
  let destination: string;
  try {
    destination = paymentUrl(url, "checkout.stripe.com");
  } catch {
    const failure = new AppError(
      "contract",
      "The payment page could not be verified. Try again.",
      true,
    );
    failure.log();
    throw failure;
  }
  // Send buffered funnel events before the page unloads.
  flush();
  window.location.assign(destination);
}

/* ---------- education funds ---------- */

export const fundingRequestSchema = z.object({
  id: z.string(),
  learnerId: z.string(),
  studentBillingName: z.string().optional(),
  status: z.enum(["prepared", "parent-reported-submitted", "cancelled"]),
  orderId: z.string().nullable(),
  paymentStatus: z.string().optional(),
  accessStatus: z.string().optional(),
  expired: z.boolean(),
  expiresAt: z.string(),
  offer: z.object({
    programId: z.string().optional(),
    programName: z.string(),
    productTitle: z.string(),
    totalMinor: z.number(),
    instructions: z.string(),
    destinationUrl: z.string().url(),
    documentPolicy: z.string(),
    termMonths: z.number().optional(),
  }),
  fundedPending: z
    .object({ status: z.string(), endsAt: z.string() })
    .nullable()
    .optional(),
});
export type FundingRequestView = z.infer<typeof fundingRequestSchema>;

/** One claimed invoice: its program, status and submission deadline. Under
 * Billing's funding-records key, so whatever refreshes Billing refreshes it. */
export const fundingRequestOptions = (session: AuthSession, invoiceId: string) =>
  queryOptions({
    queryKey: [...fundingRecordsKey(session.accountId), invoiceId],
    queryFn: ({ signal }) =>
      request(
        `/funding/requests/${encodeURIComponent(invoiceId)}`,
        fundingRequestSchema,
        { token: session.token, signal },
      ),
  });

/** Whether the invoice email has gone: queued at creation, in the same
 * transaction as the invoice (docs/funded-purchases.md), then sent by the
 * funded-delivery worker. Polled until it settles. */
export const invoiceEmailOptions = (session: AuthSession, invoiceId: string) =>
  queryOptions({
    queryKey: ["account", session.accountId, "funding-invoices", "email", invoiceId],
    queryFn: async ({ signal }) => {
      const { invoices } = await request(
        "/funding/invoices",
        z.object({
          invoices: z.array(
            z.object({
              id: z.string(),
              emailStatus: z.enum(["queued", "sent", "failed"]).optional(),
            }),
          ),
        }),
        { token: session.token, signal },
      );
      return invoices.find((entry) => entry.id === invoiceId)?.emailStatus ?? null;
    },
    refetchInterval: (query) =>
      query.state.data === "queued" && query.state.dataUpdateCount < 40
        ? 3000
        : false,
  });

const claimSchema = z.object({
  id: z.string(),
  accessStatus: z.string().optional(),
  fundedPending: z
    .object({ status: z.string(), endsAt: z.string() })
    .nullable()
    .optional(),
});

/** What a failed invoice says, by the server's code. */
const invoiceFailures: Record<string, string> = {
  confirmed_parent_email_required:
    "Confirm your email address first: the invoice is made out to it. Then create it again.",
  invoice_email_limit:
    "Several invoices were made for this email in the last hour. Try again in an hour.",
  offer_unavailable:
    "This program’s price or terms just changed. Go back to the plan to see the current one.",
  verified_consent_required:
    "This learner needs a parent’s consent before they can learn. Confirm it in Privacy, then create the invoice again.",
  family_holder_only: "Only the family’s account holder can pay for its children.",
  learner_not_found: "This learner isn’t in your account anymore.",
  invoice_already_claimed: "This invoice already belongs to another learner.",
};
export function invoiceFailure(error: unknown) {
  if (error instanceof AppError && error.code && invoiceFailures[error.code])
    return invoiceFailures[error.code]!;
  return error instanceof Error && error.message
    ? error.message
    : "The invoice couldn’t be created. Check your connection, then try again.";
}

/**
 * Creates the invoice and starts the learner's access in one action: the
 * invoice (its PDF email is queued in the same transaction), then the claim
 * that connects it to this learner and activates its funded-pending access
 * (docs/funded-purchases.md, "Access while payment is pending"). A retry
 * never makes a second invoice, email or grant: before the invoice exists it
 * resends the same key and fields (the server returns the same invoice);
 * after, it only claims that invoice again (idempotent for its learner).
 */
export function useCreateInvoice(
  session: AuthSession,
  /** On to the invoice's page. A mutation-level callback: it runs even
   * though the access it grants re-renders (and unmounts) the form. */
  onCreated?: (created: { invoiceId: string; learnerId: string }) => void,
) {
  return useMutation({
    mutationFn: async (input: {
      offer: Pick<FundingOffer, "id" | "revision">;
      studentBillingName: string;
      parentEmail: string;
      /** Null: the adult's own learner, started by `prepare` first. */
      learnerId: string | null;
      prepare?: () => Promise<string>;
      idempotencyKey: string;
      /** This attempt's invoice, when an earlier try made it and only its
       * claim failed: a claimed invoice can't be made again, so a retry
       * claims it (idempotently) instead. */
      invoiceId?: string;
      /** The invoice exists: keep its id for a retry. */
      onInvoice?: (invoiceId: string) => void;
    }) => {
      const invoiceId =
        input.invoiceId ??
        (
          await request("/funding/invoices", invoiceDocumentSchema, {
            headers: analyticsVisitorHeaders(),
            body: {
              offerId: input.offer.id,
              offerRevision: input.offer.revision,
              parentEmail: input.parentEmail,
              studentBillingName: input.studentBillingName,
              idempotencyKey: input.idempotencyKey,
            },
          })
        ).invoiceId;
      input.onInvoice?.(invoiceId);
      const learnerId = input.learnerId ?? (await input.prepare!());
      const claimed = await request(
        `/funding/invoices/${encodeURIComponent(invoiceId)}/claim`,
        claimSchema,
        { token: session.token, body: { learnerId } },
      );
      return { invoiceId, learnerId, claimed };
    },
    onSuccess: (created) => onCreated?.(created),
    onError: (error) => console.error("The invoice wasn’t created", error),
    onSettled: () => invalidateAccount(session.accountId),
  });
}

/** The parent reports the invoice submitted to their program: unverified,
 * and it extends the funded-pending window (docs/funded-purchases.md). */
export function useReportSubmitted(session: AuthSession) {
  return useMutation({
    mutationFn: (invoiceId: string) =>
      request(
        `/funding/requests/${encodeURIComponent(invoiceId)}/status`,
        z.unknown(),
        {
          token: session.token,
          body: { status: "parent-reported-submitted" },
        },
      ),
    onError: (error) => console.error("Submission wasn’t recorded", error),
    onSettled: () => invalidateAccount(session.accountId),
  });
}

/** Saves the invoice PDF: the authenticated document, never a public link. */
export function useDownloadInvoice(session: AuthSession) {
  return useMutation({
    mutationFn: async (invoice: { id: string; documentPolicy: string }) => {
      const kind =
        invoice.documentPolicy === "named-student-invoice" ? "invoice" : "quote";
      const response = await requestFetch(
        `/api/v1/funding/requests/${encodeURIComponent(invoice.id)}/${kind}`,
        { headers: { authorization: `Bearer ${session.token}` } },
      );
      if (!response.ok)
        throw new Error(
          "The invoice didn’t download. Try again, or use the copy in your email.",
        );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `AMP-invoice-${invoice.id}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onError: (error) => console.error("The invoice didn’t download", error),
  });
}

/** Starts the adult's own learner when an account buys for its own
 * practice before it has one (idempotent on the server), then refreshes
 * `/me`, which lists it. */
export async function startOwnPractice(session: AuthSession) {
  const { learnerId } = await request(
    "/me/practice",
    z.object({ learnerId: z.string() }),
    {
      token: session.token,
      body: {
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      },
    },
  );
  await refreshMe(session);
  return learnerId;
}

export const money = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
    .format(minor / 100)
    .replace(/\.00$/, "");
