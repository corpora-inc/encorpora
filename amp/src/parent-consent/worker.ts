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
/** One bounded job. No transport is constructed here; no production sender is bundled. */
export async function deliverConsentMail(
  repository: ConsentRepository,
  transport: ConsentTransport,
): Promise<boolean> {
  const candidate = (
    await repository.pool
      .query(`SELECT o.id,r.account_id FROM amp_consent_outbox o JOIN amp_consent_requests r ON r.id=o.request_id JOIN amp_consent_policy p ON p.singleton AND p.enabled AND p.reviewed_until>now() AND p.digest=r.policy_digest AND p.generation=r.policy_generation
    WHERE o.accepted_at IS NULL AND o.rejected_at IS NULL AND o.available_at<=now() AND (o.lease_until IS NULL OR o.lease_until<=now()) AND o.attempts<8
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
          `SELECT r.*,o.id AS outbox_id,o.stage FROM amp_consent_outbox o JOIN amp_consent_requests r ON r.id=o.request_id
      WHERE o.id=$1 AND o.accepted_at IS NULL AND o.rejected_at IS NULL AND o.available_at<=now() AND (o.lease_until IS NULL OR o.lease_until<=now()) AND o.attempts<8
      AND r.expires_at>now() AND r.phase=CASE WHEN o.stage='initial' THEN 'awaiting-initial' ELSE 'awaiting-confirmation' END FOR UPDATE OF o,r`,
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
      const lease = randomUUID();
      await client.query(
        "UPDATE amp_consent_outbox SET lease_id=$2,lease_until=now()+interval '2 minutes',attempts=attempts+1 WHERE id=$1",
        [row.outbox_id, lease],
      );
      const stage = row.stage as ConsentStage;
      return {
        lease,
        row,
        mail: consentMail(policy, {
          id: row.id,
          recipient: repository.secrets!.decrypt(
            row.recipient_ciphertext,
            row.id,
          ),
          token: repository.secrets!.token(repository.binding(row), stage),
          stage,
          idempotencyKey: `amp-consent:${row.outbox_id}`,
          noticeHash: row.notice_digest,
        }),
      };
    },
  );
  if (!claimed) return false;
  // Recheck immediately before the external boundary. A network operation already
  // in flight cannot be recalled; withdrawal still invalidates all resulting links.
  const allowed = await repository.transaction(
    candidate.account_id,
    async (client) => {
      try {
        await repository.available(client);
      } catch (e) {
        if (e instanceof ConsentError) return false;
        throw e;
      }
      return !!(
        await client.query(
          `SELECT 1 FROM amp_consent_outbox o JOIN amp_consent_requests r ON r.id=o.request_id JOIN amp_consent_policy p ON p.singleton AND p.enabled AND p.reviewed_until>now() AND p.digest=r.policy_digest AND p.generation=r.policy_generation WHERE o.id=$1 AND o.lease_id=$2 AND o.lease_until>now() AND r.expires_at>now() AND r.phase=$3`,
          [candidate.id, claimed.lease, claimed.row.phase],
        )
      ).rowCount;
    },
  );
  if (!allowed) return false;
  let result: DeliveryResult;
  try {
    result = await transport.send(claimed.mail);
  } catch {
    result = { kind: "unknown" };
  }
  if (
    result.kind === "accepted" &&
    (!result.receipt ||
      result.receipt.length > 500 ||
      /[\r\n]/.test(result.receipt))
  )
    result = { kind: "unknown" };
  await repository.transaction(candidate.account_id, async (client) => {
    // Only the current lease may record a result. A late ambiguous retry cannot
    // overwrite another worker's result. No worker path writes parent consent.
    await client.query(
      `UPDATE amp_consent_outbox o SET
      accepted_at=CASE WHEN $3='accepted' THEN now() ELSE NULL END,
      receipt=CASE WHEN $3='accepted' THEN $4 ELSE NULL END,
      rejected_at=CASE WHEN $3='rejected' THEN now() ELSE NULL END,
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
