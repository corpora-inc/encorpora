import type { PoolClient } from "pg";
import { ConsentError } from "../../parent-consent/contracts.js";
import { BillingError } from "./config.js";
import type { AnnualPayment, CheckoutBinding } from "./model.js";
import type { StripeRepository } from "./repository.js";
import type { StripeGateway } from "./gateway.js";

/** Financial settlement has already been verified. Transient failures never
 * schedule provider changes; these codes denote rejected consent authority. */
export async function queueRejectedEnrollment(
  client: PoolClient,
  binding: CheckoutBinding,
  payment: AnnualPayment,
  error: unknown,
): Promise<void> {
  if (
    binding.learnerId !== null ||
    !(error instanceof BillingError || error instanceof ConsentError) ||
    ![
      "purchase_consent_missing",
      "purchase_consent_requires_review",
      "purchase_consent_requires_settlement",
      "purchase_consent_payment_time_mismatch",
      "consent_enrollment_unavailable",
    ].includes(error.code)
  )
    return;
  const prior = await client.query(
    "SELECT 1 FROM amp_account_entitlements WHERE checkout_id=$1 LIMIT 1",
    [binding.id],
  );
  if (prior.rowCount) return; // Withdrawal of completed consent never cancels a paid subscription implicitly.
  const state = (
    await client.query(
      `SELECT c.revoked_at,c.expires_at,c.acknowledged_at,
    p.enabled,p.reviewed_until,p.digest=c.policy_digest AND p.generation=c.policy_generation AS policy_matches
    FROM amp_stripe_checkouts b LEFT JOIN amp_purchase_consents c ON c.checkout_id=b.id LEFT JOIN amp_consent_policy p ON p.singleton WHERE b.id=$1`,
      [binding.id],
    )
  ).rows[0];
  const now = Date.now();
  const invalidSnapshot =
    !state?.expires_at ||
    !!state.revoked_at ||
    !state.enabled ||
    !state.policy_matches ||
    state.reviewed_until.getTime() <= now ||
    payment.paidAt * 1000 > state.expires_at.getTime() ||
    payment.paidAt * 1000 < state.acknowledged_at.getTime() - 1000;
  const rejectedMethod =
    payment.invoiceReason === "subscription_create" &&
    (!["card", "link"].includes(payment.paymentMethod ?? "") ||
      payment.fullRefundAt !== undefined ||
      payment.disputed);
  if (!invalidSnapshot && !rejectedMethod) return; // A stale/missing API config can be repaired without changing billing.
  await client.query(
    "INSERT INTO amp_enrollment_cancellations(checkout_id,subscription_id,reason) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [binding.id, payment.subscriptionId, error.code],
  );
}

/** Bounded, retry-safe renewal stop. No automatic refund or consent mutation. */
export async function stopRejectedEnrollmentRenewals(
  repository: StripeRepository,
  gateway: StripeGateway,
): Promise<number> {
  if (
    !(
      await repository.pool.query(
        "SELECT to_regclass('amp_enrollment_cancellations') AS relation",
      )
    ).rows[0]?.relation
  )
    return 0;
  const rows = (
    await repository.pool.query(
      "SELECT c.checkout_id,b.account_id FROM amp_enrollment_cancellations c JOIN amp_stripe_checkouts b ON b.id=c.checkout_id WHERE b.namespace=$1 AND c.completed_at IS NULL AND c.available_at<=now() ORDER BY c.requested_at LIMIT 10",
      [repository.namespace],
    )
  ).rows;
  let failed = 0;
  for (const item of rows) {
    try {
      await repository.transaction(item.account_id, async (client) => {
        const action = (
          await client.query(
            "SELECT * FROM amp_enrollment_cancellations WHERE checkout_id=$1 AND completed_at IS NULL AND available_at<=now() FOR UPDATE",
            [item.checkout_id],
          )
        ).rows[0];
        if (!action) return;
        const binding = await repository.binding(item.checkout_id);
        if (
          binding.accountId !== item.account_id ||
          binding.learnerId !== null ||
          binding.subscriptionId !== action.subscription_id
        )
          throw new BillingError("cancellation_binding_mismatch");
        await gateway.verifyMerchant();
        const subscription = await gateway.client.subscriptions.retrieve(
          action.subscription_id,
        );
        const customer =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        if (
          subscription.id !== action.subscription_id ||
          subscription.livemode !== gateway.config.livemode ||
          customer !== binding.customerId ||
          subscription.metadata.amp_checkout_id !== binding.id
        )
          throw new BillingError("cancellation_binding_mismatch");
        if (subscription.status !== "canceled")
          await gateway.client.subscriptions.cancel(
            action.subscription_id,
            { invoice_now: false, prorate: false },
            { idempotencyKey: `amp:rejected-enrollment:${binding.id}` },
          );
        await client.query(
          "UPDATE amp_enrollment_cancellations SET completed_at=now(),error_code=NULL WHERE checkout_id=$1",
          [binding.id],
        );
        await client.query(
          "UPDATE amp_stripe_checkouts SET closed=true WHERE id=$1",
          [binding.id],
        );
      });
    } catch (error) {
      failed++;
      await repository.pool.query(
        "UPDATE amp_enrollment_cancellations SET attempts=attempts+1,error_code=$2,available_at=now()+(LEAST(3600,30*power(2,LEAST(attempts,7))) * interval '1 second') WHERE checkout_id=$1 AND completed_at IS NULL",
        [
          item.checkout_id,
          error instanceof BillingError
            ? error.code
            : "cancellation_provider_unavailable",
        ],
      );
    }
  }
  return failed;
}
