/**
 * AMP's deployed environments and the public identifiers of what each one
 * uses outside this repository. Stripe product and price ids are not secrets;
 * keys, webhook secrets and the Stripe account id stay in each environment's
 * secret (see infra/secrets.ts and docs/external-config.md).
 */
export type EnvironmentName = "stage" | "prod";

export interface StripeEnvironment {
  /** Test mode for stage, live mode for prod; the key's mode must match. */
  mode: "test" | "live";
  productId: string;
  /** The existing recurring prices. The tooling verifies them, never edits them. */
  priceIds: { year: string; month: string };
}

export interface Environment {
  origin: string;
  stripe: StripeEnvironment;
}

export const environments: Record<EnvironmentName, Environment> = {
  stage: {
    origin: "https://amp-stage.corpora.inc",
    stripe: {
      mode: "test",
      productId: "prod_VStv6AR38jUxQ5",
      priceIds: {
        year: "price_1URy7GQzEit9vbmMsJYMY168",
        month: "price_1URy7GQzEit9vbmMRk26kegM",
      },
    },
  },
  prod: {
    origin: "https://amp.corpora.inc",
    stripe: {
      mode: "live",
      productId: "prod_VTD2GqZXy2tSQL",
      priceIds: {
        year: "price_1USGcKQzEit9vbmMZ5uPUGc4",
        month: "price_1USGcKQzEit9vbmMIeLvG5Ou",
      },
    },
  },
};

/** The local development origin (`npm run dev`). */
export const localOrigin = "http://localhost:4310";

export function environmentName(value: string | undefined): EnvironmentName {
  if (value === "stage" || value === "prod") return value;
  throw new Error(`Unknown environment "${value}": use stage or prod`);
}
