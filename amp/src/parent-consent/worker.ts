import { randomUUID } from "node:crypto";
import type {
  ConsentTransport,
  ConsentStage,
  DeliveryResult,
} from "./contracts.js";
import { ConsentError } from "./contracts.js";
import { policyGeneration } from "./policy.js";
import { digest } from "./crypto.js";
import { consentMail } from "./mail.js";
import { ConsentRepository } from "./repository.js";

/** Resend keeps keys for 24 hours. Leave one hour for provider/clock uncertainty. */
export const DELIVERY_WINDOW_HOURS = 23;
export const DELIVERY_TIMEOUT_MS = 10_000;
/** One job, bounded externally and by database statement/lock deadlines. */
export async function deliverConsentMail(
  repository: ConsentRepository,
  transport: ConsentTransport,
): Promise<boolean> {
  const candidate = (
    await repository.pool.query(`
    SELECT o.id,r.account_id FROM amp_consent_outbox o
    JOIN amp_consent_requests r ON r.id=o.request_id
    JOIN amp_consent_policy p ON p.singleton AND p.enabled AND p.reviewed_until>now() AND p.digest=r.policy_digest AND p.generation=r.policy_generation
    WHERE o.accepted_at IS NULL AND o.rejected_at IS NULL AND o.stopped_at IS NULL
      AND o.available_at<=now() AND (o.lease_until IS NULL OR o.lease_until<=now())
      AND r.expires_at>now() AND r.phase=CASE WHEN o.stage='initial' THEN 'awaiting-initial' ELSE 'awaiting-confirmation' END
    ORDER BY o.available_at,o.id LIMIT 1`)
  ).rows[0];
  if (!candidate) return false;
  const claimed = await repository.transaction(
    candidate.account_id,
    async (client) => {
      let policy;
      try {
        policy = await repository.available(client);
      } catch (e) {
        if (e instanceof ConsentError) return null;
        throw e;
      }
      const row = (
        await client.query(
          `
      SELECT r.*,o.id AS outbox_id,o.stage,o.attempts,o.first_dispatch_at,o.delivery_binding,
        o.first_dispatch_at+interval '23 hours'<=clock_timestamp()+interval '12 seconds' AS window_ended
      FROM amp_consent_outbox o JOIN amp_consent_requests r ON r.id=o.request_id
      WHERE o.id=$1 AND o.accepted_at IS NULL AND o.rejected_at IS NULL AND o.stopped_at IS NULL
        AND o.available_at<=now() AND (o.lease_until IS NULL OR o.lease_until<=now())
        AND r.expires_at>now() AND r.phase=CASE WHEN o.stage='initial' THEN 'awaiting-initial' ELSE 'awaiting-confirmation' END
      FOR UPDATE OF o,r`,
          [candidate.id],
        )
      ).rows[0];
      if (
        !row ||
        row.policy_digest !== digest(policy) ||
        row.policy_generation !== (await policyGeneration(client)) ||
        !row.recipient_ciphertext
      )
        return null;
      const mail = consentMail(policy, {
        id: row.id,
        recipient: repository.secrets!.decrypt(
          row.recipient_ciphertext,
          row.id,
        ),
        token: repository.secrets!.token(
          repository.binding(row),
          row.stage as ConsentStage,
        ),
        stage: row.stage as ConsentStage,
        idempotencyKey: `amp-consent:${row.outbox_id}`,
        noticeHash: row.notice_digest,
      });
      const binding = { ...transport.binding, payloadDigest: digest(mail) };
      const reason =
        row.attempts > 0 && !row.first_dispatch_at
          ? "historical-unknown"
          : row.delivery_binding &&
              digest(row.delivery_binding) !== digest(binding)
            ? "binding-changed"
            : row.window_ended
              ? "retry-window-ended"
              : row.attempts >= 8
                ? "attempts-exhausted"
                : null;
      if (reason) {
        await client.query(
          "UPDATE amp_consent_outbox SET stopped_at=now(),stopped_reason=$2,lease_id=NULL,lease_until=NULL WHERE id=$1",
          [row.outbox_id, reason],
        );
        return { stopped: true as const };
      }
      const lease = randomUUID();
      await client.query(
        `UPDATE amp_consent_outbox SET lease_id=$2,lease_until=now()+interval '2 minutes',attempts=attempts+1,
      first_dispatch_at=COALESCE(first_dispatch_at,clock_timestamp()),delivery_binding=COALESCE(delivery_binding,$3::jsonb) WHERE id=$1`,
        [row.outbox_id, lease, JSON.stringify(binding)],
      );
      return { stopped: false as const, lease, row, mail };
    },
  );
  if (!claimed) return false;
  if (claimed.stopped) return true;
  // Withdrawal cannot recall an in-flight request; it invalidates its links.
  const checkedAt = performance.now();
  const budget = await repository.transaction(
    candidate.account_id,
    async (client) => {
      try {
        await repository.available(client);
      } catch (e) {
        if (e instanceof ConsentError) return 0;
        throw e;
      }
      const row = (
        await client.query(
          `SELECT EXTRACT(EPOCH FROM (LEAST(o.first_dispatch_at+interval '23 hours',o.lease_until,r.expires_at,p.reviewed_until)-clock_timestamp()))*1000 AS remaining
      FROM amp_consent_outbox o JOIN amp_consent_requests r ON r.id=o.request_id
      JOIN amp_consent_policy p ON p.singleton AND p.enabled AND p.digest=r.policy_digest AND p.generation=r.policy_generation
      WHERE o.id=$1 AND o.lease_id=$2 AND o.stopped_at IS NULL AND r.phase=$3`,
          [candidate.id, claimed.lease, claimed.row.phase],
        )
      ).rows[0];
      return row ? Number(row.remaining) : 0;
    },
  );
  const remaining = Math.min(
    DELIVERY_TIMEOUT_MS,
    budget - (performance.now() - checkedAt) - 2000,
  );
  if (remaining <= 0) return false;
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
  // A rejected retry cannot establish that an earlier ambiguous send failed.
  if (result.kind === "rejected" && claimed.row.attempts > 0)
    result = { kind: "unknown" };
  await repository.transaction(candidate.account_id, async (client) => {
    await client.query(
      `UPDATE amp_consent_outbox o SET
      accepted_at=CASE WHEN $3='accepted' THEN now() ELSE NULL END,
      receipt=CASE WHEN $3='accepted' THEN $4 ELSE NULL END,
      rejected_at=CASE WHEN $3='rejected' THEN now() ELSE NULL END,
      stopped_at=CASE WHEN $3='conflict' OR ($3='unknown' AND o.attempts>=8) THEN now() ELSE NULL END,
      stopped_reason=CASE WHEN $3='conflict' THEN 'provider-conflict' WHEN $3='unknown' AND o.attempts>=8 THEN 'attempts-exhausted' ELSE NULL END,
      available_at=now()+interval '5 minutes',lease_id=NULL,lease_until=NULL
      FROM amp_consent_requests r WHERE o.id=$1 AND o.lease_id=$2 AND r.id=o.request_id AND r.phase=$5 AND r.expires_at>now()`,
      [
        candidate.id,
        claimed.lease,
        result.kind,
        result.kind === "accepted" ? result.receipt : null,
        claimed.row.phase,
      ],
    );
  });
  return true;
}
