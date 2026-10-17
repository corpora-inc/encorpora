import type { CommerceOrder, LicenseGrant } from "../commerce/contracts.js";
import { z } from "zod";
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
    termMonths: z.literal(12),
    termPolicy: z.literal("twelve-months-from-verified-provisioning"),
    route: z.enum(["marketplace", "direct-pay"]),
    activationPolicy: z
      .enum(["after-settlement", "after-approval"])
      .default("after-settlement"),
    creditAgreementReference: text.optional(),
    destinationUrl: https,
    instructions: text,
    documentPolicy: z.literal("opaque-student-reference-accepted"),
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
      skuReference: text,
      routeReference: text,
      paymentReference: text,
      annualTermReference: text,
    }),
  })
  .refine(
    (v) =>
      v.activationPolicy !== "after-approval" || !!v.creditAgreementReference,
    "Approved credit agreement required before settlement",
  )
  .refine(
    (v) => Date.parse(v.validFrom) < Date.parse(v.validUntil),
    "Offer validity must increase",
  );
export type FundingOffer = z.infer<typeof fundingOfferSchema>;
export const createFundingRequestSchema = z.strictObject({
  offerId: id,
  offerRevision: id,
  learnerId: text,
  idempotencyKey: z.string().uuid(),
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
export type PublicFundingRequest = ReturnType<typeof presentRequest>;
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
