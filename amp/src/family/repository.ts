import { cancelPendingConsent } from "../parent-consent/lifecycle.js";
import { learningConsentActive } from "../server/account-access.js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  FamilyError,
  retentionNotice,
  type FamilySummary,
  type DeletionReceipt,
} from "./contracts.js";
const iso = (value: Date | null): string | null => value?.toISOString() ?? null;
export class FamilyRepository {
  constructor(
    readonly pool: Pool,
    readonly development = false,
  ) {}
  async transaction<T>(
    accountId: string,
    action: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL statement_timeout='30s'");
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
  async audit(
    client: PoolClient,
    accountId: string,
    action: string,
    learnerId: string | null,
    count = 0,
  ): Promise<string> {
    const id = randomUUID();
    await client.query(
      "INSERT INTO amp_privacy_events(id,account_id,action,learner_id,affected_learners) VALUES($1,$2,$3,$4,$5)",
      [id, accountId, action, learnerId, count],
    );
    return id;
  }
  private async stripeTable(client: PoolClient): Promise<boolean> {
    return !!(
      await client.query(
        "SELECT to_regclass('amp_stripe_checkouts') AS relation",
      )
    ).rows[0].relation;
  }
  async summary(accountId: string): Promise<FamilySummary> {
    return this.transaction(accountId, async (client) => {
      const consent = (
        await client.query(
          "SELECT policy_version,recorded_at,withdrawn_at FROM amp_parent_consents WHERE account_id=$1",
          [accountId],
        )
      ).rows[0];
      const learners = (
        await client.query(
          "SELECT id,name,deleted_at FROM amp_learners WHERE account_id=$1 ORDER BY created_at,id",
          [accountId],
        )
      ).rows;
      const grants = (
        await client.query(
          "SELECT g.* FROM amp_grants g JOIN amp_learners l ON l.id=g.learner_id WHERE l.account_id=$1 ORDER BY g.starts_at,g.id",
          [accountId],
        )
      ).rows;
      const linked = (await this.stripeTable(client))
        ? (
            await client.query(
              "SELECT DISTINCT learner_id FROM amp_stripe_checkouts WHERE account_id=$1 AND NOT closed",
              [accountId],
            )
          ).rows.map((row) => row.learner_id as string)
        : [];
      const effectiveConsent = await learningConsentActive(
        client,
        accountId,
        this.development,
      );
      return {
        consent: {
          status: consent
            ? consent.withdrawn_at
              ? "withdrawn"
              : effectiveConsent
                ? "active"
                : "not-recorded"
            : this.development
              ? "development"
              : "not-recorded",
          policyVersion: consent?.policy_version ?? null,
          recordedAt: iso(consent?.recorded_at ?? null),
          withdrawnAt: iso(consent?.withdrawn_at ?? null),
        },
        learners: learners.map((row) => ({
          id: row.id,
          name: row.name,
          deletedAt: iso(row.deleted_at),
          stripeLinked: linked.includes(row.id),
          access: grants
            .filter((g) => g.learner_id === row.id)
            .map((g) => ({
              channel: g.channel,
              status: g.status,
              startsAt: iso(g.starts_at)!,
              endsAt: iso(g.ends_at)!,
            })),
        })),
        retained: retentionNotice,
      };
    });
  }
  async rename(
    accountId: string,
    learnerId: string,
    name: string,
  ): Promise<void> {
    await this.transaction(accountId, async (client) => {
      // A parent may correct a name after withdrawal without resuming collection.
      const result = await client.query(
        "UPDATE amp_learners SET name=$3 WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL RETURNING id",
        [learnerId, accountId, name],
      );
      if (!result.rowCount) throw new FamilyError(404, "learner_not_found");
      await this.audit(client, accountId, "learner.renamed", learnerId, 1);
    });
  }
  private async withdrawInside(
    client: PoolClient,
    accountId: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference,withdrawn_at)
      VALUES($1,'withdrawn-without-record','parent-withdrawal','self-service',now()) ON CONFLICT(account_id) DO UPDATE SET withdrawn_at=COALESCE(amp_parent_consents.withdrawn_at,now())`,
      [accountId],
    );
    await cancelPendingConsent(client, accountId);
  }
  async withdraw(accountId: string): Promise<void> {
    await this.transaction(accountId, async (client) => {
      await this.withdrawInside(client, accountId);
      await this.audit(client, accountId, "consent.withdrawn", null);
    });
  }
  async deleteLearning(
    accountId: string,
    learnerId?: string,
  ): Promise<DeletionReceipt> {
    return this.transaction(accountId, async (client) => {
      const rows = (
        await client.query(
          "SELECT id,deleted_at FROM amp_learners WHERE account_id=$1 AND ($2::text IS NULL OR id=$2) ORDER BY id FOR UPDATE",
          [accountId, learnerId ?? null],
        )
      ).rows;
      if (learnerId && !rows.length)
        throw new FamilyError(404, "learner_not_found");
      const stripe = await this.stripeTable(client);
      const funding = !!(
        await client.query(
          "SELECT to_regclass('amp_funding_requests') AS relation",
        )
      ).rows[0]?.relation;
      const offline = !!(
        await client.query(
          "SELECT to_regclass('amp_offline_packs') AS relation",
        )
      ).rows[0]?.relation;
      let retained = 0,
        linked = false,
        deleted = 0;
      for (const row of rows) {
        const subscription = stripe
          ? await client.query(
              "SELECT 1 FROM amp_stripe_checkouts WHERE learner_id=$1 AND account_id=$2 LIMIT 1",
              [row.id, accountId],
            )
          : { rowCount: 0 };
        const financial = await client.query(
          `SELECT 1 FROM amp_grants WHERE learner_id=$1 AND channel<>'pilot'
          UNION ALL SELECT 1 FROM amp_commerce_orders WHERE learner_id=$1 LIMIT 1`,
          [row.id],
        );
        const preserve = !!subscription.rowCount || !!financial.rowCount;
        if (stripe) {
          const open = await client.query(
            "SELECT 1 FROM amp_stripe_checkouts WHERE learner_id=$1 AND account_id=$2 AND NOT closed LIMIT 1",
            [row.id, accountId],
          );
          linked ||= !!open.rowCount;
        }
        if (funding)
          await client.query(
            "DELETE FROM amp_funding_requests WHERE learner_id=$1 AND account_id=$2 AND order_id IS NULL",
            [row.id, accountId],
          );
        if (offline)
          await client.query(
            "DELETE FROM amp_offline_packs WHERE learner_id=$1",
            [row.id],
          );
        if (!row.deleted_at) deleted++;
        await client.query(
          "DELETE FROM amp_skill_evidence WHERE learner_id=$1",
          [row.id],
        );
        await client.query("DELETE FROM amp_instances WHERE learner_id=$1", [
          row.id,
        ]);
        if (preserve) {
          await client.query(
            "UPDATE amp_learners SET name='Deleted learner',starting_band=NULL,starting_policy=NULL,starting_excluded_strands=NULL,deleted_at=COALESCE(deleted_at,now()),created_at=CASE WHEN deleted_at IS NULL THEN now() ELSE created_at END WHERE id=$1",
            [row.id],
          );
          retained++;
        } else
          await client.query("DELETE FROM amp_learners WHERE id=$1", [row.id]);
      }
      if (!learnerId) await this.withdrawInside(client, accountId);
      const requestId = await this.audit(
        client,
        accountId,
        learnerId ? "learner.learning-deleted" : "account.learning-deleted",
        learnerId ?? null,
        deleted,
      );
      return {
        requestId,
        deletedLearners: deleted,
        retainedBillingReferences: retained,
        billingManagementRequired: linked,
        consentWithdrawn: !learnerId,
      };
    });
  }
  async issueExportTicket(accountId: string): Promise<string> {
    const ticket = randomBytes(32).toString("base64url");
    await this.pool.query(
      "INSERT INTO amp_export_tickets(digest,account_id) VALUES($1,$2)",
      [createHash("sha256").update(ticket).digest("hex"), accountId],
    );
    return ticket;
  }
  async revokeExportTicket(ticket: string): Promise<void> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(ticket)) return;
    await this.pool.query("DELETE FROM amp_export_tickets WHERE digest=$1", [
      createHash("sha256").update(ticket).digest("hex"),
    ]);
  }
  async consumeExportTicket(ticket: string): Promise<string> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(ticket))
      throw new FamilyError(401, "export_ticket_invalid");
    const result = await this.pool.query(
      "DELETE FROM amp_export_tickets WHERE digest=$1 AND expires_at>now() RETURNING account_id",
      [createHash("sha256").update(ticket).digest("hex")],
    );
    if (!result.rowCount) throw new FamilyError(401, "export_ticket_expired");
    return result.rows[0].account_id;
  }
  /** Streaming snapshot: each fetch is bounded; no complete history is loaded into JS. */
  async *export(
    accountId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const client = await this.pool.connect();
    let began = false;
    try {
      await this.audit(client, accountId, "export.started", null);
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      began = true;
      await client.query("SET LOCAL statement_timeout='15s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout='30s'");
      yield JSON.stringify({
        type: "manifest",
        version: 1,
        exportedAt: new Date().toISOString(),
        format: "NDJSON",
        retained: retentionNotice,
      }) + "\n";
      const datasets: [string, string][] = [
        [
          "consent",
          "SELECT jsonb_build_object('policyVersion',policy_version,'recordedAt',recorded_at,'withdrawnAt',withdrawn_at) AS value FROM amp_parent_consents WHERE account_id=$1",
        ],
        [
          "learner",
          "SELECT to_jsonb(l) - 'account_id' AS value FROM amp_learners l WHERE account_id=$1 ORDER BY id",
        ],
        [
          "problem",
          "SELECT to_jsonb(i) AS value FROM amp_instances i JOIN amp_learners l ON l.id=i.learner_id WHERE l.account_id=$1 ORDER BY i.id",
        ],
        [
          "attempt",
          "SELECT to_jsonb(a) AS value FROM amp_attempts a JOIN amp_learners l ON l.id=a.learner_id WHERE l.account_id=$1 ORDER BY a.id",
        ],
        [
          "derived-skill-evidence",
          "SELECT jsonb_build_object('learnerId',e.learner_id,'evidence',e.state) AS value FROM amp_skill_evidence e JOIN amp_learners l ON l.id=e.learner_id WHERE l.account_id=$1 ORDER BY e.learner_id,e.skill_id",
        ],
        [
          "license",
          "SELECT to_jsonb(g) AS value FROM amp_grants g JOIN amp_learners l ON l.id=g.learner_id WHERE l.account_id=$1 ORDER BY g.id",
        ],
        [
          "order",
          "SELECT order_state AS value FROM amp_commerce_orders WHERE account_id=$1 ORDER BY id",
        ],
        [
          "commerce-event",
          "SELECT e.payload AS value FROM amp_commerce_events e JOIN amp_commerce_orders o ON o.id=e.order_id WHERE o.account_id=$1 ORDER BY e.order_id,e.sequence",
        ],
        [
          "privacy-event",
          "SELECT to_jsonb(p) - 'account_id' AS value FROM amp_privacy_events p WHERE account_id=$1 ORDER BY occurred_at,id",
        ],
      ];
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_offline_packs') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push(
          [
            "offline-pack",
            "SELECT to_jsonb(p) - 'signed_pack' - 'request_digest' - 'consent_revision' - 'binding' AS value FROM amp_offline_packs p JOIN amp_learners l ON l.id=p.learner_id WHERE l.account_id=$1 ORDER BY p.id",
          ],
          [
            "offline-problem",
            "SELECT to_jsonb(i) AS value FROM amp_offline_instances i JOIN amp_offline_packs p ON p.id=i.pack_id JOIN amp_learners l ON l.id=p.learner_id WHERE l.account_id=$1 ORDER BY i.id",
          ],
          [
            "offline-provisional-attempt",
            "SELECT to_jsonb(a) AS value FROM amp_offline_attempts a JOIN amp_offline_packs p ON p.id=a.pack_id JOIN amp_learners l ON l.id=p.learner_id WHERE l.account_id=$1 ORDER BY a.id",
          ],
          [
            "offline-receipt",
            "SELECT to_jsonb(r) - 'input_digest' AS value FROM amp_offline_receipts r JOIN amp_offline_packs p ON p.id=r.pack_id JOIN amp_learners l ON l.id=p.learner_id WHERE l.account_id=$1 ORDER BY r.pack_id,r.request_id",
          ],
        );
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_funding_requests') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "funding-request",
          "SELECT jsonb_build_object('id',id,'learnerId',learner_id,'createdAt',created_at,'expiresAt',expires_at,'status',status,'orderId',order_id,'offer',offer_snapshot - 'approvals' - 'enabled' - 'documentPolicyReference' - 'creditAgreementReference') AS value FROM amp_funding_requests WHERE account_id=$1 ORDER BY created_at,id",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_consent_requests') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "consent-enrollment",
          "SELECT jsonb_build_object('id',id,'phase',phase,'notice',notice,'noticeDigest',notice_digest,'createdAt',created_at,'initialAt',initial_at,'completedAt',completed_at,'withdrawnAt',withdrawn_at,'expiresAt',expires_at,'purgeAfter',purge_after) AS value FROM amp_consent_requests WHERE account_id=$1 ORDER BY created_at,id",
        ]);
      if (await this.stripeTable(client)) {
        datasets.push([
          "stripe-purchase",
          "SELECT jsonb_build_object('id',id,'learnerId',learner_id,'customerId',customer_id,'subscriptionId',subscription_id,'sessionId',session_id,'closed',closed,'createdAt',created_at) AS value FROM amp_stripe_checkouts WHERE account_id=$1 ORDER BY created_at,id",
        ]);
      }
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_payment_records') AS relation",
          )
        ).rows[0]?.relation
      ) {
        datasets.push([
          "payment-record",
          "SELECT jsonb_build_object('id',id,'learnerReference',learner_id,'baseline',baseline,'status',status,'observedAt',observed_at) AS value FROM amp_payment_records WHERE account_id=$1 ORDER BY observed_at,id",
        ]);
        datasets.push([
          "payment-reconciliation-hold",
          "SELECT jsonb_build_object('recordId',r.id,'creditNoteId',h.credit_note_id,'observedAt',h.observed_at) AS value FROM amp_payment_holds h JOIN amp_payment_records r ON r.namespace=h.namespace AND r.invoice_id=h.invoice_id WHERE r.account_id=$1 ORDER BY h.observed_at,h.credit_note_id",
        ]);
        datasets.push([
          "payment-observation",
          "SELECT jsonb_build_object('id',o.id,'recordId',o.record_id,'observation',o.observation,'observedAt',o.observed_at) AS value FROM amp_payment_observations o JOIN amp_payment_records r ON r.id=o.record_id WHERE r.account_id=$1 ORDER BY o.sequence",
        ]);
      }
      for (const [type, query] of datasets) {
        if (signal?.aborted) throw new Error("Export canceled");
        await client.query(
          `DECLARE export_rows NO SCROLL CURSOR FOR ${query}`,
          [accountId],
        );
        while (true) {
          if (signal?.aborted) throw new Error("Export canceled");
          const rows = (
            await client.query("FETCH FORWARD 100 FROM export_rows")
          ).rows;
          if (!rows.length) break;
          for (const row of rows) {
            if (signal?.aborted) throw new Error("Export canceled");
            yield JSON.stringify({ type, data: row.value }) + "\n";
          }
        }
        await client.query("CLOSE export_rows");
      }
      await client.query("COMMIT");
      began = false;
      await this.audit(client, accountId, "export.completed", null);
      yield JSON.stringify({ type: "complete" }) + "\n";
    } finally {
      if (began) await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  }
}
