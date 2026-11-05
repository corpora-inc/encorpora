import type { RefundPolicy } from "./contracts.js";

/**
 * The researched refund terms for each program AMP sells through, to copy
 * into the private offers file (`refundPolicy`, `refundSummary`). Offers read
 * their terms from that file, never from here; tests check these entries
 * against the offer schema. Policy page: https://corpora.inc/legal/refund/.
 */
export const researchedRefundTerms: Record<
  string,
  { refundPolicy: RefundPolicy; refundSummary?: string }
> = {
  // Refunds go to the child's EFA through ClassWallet, never to the account
  // holder: 6 CAR § 35-107(i)(1), p. 23 of
  // https://dese.ade.arkansas.gov/Files/Educational_Freedom_Account_Program_6CARpt.35_Legal.pdf
  // and https://classwallet.my.site.com/classwallet/s/article/Refund-Overpayments-Incorrect-Payments
  "ar-efa": {
    refundPolicy: "full-to-account",
    refundSummary:
      "Ask within 30 days of payment, for any reason, and we refund the full amount to your child’s EFA account through ClassWallet.",
  },
  // ESA money may not be refunded to the parent or student
  // (A.R.S. § 15-2402(J), https://www.azleg.gov/ars/15/02402.htm); refunds go
  // by check to the Arizona Department of Education for the child's ESA
  // ("Refund of ESA Award", https://www.azed.gov/esa/esa-forms;
  // https://classwallet.my.site.com/classwallet/s/article/AZ-ESA-Refund-Overpayments-Incorrect-Payments).
  // The purchase as received: the platform's fee may not return.
  "az-esa": {
    refundPolicy: "purchase-to-account",
    refundSummary:
      "Ask within 30 days of payment, for any reason, and we refund your purchase to your child’s ESA through the Arizona Department of Education.",
  },
  // Refunds go to the child's EFA wallet in ClassWallet, issued within 30
  // days: https://nh.scholarshipfund.org/wp-content/uploads/2025/08/PRO-06-Provider-Refund-Policy.pdf
  // and the parent handbook, p. 32:
  // https://nh.scholarshipfund.org/wp-content/uploads/2026/09/Parent-Handbook-CSF-8-2026.pdf
  "nh-efa": {
    refundPolicy: "full-to-account",
    refundSummary:
      "Ask within 30 days of payment, for any reason, and we refund the full amount to your child’s EFA wallet in ClassWallet.",
  },
};
