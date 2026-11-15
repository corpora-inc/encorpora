import type { PoolClient } from "pg";
import { activeToday } from "../schools/principal.js";

/** Adult access is derived from live teaching and family sources. All readers
 * that can encounter an adult grant use accessGrantsFor on their own database
 * client. Stored adult grants are offline-pack bindings, not authority. */

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
  const access = await accessGrantsFor(db, [learnerId], accountId);
  const id = adultGrantId(learnerId);
  const projected = access.grants.find(
    (g) => g.id === id && grantInForce(g, access.now),
  );
  const ends = projected?.ends_at ?? null;
  if (ends)
    await db.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
       VALUES($1,$2,'pilot',$1,'active',now(),$3)
       ON CONFLICT(id) DO UPDATE SET status='active',ends_at=EXCLUDED.ends_at,
         starts_at=LEAST(amp_grants.starts_at,EXCLUDED.starts_at)
       WHERE amp_grants.ends_at IS DISTINCT FROM EXCLUDED.ends_at OR amp_grants.status<>'active' OR amp_grants.starts_at>EXCLUDED.starts_at`,
      [id, learnerId, ends],
    );
  else
    await db.query(
      `UPDATE amp_grants SET status='revoked',ends_at=LEAST(ends_at,GREATEST(now(),starts_at+interval '1 millisecond'))
       WHERE id=$1 AND learner_id=$2 AND (ends_at>now() OR status<>'revoked')
         AND EXISTS(SELECT 1 FROM amp_learners l WHERE l.id=$2 AND l.account_id=$3)`,
      [id, learnerId, accountId],
    );
  return ends;
}

export interface AccessGrant {
  id: string;
  learner_id: string;
  channel: string;
  external_order_id: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  offline_revision?: string;
}

/** Current grants, including scheduled direct purchases and historical rows.
 * Replaces the adult projection in memory; never writes or takes row locks.
 * Use the reader's transaction client so authorization and access share its
 * snapshot. The returned clock is PostgreSQL's transaction time.
 *
 * Only offline issuance needs a persisted adult grant: refreshAdultAccess uses
 * the same adultPracticeEnd calculation before checking its signed binding.
 * A projection's dates are not evidence of historical paid access. */
export async function accessGrantsFor(
  db: Database,
  learnerIds: readonly string[],
  accountId?: string,
) {
  const learners = (
    await db.query<{
      id: string;
      account_id: string;
      adult: boolean;
      simulation: boolean;
      deleted: boolean;
      at: Date;
    }>(
      `SELECT id,account_id,COALESCE((to_jsonb(l)->>'adult')::boolean,false) AS adult,
      COALESCE((to_jsonb(l)->>'simulation')::boolean,false) AS simulation,
      (to_jsonb(l)->>'deleted_at') IS NOT NULL AS deleted,now() AS at
      FROM amp_learners l WHERE id=ANY($1::text[]) AND ($2::text IS NULL OR account_id=$2)`,
      [learnerIds, accountId ?? null],
    )
  ).rows;
  const now =
    learners[0]?.at ??
    (await db.query<{ at: Date }>("SELECT now() AS at")).rows[0]!.at;
  const stored = (
    await db.query<AccessGrant>(
      "SELECT * FROM amp_grants WHERE learner_id=ANY($1::text[]) ORDER BY starts_at,id",
      [learners.map((l) => l.id)],
    )
  ).rows;
  const grants = stored.filter((g) => !g.id.startsWith("adult:"));
  for (const learner of learners) {
    // Keep a stored projection in exported history even for a deleted adult,
    // but it can never authorize access without a live qualifying learner.
    const ends =
      learner.adult && !learner.simulation && !learner.deleted
        ? await adultPracticeEnd(db, learner.account_id)
        : null;
    const id = adultGrantId(learner.id);
    const previous = stored.find((g) => g.id === id);
    if (ends)
      grants.push({
        ...previous,
        id,
        learner_id: learner.id,
        channel: "pilot",
        external_order_id: id,
        status: "active",
        starts_at:
          previous && previous.starts_at < now ? previous.starts_at : now,
        ends_at: ends,
      });
    else if (previous)
      grants.push({
        ...previous,
        status: "revoked",
        ends_at: previous.ends_at > now ? now : previous.ends_at,
      });
  }
  grants.sort(
    (a, b) =>
      a.starts_at.getTime() - b.starts_at.getTime() || a.id.localeCompare(b.id),
  );
  return { grants, now };
}

export const grantInForce = (g: AccessGrant, at: Date) =>
  g.status === "active" && g.starts_at <= at && g.ends_at > at;
export const grantReserved = (g: AccessGrant, at: Date) =>
  g.status === "active" && g.ends_at > at;
