import { disclosesResend } from "../parent-consent/resend.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Pool } from "pg";
import type {
  ConsentMail,
  ConsentTransport,
  DeliveryResult,
  ConsentPolicy,
} from "../parent-consent/contracts.js";
import { renderEmail, retryPayload } from "../email/email.js";
import { currentPolicy } from "../parent-consent/policy.js";
import { digest } from "../parent-consent/crypto.js";
import { fundedLearningAllowed } from "./learning-permission.js";
import { FundingPurchaseRepository } from "./repository.js";

/** Preserve the reviewed account sender, including a display name. */
export function fundedNotificationSender(value: unknown): string {
  const input = z
    .string()
    .trim()
    .min(1)
    .max(320)
    .refine((v) => !/[\r\n]/.test(v))
    .parse(value);
  const named = input.match(/^([^<>]+)<([^<>]+)>$/);
  if (!named) return z.email().max(254).parse(input);
  const name = named[1]!.trim();
  if (!name) throw new Error("Sender display name is empty");
  return `${name} <${z.email().max(254).parse(named[2]!.trim())}>`;
}

/** The funded-purchase confirmation: access is ready, or a scheduled next
 * term is confirmed. It names no learner. */
export function fundedActivationMail(input: {
  requestId: string;
  recipient: string;
  /** The parent account URL. */
  link: string;
  scheduled?: { period: "month" | "year"; startsAt: string; endsAt: string };
}): ConsentMail {
  const { requestId, link, scheduled } = input;
  const open = {
    button: { label: "Open AMP", url: link },
    lead: "Open AMP:",
    sameLine: true,
  };
  const subject = scheduled
    ? `Your next ${scheduled.period} of AMP Math is confirmed`
    : "Your AMP Math access is ready";
  return {
    idempotencyKey: `amp-funded-activation:${requestId}`,
    recipient: input.recipient,
    ...renderEmail({
      origin: new URL(link).origin,
      subject,
      heading: subject,
      body: scheduled
        ? [
            `Payment for invoice ${requestId} was received.`,
            `Your learner's next ${scheduled.period} runs from ${scheduled.startsAt} to ${scheduled.endsAt} (UTC).`,
            open,
          ]
        : [
            "Your funded AMP Mathematics purchase is confirmed and your learner's access is active.",
            `Invoice: ${requestId}`,
            "Sign in to your AMP parent account, then select your learner to start learning.",
            open,
            "You do not need to make another payment.",
            "Need help getting started? Email support@corpora.inc and include the invoice number above.",
          ],
    }),
  };
}

/** One leased notification per call. Provider acceptance is not inbox delivery.
 * Stop ambiguous sends before Resend's 24-hour idempotency window expires. */
