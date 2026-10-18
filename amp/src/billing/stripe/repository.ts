import { parseDocumentProfile } from "../evidence/profile.js";
import { learningConsentActive } from "../../server/account-access.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  BillingError,
  planConfig,
  type BillingInterval,
  stripeNamespace,
  type StripeBillingConfig,
} from "./config.js";
import type { CheckoutBinding } from "./model.js";
export interface InboxEvent {
  eventId: string;
  type: string;
  objectId: string;
  created: number;
  hash: string;
  leaseId?: string;
  attempts?: number;
}
export class StripeRepository {
  readonly namespace: string;
  constructor(
    readonly pool: Pool,
    readonly config: StripeBillingConfig,
  ) {
    this.namespace = stripeNamespace(config);
  }
  async transaction<T>(
    accountId: string,
    action: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL statement_timeout='15s'");
      await client.query(
        "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",
        [accountId],
      );
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async assertPurchaseAllowed(
    client: PoolClient,
    accountId: string,
    learnerId: string,
  ): Promise<void> {
    const consent = await client.query(
      "SELECT 1 FROM amp_parent_consents WHERE account_id=$1 AND policy_version=$2 AND withdrawn_at IS NULL",
      [accountId, this.config.consentPolicyVersion],
    );
    if (!consent.rowCount || !(await learningConsentActive(client, accountId)))
      throw new BillingError("parent_consent_required", 403);
    const learner = await client.query(
      "SELECT 1 FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR SHARE",
      [learnerId, accountId],
    );
    if (!learner.rowCount) throw new BillingError("learner_not_found", 404);
  }
  async reserve(
    accountId: string,
    learnerId: string,
    requestId: string,
    interval: BillingInterval = "year",
  ): Promise<string> {
    const selected = planConfig(this.config, interval);
    return this.transaction(accountId, async (client) => {
      await this.assertPurchaseAllowed(client, accountId, learnerId);
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,1))",
        [`${this.namespace}:${learnerId}`],
      );
      const grants = await client.query(
        "SELECT 1 FROM amp_grants WHERE learner_id=$1 AND status='active' AND ends_at>now() LIMIT 1",
        [learnerId],
      );
      if (grants.rowCount) throw new BillingError("learner_already_licensed");
      const retry = await client.query(
        "SELECT id,learner_id,closed,billing_interval FROM amp_stripe_checkouts WHERE namespace=$1 AND account_id=$2 AND request_id=$3",
        [this.namespace, accountId, requestId],
      );
      if (retry.rowCount) {
        if (
          retry.rows[0].learner_id !== learnerId ||
          retry.rows[0].closed ||
          retry.rows[0].billing_interval !== interval
        )
          throw new BillingError("checkout_request_conflict");
        return retry.rows[0].id as string;
      }
      const open = await client.query(
        "SELECT id,billing_interval FROM amp_stripe_checkouts WHERE namespace=$1 AND learner_id=$2 AND NOT closed",
        [this.namespace, learnerId],
      );
      if (open.rowCount) {
        if (open.rows[0].billing_interval !== interval)
          throw new BillingError("checkout_plan_conflict");
        return open.rows[0].id as string;
      }
      await client.query(
        "INSERT INTO amp_stripe_customers(namespace,account_id,reservation_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [this.namespace, accountId, randomUUID()],
      );
      const checkoutId = randomUUID();
      await client.query(
        "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id,document_profile,billing_interval) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          checkoutId,
          this.namespace,
          accountId,
          learnerId,
          requestId,
          selected.documentProfile
            ? JSON.stringify(
                parseDocumentProfile(selected.documentProfile, selected),
              )
            : null,
          interval,
        ],
      );
      return checkoutId;
    });
  }
  async binding(checkoutId: string): Promise<CheckoutBinding> {
    const result = await this.pool.query(
      "SELECT * FROM amp_stripe_checkouts WHERE namespace=$1 AND id=$2",
      [this.namespace, checkoutId],
    );
    if (!result.rowCount || !result.rows[0].customer_id)
      throw new BillingError("unknown_checkout_binding");
    const r = result.rows[0];
    return {
      id: r.id,
      accountId: r.account_id,
      learnerId: r.learner_id,
      customerId: r.customer_id,
      subscriptionId: r.subscription_id ?? undefined,
      sessionId: r.session_id ?? undefined,
      createdAt: r.created_at,
      interval: r.billing_interval,
    };
  }
  async enqueue(event: InboxEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO amp_stripe_inbox(namespace,event_id,event_type,object_id,event_created,payload_hash)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [
        this.namespace,
        event.eventId,
        event.type,
        event.objectId,
        event.created,
        event.hash,
      ],
    );
    const old = await this.pool.query(
      "SELECT payload_hash FROM amp_stripe_inbox WHERE namespace=$1 AND event_id=$2",
      [this.namespace, event.eventId],
    );
    if (old.rows[0]?.payload_hash !== event.hash)
      throw new BillingError("webhook_identity_conflict");
  }
  async claim(): Promise<InboxEvent | undefined> {
    const leaseId = randomUUID();
    const result = await this.pool.query(
      `UPDATE amp_stripe_inbox SET status='processing',lease_id=$2,attempts=attempts+1,available_at=now()+interval '5 minutes'
      WHERE (namespace,event_id) IN (SELECT namespace,event_id FROM amp_stripe_inbox WHERE namespace=$1 AND status IN ('pending','processing')
      AND available_at<=now() ORDER BY available_at,event_id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
      [this.namespace, leaseId],
    );
    const row = result.rows[0];
    return row
      ? {
          eventId: row.event_id,
          type: row.event_type,
          objectId: row.object_id,
          created: Number(row.event_created),
          hash: row.payload_hash,
          leaseId,
          attempts: row.attempts,
        }
      : undefined;
  }
  async finish(event: InboxEvent, errorCode?: string): Promise<void> {
    const review = (event.attempts ?? 0) >= 10;
    await this.pool.query(
      `UPDATE amp_stripe_inbox SET status=$4,error_code=$5,lease_id=NULL,
      available_at=now()+($6 * interval '1 second') WHERE namespace=$1 AND event_id=$2 AND lease_id=$3`,
      [
        this.namespace,
        event.eventId,
        event.leaseId,
        errorCode ? (review ? "review" : "pending") : "done",
        errorCode ?? null,
        Math.min(3600, 30 * 2 ** Math.min(event.attempts ?? 0, 7)),
      ],
    );
  }
}
