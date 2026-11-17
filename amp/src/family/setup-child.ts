import type { Pool, PoolClient } from "pg";
import { FamilyError } from "./contracts.js";
import type { FamilyRepository } from "./repository.js";

type Database = Pick<Pool | PoolClient, "query">;

/* A parent's setup keeps every child it saved editable until the parent is
   done (docs/product-model.md): renamed, their year corrected, or taken back
   out. Taking a child out is only for a child who has nothing yet: never
   shown a problem, and no purchase, grant or funding request names them.
   Anything else is that child's learning or money, and is deleted, if at
   all, from Privacy (`delete-learning-data`). */

/** This account's children who can still be taken back out of the family. */
export async function removableChildren(
  db: Database,
  accountId: string,
): Promise<Set<string>> {
  // Historical, not entitlement: "was anything ever granted, bought or
  // requested for this child", whether or not it is still in force
  // (tests/fixtures/grant-readers.json).
  const rows = await db.query<{ id: string }>(
    `SELECT l.id FROM amp_learners l
     WHERE l.account_id=$1 AND l.deleted_at IS NULL AND NOT l.adult
       AND NOT EXISTS (SELECT 1 FROM amp_instances i WHERE i.learner_id=l.id)
       AND NOT EXISTS (SELECT 1 FROM amp_skill_evidence e WHERE e.learner_id=l.id)
       AND NOT EXISTS (SELECT 1 FROM amp_grants g WHERE g.learner_id=l.id)
       AND NOT EXISTS (SELECT 1 FROM amp_commerce_orders o WHERE o.learner_id=l.id)
       AND NOT EXISTS (SELECT 1 FROM amp_stripe_checkouts s WHERE s.learner_id=l.id)
       AND NOT EXISTS (SELECT 1 FROM amp_stripe_checkouts s WHERE s.assigned_learner_id=l.id)
       AND NOT EXISTS (SELECT 1 FROM amp_funding_requests r WHERE r.learner_id=l.id)`,
    [accountId],
  );
  return new Set(rows.rows.map((row) => row.id));
}

/** Takes a child the parent added back out of their family, during setup.
 * The family keeps at least one child: the last one is edited, not removed.
 * The learner row goes; its roster person is tombstoned by the schema's own
 * trigger, as for any deleted learner. */
export async function removeSetupChild(
  families: FamilyRepository,
  accountId: string,
  learnerId: string,
): Promise<{ removed: true }> {
  return families.transaction(accountId, async (client) => {
    const children = (
      await client.query<{ id: string }>(
        "SELECT id FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL AND NOT adult ORDER BY created_at,id FOR UPDATE",
        [accountId],
      )
    ).rows;
    if (!children.some((child) => child.id === learnerId))
      throw new FamilyError(404, "learner_not_found");
    if (children.length < 2) throw new FamilyError(409, "last_child");
    if (!(await removableChildren(client, accountId)).has(learnerId))
      throw new FamilyError(409, "child_has_history");
    await client.query(
      "DELETE FROM amp_learners WHERE id=$1 AND account_id=$2",
      [learnerId, accountId],
    );
    await families.audit(
      client,
      accountId,
      "learner.learning-deleted",
      learnerId,
      1,
    );
    return { removed: true as const };
  });
}
