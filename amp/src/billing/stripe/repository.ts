import { parseDocumentProfile } from "../evidence/profile.js";
import {
  learningConsentActive,
  parentAddressConfirmed,
} from "../../server/account-access.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  BillingError,
  extraPlanAvailable,
  planConfig,
  type BillingInterval,
  type PriceTier,
  stripeNamespace,
  type StripeBillingConfig,
} from "./config.js";
import type { CheckoutBinding } from "./model.js";
import { annualOffer } from "./purchase.js";
import { teachesFamilySeat } from "../../family/family-seat.js";
/** Who the purchase is for: the account's own learner, or a family-class seat. */
export type PurchaseFor = "own" | "seat";
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
    readonly consentPolicy:
      import("../../parent-consent/contracts.js").ConsentPolicy | null = null,
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
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
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
  /**
   * Whether this purchase needs no parental consent: the account's own adult
   * learner buys on the account's own terms (docs/families.md). Every other
   * learner needs the purchaser's consent.
   */
  async ownAdultLearner(
    client: Pick<PoolClient, "query">,
    accountId: string,
    learnerId: string,
  ): Promise<boolean> {
    return !!(
      await client.query(
        "SELECT 1 FROM amp_learners l WHERE l.id=$1 AND l.account_id=$2 AND l.deleted_at IS NULL AND COALESCE((to_jsonb(l)->>'adult')::boolean,false) AND NOT COALESCE((to_jsonb(l)->>'simulation')::boolean,false)",
        [learnerId, accountId],
      )
    ).rowCount;
  }
  /** The purchaser's parental consent, current for this policy. */
  async purchaseConsentActive(
    client: Pick<PoolClient, "query">,
    accountId: string,
  ): Promise<boolean> {
    const consent = await client.query(
      "SELECT 1 FROM amp_parent_consents WHERE account_id=$1 AND policy_version=$2 AND withdrawn_at IS NULL",
      [accountId, this.config.consentPolicyVersion],
    );
    return (
      !!consent.rowCount && (await learningConsentActive(client, accountId))
    );
  }
  /**
   * The purchaser's consent, and a learner they may buy for: one their account
   * owns, or a child enrolled in a family class they teach (a seat). An adult
   * buying for their own learner needs no parental consent.
   */
  async assertPurchaseAllowed(
    client: PoolClient,
    accountId: string,
    learnerId: string,
  ): Promise<PurchaseFor> {
    // A practice profile is never bought for: the account's access covers
    // it (docs/families.md), so it isn't a learner a purchase can name.
    const learner = await client.query(
      "SELECT account_id FROM amp_learners l WHERE id=$1 AND deleted_at IS NULL AND NOT COALESCE((to_jsonb(l)->>'simulation')::boolean,false) FOR SHARE",
      [learnerId],
    );
    if (
      !(
        learner.rows[0]?.account_id === accountId &&
        (await this.ownAdultLearner(client, accountId, learnerId))
      ) &&
      !(await this.purchaseConsentActive(client, accountId))
    )
      throw new BillingError("parent_consent_required", 403);
    if (learner.rows[0]?.account_id === accountId) return "own";
    if (
      learner.rowCount &&
      (await teachesFamilySeat(client, accountId, learnerId))
    )
      return "seat";
    throw new BillingError("learner_not_found", 404);
  }
  /**
   * The price a new checkout for this learner sells (docs/stripe.md#each-
   * additional-child). A family-class seat, or a child of an account that
   * already pays by card for another child (a live grant or an open
   * subscription), is an additional child. Funded, gift, pilot and adult
   * access never count. Without the environment's additional-child price,
   * every child is full price.
   */
  async priceTier(
    client: PoolClient,
    accountId: string,
    learnerId: string,
    interval: BillingInterval,
    purchaseFor: PurchaseFor,
  ): Promise<PriceTier> {
    if (!extraPlanAvailable(this.config, interval)) return "full";
    if (purchaseFor === "seat") return "extra";
    // Read through to_jsonb, as elsewhere here, so a schema from before
    // adult learners or purchase assignment still answers.
    const adult = "COALESCE((to_jsonb(l)->>'adult')::boolean,false)";
    const target = await client.query(
      `SELECT ${adult} AS adult FROM amp_learners l WHERE l.id=$1`,
      [learnerId],
    );
    if (target.rows[0]?.adult) return "full";
    const paid = await client.query(
      `SELECT 1 FROM amp_learners l
        WHERE l.account_id=$1 AND l.id<>$2 AND l.deleted_at IS NULL AND NOT ${adult}
          AND (EXISTS(SELECT 1 FROM amp_grants g WHERE g.learner_id=l.id AND g.channel='stripe'
                 AND g.status='active' AND g.ends_at>now())
            OR EXISTS(SELECT 1 FROM amp_stripe_checkouts c WHERE c.namespace=$3 AND c.account_id=$1
                 AND COALESCE(c.learner_id,to_jsonb(c)->>'assigned_learner_id')=l.id
                 AND c.subscription_id IS NOT NULL AND NOT c.closed))
        LIMIT 1`,
      [accountId, learnerId, this.namespace],
    );
    return paid.rowCount ? "extra" : "full";
  }
  /** Shared checkout blockers, batched for Family and rechecked under billing locks. */
  async checkoutBlockers(
    db: Pick<PoolClient, "query">,
    accountId: string,
    ids: string[],
  ) {
    const table = (
      await db.query(
        "SELECT to_regclass('amp_account_entitlements') AS relation",
      )
    ).rows[0].relation;
    const unassigned =
      table &&
      !!(
        await db.query(
          `SELECT 1 FROM amp_account_entitlements e JOIN amp_stripe_checkouts c ON c.id=e.checkout_id
       WHERE c.account_id=$1 AND e.namespace=$2 AND c.learner_id IS NULL AND c.assigned_learner_id IS NULL
         AND e.status='active' AND e.ends_at>now() LIMIT 1`,
          [accountId, this.namespace],
        )
      ).rowCount;
    const licensed = new Set(
      (
        await db.query<{ id: string }>(
          `SELECT l.id FROM unnest($1::text[]) l(id) WHERE EXISTS(SELECT 1 FROM amp_grants g
       WHERE g.learner_id=l.id AND g.status='active' AND g.ends_at>now())`,
          [ids],
        )
      ).rows.map((row) => row.id),
    );
    return new Map(
      ids.map((id) => [
        id,
        licensed.has(id)
          ? "learner_already_licensed"
          : unassigned
            ? "license_ready_for_assignment"
            : null,
      ]),
    );
  }
  /** Whether a new annual checkout can be reserved for an owned child.
   * Submission still rechecks consent and blockers in the account transaction. */
  async ownedCheckoutEligibility(
    db: Pick<PoolClient, "query">,
    accountId: string,
    ids: string[],
  ) {
    if (
      !(await parentAddressConfirmed(db, accountId)) ||
      !(await this.purchaseConsentActive(db, accountId))
    )
      return new Set<string>();
    const owned = (
      await db.query<{ id: string }>(
        `SELECT id FROM amp_learners WHERE account_id=$1 AND id=ANY($2::text[])
       AND deleted_at IS NULL AND NOT adult AND NOT simulation`,
        [accountId, ids],
      )
    ).rows.map((row) => row.id);
    const blockers = await this.checkoutBlockers(db, accountId, owned);
    return new Set(owned.filter((id) => !blockers.get(id)));
  }
  async reserve(
    accountId: string,
    learnerId: string,
    requestId: string,
    interval: BillingInterval = "year",
    /** The offer the parent saw; refused when this checkout sells another. */
    offerId?: string,
  ): Promise<string> {
    // An existing checkout keeps the price it was reserved at.
    const offered = (tier: PriceTier) => {
      if (offerId && offerId !== annualOffer(this.config, interval, tier).id)
        throw new BillingError("offer_changed");
    };
    return this.transaction(accountId, async (client) => {
      const purchaseFor = await this.assertPurchaseAllowed(
        client,
        accountId,
        learnerId,
      );
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,1))",
        [`${this.namespace}:${learnerId}`],
      );
      const blocker = (
        await this.checkoutBlockers(client, accountId, [learnerId])
      ).get(learnerId);
      if (blocker) throw new BillingError(blocker);
      const retry = await client.query(
        "SELECT id,learner_id,closed,billing_interval,price_tier FROM amp_stripe_checkouts WHERE namespace=$1 AND account_id=$2 AND request_id=$3",
        [this.namespace, accountId, requestId],
      );
      if (retry.rowCount) {
        if (
          retry.rows[0].learner_id !== learnerId ||
          retry.rows[0].closed ||
          retry.rows[0].billing_interval !== interval
        )
          throw new BillingError("checkout_request_conflict");
        offered(retry.rows[0].price_tier);
        return retry.rows[0].id as string;
      }
      const open = await client.query(
        "SELECT id,billing_interval,price_tier FROM amp_stripe_checkouts WHERE namespace=$1 AND (learner_id=$2 OR to_jsonb(amp_stripe_checkouts)->>'assigned_learner_id'=$2) AND NOT closed",
        [this.namespace, learnerId],
      );
      if (open.rowCount) {
        if (open.rows[0].billing_interval !== interval)
          throw new BillingError("checkout_plan_conflict");
        offered(open.rows[0].price_tier);
        return open.rows[0].id as string;
      }
      const tier = await this.priceTier(
        client,
        accountId,
        learnerId,
        interval,
        purchaseFor,
      );
      offered(tier);
      const selected = planConfig(this.config, interval, tier);
      await client.query(
        "INSERT INTO amp_stripe_customers(namespace,account_id,reservation_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [this.namespace, accountId, randomUUID()],
      );
      const checkoutId = randomUUID();
      await client.query(
        "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id,document_profile,billing_interval,price_tier) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
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
          tier,
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
      assignedLearnerId: r.assigned_learner_id ?? undefined,
      customerId: r.customer_id,
      subscriptionId: r.subscription_id ?? undefined,
      sessionId: r.session_id ?? undefined,
      createdAt: r.created_at,
      interval: r.billing_interval,
      tier: r.price_tier ?? "full",
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
