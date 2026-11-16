import type { PoolClient } from "pg";
import { purchaseConsentSatisfied } from "../server/account-access.js";

/** A funded purchase covers its learner on the basis they already learn on:
 * the account's own adult, a learner 13 or older, an unnamed child on the
 * restricted internal-operations basis (16 CFR 312.5(c)(7)) or verified
 * consent. Payment grants access, never consent or additional data use. Only
 * a withdrawn or lapsed consent for a named child under 13 defers it. */
export async function fundedLearningAllowed(
  db: Pick<PoolClient, "query">,
  accountId: string,
  learnerId: string,
): Promise<boolean> {
  const owned = await db.query(
    "SELECT 1 FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL AND NOT simulation",
    [learnerId, accountId],
  );
  return (
    !!owned.rowCount &&
    (await purchaseConsentSatisfied(db, accountId, learnerId))
  );
}
