/**
 * AMP's Stripe catalog as code: the product's customer-facing text and the
 * price set it sells. `npm run infra -- stripe plan|apply --env <env>` makes the
 * environment's product match (docs/external-config.md).
 *
 * The product text comes from the brand (src/brand.json). Prices are declared
 * only to be verified: the tooling never creates, edits, activates or archives a
 * price, and never touches a subscription. A price change is a new price and a
 * reviewed migration (docs/stripe.md), not an edit here.
 */
import { brand } from "../src/brand.ts";

export interface DeclaredPrice {
  unitAmount: number;
  currency: string;
  interval: "year" | "month";
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
    year: { unitAmount: 49900, currency: "usd", interval: "year" },
    month: { unitAmount: 4900, currency: "usd", interval: "month" },
  } satisfies Record<"year" | "month", DeclaredPrice>,
} as const;
