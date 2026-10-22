import { FundingPurchaseError, type FundingRequest } from "./contracts.js";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** An unpaid quote is not an invoice, proof of payment, program approval or grant. */
export function renderFundingQuote(request: FundingRequest): string {
  const invoice = request.offer.documentPolicy === "named-student-invoice";
  if (invoice && !request.studentBillingName)
    throw new FundingPurchaseError(400, "invoice_student_name_required");
  const kind = invoice ? "invoice" : "quote";
  const o = request.offer,
    money = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: o.currency,
      }).format(n / 100);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Education purchase ${kind}</title><style>body{font:16px/1.5 system-ui;max-width:48rem;margin:2rem auto;padding:1rem;color:#153d36}h1{font-size:2rem}dt{font-weight:700}dd{margin:0 0 1rem}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:.6rem;border-bottom:1px solid #aaa}p,dd,td{overflow-wrap:anywhere}@media print{body{margin:0}a{color:inherit}}</style><main><h1>Education purchase ${kind}</h1><p><strong>${invoice ? "For program payment request" : "UNPAID — no access granted"}</strong></p><p>${invoice ? "This invoice is not a receipt or confirmation of payment, program approval or learning access. Check the transaction status before submitting a payment request." : "This document requests purchase consideration. It is not an invoice, receipt, funding approval or promise of reimbursement."}</p><dl><dt>${invoice ? "Invoice number" : "Quote reference"}</dt><dd>${escape(request.id)}</dd><dt>Prepared</dt><dd>${escape(request.createdAt)}</dd><dt>Valid until</dt><dd>${escape(request.expiresAt)}</dd><dt>Merchant</dt><dd>${escape(o.merchant.legalName)}<br>${escape(o.merchant.postalAddress)}<br>${escape(o.merchant.supportEmail)}</dd><dt>Program</dt><dd>${escape(o.programName)} · ${escape(o.programYear)}</dd><dt>${invoice ? "Student name" : "Student reference"}</dt><dd>${escape(invoice ? request.studentBillingName! : request.learnerId)}</dd><dt>Product</dt><dd>${escape(o.productTitle)} (${escape(o.sku)})<br>${escape(o.productDescription)}</dd><dt>Term</dt><dd>One learner, 12 months from verified provisioning. Exact start and end dates must be confirmed with the accepted order.</dd></dl><table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody><tr><td>Annual curriculum access × 1</td><td>${money(o.subtotalMinor)}</td></tr><tr><td>Tax</td><td>${money(o.taxMinor)}</td></tr><tr><th>Total</th><th>${money(o.subtotalMinor + o.taxMinor)}</th></tr></tbody></table><h2>Next step</h2><p>${escape(o.instructions)}</p><p>${invoice ? "Submit this invoice through the program’s approved payment route only once. Do not also pay by card. Reporting submission in AMP does not verify approval or payment." : "Complete the program’s required process. Reporting submission here does not verify approval or payment. Do not send payment using this quote."}</p></main></html>`;
}
