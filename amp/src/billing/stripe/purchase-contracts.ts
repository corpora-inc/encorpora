/** Safe parent-facing billing data. No provider credentials or child payment prompts. */
export interface AnnualOffer {
  id: string;
  mode: "test" | "live";
  currency: "USD";
  amountMinor: number;
  formattedAmount: string;
  interval: "year" | "month";
  learnerCount: 1;
  /** The full price, or the price for each additional child in a family. */
  tier?: "full" | "extra";
}
export interface PurchaseStatus {
  learnerId: string;
  phase:
    | "ready"
    | "licensed"
    | "scheduled"
    | "checkout-open"
    | "checkout-expired"
    | "payment-processing"
    | "needs-review"
    | "awaiting-payment"
    | "consent-required"
    | "deleted";
  interval?: "year" | "month";
  /** The price this learner's checkout sells: its own, or a new one's. */
  tier?: "full" | "extra";
  startsAt?: string;
  endsAt?: string;
}
