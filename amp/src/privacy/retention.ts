import type { Pool, PoolClient } from "pg";
import { FamilyRepository } from "../family/repository.js";
import { RETENTION, RETENTION_BATCH } from "./retention-periods.js";

/*
 * Time-based retention limits. Every purge takes an explicit clock, works in
 * bounded batches and returns counts only; a repeated run deletes nothing new.
 * Learner, order, checkout and tombstone deletions re-check eligibility under
 * the account lock. Trial and unreferenced financial rows are deleted by age.
 */

const validClock = (at: Date): string => {
  if (!Number.isFinite(at.getTime()))
    throw new Error("Invalid retention clock");
  return at.toISOString();
};

/** Latest practice by learner `l`, or purchase activity or licence end for
 * their family. A family that is buying again keeps its learners. */
const LEARNER_LAST_ACTIVE = `greatest(l.created_at,
  (SELECT max(i.created_at) FROM amp_instances i WHERE i.learner_id=l.id),
  (SELECT max(a.created_at) FROM amp_attempts a WHERE a.learner_id=l.id),
  (SELECT max(greatest(p.issued_at,
     (SELECT max(o.received_at) FROM amp_offline_attempts o WHERE o.pack_id=p.id)))
   FROM amp_offline_packs p WHERE p.learner_id=l.id),
  (SELECT max(g.ends_at) FROM amp_grants g JOIN amp_learners f ON f.id=g.learner_id
   WHERE f.account_id=l.account_id),
  (SELECT max(e.ends_at) FROM amp_account_entitlements e
   JOIN amp_stripe_checkouts c ON c.id=e.checkout_id WHERE c.account_id=l.account_id),
  (SELECT max(s.period_end) FROM amp_stripe_subscription_events s
   JOIN amp_stripe_checkouts c ON c.id=s.checkout_id WHERE c.account_id=l.account_id),
  (SELECT max(greatest(o.updated_at,(o.order_state->'license'->>'endsAt')::timestamptz))
   FROM amp_commerce_orders o WHERE o.account_id=l.account_id),
  (SELECT max(f.created_at) FROM amp_funding_requests f WHERE f.account_id=l.account_id),
  (SELECT max(c.created_at) FROM amp_stripe_checkouts c WHERE c.account_id=l.account_id),
  (SELECT max(r.created_at) FROM amp_payment_records r WHERE r.account_id=l.account_id))`;
const LEARNER_EXPIRED = `l.deleted_at IS NULL AND l.account_id NOT LIKE 'trial:%'
  AND ${LEARNER_LAST_ACTIVE} <= $1::timestamptz - make_interval(months=>$2)`;

async function inAccount<T>(
  pool: Pool,
  accountId: string,
  action: (client: PoolClient) => Promise<T>,
  financial = false,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    if (financial)
      await client.query("SET LOCAL amp.retention_purge='financial'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      accountId,
    ]);
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

