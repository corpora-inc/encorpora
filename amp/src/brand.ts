/**
 * AMP's canonical brand: the one place the product is named and described.
 * Read by the web app, the server, the Stripe catalog (infra/stripe.ts) and
 * the encorpora.io manifest check (tests/brand.test.ts). Change it here only.
 */
import brandJson from "./brand.json" with { type: "json" };

export interface Brand {
  /** The product's name everywhere: "AMP". */
  name: string;
  /** What the acronym stands for. */
  expansion: string;
  /** The name with its subject, for product listings and headings. */
  productName: string;
  company: string;
  /** One-sentence public description (page meta, product listings). */
  description: string;
  checkout: {
    /** Stripe product name, shown on Checkout, invoices and receipts. */
    name: string;
    /** Stripe product description, shown on Checkout. */
    description: string;
    /** Card statement descriptor (Stripe: 5-22 characters, Latin letters). */
    statementDescriptor: string;
  };
}

export const brand: Brand = brandJson;

/** Page title: "AMP · Adaptive Math Pathways". */
export const brandTitle = `${brand.name} · ${brand.expansion}`;
