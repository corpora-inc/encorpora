import { createHash } from "node:crypto";
import {
  BillingError,
  extraPlanAvailable,
  planConfig,
  type BillingInterval,
  type PriceTier,
  type StripeBillingConfig,
} from "./config.js";
import type { StripeBilling } from "./service.js";
import type { AnnualOffer, PurchaseStatus } from "./purchase-contracts.js";

export function annualOffer(
  configuration: StripeBillingConfig,
  interval: BillingInterval = "year",
  tier: PriceTier = "full",
): AnnualOffer {
  const config = planConfig(configuration, interval, tier);
  if (config.currency !== "usd")
    throw new BillingError("offer_currency_unsupported", 503);
  return {
    id: createHash("sha256")
      .update(
        JSON.stringify([
          config.priceId,
          config.amountMinor,
          config.currency,
          config.livemode,
          config.sku,
          interval,
          // The full price keeps the fingerprint it had before tiers existed.
          ...(tier === "extra" ? [tier] : []),
        ]),
      )
      .digest("hex"),
    mode: config.livemode ? "live" : "test",
    currency: "USD",
    amountMinor: config.amountMinor,
    formattedAmount: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(config.amountMinor / 100),
    interval,
    learnerCount: 1,
    tier,
  };
}

/** The full-price offers this environment sells: annual, and monthly if set. */
export function fullOffers(config: StripeBillingConfig): AnnualOffer[] {
  return config.monthlyPriceId
    ? [annualOffer(config), annualOffer(config, "month")]
    : [annualOffer(config)];
}

/** The additional-child offers, empty until the environment names them. */
export function extraOffers(config: StripeBillingConfig): AnnualOffer[] {
  return (["year", "month"] as const)
    .filter((interval) => extraPlanAvailable(config, interval))
    .map((interval) => annualOffer(config, interval, "extra"));
}

/** Reads ownership before contacting Stripe. Payment access comes exclusively from the grant ledger. */
export async function purchaseStatus(
  billing: StripeBilling,
  accountId: string,
  learnerId: string,
): Promise<PurchaseStatus> {
  let tier: PriceTier = "full";
  const status = await learnerPurchaseStatus(
    billing,
    accountId,
    learnerId,
    (found) => (tier = found),
  );
  return { ...status, tier };
}
async function learnerPurchaseStatus(
  billing: StripeBilling,
  accountId: string,
  learnerId: string,
  priced: (tier: PriceTier) => void,
): Promise<PurchaseStatus> {
  const repository = billing.repository;
  async function snapshot() {
    return repository.transaction(accountId, async (client) => {
      const learner = await client.query(
        "SELECT deleted_at FROM amp_learners WHERE id=$1 AND account_id=$2",
        [learnerId, accountId],
      );
      if (!learner.rowCount) throw new BillingError("learner_not_found", 404);
      const grants = await client.query(
        "SELECT starts_at,ends_at FROM amp_grants WHERE learner_id=$1 AND status='active' AND ends_at>now() ORDER BY starts_at LIMIT 1",
        [learnerId],
      );
      const checkout = await client.query(
        "SELECT id,session_id,subscription_id,created_at,billing_interval,price_tier FROM amp_stripe_checkouts WHERE namespace=$1 AND (learner_id=$2 OR to_jsonb(amp_stripe_checkouts)->>'assigned_learner_id'=$2) AND account_id=$3 AND NOT closed LIMIT 1",
        [repository.namespace, learnerId, accountId],
      );

      // The price this learner's checkout sells: its own while one is open,
      // else the one a new checkout would sell (the same for both plans).
      const tier: PriceTier =
        checkout.rows[0]?.price_tier ??
        (await repository.priceTier(
          client,
          accountId,
          learnerId,
          "year",
          "own",
        ));
      return {
        deleted: !!learner.rows[0].deleted_at,
        grant: grants.rows[0],
        checkout: checkout.rows[0],
        tier,
        // The account's own adult learner buys on its own terms.
        consent:
          (await repository.ownAdultLearner(client, accountId, learnerId)) ||
          (await repository.purchaseConsentActive(client, accountId)),
      };
    });
  }
  let local = await snapshot();
  priced(local.tier);
  const grantStatus = (): PurchaseStatus | undefined =>
    local.grant
      ? {
          learnerId,
          interval: local.checkout?.billing_interval,
          phase:
            local.grant.starts_at.getTime() <= Date.now()
              ? "licensed"
              : "scheduled",
          startsAt: local.grant.starts_at.toISOString(),
          endsAt: local.grant.ends_at.toISOString(),
        }
      : undefined;
  if (local.deleted) return { learnerId, phase: "deleted" };
  if (grantStatus()) return grantStatus()!;
  if (!local.consent) return { learnerId, phase: "consent-required" };
  if (!local.checkout) return { learnerId, phase: "ready" };
  if (!local.checkout.session_id)
    return {
      learnerId,
      interval: local.checkout.billing_interval,
      phase:
        Date.now() - local.checkout.created_at.getTime() < 23 * 3600_000
          ? "checkout-open"
          : "needs-review",
    };
  const session = await billing.gateway.checkoutStatus(
    local.checkout.session_id,
  );
  const checkoutId = local.checkout.id;
  local = await snapshot(); // A webhook, withdrawal or deletion may have committed while Stripe replied.
  priced(local.tier);
  if (local.deleted) return { learnerId, phase: "deleted" };
  if (grantStatus()) return grantStatus()!;
  if (!local.consent) return { learnerId, phase: "consent-required" };
  if (local.checkout?.id !== checkoutId)
    return { learnerId, phase: "needs-review" };
  return {
    learnerId,
    interval: local.checkout.billing_interval,
    phase:
      session.status === "open"
        ? "checkout-open"
        : session.status === "expired"
          ? "checkout-expired"
          : session.status === "complete"
            ? local.checkout.subscription_id
              ? "awaiting-payment"
              : "payment-processing"
            : "needs-review",
  };
}
