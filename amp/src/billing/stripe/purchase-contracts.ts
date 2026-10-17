/** Safe parent-facing billing data. No provider credentials or child payment prompts. */
export interface AnnualOffer {
  id: string;
  mode: "test" | "live";
  currency: "USD";
  amountMinor: number;
  formattedAmount: string;
  interval: "year";
  learnerCount: 1;
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
    | "consent-required"
    | "deleted";
  startsAt?: string;
  endsAt?: string;
}
