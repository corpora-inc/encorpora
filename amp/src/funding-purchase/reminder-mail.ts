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
import { FundingPurchaseRepository } from "./repository.js";

/** Reuses the funded-delivery job and transport. These are invoice follow-ups,
 * not a marketing campaign; each invoice has at most one of each reminder. */
export async function deliverFundingReminderMail(
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
    "funding-reminder-delivery",
    async (db) => {
      await currentPolicy(db, policy);
      // Three days before the fixed deadline, and never on the creation day.
      // A request submitted before this job runs needs no submission reminder.
      // Match fundedInvoiceTerm's UTC calendar-month bounds. Elapsed-hour
      // windows avoid shifting deadlines when a DB session observes DST.
      await db.query(`INSERT INTO amp_funding_invoice_reminders(invoice_id,kind,deadline_at,available_at)
      SELECT i.id,CASE WHEN r.status='parent-reported-submitted' THEN 'processing' ELSE 'submission' END,
        d.deadline,GREATEST(i.created_at+interval '24 hours',d.deadline-interval '72 hours')
      FROM amp_funding_invoice_intents i
      LEFT JOIN amp_funding_requests r ON r.id=i.claimed_request_id
      JOIN amp_access_gifts g ON g.funding_invoice_id=i.id
      CROSS JOIN LATERAL (SELECT CASE WHEN r.status='parent-reported-submitted' THEN
        LEAST(i.created_at+interval '1440 hours',
          CASE WHEN i.offer_snapshot->>'termPolicy' IN ('one-month-from-invoice','twelve-months-from-invoice')
          THEN ((i.created_at AT TIME ZONE 'UTC')+make_interval(months => (i.offer_snapshot->>'termMonths')::int)) AT TIME ZONE 'UTC'
          END)
        ELSE g.claim_by END AS deadline) d
      WHERE i.state<>'cancelled' AND i.received_payment_at IS NULL AND r.order_id IS NULL
        AND (r.status IS NULL OR r.status<>'cancelled') AND g.revoked_at IS NULL
        AND d.deadline>now() AND GREATEST(i.created_at+interval '24 hours',d.deadline-interval '72 hours')<=now()
        AND NOT EXISTS (SELECT 1 FROM amp_funding_invoice_reminders old WHERE old.invoice_id=i.id
          AND old.kind=CASE WHEN r.status='parent-reported-submitted' THEN 'processing' ELSE 'submission' END)
      ORDER BY i.created_at,i.id LIMIT 32
      ON CONFLICT DO NOTHING`);
      const row = (
        await db.query(`SELECT m.*,i.parent_email,i.state,i.received_payment_at,i.offer_snapshot,
      r.status AS request_status,r.order_id,g.revoked_at,doc.pdf_base64,
      m.first_dispatch_at+interval '23 hours'<=clock_timestamp()+interval '15 seconds' AS window_ended
      FROM amp_funding_invoice_reminders m JOIN amp_funding_invoice_intents i ON i.id=m.invoice_id
      LEFT JOIN amp_funding_requests r ON r.id=i.claimed_request_id
      JOIN amp_access_gifts g ON g.funding_invoice_id=i.id
      JOIN amp_funding_invoice_outbox doc ON doc.invoice_id=i.id
      WHERE m.accepted_at IS NULL AND m.stopped_at IS NULL AND m.available_at<=now()
        AND (m.lease_until IS NULL OR m.lease_until<=now())
      ORDER BY m.available_at,m.invoice_id,m.kind LIMIT 1 FOR UPDATE OF m SKIP LOCKED`)
      ).rows[0];
      if (!row) return null;
      const billingUrl = new URL("/account/billing", accountUrl).href;
      const deadline = new Date(row.deadline_at).toISOString().slice(0, 10);
      const submission = row.kind === "submission";
      const mail: ConsentMail = {
        idempotencyKey: `amp-invoice-reminder:${row.invoice_id}:${row.kind}`,
        recipient: row.parent_email,
        subject: submission
          ? "Reminder: submit your AMP invoice"
          : "Your AMP invoice is awaiting payment",
        text: [
          submission
            ? `Please submit your AMP invoice by ${deadline} (UTC). Your invoice PDF is attached.`
            : `We haven’t received payment for your AMP invoice. Your invoice access ends on ${deadline} (UTC).`,
          submission
            ? `${row.offer_snapshot.instructions}\n${row.offer_snapshot.destinationUrl}`
            : `Check your existing payment request with ${row.offer_snapshot.programName}:\n${row.offer_snapshot.destinationUrl}`,
          submission
            ? `After submitting, choose “I’ve submitted it” in Billing to keep practicing while your program processes payment.\n${billingUrl}`
            : `View your invoice and learning access in Billing:\n${billingUrl}`,
          `Invoice: ${row.invoice_id}`,
          "For help with your program’s payment request, email support@corpora.inc.",
        ].join("\n\n"),
        attachments: [
          {
            filename: `education-invoice-${row.invoice_id}.pdf`,
            content: row.pdf_base64,
            contentType: "application/pdf",
          },
        ],
      };
      const binding = digest({ transport: transport.binding, mail });
      const unavailable =
        row.state === "cancelled" ||
        row.request_status === "cancelled" ||
        row.received_payment_at ||
        row.order_id ||
        row.revoked_at ||
        new Date(row.deadline_at).getTime() <= Date.now() ||
        (submission
          ? row.request_status === "parent-reported-submitted"
          : row.request_status !== "parent-reported-submitted");
      const reason = unavailable
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
          "UPDATE amp_funding_invoice_reminders SET stopped_at=now(),stopped_reason=$3,lease_id=NULL,lease_until=NULL WHERE invoice_id=$1 AND kind=$2",
          [row.invoice_id, row.kind, reason],
        );
        return { stopped: true as const };
      }
      const lease = randomUUID();
      await db.query(
        `UPDATE amp_funding_invoice_reminders SET lease_id=$3,lease_until=now()+interval '2 minutes',attempts=attempts+1,
      first_dispatch_at=COALESCE(first_dispatch_at,clock_timestamp()),delivery_binding=COALESCE(delivery_binding,$4)
      WHERE invoice_id=$1 AND kind=$2`,
        [row.invoice_id, row.kind, lease, binding],
      );
      return { stopped: false as const, row, mail, lease };
    },
  );
  if (!claimed) return false;
  if (claimed.stopped) return true;
  const checkedAt = performance.now();
  // Recheck payment, submission and deletion after reserving a send. Neither a
  // stale job candidate nor an ambiguous provider retry can revive a reminder.
  const budget = await repository.transaction(
    "funding-reminder-delivery",
    async (db) => {
      await currentPolicy(db, policy);
      const row = (
        await db.query(
          `SELECT EXTRACT(EPOCH FROM (LEAST(m.lease_until,m.first_dispatch_at+interval '23 hours',m.deadline_at)-clock_timestamp()))*1000 AS remaining
      FROM amp_funding_invoice_reminders m JOIN amp_funding_invoice_intents i ON i.id=m.invoice_id
      LEFT JOIN amp_funding_requests r ON r.id=i.claimed_request_id
      JOIN amp_access_gifts g ON g.funding_invoice_id=i.id
      WHERE m.invoice_id=$1 AND m.kind=$2 AND m.lease_id=$3 AND m.stopped_at IS NULL
        AND i.parent_email=$4 AND i.state<>'cancelled' AND i.received_payment_at IS NULL
        AND r.order_id IS NULL AND (r.status IS NULL OR r.status<>'cancelled') AND g.revoked_at IS NULL
        AND ((m.kind='submission' AND (r.status IS NULL OR r.status='prepared')) OR (m.kind='processing' AND r.status='parent-reported-submitted'))`,
          [
            claimed.row.invoice_id,
            claimed.row.kind,
            claimed.lease,
            claimed.mail.recipient,
          ],
        )
      ).rows[0];
      if (!row)
        await db.query(
          "UPDATE amp_funding_invoice_reminders SET stopped_at=now(),stopped_reason='invoice-unavailable',lease_id=NULL,lease_until=NULL WHERE invoice_id=$1 AND kind=$2 AND lease_id=$3",
          [claimed.row.invoice_id, claimed.row.kind, claimed.lease],
        );
      return row ? Number(row.remaining) : 0;
    },
  );
  const remaining = Math.min(
    10000,
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
    `UPDATE amp_funding_invoice_reminders SET
    accepted_at=CASE WHEN $4='accepted' THEN now() ELSE NULL END,receipt=CASE WHEN $4='accepted' THEN $5 ELSE NULL END,
    stopped_at=CASE WHEN $4 IN ('rejected','conflict') OR ($4='unknown' AND attempts>=8) THEN now() ELSE NULL END,
    stopped_reason=CASE WHEN $4 IN ('rejected','conflict') THEN 'provider-' || $4 WHEN $4='unknown' AND attempts>=8 THEN 'attempts-exhausted' ELSE NULL END,
    available_at=now()+interval '5 minutes',lease_id=NULL,lease_until=NULL
    WHERE invoice_id=$1 AND kind=$2 AND lease_id=$3`,
    [
      claimed.row.invoice_id,
      claimed.row.kind,
      claimed.lease,
      result.kind,
      result.kind === "accepted" ? result.receipt : null,
    ],
  );
  return true;
}
