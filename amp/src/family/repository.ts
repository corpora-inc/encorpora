import {
  purchaseMeasurementView,
  revokeAdvertisingPermission,
} from "../advertising/permission.js";
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
  private async ownedTrialsAvailable(client: PoolClient): Promise<boolean> {
    return !!(
      await client.query(`SELECT 1 FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name='amp_trials' AND column_name='owner_account_id'`)
    ).rowCount;
  }
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
          "SELECT l.id,l.name,l.birth_year,l.sat_math_focus,l.deleted_at,EXISTS(SELECT 1 FROM amp_grants g WHERE g.learner_id=l.id AND g.status='active' AND g.starts_at<=now() AND g.ends_at>now()) AS has_access FROM amp_learners l WHERE l.account_id=$1 ORDER BY l.created_at,l.id",
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
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_purchase_consents') AS relation",
          )
        ).rows[0]?.relation
      ) {
        const assigned = await client.query(
          "SELECT assigned_learner_id FROM amp_stripe_checkouts WHERE account_id=$1 AND NOT closed AND assigned_learner_id IS NOT NULL",
          [accountId],
        );
        linked.push(
          ...assigned.rows.map((row) => row.assigned_learner_id as string),
        );
      }
      const effectiveConsent = await learningConsentActive(
        client,
        accountId,
        this.development,
      );
      return {
        purchaseMeasurement: await purchaseMeasurementView(client, accountId),
        metaPurchaseMeasurement: await purchaseMeasurementView(
          client,
          accountId,
          "meta",
        ),
        openaiPurchaseMeasurement: await purchaseMeasurementView(
          client,
          accountId,
          "openai",
        ),
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
          birthYear: row.birth_year ?? null,
          satMathFocus: row.sat_math_focus,
          deletedAt: iso(row.deleted_at),
          stripeLinked: linked.includes(row.id),
          canPractice:
            !row.deleted_at &&
            effectiveConsent &&
            (this.development || row.has_access),
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
    await revokeAdvertisingPermission(client, accountId);
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
    return this.transaction(accountId, (client) =>
      this.deleteLearningInside(client, accountId, learnerId),
    );
  }
  /** Caller holds the account transaction lock. Retention uses the same path. */
  async deleteLearningInside(
    client: PoolClient,
    accountId: string,
    learnerId?: string,
    action?: "learner.retention-deleted",
  ): Promise<DeletionReceipt> {
    // Events have no learner identifier; erase the account's diagnostic history
    // on either whole-family or individual learning-data deletion.
    if (
      (
        await client.query(
          "SELECT to_regclass('amp_visitor_journeys') AS relation",
        )
      ).rows[0]?.relation
    ) {
      await client.query(
        "INSERT INTO amp_journey_generations(account_id,generation) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET generation=EXCLUDED.generation",
        [accountId, randomUUID()],
      );
      await client.query(
        "DELETE FROM amp_visitor_journeys WHERE account_id=$1",
        [accountId],
      );
    }
    if (!learnerId && (await this.ownedTrialsAvailable(client)))
      await client.query(
        `DELETE FROM amp_learners l USING amp_trials t
       WHERE l.id=t.learner_id AND l.account_id='trial:'||t.id
       AND t.owner_account_id=$1 AND t.adopted_at IS NULL`,
        [accountId],
      );
    const rows = (
      await client.query(
        "SELECT id,deleted_at FROM amp_learners WHERE account_id=$1 AND ($2::text IS NULL OR id=$2) ORDER BY id FOR UPDATE",
        [accountId, learnerId ?? null],
      )
    ).rows;
    if (learnerId && !rows.length)
      throw new FamilyError(404, "learner_not_found");
    await revokeAdvertisingPermission(client, accountId);
    const invoiceIntents = !!(
      await client.query(
        "SELECT to_regclass('amp_funding_invoice_intents') AS relation",
      )
    ).rows[0]?.relation;
    if (!learnerId && invoiceIntents)
      await client.query(
        `DELETE FROM amp_funding_invoice_intents i WHERE i.received_payment_at IS NULL AND (i.claimed_account_id=$1 OR (i.claimed_account_id IS NULL AND EXISTS (SELECT 1 FROM amp_auth_users u WHERE 'amp|' || u.id=$1 AND u."emailVerified" AND lower(trim(u.email))=i.parent_email)))`,
        [accountId],
      );
    const stripe = await this.stripeTable(client);
    const funding = !!(
      await client.query(
        "SELECT to_regclass('amp_funding_requests') AS relation",
      )
    ).rows[0]?.relation;
    const offline = !!(
      await client.query("SELECT to_regclass('amp_offline_packs') AS relation")
    ).rows[0]?.relation;
    const purchases = !!(
      await client.query(
        "SELECT to_regclass('amp_purchase_consents') AS relation",
      )
    ).rows[0]?.relation;
    const practice = !!(
      await client.query(
        "SELECT to_regclass('amp_practice_settings') AS relation",
      )
    ).rows[0]?.relation;
    const flags = !!(
      await client.query("SELECT to_regclass('amp_problem_flags') AS relation")
    ).rows[0]?.relation;
    const workbooks = !!(
      await client.query("SELECT to_regclass('amp_workbooks') AS relation")
    ).rows[0]?.relation;
    let retained = 0,
      linked =
        !learnerId && stripe
          ? !!(
              await client.query(
                "SELECT 1 FROM amp_stripe_checkouts WHERE account_id=$1 AND NOT closed LIMIT 1",
                [accountId],
              )
            ).rowCount
          : false,
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
      const assigned = purchases
        ? await client.query(
            "SELECT closed FROM amp_stripe_checkouts WHERE assigned_learner_id=$1 AND account_id=$2",
            [row.id, accountId],
          )
        : { rows: [] };
      const preserve =
        !!subscription.rowCount ||
        !!financial.rowCount ||
        assigned.rows.length > 0;
      linked ||= assigned.rows.some((r) => !r.closed);
      if (stripe) {
        const open = await client.query(
          "SELECT 1 FROM amp_stripe_checkouts WHERE learner_id=$1 AND account_id=$2 AND NOT closed LIMIT 1",
          [row.id, accountId],
        );
        linked ||= !!open.rowCount;
      }
      if (funding)
        await client.query(
          invoiceIntents
            ? "DELETE FROM amp_funding_requests WHERE learner_id=$1 AND account_id=$2 AND order_id IS NULL AND NOT EXISTS (SELECT 1 FROM amp_funding_invoice_intents i WHERE i.claimed_request_id=amp_funding_requests.id AND i.received_payment_at IS NOT NULL)"
            : "DELETE FROM amp_funding_requests WHERE learner_id=$1 AND account_id=$2 AND order_id IS NULL",
          [row.id, accountId],
        );
      if (offline)
        await client.query(
          "DELETE FROM amp_offline_packs WHERE learner_id=$1",
          [row.id],
        );
      if (!row.deleted_at) deleted++;
      if (practice) {
        await client.query(
          "DELETE FROM amp_practice_changes WHERE learner_id=$1",
          [row.id],
        );
        await client.query(
          "DELETE FROM amp_practice_settings WHERE learner_id=$1",
          [row.id],
        );
      }
      await client.query("DELETE FROM amp_skill_evidence WHERE learner_id=$1", [
        row.id,
      ]);
      // Workbooks name the learner's problems; a retained billing tombstone
      // keeps none of them.
      if (workbooks)
        await client.query("DELETE FROM amp_workbooks WHERE learner_id=$1", [
          row.id,
        ]);
      await client.query("DELETE FROM amp_instances WHERE learner_id=$1", [
        row.id,
      ]);
      // Reports outlive the learner only as notes-free reports on content.
      if (flags)
        await client.query(
          "UPDATE amp_problem_flags SET learner_id=NULL,note=NULL WHERE learner_id=$1",
          [row.id],
        );
      if (preserve) {
        await client.query(
          "UPDATE amp_learners SET name='Deleted learner',birth_year=NULL,starting_band=NULL,starting_policy=NULL,starting_excluded_strands=NULL,deleted_at=COALESCE(deleted_at,now()),created_at=CASE WHEN deleted_at IS NULL THEN now() ELSE created_at END WHERE id=$1",
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
      action ??
        (learnerId ? "learner.learning-deleted" : "account.learning-deleted"),
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
          "SELECT to_jsonb(l) - 'account_id' AS value FROM amp_learners l WHERE (account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY id",
        ],
        [
          "problem",
          "SELECT to_jsonb(i) AS value FROM amp_instances i JOIN amp_learners l ON l.id=i.learner_id WHERE (l.account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY i.id",
        ],
        [
          "attempt",
          "SELECT to_jsonb(a) AS value FROM amp_attempts a JOIN amp_learners l ON l.id=a.learner_id WHERE (l.account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY a.id",
        ],
        [
          "derived-skill-evidence",
          "SELECT jsonb_build_object('learnerId',e.learner_id,'evidence',e.state) AS value FROM amp_skill_evidence e JOIN amp_learners l ON l.id=e.learner_id WHERE (l.account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY e.learner_id,e.skill_id",
        ],
        [
          "license",
          "SELECT to_jsonb(g) AS value FROM amp_grants g JOIN amp_learners l ON l.id=g.learner_id WHERE (l.account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY g.id",
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
            "SELECT to_regclass('amp_practice_settings') AS relation",
          )
        ).rows[0]?.relation
      ) {
        for (const [type, table, order] of [
          ["practice-settings", "amp_practice_settings", "p.learner_id"],
          [
            "practice-change",
            "amp_practice_changes",
            "p.learner_id,p.created_at,p.request_id",
          ],
        ])
          datasets.push([
            type!,
            `SELECT to_jsonb(p) AS value FROM ${table} p JOIN amp_learners l ON l.id=p.learner_id WHERE (l.account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY ${order}`,
          ]);
      }
      if (
        (await client.query("SELECT to_regclass('amp_workbooks') AS relation"))
          .rows[0]?.relation
      )
        datasets.push([
          "workbook",
          "SELECT to_jsonb(w) AS value FROM amp_workbooks w JOIN amp_learners l ON l.id=w.learner_id WHERE (l.account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY w.learner_id,w.workbook_date,w.number,w.minutes",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_access_gifts') AS relation",
          )
        ).rows[0]?.relation
      ) {
        const authPresent = (
          await client.query("SELECT to_regclass('amp_auth_users') AS relation")
        ).rows[0]?.relation;
        const pending = authPresent
          ? ` OR (account_id IS NULL AND $1 LIKE 'amp|%' AND recipient_email IN
          (SELECT lower(btrim(email)) FROM amp_auth_users WHERE id=substring($1 from 5) AND "emailVerified"=true))`
          : "";
        datasets.push([
          "complimentary-access",
          "SELECT jsonb_build_object('id',id,'months',months,'issuedAt',issued_at,'claimBy',claim_by,'activatedAt',activated_at,'endsAt',ends_at,'learnerId',learner_id,'revokedAt',revoked_at) AS value FROM amp_access_gifts WHERE account_id=$1" +
            pending +
            " ORDER BY issued_at,id",
        ]);
      }
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_ad_collection_withdrawals') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "ad-collection-withdrawal",
          "SELECT jsonb_build_object('provider',provider,'collectionAllowed',false) AS value FROM amp_ad_collection_withdrawals WHERE account_id=$1 ORDER BY provider",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_advertising_permissions') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "purchase-measurement-permission",
          "SELECT to_jsonb(p) - 'account_id' - 'email_digest' AS value FROM amp_advertising_permissions p WHERE account_id=$1",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_ad_click_evidence') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "ad-acquisition",
          "SELECT jsonb_build_object('provider',c.provider,'identifiers',c.identifiers,'firstObservedAt',c.first_observed_at,'capturedAt',c.observed_at,'expiresAt',j.expires_at,'sourceUrl',c.source_url,'campaignLabels',c.campaign_labels) AS value FROM amp_ad_click_evidence c JOIN amp_ad_click_journeys j ON j.id=c.journey_id WHERE j.account_id=$1 ORDER BY c.observed_at,c.sequence",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_ga_signup_exports') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "signup-web-analytics",
          "SELECT to_jsonb(g)-'user_id' AS value FROM amp_ga_signup_exports g WHERE 'amp|'||user_id=$1",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_provider_signup_exports') AS relation",
          )
        ).rows[0]?.relation
      ) {
        datasets.push(
          [
            "signup-ad-measurement",
            "SELECT jsonb_build_object('provider',provider,'signupAt',occurred_at,'state',state,'attempts',attempts,'httpStatus',http_status,'stoppedReason',stopped_reason) AS value FROM amp_provider_signup_exports WHERE 'amp|'||user_id=$1 ORDER BY occurred_at,id",
          ],
          [
            "signup-browser-context",
            "SELECT jsonb_build_object('userAgent',user_agent,'expiresAt',expires_at) AS value FROM amp_signup_browser_contexts WHERE 'amp|'||user_id=$1",
          ],
        );
      }
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_meta_advertising_permissions') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "meta-purchase-measurement-permission",
          "SELECT to_jsonb(p) - 'account_id' - 'email_digest' AS value FROM amp_meta_advertising_permissions p WHERE account_id=$1",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_openai_advertising_permissions') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "openai-purchase-measurement-permission",
          "SELECT to_jsonb(p) - 'account_id' - 'email_digest' AS value FROM amp_openai_advertising_permissions p WHERE account_id=$1",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_openai_purchase_queue') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "openai-purchase-measurement-delivery",
          "SELECT jsonb_build_object('provider','OpenAI','purchaseAt',occurred_at,'amountMinor',amount_minor,'currency','USD','state',state,'attempts',attempt_count,'lastHttpStatus',last_http_status,'updatedAt',updated_at) AS value FROM amp_openai_purchase_queue WHERE account_id=$1 ORDER BY occurred_at,event_id",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_meta_purchase_contexts') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "meta-purchase-context",
          "SELECT jsonb_build_object('provider','Meta','purchaseAt',occurred_at,'observedAt',observed_at,'expiresAt',expires_at,'noticeVersion',permission_notice,'eventSourceUrl',event_source_url,'clientUserAgent',client_user_agent) AS value FROM amp_meta_purchase_contexts WHERE account_id=$1 ORDER BY occurred_at,payment_id",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_google_purchase_queue') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "purchase-measurement-preparation",
          "SELECT jsonb_build_object('provider','Google','purchaseAt',occurred_at,'amountMinor',original_minor,'netMinor',net_minor,'currency',currency,'state',state,'holdReason',hold_reason,'cancellationReason',cancellation_reason,'noticeVersion',permission_notice,'permissionGrantedAt',permission_granted_at,'permissionExpiresAt',permission_expires_at,'createdAt',created_at,'updatedAt',updated_at) AS value FROM amp_google_purchase_queue WHERE account_id=$1 ORDER BY occurred_at,transaction_id",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_google_delivery_attempts') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "purchase-measurement-delivery",
          "SELECT jsonb_build_object('provider','Google','purchaseAt',q.occurred_at,'kind',a.kind,'amountMinor',a.amount_minor,'currency',q.currency,'state',a.state,'processing',a.processing,'errorCode',a.error_code,'diagnostics',a.diagnostics,'createdAt',a.created_at,'completedAt',a.completed_at) AS value FROM amp_google_delivery_attempts a JOIN amp_google_purchase_queue q USING(transaction_id) WHERE q.account_id=$1 ORDER BY a.created_at,a.id",
        ]);
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
            "SELECT to_jsonb(p) - 'signed_pack' - 'request_digest' - 'consent_revision' - 'binding' AS value FROM amp_offline_packs p JOIN amp_learners l ON l.id=p.learner_id WHERE (l.account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY p.id",
          ],
          [
            "offline-problem",
            "SELECT to_jsonb(i) AS value FROM amp_offline_instances i JOIN amp_offline_packs p ON p.id=i.pack_id JOIN amp_learners l ON l.id=p.learner_id WHERE (l.account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY i.id",
          ],
          [
            "offline-provisional-attempt",
            "SELECT to_jsonb(a) AS value FROM amp_offline_attempts a JOIN amp_offline_packs p ON p.id=a.pack_id JOIN amp_learners l ON l.id=p.learner_id WHERE (l.account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY a.id",
          ],
          [
            "offline-receipt",
            "SELECT to_jsonb(r) - 'input_digest' AS value FROM amp_offline_receipts r JOIN amp_offline_packs p ON p.id=r.pack_id JOIN amp_learners l ON l.id=p.learner_id WHERE (l.account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY r.pack_id,r.request_id",
          ],
        );
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_meta_purchase_queue') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "meta-purchase-measurement-preparation",
          "SELECT jsonb_build_object('provider','Meta','purchaseAt',occurred_at,'originalAmountMinor',original_minor,'currency','USD','state',state,'noticeVersion',permission_notice,'createdAt',created_at) AS value FROM amp_meta_purchase_queue WHERE account_id=$1 ORDER BY occurred_at,event_id",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_meta_delivery_attempts') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "meta-purchase-measurement-delivery",
          "SELECT jsonb_build_object('provider','Meta','purchaseAt',q.occurred_at,'amountMinor',a.amount_minor,'currency','USD','state',a.state,'errorCode',a.error_code,'messageCount',a.receipt->'messageCount','createdAt',a.created_at,'completedAt',a.completed_at) AS value FROM amp_meta_delivery_attempts a JOIN amp_meta_purchase_queue q USING(event_id) WHERE q.account_id=$1 ORDER BY a.created_at,a.id",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_problem_flags') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "problem-report",
          "SELECT to_jsonb(f) AS value FROM amp_problem_flags f JOIN amp_learners l ON l.id=f.learner_id WHERE (l.account_id=$1 OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)) ORDER BY f.created_at,f.id",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_funding_invoice_intents') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "funding-invoice",
          `SELECT jsonb_build_object('id',i.id,'parentEmail',i.parent_email,'studentBillingName',i.student_billing_name,'createdAt',i.created_at,'expiresAt',i.expires_at,'state',i.state,'claimedRequestId',i.claimed_request_id,'campaignAttribution',i.campaign_attribution) AS value FROM amp_funding_invoice_intents i WHERE i.claimed_account_id=$1 OR (i.claimed_account_id IS NULL AND EXISTS (SELECT 1 FROM amp_auth_users u WHERE 'amp|' || u.id=$1 AND u."emailVerified" AND lower(trim(u.email))=i.parent_email)) ORDER BY i.created_at,i.id`,
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_funding_requests') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "funding-request",
          "SELECT jsonb_build_object('id',id,'learnerId',learner_id,'createdAt',created_at,'expiresAt',expires_at,'status',status,'orderId',order_id,'campaignAttribution',campaign_attribution,'studentBillingName',student_billing_name,'offer',offer_snapshot - 'approvals' - 'enabled' - 'documentPolicyReference' - 'creditAgreementReference') AS value FROM amp_funding_requests WHERE account_id=$1 ORDER BY created_at,id",
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
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_purchase_consents') AS relation",
          )
        ).rows[0]?.relation
      ) {
        datasets.push([
          "purchase-consent",
          "SELECT jsonb_build_object('purchaseId',checkout_id,'notice',notice,'noticeDigest',notice_digest,'acknowledgedAt',acknowledged_at,'consentAt',consent_at,'withdrawnAt',revoked_at,'expiresAt',expires_at,'purgeAfter',purge_after) AS value FROM amp_purchase_consents WHERE account_id=$1 ORDER BY acknowledged_at,checkout_id",
        ]);
        datasets.push([
          "account-license",
          "SELECT jsonb_build_object('purchaseId',c.id,'learnerId',c.assigned_learner_id,'invoiceId',e.invoice_id,'status',e.status,'endsAt',e.ends_at) AS value FROM amp_account_entitlements e JOIN amp_stripe_checkouts c ON c.id=e.checkout_id WHERE c.account_id=$1 ORDER BY c.created_at,e.invoice_id",
        ]);
      }
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
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_visitor_journeys') AS relation",
          )
        ).rows[0]?.relation
      )
        datasets.push([
          "journey-event",
          "SELECT jsonb_build_object('event',event,'props',props,'clientAt',client_at,'receivedAt',received_at) AS value FROM amp_visitor_journeys WHERE account_id=$1 ORDER BY client_at,event_id",
        ]);
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_acquisition_contacts') AS relation",
          )
        ).rows[0]?.relation
      ) {
        datasets.push([
          "acquisition-contact",
          "SELECT jsonb_build_object('nextContactAt',next_contact_at,'timeZone',time_zone,'timeZoneBasis',time_zone_basis,'holdReason',hold_reason,'suppressedAt',suppressed_at,'suppressionReason',suppression_reason,'mailboxCheckedAt',mailbox_checked_at) AS value FROM amp_acquisition_contacts WHERE 'amp|'||user_id=$1",
        ]);
        datasets.push([
          "acquisition-message",
          "SELECT jsonb_build_object('purpose',purpose,'sender',sender,'recipient',recipient,'subject',subject,'body',body,'status',status,'createdAt',created_at,'sentAt',sent_at) AS value FROM amp_acquisition_messages WHERE 'amp|'||user_id=$1 ORDER BY created_at,id",
        ]);
        datasets.push([
          "acquisition-contact-event",
          "SELECT jsonb_build_object('kind',kind,'occurredAt',occurred_at,'recordedAt',recorded_at) AS value FROM amp_acquisition_contact_events WHERE 'amp|'||user_id=$1 ORDER BY occurred_at,id",
        ]);
      }
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_account_classifications') AS relation",
          )
        ).rows[0]?.relation
      ) {
        datasets.push(
          [
            "account-classification",
            "SELECT jsonb_build_object('category',category,'note',note,'updatedAt',updated_at) AS value FROM amp_account_classifications WHERE 'amp|'||user_id=$1",
          ],
          [
            "account-classification-event",
            "SELECT jsonb_build_object('category',category,'note',note,'recordedAt',recorded_at) AS value FROM amp_account_classification_events WHERE 'amp|'||user_id=$1 ORDER BY recorded_at,event_key",
          ],
        );
      }
      const ownedTrials = await this.ownedTrialsAvailable(client);
      for (const [type, source] of datasets) {
        const query = ownedTrials
          ? source
          : source.replaceAll(
              " OR EXISTS (SELECT 1 FROM amp_trials t WHERE t.learner_id=l.id AND t.owner_account_id=$1)",
              "",
            );
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
