import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import { canonicalCommercePayload } from "../commerce/ledger.js";
import { learningConsentActive } from "../server/account-access.js";
import { FundingPurchaseRepository, fundingRequestRow } from "./repository.js";
import {
  availableOffers,
  FundingPurchaseError,
  studentBillingNameSchema,
  type FundingOffer,
  type FundingRequest,
} from "./contracts.js";
import { validateInvoiceStudentName } from "./quote-pdf.js";

export const createInvoiceIntentSchema = z.strictObject({
  offerId: z.string().min(1).max(120),
  offerRevision: z.string().min(1).max(120),
  parentEmail: z.string().trim().toLowerCase().email().max(254),
  studentBillingName: studentBillingNameSchema,
  idempotencyKey: z.string().uuid(),
});
export interface InvoiceIntent {
  id: string;
  offer: FundingOffer;
  createdAt: string;
  expiresAt: string;
  state: "prepared" | "claimed" | "cancelled";
  claimedRequestId: string | null;
}
interface PrivateInvoiceIntent extends InvoiceIntent {
  parentEmail: string;
  studentBillingName: string;
  idempotencyKey: string;
}
function rowIntent(row: Record<string, any>): PrivateInvoiceIntent {
  return {
    id: row.id,
    offer: row.offer_snapshot,
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    state: row.state,
    claimedRequestId: row.claimed_request_id,
    parentEmail: row.parent_email,
    studentBillingName: row.student_billing_name,
    idempotencyKey: row.idempotency_key,
  };
}
/** PDF rendering needs billing fields only. No learner or account is invented. */
export function invoiceDocument(
  intent: PrivateInvoiceIntent,
): Pick<
  FundingRequest,
  | "id"
  | "offer"
  | "createdAt"
  | "expiresAt"
  | "studentBillingName"
  | "learnerId"
