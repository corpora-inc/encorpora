import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type {
  ConsentMail,
  ConsentPolicy,
  ConsentTransport,
  DeliveryResult,
} from "../parent-consent/contracts.js";
import { digest } from "../parent-consent/crypto.js";
import { currentPolicy } from "../parent-consent/policy.js";
import { disclosesResend } from "../parent-consent/resend.js";
import { renderEmail, retryPayload } from "../email/email.js";
import { FundingPurchaseRepository } from "./repository.js";

/** The requested invoice, with how to submit it. */
export function fundingInvoiceMail(input: {
  invoiceId: string;
  recipient: string;
  instructions: string;
  destinationUrl: string;
  /** YYYY-MM-DD. */
  submitBy: string;
  billingUrl: string;
  pdfBase64: string;
}): ConsentMail {
  const { invoiceId, billingUrl } = input;
  return {
    idempotencyKey: `amp-funding-invoice:${invoiceId}`,
    recipient: input.recipient,
    ...renderEmail({
      origin: new URL(billingUrl).origin,
      subject: "Your AMP invoice and next steps",
      heading: "Your AMP invoice",
      body: [
        "Your AMP invoice is attached. Your child can start today while you arrange payment through your program.",
        {
          button: { label: "Submit the invoice", url: input.destinationUrl },
          lead: `Submit the attached PDF through your program: ${input.instructions}`,
        },
        `Submit by ${input.submitBy} to keep learning while your program processes payment.`,
        {
          link: { label: "Open Billing", url: billingUrl },
          lead: "Your invoices, learning access and submission status are in Billing. Sign in with this email:",
        },
        "After submitting, choose ‘I’ve submitted it’ in Billing. We’ll email you when payment arrives.",
        `Invoice: ${invoiceId}`,
        "Need help with ClassWallet DirectPay? Email support@corpora.inc.",
      ],
    }),
    attachments: [
      {
        filename: `education-invoice-${invoiceId}.pdf`,
        content: input.pdfBase64,
        contentType: "application/pdf",
      },
    ],
  };
}

/** Requested invoice delivery, not marketing or proof of payment. The guest
 * supplies its recipient; access still requires verified account ownership. */
