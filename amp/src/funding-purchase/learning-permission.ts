import type { PoolClient } from "pg";
import {
  learningConsentActive,
  purchaseConsentSatisfied,
} from "../server/account-access.js";

/** A verified funded purchase can cover the same restricted learning as its
 * claimed invoice. Payment grants access, never consent or additional data use.
 * Other funded requests keep their existing permission requirements. */
export async function fundedLearningAllowed(
  db: Pick<PoolClient, "query">,
  requestId: string,
  accountId: string,
  learnerId: string,
): Promise<boolean> {
  const owned = await db.query(
    "SELECT 1 FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL AND NOT simulation",
    [learnerId, accountId],
  );
  if (!owned.rowCount) return false;
  if (await purchaseConsentSatisfied(db, accountId, learnerId)) return true;
  const invoice = await db.query(
    `SELECT 1 FROM amp_funding_invoice_intents i JOIN amp_funding_requests r ON r.id=i.claimed_request_id
     WHERE i.id=$1 AND i.state='claimed' AND i.claimed_account_id=$2
       AND r.account_id=$2 AND r.learner_id=$3 AND r.status<>'cancelled'`,
    [requestId, accountId, learnerId],
  );
  return (
    !!invoice.rowCount &&
    (await learningConsentActive(db, accountId, false, learnerId))
  );
}
