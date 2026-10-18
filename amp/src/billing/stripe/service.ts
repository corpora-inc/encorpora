import {
  recordFinancialEvidence,
  holdFinancialRecord,
} from "../evidence/repository.js";
import type { Pool } from "pg";
import { applyCommerceEventInTransaction } from "../../commerce/postgres.js";
import { recordSubscriptionEvent } from "./subscriptions.js";
import { annualEvents } from "./model.js";
import { BillingError, planConfig, type BillingInterval } from "./config.js";
import { StripeGateway } from "./gateway.js";
import { StripeRepository, type InboxEvent } from "./repository.js";
export class StripeBilling {
  private static runningPools = new WeakSet<Pool>();
  constructor(
    readonly repository: StripeRepository,
    readonly gateway: StripeGateway,
  ) {}
  async checkout(
    accountId: string,
    learnerId: string,
    requestId: string,
    interval: BillingInterval = "year",
  ): Promise<{ url: string }> {
    let checkoutId: string;
    try {
      checkoutId = await this.repository.reserve(
        accountId,
        learnerId,
        requestId,
        interval,
      );
    } catch (error) {
      if (
        !(error instanceof BillingError) ||
        error.code !== "checkout_plan_conflict"
      )
        throw error;
      // Only provider-confirmed expiry permits replacing another plan's checkout.
      await this.repository.transaction(accountId, async (client) => {
        await this.repository.assertPurchaseAllowed(
          client,
          accountId,
          learnerId,
        );
        const open = await client.query(
          "SELECT id,session_id FROM amp_stripe_checkouts WHERE namespace=$1 AND learner_id=$2 AND account_id=$3 AND NOT closed FOR UPDATE",
          [this.repository.namespace, learnerId, accountId],
        );
        const row = open.rows[0];
        if (row) {
          if (
            !row.session_id ||
            (await this.gateway.checkoutStatus(row.session_id)).status !==
              "expired"
          )
            throw error;
          await client.query(
            "UPDATE amp_stripe_checkouts SET closed=true WHERE id=$1",
            [row.id],
          );
        }
      });
      checkoutId = await this.repository.reserve(
        accountId,
        learnerId,
        requestId,
        interval,
      );
    }
    await this.gateway.verifyCatalog();
    const result = await this.repository.transaction<
      { url: string } | { expired: true }
    >(accountId, async (client) => {
      await this.repository.assertPurchaseAllowed(client, accountId, learnerId);
      const grants = await client.query(
        "SELECT 1 FROM amp_grants WHERE learner_id=$1 AND status='active' AND ends_at>now() LIMIT 1",
        [learnerId],
      );
      if (grants.rowCount) throw new BillingError("learner_already_licensed");
      const result = await client.query(
        "SELECT * FROM amp_stripe_checkouts WHERE id=$1 AND account_id=$2 FOR UPDATE",
        [checkoutId, accountId],
      );
      const row = result.rows[0];
      if (!row || row.closed) throw new BillingError("checkout_unavailable");
      if (row.session_id) {
        const session = await this.gateway.checkoutStatus(row.session_id);
        if (session.status === "open" && session.url)
          return { url: session.url };
        if (session.status === "complete")
          throw new BillingError("subscription_already_started");
        if (session.status === "expired") {
          await client.query(
            "UPDATE amp_stripe_checkouts SET closed=true WHERE id=$1",
            [checkoutId],
          );
          return { expired: true };
        }
        throw new BillingError("checkout_requires_reconciliation");
      }
      if (Date.now() - row.created_at.getTime() > 23 * 3600_000)
        throw new BillingError("checkout_requires_reconciliation");
      const customers = await client.query(
        "SELECT * FROM amp_stripe_customers WHERE namespace=$1 AND account_id=$2 FOR UPDATE",
        [this.repository.namespace, accountId],
      );
      const customer = customers.rows[0];
      if (!customer) throw new BillingError("customer_reservation_missing");
      if (
        !customer.customer_id &&
        Date.now() - customer.created_at.getTime() > 23 * 3600_000
      )
        throw new BillingError("customer_requires_reconciliation");
      const customerId =
        customer.customer_id ??
        (await this.gateway.createCustomer(customer.reservation_id));
      await client.query(
        "UPDATE amp_stripe_customers SET customer_id=$3 WHERE namespace=$1 AND account_id=$2",
        [this.repository.namespace, accountId, customerId],
      );
      const session = await this.gateway.createCheckout(
        checkoutId,
        customerId,
        row.billing_interval,
      );
      await client.query(
        "UPDATE amp_stripe_checkouts SET customer_id=$2,session_id=$3,session_url=$4 WHERE id=$1",
        [checkoutId, customerId, session.id, session.url],
      );
      return { url: session.url };
    });
    if ("expired" in result)
      throw new BillingError("checkout_expired_retry_with_new_request");
    return result;
  }
  async portal(accountId: string): Promise<{ url: string }> {
    await this.gateway.verifyPortal();
    const result = await this.repository.pool.query(
      "SELECT customer_id FROM amp_stripe_customers WHERE namespace=$1 AND account_id=$2",
      [this.repository.namespace, accountId],
    );
    const customerId = result.rows[0]?.customer_id;
    if (!customerId) throw new BillingError("billing_account_not_found", 404);
    return { url: await this.gateway.portal(customerId) };
  }
  private async process(event: InboxEvent): Promise<void> {
    if (
      [
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ].includes(event.type)
    ) {
      await recordSubscriptionEvent(this.repository, this.gateway, event);
      return;
    }
    let invoiceId: string;
    if (event.type === "invoice.paid") invoiceId = event.objectId;
    else if (event.type === "charge.refunded")
      invoiceId = await this.gateway.invoiceFromCharge(event.objectId);
    else if (
      ["refund.created", "refund.updated", "refund.failed"].includes(event.type)
    )
      invoiceId = await this.gateway.invoiceFromRefund(event.objectId);
    else if (
      [
        "credit_note.created",
        "credit_note.updated",
        "credit_note.voided",
      ].includes(event.type)
    )
      invoiceId = await this.gateway.invoiceFromCreditNote(event.objectId);
    else return;
    await this.gateway.verifyMerchant();
    if (event.type.startsWith("credit_note."))
      await holdFinancialRecord(
        this.repository,
        invoiceId,
        event.eventId,
        event.objectId,
      );
    let payment = await this.gateway.annualPayment(invoiceId);
    if (payment.refunded && !Number.isSafeInteger(payment.fullRefundAt))
      throw new BillingError("refund_timestamp_missing");
    const binding = await this.repository.binding(payment.checkoutId);
    if (!binding.sessionId) throw new BillingError("checkout_session_missing");
    const session = await this.gateway.checkoutStatus(binding.sessionId);
    if (
      session.status !== "complete" ||
      session.subscriptionId !== payment.subscriptionId
    )
      throw new BillingError("checkout_subscription_mismatch");
    let projectionError: unknown;
    await this.repository.transaction(binding.accountId, async (client) => {
      // Serializes invoice deliveries across workers, including refund-before-payment ordering.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,2))",
        [`${this.repository.namespace}:${invoiceId}`],
      );
      // Re-fetch under the invoice lock: an earlier lookup is only for finding ownership.
      payment = await this.gateway.annualPayment(invoiceId);
      if (
        payment.checkoutId !== binding.id ||
        payment.customerId !== binding.customerId ||
        payment.subscriptionId !== session.subscriptionId
      )
        throw new BillingError("payment_binding_changed");
      // Validate annual mapping before retaining financial facts.
      annualEvents(this.gateway.config, binding, payment);
      const row = await client.query(
        "SELECT subscription_id FROM amp_stripe_checkouts WHERE id=$1 FOR UPDATE",
        [binding.id],
      );
      if (
        row.rows[0]?.subscription_id &&
        row.rows[0].subscription_id !== payment.subscriptionId
      )
        throw new BillingError("subscription_binding_collision");
      await client.query(
        "UPDATE amp_stripe_checkouts SET subscription_id=$2 WHERE id=$1",
        [binding.id, payment.subscriptionId],
      );
      await client.query(
        `INSERT INTO amp_stripe_invoice_evidence(namespace,invoice_id,full_refund_at,partial_refund) VALUES($1,$2,$3,$4)
        ON CONFLICT(namespace,invoice_id) DO UPDATE SET full_refund_at=COALESCE(amp_stripe_invoice_evidence.full_refund_at,EXCLUDED.full_refund_at),partial_refund=EXCLUDED.partial_refund`,
        [
          this.repository.namespace,
          invoiceId,
          payment.refunded ? payment.fullRefundAt : null,
          payment.partialRefund,
        ],
      );
      const evidence = await client.query(
        "SELECT full_refund_at FROM amp_stripe_invoice_evidence WHERE namespace=$1 AND invoice_id=$2",
        [this.repository.namespace, invoiceId],
      );
      const refundAt = evidence.rows[0].full_refund_at;
      if (refundAt !== null) payment.fullRefundAt = Number(refundAt);
      await recordFinancialEvidence(
        client,
        this.repository.namespace,
        binding,
        payment,
        payment.financial,
        event.eventId,
        planConfig(this.gateway.config, binding.interval).documentProfile,
      );
      await client.query("SAVEPOINT access_projection");
      try {
        for (const commerceEvent of annualEvents(
          this.gateway.config,
          binding,
          payment,
        )) {
          if (commerceEvent.type === "license.activated") {
            const replay = await client.query(
              "SELECT 1 FROM amp_commerce_events WHERE channel='stripe' AND channel_reference=$1 AND event_id=$2",
              [this.repository.namespace, commerceEvent.id],
            );
            if (!replay.rowCount) {
              const collision = await client.query(
                "SELECT 1 FROM amp_payment_records r JOIN amp_payment_observations o ON o.record_id=r.id WHERE r.namespace=$1 AND r.invoice_id=$2 AND o.observation->>'kind'='review' AND o.observation->>'reason' IN ('financial_charge_collision','financial_baseline_collision','financial_refund_history_collision') LIMIT 1",
                [this.repository.namespace, payment.invoiceId],
              );
              if (collision.rowCount)
                throw new BillingError(
                  "payment_identity_requires_reconciliation",
                );
            }
            if (!replay.rowCount)
              await this.repository.assertPurchaseAllowed(
                client,
                binding.accountId,
                binding.learnerId,
              );
          }
          await applyCommerceEventInTransaction(client, commerceEvent);
        }
        await client.query("RELEASE SAVEPOINT access_projection");
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT access_projection");
        projectionError = error;
      }
    });
    if (projectionError) throw projectionError;
  }
  /** One bounded pass. Durable failures retain only a safe category, never API bodies. */
  async runBatch(limit = 20): Promise<{ processed: number; failed: number }> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error("Worker batch limit must be 1..100");
    if ((this.repository.pool.options.max ?? 10) < 2)
      throw new Error("Stripe worker requires at least two pool connections");
    if (StripeBilling.runningPools.has(this.repository.pool))
      throw new Error("Only one Stripe worker pass may use a pool at a time");
    StripeBilling.runningPools.add(this.repository.pool);
    try {
      let processed = 0,
        failed = 0;
      for (let index = 0; index < limit; index++) {
        const event = await this.repository.claim();
        if (!event) break;
        try {
          await this.process(event);
          await this.repository.finish(event);
          processed++;
        } catch (error) {
          await this.repository.finish(
            event,
            error instanceof BillingError ? error.code : "processing_failed",
          );
          failed++;
        }
      }
      return { processed, failed };
    } finally {
      StripeBilling.runningPools.delete(this.repository.pool);
    }
  }
}