export async function deliverFundedActivationMail(
  pool: Pool,
  transport: ConsentTransport,
  policy: ConsentPolicy,
): Promise<boolean> {
  const link = new URL(policy.notice.parentAccountUrl);
  if (!policy.review.paymentNotificationsReviewed || !disclosesResend(policy))
    throw new Error("Payment notification delivery must be reviewed");
  if (
    link.protocol !== "https:" ||
    link.username ||
    link.password ||
    link.hash ||
    link.search
  )
    throw new Error("A reviewed HTTPS parent account URL is required");
  const repository = new FundingPurchaseRepository(pool, []);
  const candidate = (
    await pool.query(`SELECT o.request_id,r.account_id
    FROM amp_funded_activation_outbox o JOIN amp_funding_requests r ON r.id=o.request_id
    WHERE o.accepted_at IS NULL AND o.stopped_at IS NULL AND o.available_at<=now()
    AND (o.lease_until IS NULL OR o.lease_until<=now()) ORDER BY o.available_at,o.request_id LIMIT 1`)
  ).rows[0];
  if (!candidate) return false;
  const claimed = await repository.transaction(
    candidate.account_id,
    async (client) => {
      await currentPolicy(client, policy);
      const row = (
        await client.query(
          `SELECT o.*, r.account_id,r.learner_id,r.order_id,r.offer_snapshot,
      c.grant_state,c.order_state,u.email,u."emailVerified",l.deleted_at,
      o.first_dispatch_at+interval '23 hours'<=clock_timestamp()+interval '15 seconds' AS window_ended
      FROM amp_funded_activation_outbox o JOIN amp_funding_requests r ON r.id=o.request_id
      JOIN amp_commerce_orders c ON c.id=r.order_id JOIN amp_learners l ON l.id=r.learner_id
      LEFT JOIN amp_auth_users u ON 'amp|' || u.id=r.account_id
      WHERE o.request_id=$1 AND o.accepted_at IS NULL AND o.stopped_at IS NULL
      AND o.available_at<=now() AND (o.lease_until IS NULL OR o.lease_until<=now())
      FOR UPDATE OF o`,
          [candidate.request_id],
        )
      ).rows[0];
      if (!row) return null;
      const grant = row.grant_state;
      // Issuance and term dates are immutable. A retry crossing the start date
      // must keep the same confirmation and provider idempotency binding.
      const scheduled =
        Date.parse(grant?.startsAt) > Date.parse(grant?.issuedAt) &&
        row.order_state.settlement === "settled";
      const eligible =
        grant?.status === "active" &&
        (scheduled || Date.parse(grant.startsAt) <= Date.now()) &&
        Date.parse(grant.endsAt) > Date.now() &&
        !row.deleted_at &&
        (await fundedLearningAllowed(client, row.account_id, row.learner_id));
      const period = row.offer_snapshot.termMonths === 1 ? "month" : "year";
      const composed = fundedActivationMail({
        requestId: row.request_id,
        recipient: row.email ?? "",
        link: link.href,
        ...(scheduled
          ? {
              scheduled: {
                period,
                startsAt: grant.startsAt.slice(0, 10),
                endsAt: grant.endsAt.slice(0, 10),
              },
            }
          : {}),
      });
      const mail = retryPayload(
        composed,
        (payload) =>
          row.delivery_binding ===
          digest({ transport: transport.binding, mail: payload }),
      );
      const binding = digest({ transport: transport.binding, mail });
      const reason = !eligible
        ? "access-inactive"
        : row.emailVerified !== true || !z.email().safeParse(row.email).success
          ? "verified-recipient-unavailable"
          : row.delivery_binding && row.delivery_binding !== binding
            ? "binding-changed"
            : row.window_ended
              ? "retry-window-ended"
              : row.attempts >= 8
                ? "attempts-exhausted"
                : null;
      if (reason) {
        await client.query(
          "UPDATE amp_funded_activation_outbox SET stopped_at=now(),stopped_reason=$2,lease_id=NULL,lease_until=NULL WHERE request_id=$1",
          [row.request_id, reason],
        );
        return { stopped: true as const };
      }
      const lease = randomUUID();
      await client.query(
        `UPDATE amp_funded_activation_outbox SET lease_id=$2,lease_until=now()+interval '2 minutes',
      attempts=attempts+1,first_dispatch_at=COALESCE(first_dispatch_at,clock_timestamp()),
      delivery_binding=COALESCE(delivery_binding,$3) WHERE request_id=$1`,
        [row.request_id, lease, binding],
      );
      return { stopped: false as const, row, mail, lease };
    },
  );
  if (!claimed) return false;
  if (claimed.stopped) return true;
  const checkedAt = performance.now();
  const budget = await repository.transaction(
    candidate.account_id,
    async (client) => {
      await currentPolicy(client, policy);
      const check = (
        await client.query(
          `SELECT u.email,u."emailVerified",c.grant_state,l.deleted_at,
        EXTRACT(EPOCH FROM (LEAST(o.lease_until,o.first_dispatch_at+interval '23 hours')-clock_timestamp()))*1000 AS remaining
      FROM amp_funded_activation_outbox o JOIN amp_funding_requests r ON r.id=o.request_id
      JOIN amp_commerce_orders c ON c.id=r.order_id JOIN amp_learners l ON l.id=r.learner_id
      JOIN amp_auth_users u ON 'amp|' || u.id=r.account_id
      WHERE o.request_id=$1 AND o.lease_id=$2 AND o.stopped_at IS NULL
      AND o.lease_until>clock_timestamp()+interval '15 seconds'
      AND o.first_dispatch_at+interval '23 hours'>clock_timestamp()+interval '15 seconds'`,
          [candidate.request_id, claimed.lease],
        )
      ).rows[0];
      const eligible =
        !!check &&
        check.email === claimed.mail.recipient &&
        check.emailVerified === true &&
        !check.deleted_at &&
        check.grant_state?.status === "active" &&
        Date.parse(check.grant_state.endsAt) > Date.now() &&
        (await fundedLearningAllowed(
          client,
          candidate.account_id,
          claimed.row.learner_id,
        ));
      return eligible
        ? Math.min(
            Number(check.remaining),
            Date.parse(check.grant_state.endsAt) - Date.now(),
          )
        : 0;
    },
  );
  const remaining = Math.min(
    10_000,
    budget - (performance.now() - checkedAt) - 2000,
  );
  if (remaining <= 0) return true;
  // Privacy changes after dispatch cannot recall a transactional message. It
  // contains no learner name, bearer token or grant authority.
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
  await repository.transaction(candidate.account_id, async (client) => {
    await client.query(
      `UPDATE amp_funded_activation_outbox SET
      accepted_at=CASE WHEN $3='accepted' THEN now() ELSE NULL END,
      receipt=CASE WHEN $3='accepted' THEN $4 ELSE NULL END,
      stopped_at=CASE WHEN $3 IN ('rejected','conflict') OR ($3='unknown' AND attempts>=8) THEN now() ELSE NULL END,
      stopped_reason=CASE WHEN $3 IN ('rejected','conflict') THEN 'provider-' || $3 WHEN $3='unknown' AND attempts>=8 THEN 'attempts-exhausted' ELSE NULL END,
      available_at=now()+interval '5 minutes',lease_id=NULL,lease_until=NULL
      WHERE request_id=$1 AND lease_id=$2`,
      [
        candidate.request_id,
        claimed.lease,
        result.kind,
        result.kind === "accepted" ? result.receipt : null,
      ],
    );
  });
  return true;
}