/** Candidate scans run with a bounded statement time. */
async function scan<T>(
  pool: Pool,
  sql: string,
  values: unknown[],
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout='120s'");
    const rows = (await client.query(sql, values)).rows as T[];
    await client.query("COMMIT");
    return rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** A busy account or a write racing the purge skips that unit until the next run. */
const RETRY_NEXT_RUN = new Set(["55P03", "40P01", "40001", "23503"]);

/** Keyset batches over candidates; returns how many units were removed. */
async function eachBatch(
  select: (
    after: string,
    limit: number,
  ) => Promise<{ key: string; account: string }[]>,
  remove: (row: { key: string; account: string }) => Promise<boolean>,
): Promise<number> {
  let after = "",
    removed = 0;
  for (let batch = 0; batch < RETENTION_BATCH.maxBatches; batch++) {
    const rows = await select(after, RETENTION_BATCH.batchSize);
    for (const row of rows)
      try {
        if (await remove(row)) removed++;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (!code || !RETRY_NEXT_RUN.has(code)) throw error;
        console.error(JSON.stringify({ retentionUnitSkipped: code }));
      }
    if (rows.length < RETENTION_BATCH.batchSize) break;
    after = rows[rows.length - 1]!.key;
  }
  return removed;
}

/**
 * Deletes a learner's profile and learning records 24 months after the later
 * of their last practice activity and the end of the family's latest licence.
 * Uses the parent deletion path: financially linked learners keep only an
 * opaque "Deleted learner" reference, which financial retention later removes.
 */
export async function purgeInactiveLearners(
  pool: Pool,
  at = new Date(),
): Promise<{ expiredLearners: number }> {
  const clock = validClock(at);
  const months = RETENTION.learnerInactivityMonths;
  const family = new FamilyRepository(pool);
  const expiredLearners = await eachBatch(
    async (after, limit) =>
      scan(
        pool,
        `SELECT l.id AS key,l.account_id AS account FROM amp_learners l
        WHERE ${LEARNER_EXPIRED} AND l.id>$3 ORDER BY l.id LIMIT $4`,
        [clock, months, after, limit],
      ),
    ({ key, account }) =>
      inAccount(pool, account, async (client) => {
        await client.query(
          "SELECT 1 FROM amp_learners WHERE id=$1 AND account_id=$2 FOR UPDATE",
          [key, account],
        );
        const still = await client.query(
          `SELECT 1 FROM amp_learners l WHERE l.id=$3 AND l.account_id=$4 AND ${LEARNER_EXPIRED}`,
          [clock, months, key, account],
        );
        if (!still.rowCount) return false;
        await family.deleteLearningInside(
          client,
          account,
          key,
          "learner.retention-deleted",
        );
        return true;
      }),
  );
  return { expiredLearners };
}

/**
 * Deletes trial milestone events and trial records 90 days after creation.
 * An unsaved trial's learner and answers go with it; a saved trial's learner
 * now belongs to the family and follows learner retention.
 */
export async function purgeTrialRecords(
  pool: Pool,
  at = new Date(),
): Promise<{ expiredTrialEvents: number; expiredTrialRecords: number }> {
  const clock = validClock(at);
  const days = RETENTION.trialRecordDays;
  let expiredTrialEvents = 0,
    expiredTrialRecords = 0;
  for (let batch = 0; batch < RETENTION_BATCH.maxBatches; batch++) {
    const events = await pool.query(
      `DELETE FROM amp_trial_events WHERE ctid=ANY(ARRAY(SELECT ctid FROM amp_trial_events
      WHERE occurred_at<=$1::timestamptz-make_interval(days=>$2) LIMIT $3))`,
      [clock, days, RETENTION_BATCH.batchSize],
    );
    expiredTrialEvents += events.rowCount ?? 0;
    if ((events.rowCount ?? 0) < RETENTION_BATCH.batchSize) break;
  }
  for (let batch = 0; batch < RETENTION_BATCH.maxBatches; batch++) {
    const trials = await pool.query(
      `WITH gone AS (
         DELETE FROM amp_trials WHERE id IN (SELECT id FROM amp_trials
           WHERE created_at<=$1::timestamptz-make_interval(days=>$2) ORDER BY created_at LIMIT $3)
         RETURNING id,learner_id
       ), learners AS (
         DELETE FROM amp_learners l USING gone
         WHERE l.id=gone.learner_id AND l.account_id='trial:'||gone.id RETURNING l.id
       ) SELECT (SELECT count(*) FROM gone)::int AS trials`,
      [clock, days, RETENTION_BATCH.batchSize],
    );
    const removed = trials.rows[0].trials as number;
    expiredTrialRecords += removed;
    if (removed < RETENTION_BATCH.batchSize) break;
  }
  return { expiredTrialEvents, expiredTrialRecords };
}

/** Latest transaction or licence end for commerce order `o`. */
const ORDER_LAST = `greatest(o.updated_at,
  (o.order_state->'license'->>'endsAt')::timestamptz,
  (o.grant_state->>'endsAt')::timestamptz,
  (SELECT max(e.recorded_at) FROM amp_commerce_events e WHERE e.order_id=o.id),
  (SELECT max(g.ends_at) FROM amp_grants g WHERE g.id='commerce:'||(o.grant_state->>'id')),
  (SELECT max(f.created_at) FROM amp_funding_requests f WHERE f.order_id=o.id))`;
/** Latest payment, refund, subscription or entitlement time for checkout `c`. */
const CHECKOUT_LAST = `greatest(c.created_at,
  (SELECT max(greatest(r.created_at,r.observed_at,
     (SELECT max(ob.observed_at) FROM amp_payment_observations ob WHERE ob.record_id=r.id),
     (SELECT max(h.observed_at) FROM amp_payment_holds h WHERE h.namespace=r.namespace AND h.invoice_id=r.invoice_id),
     (SELECT max(v.recorded_at) FROM amp_stripe_invoice_evidence v WHERE v.namespace=r.namespace AND v.invoice_id=r.invoice_id)))
   FROM amp_payment_records r WHERE r.checkout_id=c.id),
  (SELECT max(e.ends_at) FROM amp_account_entitlements e WHERE e.checkout_id=c.id),
  (SELECT max(greatest(s.observed_at,s.period_end)) FROM amp_stripe_subscription_events s WHERE s.checkout_id=c.id),
  (SELECT max(greatest(x.requested_at,x.completed_at)) FROM amp_enrollment_cancellations x WHERE x.checkout_id=c.id))`;
const CUTOFF = "$1::timestamptz-make_interval(years=>$2)";
const UNREFERENCED_TOMBSTONE = `l.deleted_at IS NOT NULL
  AND NOT EXISTS(SELECT 1 FROM amp_commerce_orders o WHERE o.learner_id=l.id)
  AND NOT EXISTS(SELECT 1 FROM amp_grants g WHERE g.learner_id=l.id)
  AND NOT EXISTS(SELECT 1 FROM amp_stripe_checkouts c WHERE c.learner_id=l.id OR c.assigned_learner_id=l.id)
  AND NOT EXISTS(SELECT 1 FROM amp_payment_records r WHERE r.learner_id=l.id)`;

/**
 * Deletes orders, payments, refunds, licences, entitlements and the opaque
 * learner references in them 7 years after the later of the last transaction
 * and the end of the licence period bought. A checkout whose purchase consent
 * record still exists follows the consent-evidence lifecycle first.
 */
export async function purgeFinancialRecords(
  pool: Pool,
  at = new Date(),
): Promise<{
  expiredOrders: number;
  expiredCheckouts: number;
  expiredFinancialRecords: number;
  expiredLearnerReferences: number;
}> {
  const clock = validClock(at);
  const years = RETENTION.financialRecordYears;
  const expiredOrders = await eachBatch(
    async (after, limit) =>
      scan(
        pool,
        `SELECT o.id AS key,o.account_id AS account FROM amp_commerce_orders o
        WHERE ${ORDER_LAST}<=${CUTOFF} AND o.id>$3 ORDER BY o.id LIMIT $4`,
        [clock, years, after, limit],
      ),
    ({ key, account }) =>
      inAccount(
        pool,
        account,
        async (client) => {
          const still = await client.query(
            `SELECT o.grant_state->>'id' AS grant FROM amp_commerce_orders o
            WHERE o.id=$3 AND ${ORDER_LAST}<=${CUTOFF} FOR UPDATE`,
            [clock, years, key],
          );
          if (!still.rowCount) return false;
          await client.query(
            "DELETE FROM amp_commerce_events WHERE order_id=$1",
            [key],
          );
          await client.query(
            "DELETE FROM amp_funding_requests WHERE order_id=$1",
            [key],
          );
          if (still.rows[0].grant)
            await client.query("DELETE FROM amp_grants WHERE id=$1", [
              `commerce:${still.rows[0].grant}`,
            ]);
          await client.query("DELETE FROM amp_commerce_orders WHERE id=$1", [
            key,
          ]);
          return true;
        },
        true,
      ),
  );
  const expiredCheckouts = await eachBatch(
    async (after, limit) =>
      scan(
        pool,
        `SELECT c.id::text AS key,c.account_id AS account FROM amp_stripe_checkouts c
        WHERE ${CHECKOUT_LAST}<=${CUTOFF} AND c.id::text>$3
        AND NOT EXISTS(SELECT 1 FROM amp_purchase_consents pc WHERE pc.checkout_id=c.id)
        ORDER BY c.id::text LIMIT $4`,
        [clock, years, after, limit],
      ),
    ({ key, account }) =>
      inAccount(
        pool,
        account,
        async (client) => {
          const still = await client.query(
            `SELECT 1 FROM amp_stripe_checkouts c WHERE c.id=$3::uuid AND ${CHECKOUT_LAST}<=${CUTOFF}
            AND NOT EXISTS(SELECT 1 FROM amp_purchase_consents pc WHERE pc.checkout_id=c.id) FOR UPDATE`,
            [clock, years, key],
          );
          if (!still.rowCount) return false;
          const invoices = `SELECT namespace,invoice_id FROM amp_payment_records WHERE checkout_id=$1
            UNION SELECT namespace,invoice_id FROM amp_account_entitlements WHERE checkout_id=$1`;
          await client.query(
            `DELETE FROM amp_payment_holds WHERE (namespace,invoice_id) IN (${invoices})`,
            [key],
          );
          await client.query(
            `DELETE FROM amp_stripe_invoice_evidence WHERE (namespace,invoice_id) IN (${invoices})`,
            [key],
          );
          await client.query(
            "DELETE FROM amp_payment_observations WHERE record_id IN (SELECT id FROM amp_payment_records WHERE checkout_id=$1)",
            [key],
          );
          for (const table of [
            "amp_payment_records",
            "amp_account_entitlements",
            "amp_stripe_subscription_events",
            "amp_enrollment_cancellations",
          ])
            await client.query(`DELETE FROM ${table} WHERE checkout_id=$1`, [
              key,
            ]);
          await client.query("DELETE FROM amp_stripe_checkouts WHERE id=$1", [
            key,
          ]);
          return true;
        },
        true,
      ),
  );
  // Records with no remaining parent age out on their own timestamps.
  const client = await pool.connect();
  let expiredFinancialRecords = 0;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query("SET LOCAL amp.retention_purge='financial'");
    const limit = RETENTION_BATCH.batchSize * RETENTION_BATCH.maxBatches;
    for (const sql of [
      `DELETE FROM amp_payment_holds h WHERE ctid=ANY(ARRAY(SELECT ctid FROM amp_payment_holds h WHERE h.observed_at<=${CUTOFF}
        AND NOT EXISTS(SELECT 1 FROM amp_payment_records r WHERE r.namespace=h.namespace AND r.invoice_id=h.invoice_id)
        AND NOT EXISTS(SELECT 1 FROM amp_account_entitlements e WHERE e.namespace=h.namespace AND e.invoice_id=h.invoice_id) LIMIT $3))`,
      `DELETE FROM amp_stripe_invoice_evidence v WHERE ctid=ANY(ARRAY(SELECT ctid FROM amp_stripe_invoice_evidence v WHERE v.recorded_at<=${CUTOFF}
        AND NOT EXISTS(SELECT 1 FROM amp_payment_records r WHERE r.namespace=v.namespace AND r.invoice_id=v.invoice_id)
        AND NOT EXISTS(SELECT 1 FROM amp_account_entitlements e WHERE e.namespace=v.namespace AND e.invoice_id=v.invoice_id) LIMIT $3))`,
      `DELETE FROM amp_stripe_inbox WHERE ctid=ANY(ARRAY(SELECT ctid FROM amp_stripe_inbox WHERE received_at<=${CUTOFF} LIMIT $3))`,
      `DELETE FROM amp_stripe_customers s WHERE ctid=ANY(ARRAY(SELECT ctid FROM amp_stripe_customers s WHERE s.created_at<=${CUTOFF}
        AND NOT EXISTS(SELECT 1 FROM amp_stripe_checkouts c WHERE c.namespace=s.namespace AND c.account_id=s.account_id)
        LIMIT $3 FOR UPDATE SKIP LOCKED))`,
      `DELETE FROM amp_grants g WHERE ctid=ANY(ARRAY(SELECT ctid FROM amp_grants g WHERE g.ends_at<=${CUTOFF}
        AND NOT EXISTS(SELECT 1 FROM amp_commerce_orders o WHERE g.id='commerce:'||(o.grant_state->>'id')) LIMIT $3))`,
    ])
      expiredFinancialRecords +=
        (await client.query(sql, [clock, years, limit])).rowCount ?? 0;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  // A "Deleted learner" tombstone exists only for financial references.
  const expiredLearnerReferences = await eachBatch(
    async (after, limit) =>
      scan(
        pool,
        `SELECT l.id AS key,l.account_id AS account FROM amp_learners l
        WHERE ${UNREFERENCED_TOMBSTONE} AND l.id>$1 ORDER BY l.id LIMIT $2`,
        [after, limit],
      ),
    ({ key, account }) =>
      inAccount(pool, account, async (client) => {
        const removed = await client.query(
          `DELETE FROM amp_learners l WHERE l.id=$1 AND ${UNREFERENCED_TOMBSTONE}`,
          [key],
        );
        return !!removed.rowCount;
      }),
  );
  return {
    expiredOrders,
    expiredCheckouts,
    expiredFinancialRecords,
    expiredLearnerReferences,
  };
}
