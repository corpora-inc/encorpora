import { learningConsentActive } from "../server/account-access.js";
import { randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  beginConsentSchema,
  acknowledgeConsentSchema,
  ConsentError,
  EMAIL_PLUS_METHOD,
  type ConsentPolicy,
  type ConsentStage,
  type ConsentView,
} from "./contracts.js";
import {
  ConsentSecrets,
  digest,
  noticeDigest,
  tokenMatches,
} from "./crypto.js";
import { currentPolicy, policyGeneration } from "./policy.js";
const iso = (v: Date | null): string | null => v?.toISOString() ?? null;
export class ConsentRepository {
  constructor(
    readonly pool: Pool,
    readonly policy: ConsentPolicy | null,
    readonly secrets: ConsentSecrets | null,
    readonly transportEnabled = false,
  ) {}
  async transaction<T>(
    account: string,
    action: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL statement_timeout='15s'");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [account],
      );
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async available(client: PoolClient): Promise<ConsentPolicy> {
    if (!this.secrets || !this.transportEnabled)
      throw new ConsentError("consent_enrollment_unavailable", 503);
    return currentPolicy(client, this.policy);
  }
  async view(account: string): Promise<ConsentView> {
    return this.transaction(account, async (client) => {
      let p: ConsentPolicy | null = null;
      try {
        p = await this.available(client);
      } catch (e) {
        if (!(e instanceof ConsentError)) throw e;
      }
      const row = (
        await client.query(
          "SELECT *,expires_at<=now() AS expired FROM amp_consent_requests WHERE account_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1",
          [account],
        )
      ).rows[0];
      const installed = (
        await client.query(
          "SELECT digest,generation,enabled,reviewed_until>now() AS current FROM amp_consent_policy WHERE singleton FOR SHARE",
        )
      ).rows[0];
      const policyMatches = !!(
        installed?.enabled &&
        installed.current &&
        row &&
        installed.digest === row.policy_digest &&
        installed.generation === row.policy_generation
      );
      const consentActive = await learningConsentActive(client, account);
      const delivery = row
        ? (
            await client.query(
              "SELECT accepted_at,rejected_at FROM amp_consent_outbox WHERE request_id=$1 AND stage=$2",
              [
                row.id,
                row.phase === "awaiting-initial" ? "initial" : "confirmation",
              ],
            )
          ).rows[0]
        : null;
      return {
        consentActive,
        available: !!p,
        notice:
          p?.notice ??
          (consentActive && row?.phase === "active" ? row.notice : null),
        noticeDigest: p
          ? noticeDigest(p)
          : consentActive && row?.phase === "active"
            ? row.notice_digest
            : null,
        confirmationDelayHours: p?.confirmationDelayHours ?? null,
        request: row
          ? {
              id: row.id,
              phase:
                [
                  "active",
                  "awaiting-initial",
                  "awaiting-confirmation",
                ].includes(row.phase) && !policyMatches
                  ? "policy-changed"
                  : row.expired && row.phase.startsWith("awaiting-")
                    ? "expired"
                    : row.phase,
              createdAt: iso(row.created_at)!,
              expiresAt: iso(row.expires_at)!,
              confirmationAfter: iso(row.confirmation_after),
              delivery: delivery
                ? delivery.accepted_at
                  ? "accepted"
                  : delivery.rejected_at
                    ? "rejected"
                    : "queued"
                : null,
            }
          : null,
      };
    });
  }
  async begin(account: string, input: unknown): Promise<void> {
    const body = beginConsentSchema.parse(input);
    await this.transaction(account, async (client) => {
      const p = await this.available(client),
        hash = noticeDigest(p);
      if (body.noticeDigest !== hash) throw new ConsentError("notice_changed");
      const emailHash = this.secrets!.addressHash(body.email);
      const prior = (
        await client.query(
          "SELECT * FROM amp_consent_requests WHERE account_id=$1 AND idempotency_key=$2",
          [account, body.requestId],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.email_hash !== emailHash ||
          prior.notice_digest !== hash ||
          prior.policy_generation !== (await policyGeneration(client))
        )
          throw new ConsentError("request_replay_mismatch");
        return;
      }
      if (
        (
          await client.query(
            "SELECT 1 FROM amp_consent_requests WHERE account_id=$1 AND phase='active' AND policy_digest=$2 AND policy_generation=$3",
            [account, digest(p), await policyGeneration(client)],
          )
        ).rowCount
      )
        throw new ConsentError("consent_already_active");
      const recent = await client.query(
        "SELECT count(*)::int AS n FROM amp_consent_requests WHERE account_id=$1 AND created_at>now()-interval '1 day'",
        [account],
      );
      if (recent.rows[0].n >= 3)
        throw new ConsentError("consent_request_limit", 429);
      await client.query(
        `UPDATE amp_consent_requests SET phase='replaced',recipient_ciphertext=NULL,purge_after=CASE WHEN completed_at IS NULL THEN expires_at ELSE now()+((notice->>'withdrawnEvidenceDays')::int * interval '1 day') END WHERE account_id=$1 AND phase IN ('awaiting-initial','awaiting-confirmation','active')`,
        [account],
      );
      const id = randomUUID();
      await client.query(
        `INSERT INTO amp_consent_requests(id,account_id,idempotency_key,policy_digest,notice_digest,notice,email_hash,recipient_ciphertext,nonce,phase,expires_at,policy_generation)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'awaiting-initial',now()+($10 * interval '1 day'),$11)`,
        [
          id,
          account,
          body.requestId,
          digest(p),
          hash,
          p.notice,
          emailHash,
          this.secrets!.encrypt(body.email, id),
          randomBytes(32).toString("hex"),
          p.notice.pendingContactDays,
          await policyGeneration(client),
        ],
      );
      await client.query(
        "INSERT INTO amp_consent_outbox(id,request_id,stage,available_at) VALUES($1,$2,'initial',now())",
        [randomUUID(), id],
      );
    });
  }
  binding(row: Record<string, string>) {
    return {
      id: row.id,
      account: row.account_id,
      nonce: row.nonce,
      emailHash: row.email_hash,
      noticeHash: row.notice_digest,
    };
  }
  async acknowledge(account: string, input: unknown): Promise<void> {
    const body = acknowledgeConsentSchema.parse(input);
    await this.transaction(account, async (client) => {
      const p = await this.available(client);
      const row = (
        await client.query(
          "SELECT *,expires_at>now() AS current,confirmation_after<=now() AS ready FROM amp_consent_requests WHERE id=$1 AND account_id=$2 FOR UPDATE",
          [body.requestId, account],
        )
      ).rows[0];
      if (
        !row ||
        row.policy_digest !== digest(p) ||
        row.policy_generation !== (await policyGeneration(client)) ||
        row.notice_digest !== body.noticeDigest ||
        !tokenMatches(
          body.token,
          this.secrets!.token(this.binding(row), body.stage),
        )
      )
        throw new ConsentError("consent_link_invalid");
      if (
        row.phase === "withdrawn" ||
        row.phase === "replaced" ||
        row.phase === "expired"
      )
        throw new ConsentError("consent_link_invalid");
      // A consumed token cannot create another transition. An exact retry is safe.
      if (
        (body.stage === "initial" && row.initial_at) ||
        (body.stage === "confirmation" && row.completed_at)
      )
        return;
      if (!row.current) throw new ConsentError("consent_link_expired");
      const delivered = (
        await client.query(
          "SELECT 1 FROM amp_consent_outbox WHERE request_id=$1 AND stage=$2 AND accepted_at IS NOT NULL",
          [row.id, body.stage],
        )
      ).rowCount;
      if (!delivered) throw new ConsentError("confirmation_not_ready");
      if (body.stage === "initial") {
        if (row.phase !== "awaiting-initial")
          throw new ConsentError("consent_link_invalid");
        await client.query(
          "UPDATE amp_consent_requests SET phase='awaiting-confirmation',initial_at=now(),confirmation_after=now()+($2 * interval '1 hour') WHERE id=$1",
          [row.id, p.confirmationDelayHours],
        );
        await client.query(
          "INSERT INTO amp_consent_outbox(id,request_id,stage,available_at) SELECT $1,id,'confirmation',confirmation_after FROM amp_consent_requests WHERE id=$2",
          [randomUUID(), row.id],
        );
      } else {
        if (row.phase !== "awaiting-confirmation" || !row.ready)
          throw new ConsentError("confirmation_not_ready");
        await client.query(
          "UPDATE amp_consent_requests SET phase='active',completed_at=now(),recipient_ciphertext=NULL WHERE id=$1",
          [row.id],
        );
        await client.query(
          `INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,$2,$3,$4)
          ON CONFLICT(account_id) DO UPDATE SET policy_version=$2,verification_method=$3,evidence_reference=$4,recorded_at=now(),withdrawn_at=NULL`,
          [account, p.notice.version, EMAIL_PLUS_METHOD, row.id],
        );
      }
    });
  }
}
