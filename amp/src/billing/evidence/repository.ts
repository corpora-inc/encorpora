import type { StripeRepository } from "../stripe/repository.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { BillingError } from "../stripe/config.js";
import type { AnnualPayment, CheckoutBinding } from "../stripe/model.js";
import {
  documentProfileSchema,
  type FinancialResult,
  type FinancialObservation,
  type PaymentBaseline,
  type PaymentHistoryItem,
  type RefundFact,
  type DocumentProfile,
} from "./contracts.js";
import { evidenceDigest } from "./profile.js";

function refundConflict(previous: RefundFact[], next: RefundFact[]): boolean {
  for (const old of previous) {
    const current = next.find((item) => item.id === old.id);
    if (
      !current ||
      evidenceDigest({ ...old, status: undefined }) !==
        evidenceDigest({ ...current, status: undefined })
    )
      return true;
    if (
      (old.status === "failed" || old.status === "canceled") &&
      old.status !== current.status
    )
      return true;
    if (old.status === "succeeded" && current.status === "pending") return true;
  }
  return false;
}
/** Caller holds account→invoice locks. Financial writes precede the access-projection savepoint. */
export async function recordFinancialEvidence(
  client: PoolClient,
  namespace: string,
  binding: CheckoutBinding,
  payment: AnnualPayment,
  result: FinancialResult | undefined,
  eventId: string,
  currentProfile?: DocumentProfile,
): Promise<void> {
  const checkout = await client.query(
    "SELECT document_profile FROM amp_stripe_checkouts WHERE id=$1 AND namespace=$2 AND account_id=$3",
    [binding.id, namespace, binding.accountId],
  );
  const rawProfile = checkout.rows[0]?.document_profile;
  if (!rawProfile) return; // No retrospective identity from current merchant settings.
  const profile = documentProfileSchema.parse(rawProfile);
  if (
    `${profile.accountId}:${profile.livemode ? "live" : "test"}` !==
      namespace ||
    profile.productId !== payment.productId ||
    profile.priceId !== payment.priceId ||
    profile.currency !== payment.currency ||
    profile.unitAmountMinor !== payment.subtotal
  )
    throw new BillingError("financial_profile_mapping_mismatch");
  await client.query(
    `INSERT INTO amp_payment_records(id,namespace,invoice_id,checkout_id,account_id,learner_id,status,review_reason) VALUES($1,$2,$3,$4,$5,$6,'review','financial_evidence_unavailable') ON CONFLICT(namespace,invoice_id) DO NOTHING`,
    [
      randomUUID(),
      namespace,
      payment.invoiceId,
      binding.id,
      binding.accountId,
      binding.learnerId,
    ],
  );
  const stored = (
    await client.query(
      "SELECT * FROM amp_payment_records WHERE namespace=$1 AND invoice_id=$2 FOR UPDATE",
      [namespace, payment.invoiceId],
    )
  ).rows[0];
  if (
    stored.checkout_id !== binding.id ||
    stored.account_id !== binding.accountId ||
    stored.learner_id !== binding.learnerId
  )
    throw new BillingError("financial_ownership_collision");
  let financial: FinancialResult = result ?? {
    kind: "review",
    reason: "financial_evidence_unavailable",
  };
  const last = (
    await client.query(
      "SELECT observation,observation_sha256 FROM amp_payment_observations WHERE record_id=$1 ORDER BY sequence DESC LIMIT 1",
      [stored.id],
    )
  ).rows[0];
  const priorVerified = (
    await client.query(
      "SELECT observation FROM amp_payment_observations WHERE record_id=$1 AND observation->>'kind'='verified' ORDER BY sequence DESC LIMIT 1",
      [stored.id],
    )
  ).rows[0]?.observation as
    { kind: "verified"; observation: FinancialObservation } | undefined;
  let baseline: PaymentBaseline | undefined;
  const chargeCollision = await client.query(
    "SELECT 1 FROM amp_payment_records WHERE namespace=$1 AND baseline->>'chargeId'=$2 AND invoice_id<>$3 LIMIT 1",
    [namespace, payment.chargeId, payment.invoiceId],
  );
  if (chargeCollision.rowCount)
    financial = { kind: "review", reason: "financial_charge_collision" };
  if (financial.kind === "verified") {
    const observation = financial.observation;
    baseline = {
      invoiceReason: observation.invoiceReason,
      invoiceId: payment.invoiceId,
      chargeId: payment.chargeId,
      subscriptionId: payment.subscriptionId,
      checkoutId: payment.checkoutId,
      paidAt: payment.paidAt,
      periodStart: payment.periodStart,
      periodEnd: payment.periodEnd,
      preTaxMinor: observation.preTaxMinor,
      tax: observation.tax,
      paidMinor: observation.paidMinor,
      currency: observation.currency,
      profile,
    };
    if (
      observation.paidMinor !== payment.paid ||
      (stored.baseline_sha256 &&
        stored.baseline_sha256 !== evidenceDigest(baseline))
    )
      financial = { kind: "review", reason: "financial_baseline_collision" };
    else if (
      priorVerified &&
      refundConflict(priorVerified.observation.refunds, observation.refunds)
    )
      financial = {
        kind: "review",
        reason: "financial_refund_history_collision",
      };
  }
  const stickyReasons = [
    "financial_charge_collision",
    "financial_baseline_collision",
    "financial_refund_history_collision",
    "provider_credit_note_requires_review",
    "renewal_profile_requires_review",
  ];
  let documentHold = stickyReasons.includes(stored.review_reason)
    ? (stored.review_reason as string)
    : financial.kind === "review" && stickyReasons.includes(financial.reason)
      ? financial.reason
      : null;
  const creditHold = await client.query(
    "SELECT 1 FROM amp_payment_holds WHERE namespace=$1 AND invoice_id=$2 LIMIT 1",
    [namespace, payment.invoiceId],
  );
  if (creditHold.rowCount)
    documentHold = "provider_credit_note_requires_review";
  if (
    !stored.baseline &&
    financial.kind === "verified" &&
    financial.observation.invoiceReason === "subscription_cycle" &&
    (!currentProfile ||
      evidenceDigest(currentProfile) !== evidenceDigest(profile))
  )
    documentHold = "renewal_profile_requires_review";
  // Holds prevent issuance, but do not discard newly verified cash/refund observations.
  // A baseline collision never rewrites the original invoice. The review hold is durable.
  if (financial.kind === "verified" && !stored.baseline)
    await client.query(
      "UPDATE amp_payment_records SET baseline=$2,baseline_sha256=$3 WHERE id=$1",
      [stored.id, JSON.stringify(baseline), evidenceDigest(baseline)],
    );
  const digest = evidenceDigest(financial);
  if (last?.observation_sha256 !== digest)
    await client.query(
      "INSERT INTO amp_payment_observations(id,record_id,observation,observation_sha256,source_event_id) VALUES($1,$2,$3,$4,$5)",
      [randomUUID(), stored.id, JSON.stringify(financial), digest, eventId],
    );
  await client.query(
    "UPDATE amp_payment_records SET status=$2,review_reason=$3,observed_at=clock_timestamp() WHERE id=$1",
    [
      stored.id,
      financial.kind === "verified" && !documentHold ? "verified" : "review",
      documentHold ?? (financial.kind === "review" ? financial.reason : null),
    ],
  );
}
export async function paymentHistory(
  pool: Pool,
  accountId: string,
  recordId?: string,
  cursor?: { createdAt: string; id: string },
): Promise<PaymentHistoryItem[]> {
  // One statement gives baseline, status, and observation history one MVCC snapshot.
  const records = await pool.query(
    `SELECT r.id,r.created_at,r.learner_id,r.baseline,
    CASE WHEN EXISTS(SELECT 1 FROM amp_payment_holds h WHERE h.namespace=r.namespace AND h.invoice_id=r.invoice_id) THEN 'review' ELSE r.status END AS status,r.observed_at,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',o.id,'observation',o.observation,'observedAt',o.observed_at) ORDER BY o.sequence) FROM amp_payment_observations o WHERE o.record_id=r.id),'[]'::jsonb) AS history
    FROM amp_payment_records r WHERE r.account_id=$1 AND ($2::uuid IS NULL OR r.id=$2) AND ($3::timestamptz IS NULL OR (r.created_at,r.id)<($3::timestamptz,$4::uuid)) ORDER BY r.created_at DESC,r.id DESC LIMIT 101`,
    [
      accountId,
      recordId ?? null,
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
    ],
  );
  return records.rows.map((row) => {
    const history = row.history as {
      id: string;
      observation: FinancialResult;
      observedAt: string;
    }[];
    const observations = history.flatMap((item) =>
      item.observation.kind === "verified"
        ? [
            {
              id: item.id,
              observedAt: item.observedAt,
              refunds: item.observation.observation.refunds,
            },
          ]
        : [],
    );
    const baseline = row.baseline as PaymentBaseline | null;
    const refunded =
      row.status === "verified" && observations.length
        ? observations
            .at(-1)!
            .refunds.filter((item) => item.status === "succeeded")
            .reduce((sum, item) => sum + item.amountMinor, 0)
        : null;
    return {
      id: row.id,
      createdAt: row.created_at.toISOString(),
      learnerReference: row.learner_id,
      status: row.status,
      baseline,
      observedAt: row.observed_at.toISOString(),
      successfulRefundMinor: refunded,
      netPaidMinor:
        refunded !== null && baseline ? baseline.paidMinor - refunded : null,
      observations,
    };
  });
}

