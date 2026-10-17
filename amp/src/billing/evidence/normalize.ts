import type Stripe from "stripe";
import type { FinancialResult, RefundFact, TaxAmount } from "./contracts.js";
const resourceId = (value: string | { id: string } | null): string | null =>
  typeof value === "string" ? value : (value?.id ?? null);
function amount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 100_000_000
  );
}
/** Exact monetary facts only; missing tax fields are not inferred from a price. */
export function normalizeFinancialEvidence(
  invoice: Stripe.Invoice,
  chargeId: string,
  refunds: Stripe.Refund[],
): FinancialResult {
  const review = (reason: string): FinancialResult => ({
    kind: "review",
    reason,
  });
  if (
    invoice.currency !== "usd" ||
    !amount(invoice.total) ||
    !amount(invoice.total_excluding_tax) ||
    !amount(invoice.subtotal_excluding_tax) ||
    !Array.isArray(invoice.total_taxes)
  )
    return review("financial_amounts_unavailable");
  if (
    invoice.amount_paid !== invoice.total ||
    invoice.amount_remaining !== 0 ||
    invoice.amount_overpaid !== 0 ||
    invoice.amount_shipping !== 0 ||
    invoice.starting_balance !== 0 ||
    invoice.ending_balance !== 0 ||
    invoice.pre_payment_credit_notes_amount !== 0 ||
    invoice.post_payment_credit_notes_amount !== 0 ||
    invoice.latest_revision ||
    invoice.from_invoice ||
    invoice.discounts.length ||
    invoice.total_discount_amounts?.some((item) => item.amount !== 0) ||
    invoice.total_pretax_credit_amounts?.some((item) => item.amount !== 0)
  )
    return review("financial_adjustments_require_review");
  if (
    invoice.billing_reason !== "subscription_create" &&
    invoice.billing_reason !== "subscription_cycle"
  )
    return review("financial_invoice_reason_requires_review");
  const tax: TaxAmount[] = [];
  for (const item of invoice.total_taxes) {
    if (
      !amount(item.amount) ||
      !["inclusive", "exclusive"].includes(item.tax_behavior)
    )
      return review("financial_tax_requires_review");
    tax.push({
      amountMinor: item.amount,
      behavior: item.tax_behavior as TaxAmount["behavior"],
    });
  }
  tax.sort(
    (a, b) =>
      a.behavior.localeCompare(b.behavior) || a.amountMinor - b.amountMinor,
  );
  const included = tax
    .filter((item) => item.behavior === "inclusive")
    .reduce((sum, item) => sum + item.amountMinor, 0);
  const excluded = tax
    .filter((item) => item.behavior === "exclusive")
    .reduce((sum, item) => sum + item.amountMinor, 0);
  if (
    invoice.subtotal_excluding_tax !== invoice.total_excluding_tax ||
    invoice.subtotal !== invoice.total_excluding_tax + included ||
    invoice.total !== invoice.total_excluding_tax + included + excluded
  )
    return review("financial_tax_mismatch");
  if (refunds.length > 100) return review("financial_refund_history_limit");
  const normalized: RefundFact[] = [],
    seen = new Set<string>();
  for (const refund of refunds) {
    if (
      !/^re_[A-Za-z0-9_]+$/.test(refund.id) ||
      seen.has(refund.id) ||
      resourceId(refund.charge) !== chargeId ||
      refund.currency !== "usd" ||
      !amount(refund.amount) ||
      refund.amount === 0 ||
      !Number.isSafeInteger(refund.created) ||
      refund.created <= 0 ||
      !refund.status ||
      ![
        "pending",
        "requires_action",
        "succeeded",
        "failed",
        "canceled",
      ].includes(refund.status)
    )
      return review("financial_refund_mismatch");
    seen.add(refund.id);
    normalized.push({
      id: refund.id,
      chargeId,
      amountMinor: refund.amount,
      currency: "usd",
      created: refund.created,
      status: refund.status as RefundFact["status"],
    });
  }
  normalized.sort((a, b) => a.id.localeCompare(b.id));
  if (
    normalized
      .filter((refund) => refund.status === "succeeded")
      .reduce((sum, refund) => sum + refund.amountMinor, 0) > invoice.total
  )
    return review("financial_refund_total_mismatch");
  return {
    kind: "verified",
    observation: {
      invoiceReason:
        invoice.billing_reason === "subscription_create"
          ? "subscription_create"
          : "subscription_cycle",
      preTaxMinor: invoice.total_excluding_tax,
      tax,
      paidMinor: invoice.total,
      currency: "usd",
      refunds: normalized,
    },
  };
}
