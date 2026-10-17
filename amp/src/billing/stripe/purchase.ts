import { createHash } from "node:crypto";
import { BillingError, type StripeBillingConfig } from "./config.js";
import type { StripeBilling } from "./service.js";
import type { AnnualOffer, PurchaseStatus } from "./purchase-contracts.js";

export function annualOffer(config: StripeBillingConfig): AnnualOffer {
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
    interval: "year",
    learnerCount: 1,
  };
}

/** Reads ownership before contacting Stripe. Payment access comes exclusively from the grant ledger. */
export async function purchaseStatus(
  billing: StripeBilling,
  accountId: string,
  learnerId: string,
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
        "SELECT id,session_id,subscription_id,created_at FROM amp_stripe_checkouts WHERE namespace=$1 AND learner_id=$2 AND account_id=$3 AND NOT closed LIMIT 1",
        [repository.namespace, learnerId, accountId],
      );
      const consent = await client.query(
        "SELECT 1 FROM amp_parent_consents WHERE account_id=$1 AND policy_version=$2 AND withdrawn_at IS NULL",
        [accountId, repository.config.consentPolicyVersion],
      );
      return {
        deleted: !!learner.rows[0].deleted_at,
        grant: grants.rows[0],
        checkout: checkout.rows[0],
        consent: !!consent.rowCount,
      };
    });
  }
  let local = await snapshot();
  const grantStatus = (): PurchaseStatus | undefined =>
    local.grant
      ? {
          learnerId,
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
  if (local.deleted) return { learnerId, phase: "deleted" };
  if (grantStatus()) return grantStatus()!;
  if (!local.consent) return { learnerId, phase: "consent-required" };
  if (local.checkout?.id !== checkoutId)
    return { learnerId, phase: "needs-review" };
  return {
    learnerId,
    phase:
      session.status === "open"
        ? "checkout-open"
        : session.status === "expired"
          ? "checkout-expired"
          : session.status === "complete"
            ? local.checkout.subscription_id
              ? "needs-review"
              : "payment-processing"
            : "needs-review",
  };
}
