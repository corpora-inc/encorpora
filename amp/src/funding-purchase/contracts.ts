import type { CommerceOrder, LicenseGrant } from "../commerce/contracts.js";
import { z } from "zod";
import { fundedCampaignSchema } from "../analytics/funded-campaign.js";
const text = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/);
const instant = z
  .string()
  .datetime({ precision: 3 })
  .refine((v) => new Date(v).toISOString() === v);
const https = z
  .string()
  .url()
  .refine((v) => {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
  });
export const REFUND_POLICIES = [
  "full-to-account",
  "purchase-to-account",
  "none",
] as const;
export type RefundPolicy = (typeof REFUND_POLICIES)[number];
/** Private deployment configuration. Research status alone never enables an offer. */
export const fundingOfferSchema = z
  .strictObject({
    id,
    revision: id,
    enabled: z.boolean(),
    programId: id,
    channelReference: id,
    programYear: text,
    jurisdiction: z.string().regex(/^[A-Z]{2}$/),
    programName: text,
    sku: id,
    productTitle: text,
    productDescription: text,
    currency: z.literal("USD"),
    subtotalMinor: z.number().int().positive().max(100_000_000),
    taxMinor: z.number().int().nonnegative().max(100_000_000),
    /** A year, or one month (funded programs that let a family pay month
     * to month). Each term has its own policy, so an issued snapshot never
     * reads as the other. */
    termMonths: z.union([z.literal(12), z.literal(1)]),
    termPolicy: z.enum([
      "twelve-months-from-verified-provisioning",
      "one-month-from-verified-provisioning",
    ]),
    route: z.enum(["marketplace", "direct-pay"]),
    /** Prepare a vendor invoice for the program's individual purchase review. */
    purchaseReview: z.literal("individual-approval-required").optional(),
    activationPolicy: z
      .enum(["after-settlement", "after-approval"])
      .default("after-settlement"),
    creditAgreementReference: text.optional(),
    destinationUrl: https,
    instructions: text,
    /** The one public status line for this program, exactly as the parent
     * site shows it (corpora-site `presentation.statusLabel`), e.g. its vendor
     * status and payment route. Absent: nothing is claimed. */
    statusLabel: text.max(100).optional(),
    /** Whether this program lets us honour the 30-day money-back
     * guarantee (https://corpora.inc/legal/refund/): the full amount back to
     * the child's program account, the purchase as received (a payment
     * platform's fee may not return), or no refunds at all. Researched terms
     * and sources: `researchedRefundTerms` in refund-terms.ts. Optional for
     * one release so existing offer files still load (with a warning); then
     * required. */
    refundPolicy: z.enum(REFUND_POLICIES).optional(),
    /** That policy in one public line at the point of sale (the invoice
     * form). Required with a refund. */
    refundSummary: text.max(200).optional(),
    documentPolicy: z.enum([
      "opaque-student-reference-accepted",
      "named-student-invoice",
    ]),
    documentPolicyReference: text,
    validFrom: instant,
    validUntil: instant,
    merchant: z.strictObject({
      legalName: text,
      postalAddress: text,
      supportEmail: z.string().email(),
    }),
    approvals: z.strictObject({
      vendorReference: text,
      skuReference: text.optional(),
      routeReference: text,
      paymentReference: text,
      annualTermReference: text.optional(),
    }),
  })
  .refine(
    (v) =>
      v.purchaseReview
        ? v.route === "direct-pay" &&
          v.documentPolicy === "named-student-invoice" &&
          v.activationPolicy === "after-settlement"
        : !!v.approvals.skuReference && !!v.approvals.annualTermReference,
    "Individual purchase review requires a named DirectPay invoice and settlement before activation; approved offers require SKU and annual-term evidence",
  )
  .refine(
    (v) =>
      v.activationPolicy !== "after-approval" || !!v.creditAgreementReference,
    "Approved credit agreement required before settlement",
  )
  .refine(
    (v) => Date.parse(v.validFrom) < Date.parse(v.validUntil),
    "Offer validity must increase",
  )
  .refine(
    (v) =>
      v.termPolicy ===
      (v.termMonths === 1
        ? "one-month-from-verified-provisioning"
        : "twelve-months-from-verified-provisioning"),
    "An offer's term policy names its term",
  )
  .refine(
    (v) => !v.refundPolicy || v.refundPolicy === "none" || !!v.refundSummary,
    "A program that refunds states its refund terms (refundSummary)",
  );
