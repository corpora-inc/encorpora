/**
 * Prices AMP no longer sells but whose subscriptions keep renewing. A Stripe
 * price is immutable, so a list-price change is a new price; every subscriber
 * keeps the price they bought until they cancel. Renewal invoices, subscription
 * events and paid-period grants accept these ids at exactly these amounts, and
 * checkout never uses them. The ids are public identifiers, not secrets.
 */
export interface RetiredPrice {
  priceId: string;
  interval: "year" | "month";
  amountMinor: number;
  livemode: boolean;
}

/** $499 a year and $49 a month, sold until the 2026-11-07 list-price change. */
export const retiredPrices: readonly RetiredPrice[] = [
  {
    priceId: "price_1URy7GQzEit9vbmMsJYMY168",
    interval: "year",
    amountMinor: 49900,
    livemode: false,
  },
  {
    priceId: "price_1URy7GQzEit9vbmMRk26kegM",
    interval: "month",
    amountMinor: 4900,
    livemode: false,
  },
  {
    priceId: "price_1USGcKQzEit9vbmMZ5uPUGc4",
    interval: "year",
    amountMinor: 49900,
    livemode: true,
  },
  {
    priceId: "price_1USGcKQzEit9vbmMIeLvG5Ou",
    interval: "month",
    amountMinor: 4900,
    livemode: true,
  },
];
