import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { digest, noticeDigest } from "../../parent-consent/crypto.js";
import {
  currentPolicy,
  policyGeneration,
} from "../../parent-consent/policy.js";
import {
  learningConsentActive,
  parentAddressConfirmed,
} from "../../server/account-access.js";
import { applyCommerceEventInTransaction } from "../../commerce/postgres.js";
import { assertFinancialIdentity } from "../evidence/repository.js";
import { parseDocumentProfile } from "../evidence/profile.js";
import { BillingError, planConfig, type BillingInterval } from "./config.js";
import {
  annualEvents,
  type AnnualPayment,
  type CheckoutBinding,
} from "./model.js";
import type { StripeRepository } from "./repository.js";
import type { StripeBilling } from "./service.js";

export const purchaseAcknowledgement = z.strictObject({
  noticeDigest: z.string().regex(/^[a-f0-9]{64}$/),
  parentAttestation: z.literal(true),
});
export type PurchaseAcknowledgement = z.infer<typeof purchaseAcknowledgement>;

/** The policy and acknowledgement contain no child profile or payment credentials. */
export async function reserveEnrollment(
  repository: StripeRepository,
  account: string,
  requestId: string,
  interval: BillingInterval,
  acknowledgement: PurchaseAcknowledgement,
): Promise<string> {
  purchaseAcknowledgement.parse(acknowledgement);
  const selected = planConfig(repository.config, interval);
  return repository.transaction(account, async (client) => {
    if (!(await parentAddressConfirmed(client, account)))
      throw new BillingError("email_unconfirmed", 403);
    const policy = await currentPolicy(client, repository.consentPolicy);
    if (!policy.review.paymentNotificationsReviewed)
      throw new BillingError("purchase_consent_unavailable", 503);
    if (
      policy.notice.version !== repository.config.consentPolicyVersion ||
      acknowledgement.noticeDigest !== noticeDigest(policy)
    )
      throw new BillingError("notice_changed");
    const retry = (
      await client.query(
        "SELECT id,learner_id,billing_interval,closed FROM amp_stripe_checkouts WHERE namespace=$1 AND account_id=$2 AND request_id=$3",
        [repository.namespace, account, requestId],
      )
    ).rows[0];
    if (retry) {
      if (
        retry.learner_id !== null ||
        retry.billing_interval !== interval ||
        retry.closed
      )
        throw new BillingError("checkout_request_conflict");
      return retry.id;
    }
    const open = (
      await client.query(
        "SELECT id,billing_interval FROM amp_stripe_checkouts WHERE namespace=$1 AND account_id=$2 AND learner_id IS NULL AND NOT closed",
        [repository.namespace, account],
      )
    ).rows[0];
    if (open) {
      if (open.billing_interval !== interval)
        throw new BillingError("checkout_plan_conflict");
      return open.id;
    }
    const pendingLicense = await client.query(
      "SELECT 1 FROM amp_account_entitlements e JOIN amp_stripe_checkouts c ON c.id=e.checkout_id WHERE c.account_id=$1 AND e.namespace=$2 AND c.assigned_learner_id IS NULL AND e.status='active' AND e.ends_at>now()",
      [account, repository.namespace],
    );
    if (pendingLicense.rowCount)
      throw new BillingError("license_ready_for_assignment");
    const id = randomUUID();
    await client.query(
      "INSERT INTO amp_stripe_customers(namespace,account_id,reservation_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [repository.namespace, account, randomUUID()],
    );
    await client.query(
      "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id,document_profile,billing_interval) VALUES($1,$2,$3,NULL,$4,$5,$6)",
      [
        id,
        repository.namespace,
        account,
        requestId,
        selected.documentProfile
          ? JSON.stringify(
              parseDocumentProfile(selected.documentProfile, selected),
            )
          : null,
        interval,
      ],
    );
    await client.query(
      "INSERT INTO amp_purchase_consents(checkout_id,account_id,policy_generation,policy_digest,notice_digest,notice) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        account,
        await policyGeneration(client),
        digest(policy),
        noticeDigest(policy),
        policy.notice,
      ],
    );
    return id;
  });
}

/** Commit the attempt boundary before any remote create. A missing result after
 * this boundary is ambiguous and cannot authorize a replacement charge. */
