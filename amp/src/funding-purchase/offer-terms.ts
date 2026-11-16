import { createHash } from "node:crypto";
import { canonicalCommercePayload } from "../commerce/ledger.js";
import type { FundingOffer } from "./contracts.js";

const revisionSuffix = "-invoice-dates-v1";

function invoiceRevision(revision: string): string {
  const revised = `${revision}${revisionSuffix}`;
  if (revised.length <= 120) return revised;
  const hash = createHash("sha256").update(revision).digest("hex").slice(0, 16);
  return `${revision.slice(0, 120 - revisionSuffix.length - hash.length - 1)}-${hash}${revisionSuffix}`;
}

/** New named DirectPay invoices use dated terms under individual purchase
 * review. Stored invoices keep their original terms and approval evidence. */
export function withInvoiceDateTerms(offer: FundingOffer): FundingOffer {
  if (
    offer.documentPolicy !== "named-student-invoice" ||
    offer.route !== "direct-pay" ||
    offer.activationPolicy !== "after-settlement" ||
    (offer.termPolicy !== "one-month-from-verified-provisioning" &&
      offer.termPolicy !== "twelve-months-from-verified-provisioning")
  )
    return offer;
  return {
    ...offer,
    revision: invoiceRevision(offer.revision),
    purchaseReview: "individual-approval-required",
    termPolicy:
      offer.termMonths === 1
        ? "one-month-from-invoice"
        : "twelve-months-from-invoice",
  };
}

/** The dated-term migration must not strand an issued invoice. Every other
 * field must still match, including price, merchant, validity and approval
 * evidence. Callers separately filter currently enabled/valid offers. */
export function fundingOfferMatchesSnapshot(
  current: FundingOffer,
  snapshot: FundingOffer,
): boolean {
  const expected = canonicalCommercePayload(current);
  return (
    expected === canonicalCommercePayload(snapshot) ||
    expected === canonicalCommercePayload(withInvoiceDateTerms(snapshot))
  );
}
