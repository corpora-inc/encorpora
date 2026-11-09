import type { PoolClient } from "pg";
import { activeToday } from "../schools/principal.js";

/* An adult's own practice (docs/families.md). Every teaching adult practices
   free: a teacher at a school with a license in force, or a parent of a child
   with access. `hasAccess` still reads only `amp_grants`: one grant per adult
   learner, refreshed on account reads and learning transactions, carries the
   latest qualifying end. The separate free allowance creates no grant. */

type Database = Pick<PoolClient, "query">;
export const adultGrantId = (learnerId: string) => `adult:${learnerId}`;

/** Until when this account's adult practice is free: the latest end among the
 * licenses in force at orgs where it teaches (no later than a dated role's
 * last day) and the access of its children. Null when nothing qualifies. */
export async function adultPracticeEnd(
  db: Database,
  accountId: string,
): Promise<Date | null> {
  const { rows } = await db.query<{ ends: Date | null }>(
    `SELECT max(q.ends) AS ends FROM (
       SELECT LEAST(l.ends_at,COALESCE((r.end_on::timestamp AT TIME ZONE o.timezone),'infinity')) AS ends
       FROM amp_people p
       JOIN amp_org_roles r ON r.person_id=p.id AND r.role='teacher'
       JOIN amp_orgs o ON o.id=r.org_id
       JOIN amp_school_licenses l ON l.org_id=ANY(o.path)
         AND l.status='active' AND l.starts_at<=now() AND l.ends_at>now()
       WHERE p.account_id=$1 AND p.deleted_at IS NULL AND ${activeToday("r", "o")}
       UNION ALL
       SELECT g.ends_at FROM amp_learners c
       JOIN amp_grants g ON g.learner_id=c.id
       WHERE c.account_id=$1 AND NOT c.adult AND c.deleted_at IS NULL
         AND g.status='active' AND g.starts_at<=now() AND g.ends_at>now()
     ) q WHERE q.ends>now()`,
    [accountId],
  );
  return rows[0]?.ends ?? null;
}

/** Writes, extends or ends the adult learner's one grant so it carries the
 * latest end among what qualifies now. Idempotent: an unchanged end writes
 * nothing. When nothing qualifies the grant lapses now; it is never deleted.
 * Caller holds the account's lock. Returns the end, or null. */
export async function refreshAdultAccess(
  db: Database,
  accountId: string,
  learnerId: string,
): Promise<Date | null> {
  const ends = await adultPracticeEnd(db, accountId);
  const id = adultGrantId(learnerId);
  if (ends)
    await db.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
       VALUES($1,$2,'pilot',$1,'active',now(),$3)
       ON CONFLICT(id) DO UPDATE SET status='active',ends_at=EXCLUDED.ends_at
       WHERE amp_grants.ends_at IS DISTINCT FROM EXCLUDED.ends_at OR amp_grants.status<>'active'`,
      [id, learnerId, ends],
    );
  else
    await db.query(
      `UPDATE amp_grants SET ends_at=GREATEST(now(),starts_at+interval '1 millisecond')
       WHERE id=$1 AND learner_id=$2 AND ends_at>now()`,
      [id, learnerId],
    );
  return ends;
}