export async function prepareEnrollmentCheckout(
  repository: StripeRepository,
  account: string,
  id: string,
  recordAttempt = true,
): Promise<number | null> {
  return repository.transaction(account, async (client) => {
    const row = (
      await client.query(
        "SELECT c.session_id,c.creation_started_at,p.expires_at FROM amp_stripe_checkouts c JOIN amp_purchase_consents p ON p.checkout_id=c.id WHERE c.id=$1 AND c.account_id=$2 FOR UPDATE OF c",
        [id, account],
      )
    ).rows[0];
    if (!row) throw new BillingError("purchase_consent_requires_review");
    const expiresAt = Math.floor(row.expires_at.getTime() / 1000);
    if (row.session_id) return expiresAt;
    // Leave an hour for Stripe's 30-minute minimum and the 23-hour retry bound.
    // Before expiry, an ambiguous create cannot authorize a replacement.
    // After the fixed provider deadline, an unbound session is expired and its
    // URL was never returned (the binding transaction did not commit).
    if (expiresAt <= Math.floor(Date.now() / 1000) + 60 * 60) {
      if (row.creation_started_at && expiresAt > Math.floor(Date.now() / 1000))
        throw new BillingError("checkout_requires_reconciliation");
      await client.query(
        "UPDATE amp_stripe_checkouts SET closed=true WHERE id=$1",
        [id],
      );
      await client.query(
        "UPDATE amp_purchase_consents SET revoked_at=now(),purge_after=expires_at WHERE checkout_id=$1",
        [id],
      );
      return null;
    }
    await assertEnrollmentIntent(repository, client, account, id);
    if (recordAttempt)
      await client.query(
        "UPDATE amp_stripe_checkouts SET creation_started_at=COALESCE(creation_started_at,now()) WHERE id=$1",
        [id],
      );
    return expiresAt;
  });
}

/** A session failure must not roll back its already-resolved adult customer.
 * No learner data is sent when creating this opaque customer reservation. */
export async function ensureEnrollmentCustomer(
  billing: StripeBilling,
  account: string,
): Promise<void> {
  const repository = billing.repository;
  await repository.transaction(account, async (client) => {
    const customer = (
      await client.query(
        "SELECT * FROM amp_stripe_customers WHERE namespace=$1 AND account_id=$2 FOR UPDATE",
        [repository.namespace, account],
      )
    ).rows[0];
    if (!customer) throw new BillingError("customer_reservation_missing");
    if (customer.customer_id) return;
    if (Date.now() - customer.created_at.getTime() > 23 * 3600_000) {
      const attempted = await client.query(
        "SELECT 1 FROM amp_stripe_checkouts WHERE namespace=$1 AND account_id=$2 AND (creation_started_at IS NOT NULL OR (learner_id IS NOT NULL AND NOT closed)) LIMIT 1",
        [repository.namespace, account],
      );
      if (attempted.rowCount)
        throw new BillingError("customer_requires_reconciliation");
      // No session creation was attempted. A possible orphan customer has no
      // returned session or charge authority; use a fresh opaque reservation.
      customer.reservation_id = randomUUID();
      await client.query(
        "UPDATE amp_stripe_customers SET reservation_id=$3,created_at=now() WHERE namespace=$1 AND account_id=$2",
        [repository.namespace, account, customer.reservation_id],
      );
    }
    const customerId = await billing.gateway.createCustomer(
      customer.reservation_id,
    );
    await client.query(
      "UPDATE amp_stripe_customers SET customer_id=$3 WHERE namespace=$1 AND account_id=$2",
      [repository.namespace, account, customerId],
    );
  });
}

export async function assertEnrollmentIntent(
  repository: StripeRepository,
  client: PoolClient,
  account: string,
  checkoutId: string,
  settlement = false,
) {
  const policy = await currentPolicy(client, repository.consentPolicy);
  const row = (
    await client.query(
      "SELECT *,expires_at>clock_timestamp() AS current FROM amp_purchase_consents WHERE checkout_id=$1 AND account_id=$2 FOR UPDATE",
      [checkoutId, account],
    )
  ).rows[0];
  if (
    !row ||
    row.revoked_at ||
    (!settlement && !row.current) ||
    !policy.review.paymentNotificationsReviewed ||
    row.policy_digest !== digest(policy) ||
    row.policy_generation !== (await policyGeneration(client))
  )
    throw new BillingError("purchase_consent_requires_review");
  return row;
}