export async function deliverFundingInvoiceMail(
  pool: Pool,
  transport: ConsentTransport,
  policy: ConsentPolicy,
): Promise<boolean> {
  const accountUrl = new URL(policy.notice.parentAccountUrl);
  if (
    !policy.review.paymentNotificationsReviewed ||
    !disclosesResend(policy) ||
    accountUrl.protocol !== "https:" ||
    accountUrl.username ||
    accountUrl.password ||
    accountUrl.search ||
    accountUrl.hash
  )
    throw new Error("Reviewed invoice delivery configuration required");
  const repository = new FundingPurchaseRepository(pool, []);
  const claimed = await repository.transaction(
    "funding-invoice-delivery",
    async (db) => {
      await currentPolicy(db, policy);
      const row = (
        await db.query(`SELECT o.*,i.parent_email,i.offer_snapshot,i.expires_at,i.state,i.received_payment_at,
        r.status AS request_status,g.revoked_at AS reservation_revoked_at,g.id AS reservation_id,g.claim_by,
        o.first_dispatch_at+interval '23 hours'<=clock_timestamp()+interval '15 seconds' AS window_ended
      FROM amp_funding_invoice_outbox o JOIN amp_funding_invoice_intents i ON i.id=o.invoice_id
      LEFT JOIN amp_funding_requests r ON r.id=i.claimed_request_id
      LEFT JOIN amp_access_gifts g ON g.funding_invoice_id=i.id
      WHERE o.accepted_at IS NULL AND o.stopped_at IS NULL AND o.available_at<=now()
        AND (o.lease_until IS NULL OR o.lease_until<=now())
      ORDER BY o.available_at,o.invoice_id LIMIT 1 FOR UPDATE OF o SKIP LOCKED`)
      ).rows[0];
      if (!row) return null;
      const offer = row.offer_snapshot;
      const billingUrl = new URL("/account/billing", accountUrl).href;
      const composed = fundingInvoiceMail({
        invoiceId: row.invoice_id,
        recipient: row.parent_email,
        instructions: offer.instructions,
        destinationUrl: offer.destinationUrl,
        submitBy: new Date(row.claim_by ?? row.expires_at)
          .toISOString()
          .slice(0, 10),
        billingUrl,
        pdfBase64: row.pdf_base64,
      });
      const mail = retryPayload(
        composed,
        (payload) =>
          row.delivery_binding ===
          digest({ transport: transport.binding, mail: payload }),
      );
      const binding = digest({ transport: transport.binding, mail });
      const reason =
        row.state === "cancelled" ||
        row.request_status === "cancelled" ||
        row.received_payment_at ||
        row.reservation_revoked_at ||
        !row.reservation_id ||
        new Date(row.expires_at).getTime() <= Date.now()
          ? "invoice-unavailable"
          : row.delivery_binding && row.delivery_binding !== binding
            ? "binding-changed"
            : row.window_ended
              ? "retry-window-ended"
              : row.attempts >= 8
                ? "attempts-exhausted"
                : null;
      if (reason) {
        await db.query(
          "UPDATE amp_funding_invoice_outbox SET stopped_at=now(),stopped_reason=$2,lease_id=NULL,lease_until=NULL WHERE invoice_id=$1",
          [row.invoice_id, reason],
        );
        return { stopped: true as const };
      }
      const lease = randomUUID();
      await db.query(
        `UPDATE amp_funding_invoice_outbox SET lease_id=$2,lease_until=now()+interval '2 minutes',
      attempts=attempts+1,first_dispatch_at=COALESCE(first_dispatch_at,clock_timestamp()),
      delivery_binding=COALESCE(delivery_binding,$3) WHERE invoice_id=$1`,
        [row.invoice_id, lease, binding],
      );
      return { stopped: false as const, row, mail, lease };
    },
  );
  if (!claimed) return false;
  if (claimed.stopped) return true;
  const checkedAt = performance.now();
  const budget = await repository.transaction(
    "funding-invoice-delivery",
    async (db) => {
      await currentPolicy(db, policy);
      const row = (
        await db.query(
          `SELECT EXTRACT(EPOCH FROM
        (LEAST(o.lease_until,o.first_dispatch_at+interval '23 hours',i.expires_at)-clock_timestamp()))*1000 AS remaining
      FROM amp_funding_invoice_outbox o JOIN amp_funding_invoice_intents i ON i.id=o.invoice_id
      LEFT JOIN amp_funding_requests r ON r.id=i.claimed_request_id
      LEFT JOIN amp_access_gifts g ON g.funding_invoice_id=i.id
      WHERE o.invoice_id=$1 AND o.lease_id=$2 AND o.stopped_at IS NULL
        AND i.state<>'cancelled' AND i.received_payment_at IS NULL AND i.parent_email=$3
        AND (r.status IS NULL OR r.status<>'cancelled') AND g.id IS NOT NULL AND g.revoked_at IS NULL`,
          [claimed.row.invoice_id, claimed.lease, claimed.mail.recipient],
        )
      ).rows[0];
      if (!row)
        await db.query(
          "UPDATE amp_funding_invoice_outbox SET stopped_at=now(),stopped_reason='invoice-unavailable',lease_id=NULL,lease_until=NULL WHERE invoice_id=$1 AND lease_id=$2 AND stopped_at IS NULL",
          [claimed.row.invoice_id, claimed.lease],
        );
      return row ? Number(row.remaining) : 0;
    },
  );
  const remaining = Math.min(
    10_000,
    budget - (performance.now() - checkedAt) - 2000,
  );
  if (remaining <= 0) return true;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let result: DeliveryResult;
  try {
    result = await Promise.race([
      transport.send(claimed.mail, { signal: controller.signal }),
      new Promise<DeliveryResult>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve({ kind: "unknown" });
        }, remaining);
      }),
    ]);
  } catch {
    result = { kind: "unknown" };
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
  if (
    result.kind === "accepted" &&
    (!result.receipt ||
      result.receipt.length > 500 ||
      /[\r\n]/.test(result.receipt))
  )
    result = { kind: "unknown" };
  if (result.kind === "rejected" && claimed.row.attempts > 0)
    result = { kind: "unknown" };
  await pool.query(
    `UPDATE amp_funding_invoice_outbox SET
    accepted_at=CASE WHEN $3='accepted' THEN now() ELSE NULL END,
    receipt=CASE WHEN $3='accepted' THEN $4 ELSE NULL END,
    stopped_at=CASE WHEN $3 IN ('rejected','conflict') OR ($3='unknown' AND attempts>=8) THEN now() ELSE NULL END,
    stopped_reason=CASE WHEN $3 IN ('rejected','conflict') THEN 'provider-' || $3 WHEN $3='unknown' AND attempts>=8 THEN 'attempts-exhausted' ELSE NULL END,
    available_at=now()+interval '5 minutes',lease_id=NULL,lease_until=NULL
    WHERE invoice_id=$1 AND lease_id=$2`,
    [
      claimed.row.invoice_id,
      claimed.lease,
      result.kind,
      result.kind === "accepted" ? result.receipt : null,
    ],
  );
  return true;
}
