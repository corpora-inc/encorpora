/**
 * AMP's deployed environments and the public identifiers of what each one
 * uses outside this repository. Stripe product and price ids are not secrets;
 * keys, webhook secrets and the Stripe account id stay in each environment's
 * secret (see infra/secrets.ts and docs/external-config.md).
 */
import { retiredPrices } from "../src/billing/stripe/retired-prices.ts";

function retiredIds(livemode: boolean) {
  const id = (interval: "year" | "month") =>
    retiredPrices.find(
      (p) => p.livemode === livemode && p.interval === interval,
    )!.priceId;
  return { year: id("year"), month: id("month") };
}

export type EnvironmentName = "stage" | "prod";

export interface StripeEnvironment {
  /** Test mode for stage, live mode for prod; the key's mode must match. */
  mode: "test" | "live";
  productId: string;
  /**
   * The prices AMP sold before the current catalog (src/billing/stripe/
   * retired-prices.ts). The tooling verifies they still exist; subscribers
   * keep renewing on them. The price being sold is found by its lookup key.
   */
  retiredPriceIds: { year: string; month: string };
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
      retiredPriceIds: retiredIds(false),
    },
  },
  prod: {
    origin: "https://amp.corpora.inc",
    stripe: {
      mode: "live",
      productId: "prod_VTD2GqZXy2tSQL",
      retiredPriceIds: retiredIds(true),
    },
  },
};

/** The local development origin (`npm run dev`). */
export const localOrigin = "http://localhost:4310";

export function environmentName(value: string | undefined): EnvironmentName {
  if (value === "stage" || value === "prod") return value;
  throw new Error(`Unknown environment "${value}": use stage or prod`);
}