/** Called under the account and invoice locks, inside the access savepoint.
 * Consent and the account entitlement commit together; financial evidence is retained on failure. */
export async function settleEnrollment(
  repository: StripeRepository,
  client: PoolClient,
  binding: CheckoutBinding,
  payment: AnnualPayment,
  eventType: string,
): Promise<void> {
  const row = (
    await client.query(
      "SELECT * FROM amp_purchase_consents WHERE checkout_id=$1 FOR UPDATE",
      [binding.id],
    )
  ).rows[0];
  const checkout = (
    await client.query(
      "SELECT assigned_learner_id FROM amp_stripe_checkouts WHERE id=$1 FOR UPDATE",
      [binding.id],
    )
  ).rows[0];
  const priorSettlement = (
    await client.query(
      "SELECT 1 FROM amp_account_entitlements WHERE namespace=$1 AND checkout_id=$2 LIMIT 1",
      [repository.namespace, binding.id],
    )
  ).rowCount;
  if (!row && !priorSettlement)
    throw new BillingError("purchase_consent_missing");
  const old = (
    await client.query(
      "SELECT status FROM amp_account_entitlements WHERE namespace=$1 AND invoice_id=$2",
      [repository.namespace, payment.invoiceId],
    )
  ).rows[0];
  // Refunds and disputes change the paid license, never the parental decision.
  let status =
    payment.fullRefundAt !== undefined
      ? "refunded"
      : payment.disputed || old?.status === "held"
        ? "held"
        : old?.status === "refunded"
          ? "refunded"
          : "active";
  if (!row?.consent_at && !priorSettlement) {
    await assertFinancialIdentity(
      client,
      repository.namespace,
      payment.invoiceId,
    );
    if (
      eventType !== "invoice.paid" ||
      payment.invoiceReason !== "subscription_create" ||
      !["card", "link"].includes(payment.paymentMethod ?? "") ||
      status !== "active"
    )
      throw new BillingError("purchase_consent_requires_settlement");
    const intent = await assertEnrollmentIntent(
      repository,
      client,
      binding.accountId,
      binding.id,
      true,
    );
    if (
      payment.paidAt * 1000 < intent.acknowledged_at.getTime() - 1000 ||
      payment.paidAt * 1000 > intent.expires_at.getTime()
    )
      throw new BillingError("purchase_consent_payment_time_mismatch");
    await client.query(
      "UPDATE amp_purchase_consents SET consent_at=to_timestamp($2),invoice_id=$3,customer_id=$4 WHERE checkout_id=$1",
      [binding.id, payment.paidAt, payment.invoiceId, payment.customerId],
    );
    await client.query(
      `UPDATE amp_consent_requests SET phase='replaced',recipient_ciphertext=NULL,purge_after=CASE WHEN completed_at IS NULL THEN expires_at ELSE now()+((notice->>'withdrawnEvidenceDays')::int * interval '1 day') END WHERE account_id=$1 AND phase IN ('awaiting-initial','awaiting-confirmation','active')`,
      [binding.accountId],
    );
    await client.query(
      `INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,$2,'monetary-transaction',$3) ON CONFLICT(account_id) DO UPDATE SET policy_version=$2,verification_method='monetary-transaction',evidence_reference=$3,recorded_at=now(),withdrawn_at=NULL`,
      [binding.accountId, row.notice.version, binding.id],
    );
  }
  if (status === "active" && !checkout.assigned_learner_id) {
    try {
      await assertFinancialIdentity(
        client,
        repository.namespace,
        payment.invoiceId,
      );
    } catch (error) {
      if (!(error instanceof BillingError)) throw error;
      status = "held";
    }
  }
  // Replays and renewals never re-consent, including after withdrawal or deletion.
  await client.query(
    `INSERT INTO amp_account_entitlements(namespace,invoice_id,checkout_id,payment,status,ends_at) VALUES($1,$2,$3,$4,$5,to_timestamp($6)) ON CONFLICT(namespace,invoice_id) DO UPDATE SET payment=$4,status=$5`,
    [
      repository.namespace,
      payment.invoiceId,
      binding.id,
      payment,
      status,
      payment.periodEnd,
    ],
  );
  if (checkout.assigned_learner_id) {
    const assigned = { ...binding, learnerId: checkout.assigned_learner_id };
    const events = annualEvents(repository.config, assigned, payment);
    for (const event of events) {
      if (event.type === "license.activated") {
        const replay = await client.query(
          "SELECT 1 FROM amp_commerce_events WHERE channel='stripe' AND channel_reference=$1 AND event_id=$2",
          [repository.namespace, event.id],
        );
        if (!replay.rowCount) {
          if (status !== "active") continue;
          await assertFinancialIdentity(
            client,
            repository.namespace,
            payment.invoiceId,
          );
          await repository.assertPurchaseAllowed(
            client,
            binding.accountId,
            checkout.assigned_learner_id,
          );
        }
      }
      await applyCommerceEventInTransaction(client, event);
    }
    if (status === "held") {
      const base = events[0]!;
      await applyCommerceEventInTransaction(client, {
        id: `${payment.invoiceId}:disputed`,
        channel: "stripe",
        channelReference: repository.namespace,
        orderId: base.orderId,
        occurredAt: new Date(payment.paidAt * 1000).toISOString(),
        type: "license.revoked",
        evidence: `stripe:disputed:${payment.chargeId}`,
      });
    }
  }
}

