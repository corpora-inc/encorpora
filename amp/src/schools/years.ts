import type { PoolClient } from "pg";

type Database = Pick<PoolClient, "query">;
const TODAY = "(now() AT TIME ZONE o.timezone)::date";
const YEARS = `SELECT 1 FROM amp_academic_sessions y WHERE y.org_id=ANY(o.path) AND y.kind='year'`;

/** SQL: class `c`, in session `cs` at org `o`, belongs to the year in use: the
 * year running today, else the next one coming, else the last one that ran. Past
 * years stay reachable through the switcher on the class list. Nothing is ever
 * archived by a year ending, so a class keeps its grades and its URL. */
export const YEAR_IN_USE = `(CASE
  WHEN cs.starts_on<=${TODAY} AND cs.ends_on>=${TODAY} THEN true
  WHEN cs.starts_on>${TODAY} THEN
    NOT EXISTS(${YEARS} AND y.starts_on<=${TODAY} AND y.ends_on>=${TODAY})
    AND NOT EXISTS(${YEARS} AND y.starts_on>${TODAY} AND y.starts_on<cs.starts_on)
  ELSE
    NOT EXISTS(${YEARS} AND y.ends_on>=${TODAY})
    AND NOT EXISTS(${YEARS} AND y.ends_on>cs.ends_on)
END)`;

export type SchoolYear = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  inUse: boolean;
};

/** Every year this org has classes in, newest first, with the one in use marked. */
export async function yearsOf(
  db: Database,
  orgId: string,
  classIds: readonly string[] | null,
): Promise<SchoolYear[]> {
  const { rows } = await db.query(
    `SELECT DISTINCT y.id,y.name,y.starts_on::text AS "startsOn",y.ends_on::text AS "endsOn",
       bool_or(${YEAR_IN_USE}) OVER (PARTITION BY y.id) AS "inUse"
     FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
     JOIN amp_academic_sessions cs ON cs.id=c.session_id
     JOIN amp_academic_sessions y ON y.id=COALESCE(cs.parent_id,cs.id)
     WHERE o.path @> ARRAY[$1]::uuid[] AND c.archived_at IS NULL
       AND ($2::uuid[] IS NULL OR c.id=ANY($2::uuid[]))
     ORDER BY "startsOn" DESC,y.id`,
    [orgId, classIds],
  );
  return rows;
}

/** Whether a class is from a year that's over and been followed by another: it
 * keeps its grades and time, not today's to-dos. */
export async function classIsPast(
  db: Database,
  classId: string,
): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT cs.ends_on<${TODAY} AND NOT ${YEAR_IN_USE} AS past
     FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
     JOIN amp_academic_sessions cs ON cs.id=c.session_id WHERE c.id=$1`,
    [classId],
  );
  return rows[0]?.past === true;
}
