/**
 * AMP's Stripe catalog as code: the product's customer-facing text and the
 * price set it sells. `npm run infra -- stripe plan|apply --env <env>` makes the
 * environment's product match (docs/external-config.md).
 *
 * The product text comes from the brand (src/brand.json). A Stripe price is
 * immutable, so a change to what AMP charges is a new price: `apply` creates a
 * declared price that does not exist yet (found by its lookup key) and nothing
 * else about prices. It never edits, activates or archives a price and never
 * touches a subscription. Earlier prices stay active in
 * src/billing/stripe/retired-prices.ts so existing subscriptions keep renewing
 * at the price they bought.
 */
import { brand } from "../src/brand.ts";

export interface DeclaredPrice {
  unitAmount: number;
  currency: string;
  interval: "year" | "month";
  /** Stripe's stable handle for finding this price without knowing its id. */
  lookupKey: string;
}

export const stripeCatalog = {
  product: {
    name: brand.checkout.name,
    description: brand.checkout.description,
    statement_descriptor: brand.checkout.statementDescriptor,
    /** Stripe Tax: software as a service, personal use. */
    tax_code: "txcd_10103000",
    /** Managed keys only; other metadata keys are left alone. */
    metadata: { managed_by: "encorpora amp/infra/stripe.ts" },
  },
  prices: {
    year: {
      unitAmount: 59900,
      currency: "usd",
      interval: "year",
      lookupKey: "amp-year-59900",
    },
    month: {
      unitAmount: 5900,
      currency: "usd",
      interval: "month",
      lookupKey: "amp-month-5900",
    },
  } satisfies Record<"year" | "month", DeclaredPrice>,
} as const;