/** Ownership, consent, assignment and grant projection share one account transaction. */
export async function claimEnrollment(
  billing: StripeBilling,
  account: string,
  checkoutId: string,
  learnerId: string,
): Promise<void> {
  const repository = billing.repository;
  const binding = await repository.binding(checkoutId);
  if (binding.accountId !== account || binding.learnerId !== null)
    throw new BillingError("purchase_not_found", 404);
  await repository.transaction(account, async (client) => {
    await repository.assertPurchaseAllowed(client, account, learnerId);
    const checkout = (
      await client.query(
        "SELECT assigned_learner_id FROM amp_stripe_checkouts WHERE id=$1 FOR UPDATE",
        [checkoutId],
      )
    ).rows[0];
    // A fresh, independently verified current consent may authorize assignment
    // after withdrawal or policy replacement. Never reactivate the old snapshot.
    if (!(await learningConsentActive(client, account)))
      throw new BillingError("purchase_consent_required");
    if (checkout.assigned_learner_id) {
      if (checkout.assigned_learner_id !== learnerId)
        throw new BillingError("license_already_assigned");
      return;
    }
    const terms = (
      await client.query(
        "SELECT payment FROM amp_account_entitlements WHERE namespace=$1 AND checkout_id=$2 AND status='active' AND ends_at>now() ORDER BY invoice_id FOR UPDATE",
        [repository.namespace, checkoutId],
      )
    ).rows;
    if (!terms.length) throw new BillingError("paid_license_unavailable");
    const grants = await client.query(
      "SELECT 1 FROM amp_grants WHERE learner_id=$1 AND status='active' AND ends_at>now()",
      [learnerId],
    );
    if (grants.rowCount) throw new BillingError("learner_already_licensed");
    // Refresh under the same lock as settlement; a refund received before claim cannot grant access.
    for (const term of terms) {
      const stored = term.payment as AnnualPayment;
      await assertFinancialIdentity(
        client,
        repository.namespace,
        stored.invoiceId,
      );
      const payment = await billing.gateway.annualPayment(stored.invoiceId);
      annualEvents(repository.config, binding, payment);
      if (
        payment.fullRefundAt !== undefined ||
        payment.disputed ||
        payment.chargeId !== stored.chargeId ||
        payment.periodEnd !== stored.periodEnd
      )
        throw new BillingError("paid_license_requires_reconciliation");
      for (const event of annualEvents(
        repository.config,
        { ...binding, learnerId },
        payment,
      ))
        await applyCommerceEventInTransaction(client, event);
    }
    await client.query(
      "UPDATE amp_stripe_checkouts SET assigned_learner_id=$2 WHERE id=$1",
      [checkoutId, learnerId],
    );
  });
}
