import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  lockLearningAccount,
  learningConsentActive,
} from "../server/account-access.js";
import { readCommerceOrder } from "../commerce/postgres.js";
import {
  availableOffers,
  createFundingRequestSchema,
  FundingPurchaseError,
  presentRequest,
  type FundingOffer,
  type FundingRequest,
} from "./contracts.js";
const iso = (value: Date | string) => new Date(value).toISOString();
export function fundingRequestRow(row: Record<string, any>): FundingRequest {
  return {
    id: row.id,
    accountId: row.account_id,
    learnerId: row.learner_id,
    idempotencyKey: row.idempotency_key,
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    status: row.status,
    offer: row.offer_snapshot,
    orderId: row.order_id,
  };
}
export class FundingPurchaseRepository {
  constructor(
    readonly pool: Pool,
    readonly offers: readonly FundingOffer[],
    readonly development = false,
  ) {}
  async transaction<T>(
    account: string,
    run: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL statement_timeout='30s'");
      await lockLearningAccount(client, account);
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  async create(
    account: string,
    input: unknown,
    at = new Date(),
  ): Promise<FundingRequest> {
    const data = createFundingRequestSchema.parse(input);
    return this.transaction(account, async (client) => {
      if (!(await learningConsentActive(client, account)))
        throw new FundingPurchaseError(403, "verified_consent_required");
      const learner = await client.query(
        "SELECT id FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR SHARE",
        [data.learnerId, account],
      );
      if (!learner.rowCount)
        throw new FundingPurchaseError(404, "learner_not_found");
      // Serialize only this account's idempotency key, never a global purchase lock.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,3))",
        [JSON.stringify([account, data.idempotencyKey])],
      );
      const old = await client.query(
        "SELECT * FROM amp_funding_requests WHERE account_id=$1 AND idempotency_key=$2",
        [account, data.idempotencyKey],
      );
      if (old.rowCount) {
        const request = fundingRequestRow(old.rows[0]);
        if (
          request.learnerId !== data.learnerId ||
          request.offer.id !== data.offerId ||
          request.offer.revision !== data.offerRevision
        )
          throw new FundingPurchaseError(409, "idempotency_payload_mismatch");
        return request;
      }
      const offer = availableOffers(this.offers, at).find(
        (o) => o.id === data.offerId && o.revision === data.offerRevision,
      );
      if (!offer) throw new FundingPurchaseError(409, "offer_unavailable");
      const expires = new Date(
        Math.min(at.getTime() + 30 * 86400000, Date.parse(offer.validUntil)),
      );
      const result = await client.query(
        "INSERT INTO amp_funding_requests(id,account_id,learner_id,idempotency_key,offer_id,offer_revision,offer_snapshot,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
        [
          randomUUID(),
          account,
          data.learnerId,
          data.idempotencyKey,
          offer.id,
          offer.revision,
          JSON.stringify(offer),
          at.toISOString(),
          expires.toISOString(),
        ],
      );
      return fundingRequestRow(result.rows[0]);
    });
  }
  async read(account: string, id: string): Promise<FundingRequest> {
    const result = await this.pool.query(
      "SELECT r.* FROM amp_funding_requests r JOIN amp_learners l ON l.id=r.learner_id WHERE r.id=$1 AND r.account_id=$2 AND (l.deleted_at IS NULL OR r.order_id IS NOT NULL)",
      [id, account],
    );
    if (!result.rowCount)
      throw new FundingPurchaseError(404, "request_not_found");
    return fundingRequestRow(result.rows[0]);
  }
  async list(account: string) {
    const rows = await this.pool.query(
      "SELECT r.* FROM amp_funding_requests r JOIN amp_learners l ON l.id=r.learner_id WHERE r.account_id=$1 AND (l.deleted_at IS NULL OR r.order_id IS NOT NULL) ORDER BY r.created_at DESC LIMIT 100",
      [account],
    );
    return Promise.all(
      rows.rows.map((row) => this.present(account, fundingRequestRow(row))),
    );
  }
  async present(account: string, request: FundingRequest) {
    return presentRequest(
      request,
      request.orderId
        ? await readCommerceOrder(this.pool, account, request.orderId)
        : null,
    );
  }
  async update(
    account: string,
    id: string,
    status: "parent-reported-submitted" | "cancelled",
    at = new Date(),
  ) {
    return this.transaction(account, async (client) => {
      const result = await client.query(
        "SELECT * FROM amp_funding_requests WHERE id=$1 AND account_id=$2 FOR UPDATE",
        [id, account],
      );
      if (!result.rowCount)
        throw new FundingPurchaseError(404, "request_not_found");
      const request = fundingRequestRow(result.rows[0]);
      if (request.orderId)
        throw new FundingPurchaseError(409, "request_already_provisioned");
      if (Date.parse(request.expiresAt) <= at.getTime())
        throw new FundingPurchaseError(409, "request_expired");
      if (request.status === "cancelled" && status !== "cancelled")
        throw new FundingPurchaseError(409, "request_cancelled");
      await client.query(
        "UPDATE amp_funding_requests SET status=$3 WHERE id=$1 AND account_id=$2",
        [id, account, status],
      );
      return { ...request, status };
    });
  }
}