/** A credit note invalidates current financial completeness even if invoice refresh fails. */
export async function holdFinancialRecord(
  repository: StripeRepository,
  invoiceId: string,
  eventId: string,
  creditNoteId: string,
): Promise<void> {
  await repository.pool.query(
    "INSERT INTO amp_payment_holds(namespace,invoice_id,credit_note_id,source_event_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [repository.namespace, invoiceId, creditNoteId, eventId],
  );
  const found = await repository.pool.query(
    "SELECT account_id FROM amp_payment_records WHERE namespace=$1 AND invoice_id=$2",
    [repository.namespace, invoiceId],
  );
  if (!found.rowCount) return;
  await repository.transaction(found.rows[0].account_id, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))", [
      `${repository.namespace}:${invoiceId}`,
    ]);
    const row = (
      await client.query(
        "SELECT id FROM amp_payment_records WHERE namespace=$1 AND invoice_id=$2 FOR UPDATE",
        [repository.namespace, invoiceId],
      )
    ).rows[0];
    const observation: FinancialResult = {
      kind: "review",
      reason: "provider_credit_note_requires_review",
      creditNoteId,
    };
    const digest = evidenceDigest(observation);
    const existing = await client.query(
      "SELECT 1 FROM amp_payment_observations WHERE record_id=$1 AND source_event_id=$2 AND observation_sha256=$3",
      [row.id, eventId, digest],
    );
    if (!existing.rowCount)
      await client.query(
        "INSERT INTO amp_payment_observations(id,record_id,observation,observation_sha256,source_event_id) VALUES($1,$2,$3,$4,$5)",
        [randomUUID(), row.id, JSON.stringify(observation), digest, eventId],
      );
    await client.query(
      "UPDATE amp_payment_records SET status='review',review_reason='provider_credit_note_requires_review',observed_at=clock_timestamp() WHERE id=$1",
      [row.id],
    );
  });
}
