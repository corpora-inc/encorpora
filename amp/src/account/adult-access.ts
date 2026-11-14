import type { PoolClient } from "pg";
import { activeToday } from "../schools/principal.js";

/* An adult's own practice (docs/families.md). Every teaching adult practices
   free: a teacher at a school with a license in force (never a demo's), or a
   parent of a child with access, the account holder and the family's second
   parent alike. `hasAccess` still reads only `amp_grants`: one grant per adult
   learner, refreshed on learning transactions, carries the
   latest qualifying end. Account reads project eligibility directly from its
   sources. The separate free allowance creates no grant. */

type Database = Pick<PoolClient, "query">;
export const adultGrantId = (learnerId: string) => `adult:${learnerId}`;

/** Until when this account's adult practice is free: the latest end among the
 * licenses in force at orgs where it teaches (no later than a dated role's
 * last day), the access of its children, and the access of the children of a
 * family it is the second parent of while that role lasts. Null when nothing
 * qualifies. */
export async function adultPracticeEnd(
  db: Database,
  accountId: string,
): Promise<Date | null> {
  const { rows } = await db.query<{ ends: Date | null }>(
    `SELECT max(q.ends) AS ends FROM (
       SELECT LEAST(l.ends_at,COALESCE((r.end_on::timestamp AT TIME ZONE o.timezone),'infinity')) AS ends
       FROM amp_people p
       JOIN amp_org_roles r ON r.person_id=p.id AND r.role='teacher'
       JOIN amp_orgs o ON o.id=r.org_id AND NOT o.demo
       JOIN amp_school_licenses l ON l.org_id=ANY(o.path)
         AND l.status='active' AND l.starts_at<=now() AND l.ends_at>now()
       WHERE p.account_id=$1 AND p.deleted_at IS NULL AND ${activeToday("r", "o")}
         AND (l.class_ids IS NULL OR EXISTS(SELECT 1 FROM amp_enrollments e
           JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL
           WHERE e.person_id=p.id AND e.role='teacher' AND e.class_id=ANY(l.class_ids) AND ${activeToday("e", "o")}))
       UNION ALL
       SELECT LEAST(greatest(t.grace_ends_at,(SELECT max(x.until_at) FROM amp_pilot_extensions x WHERE x.pilot_id=t.id)),
         COALESCE(e.end_on::timestamp AT TIME ZONE o.timezone,'infinity'),
         COALESCE(r.end_on::timestamp AT TIME ZONE o.timezone,'infinity')) AS ends
       FROM amp_people p JOIN amp_enrollments e ON e.person_id=p.id AND e.role='teacher'
       JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL
       JOIN amp_orgs o ON o.id=c.org_id AND NOT o.demo AND o.kind<>'family'
       JOIN amp_org_roles r ON r.person_id=p.id AND r.role='teacher' AND r.org_id=ANY(o.path)
       JOIN amp_class_pilots cp ON cp.class_id=c.id JOIN amp_teacher_pilots t ON t.id=cp.pilot_id
       WHERE p.account_id=$1 AND p.deleted_at IS NULL AND t.started_at<=now()
         AND ${activeToday("e", "o")} AND ${activeToday("r", "o")}
       UNION ALL
       SELECT g.ends_at FROM amp_learners c
       JOIN amp_grants g ON g.learner_id=c.id
       WHERE c.account_id=$1 AND NOT c.adult AND c.deleted_at IS NULL
         AND g.status='active' AND g.starts_at<=now() AND g.ends_at>now()
       UNION ALL
       SELECT g.ends_at FROM amp_people sp
       JOIN amp_families f ON f.second_parent=sp.id
       JOIN amp_orgs fo ON fo.id=f.org_id
       JOIN amp_org_roles fr ON fr.person_id=sp.id AND fr.org_id=f.org_id AND fr.role='teacher'
       JOIN amp_learners c ON c.account_id=f.account_id AND NOT c.adult AND c.deleted_at IS NULL
       JOIN amp_grants g ON g.learner_id=c.id
       WHERE sp.account_id=$1 AND sp.deleted_at IS NULL AND ${activeToday("fr", "fo")}
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