> {
  return {
    id: intent.id,
    offer: intent.offer,
    createdAt: intent.createdAt,
    expiresAt: intent.expiresAt,
    studentBillingName: intent.studentBillingName,
    learnerId: "",
  };
}
export class FundingInvoiceRepository {
  constructor(readonly funding: FundingPurchaseRepository) {}
  offers(at = new Date()) {
    return availableOffers(this.funding.offers, at).filter(
      (o) => o.documentPolicy === "named-student-invoice",
    );
  }
  async create(input: unknown, at = new Date()): Promise<PrivateInvoiceIntent> {
    const data = createInvoiceIntentSchema.parse(input);
    await validateInvoiceStudentName(data.studentBillingName);
    // A random key is not an ownership credential; exact billing fields are also
    // required for a retry. There is no public read-by-ID or email lookup.
    return this.funding.transaction(
      `invoice:${data.idempotencyKey}`,
      async (client) => {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1,9))",
          [data.idempotencyKey],
        );
        const previous = await client.query(
          "SELECT * FROM amp_funding_invoice_intents WHERE idempotency_key=$1 FOR UPDATE",
          [data.idempotencyKey],
        );
        if (previous.rowCount) {
          const intent = rowIntent(previous.rows[0]);
          if (
            intent.parentEmail !== data.parentEmail ||
            intent.studentBillingName !== data.studentBillingName ||
            intent.offer.id !== data.offerId ||
            intent.offer.revision !== data.offerRevision
          )
            throw new FundingPurchaseError(409, "idempotency_payload_mismatch");
          if (
            intent.state !== "prepared" ||
            Date.parse(intent.expiresAt) <= at.getTime()
          )
            throw new FundingPurchaseError(409, "invoice_unavailable");
          return intent;
        }
        const offer = this.offers(at).find(
          (o) => o.id === data.offerId && o.revision === data.offerRevision,
        );
        if (!offer) throw new FundingPurchaseError(409, "offer_unavailable");
        const expiresAt = new Date(
          Math.min(at.getTime() + 30 * 86400000, Date.parse(offer.validUntil)),
        );
        const result = await client.query(
          `INSERT INTO amp_funding_invoice_intents(id,idempotency_key,parent_email,student_billing_name,offer_snapshot,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [
            randomUUID(),
            data.idempotencyKey,
            data.parentEmail,
            data.studentBillingName,
            JSON.stringify(offer),
            at.toISOString(),
            expiresAt.toISOString(),
          ],
        );
        return rowIntent(result.rows[0]);
      },
    );
  }
  /** Trusted reconciliation seam deliberately excludes billing PII. */
  async readInvoiceIntent(id: string): Promise<InvoiceIntent | null> {
    const result = await this.funding.pool.query(
      "SELECT * FROM amp_funding_invoice_intents WHERE id=$1",
      [id],
    );
    if (!result.rowCount) return null;
    const {
      parentEmail: _email,
      studentBillingName: _name,
      idempotencyKey: _key,
      ...intent
    } = rowIntent(result.rows[0]);
    return intent;
  }
  private async verifiedEmail(
    client: PoolClient,
    account: string,
  ): Promise<string> {
    if (!account.startsWith("amp|"))
      throw new FundingPurchaseError(403, "confirmed_parent_email_required");
    const user = await client.query(
      'SELECT email,"emailVerified" FROM amp_auth_users WHERE id=$1 FOR SHARE',
      [account.slice(4)],
    );
    if (user.rows[0]?.emailVerified !== true)
      throw new FundingPurchaseError(403, "confirmed_parent_email_required");
    return z.string().trim().toLowerCase().email().parse(user.rows[0].email);
  }
  async list(account: string) {
    return this.funding.transaction(account, async (client) => {
      const email = await this.verifiedEmail(client, account);
      const rows = await client.query(
        "SELECT * FROM amp_funding_invoice_intents WHERE parent_email=$1 AND (claimed_account_id IS NULL OR claimed_account_id=$2) AND state<>'cancelled' ORDER BY created_at DESC LIMIT 100",
        [email, account],
      );
      return rows.rows.map((row) => rowIntent(row));
    });
  }
  async discard(account: string, id: string): Promise<void> {
    await this.funding.transaction(account, async (client) => {
      const email = await this.verifiedEmail(client, account);
      const result = await client.query(
        "UPDATE amp_funding_invoice_intents SET state='cancelled' WHERE id=$1 AND parent_email=$2 AND claimed_request_id IS NULL AND received_payment_at IS NULL AND state='prepared' RETURNING id",
        [id, email],
      );
      if (!result.rowCount)
        throw new FundingPurchaseError(409, "invoice_cannot_discard");
    });
  }
  async claim(
    account: string,
    id: string,
    learnerId: string,
    at = new Date(),
  ): Promise<FundingRequest> {
    return this.funding.transaction(account, async (client) => {
      const email = await this.verifiedEmail(client, account);
      if (!(await learningConsentActive(client, account)))
        throw new FundingPurchaseError(403, "verified_consent_required");
      const learner = await client.query(
        "SELECT id FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR SHARE",
        [learnerId, account],
      );
      if (!learner.rowCount)
        throw new FundingPurchaseError(404, "learner_not_found");
      const rows = await client.query(
        "SELECT * FROM amp_funding_invoice_intents WHERE id=$1 AND parent_email=$2 FOR UPDATE",
        [id, email],
      );
      if (!rows.rowCount)
        throw new FundingPurchaseError(404, "invoice_not_found");
      const intent = rowIntent(rows.rows[0]);
      if (intent.state === "claimed") {
        const existing = await client.query(
          "SELECT * FROM amp_funding_requests WHERE id=$1 AND account_id=$2 AND learner_id=$3",
          [id, account, learnerId],
        );
        if (!existing.rowCount)
          throw new FundingPurchaseError(409, "invoice_already_claimed");
        return fundingRequestRow(existing.rows[0]);
      }
      if (
        intent.state !== "prepared" ||
        Date.parse(intent.expiresAt) <= at.getTime()
      )
        throw new FundingPurchaseError(409, "invoice_unavailable");
      if (
        !this.offers(at).some(
          (o) =>
            canonicalCommercePayload(o) ===
            canonicalCommercePayload(intent.offer),
        )
      )
        throw new FundingPurchaseError(409, "offer_unavailable");
      const result = await client.query(
        `INSERT INTO amp_funding_requests(id,account_id,learner_id,idempotency_key,offer_id,offer_revision,offer_snapshot,created_at,expires_at,student_billing_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          id,
          account,
          learnerId,
          intent.idempotencyKey,
          intent.offer.id,
          intent.offer.revision,
          JSON.stringify(intent.offer),
          intent.createdAt,
          intent.expiresAt,
          intent.studentBillingName,
        ],
      );
      await client.query(
        "UPDATE amp_funding_invoice_intents SET state='claimed',claimed_account_id=$2,claimed_request_id=id WHERE id=$1",
        [id, account],
      );
      return fundingRequestRow(result.rows[0]);
    });
  }
}