export type FundingOffer = z.infer<typeof fundingOfferSchema>;
/** Supplied by the parent for a program invoice, never inferred from a nickname. */
export const studentBillingNameSchema = text.max(180);
export const createFundingRequestSchema = z.strictObject({
  offerId: id,
  offerRevision: id,
  learnerId: text,
  idempotencyKey: z.string().uuid(),
  campaignAttribution: fundedCampaignSchema.optional(),
  studentBillingName: studentBillingNameSchema.optional(),
});
export type CreateFundingRequest = z.infer<typeof createFundingRequestSchema>;
export interface FundingRequest {
  id: string;
  accountId: string;
  learnerId: string;
  idempotencyKey: string;
  createdAt: string;
  expiresAt: string;
  status: "prepared" | "parent-reported-submitted" | "cancelled";
  offer: FundingOffer;
  orderId: string | null;
  studentBillingName?: string;
}
export class FundingPurchaseError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
/** Exact safe presentation subset: operational evidence references are private. */
export function presentOffer(offer: FundingOffer) {
  const {
    approvals: _approvals,
    enabled: _enabled,
    documentPolicyReference: _documentEvidence,
    creditAgreementReference: _creditEvidence,
    ...publicOffer
  } = offer;
  return { ...publicOffer, totalMinor: offer.subtotalMinor + offer.taxMinor };
}
export function presentRequest(
  request: FundingRequest,
  commerce: { order: CommerceOrder; grant: LicenseGrant | null } | null = null,
  at = new Date(),
  offerAvailable = true,
) {
  const {
    accountId: _accountId,
    idempotencyKey: _key,
    ...publicRequest
  } = request;
  const order = commerce?.order;
  const grant = commerce?.grant;
  return {
    ...publicRequest,
    offer: presentOffer(request.offer),
    offerAvailable,
    expired: !request.orderId && Date.parse(request.expiresAt) <= at.getTime(),
    paymentStatus: order?.settlement ?? "not-verified",
    accessStatus:
      grant?.status === "revoked"
        ? "revoked"
        : grant &&
            Date.parse(grant.startsAt) <= at.getTime() &&
            at.getTime() < Date.parse(grant.endsAt)
          ? "active"
          : grant
            ? "outside-term"
            : "not-granted",
    commerce: order
      ? {
          id: order.id,
          approval: order.approval,
          fulfillment: order.fulfillment,
          settlement: order.settlement,
          refund: order.refund,
          revocation: order.revocation,
          amountMinor: order.amountMinor,
          currency: order.currency,
          startsAt: order.license.startsAt,
          endsAt: order.license.endsAt,
        }
      : null,
  };
}
export type PublicFundingOffer = ReturnType<typeof presentOffer>;
export type PublicFundingRequest = ReturnType<typeof presentRequest> & {
  fundedPending?: { status: string; endsAt: string } | null;
};
export function availableOffers(
  offers: readonly FundingOffer[],
  at: Date,
): FundingOffer[] {
  if (!Number.isFinite(at.getTime())) throw new Error("Invalid offer clock");
  const seen = new Set<string>();
  return offers
    .map((offer) => fundingOfferSchema.parse(offer))
    .filter((offer) => {
      if (seen.has(offer.id)) throw new Error("Duplicate operational offer");
      seen.add(offer.id);
      return (
        offer.enabled &&
        Date.parse(offer.validFrom) <= at.getTime() &&
        at.getTime() < Date.parse(offer.validUntil)
      );
    });
}
