import type { Pool } from "pg";
import { RETENTION } from "../../privacy/retention-periods.js";
import { removeOrgTree } from "../org-delete.js";
import type { DemoKind } from "./build.js";

/** Removes one demo org with everything in it, in one transaction. With
 * `seenBefore` (the retention job), only if nobody has opened it since: the
 * check is under the org's row lock, so a visit after the job chose it wins. */
export async function removeDemoOrg(
  pool: Pool,
  orgId: string,
  seenBefore?: Date,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='60s'");
    const org = (
      await client.query(
        `SELECT name FROM amp_orgs WHERE id=$1 AND demo
         AND ($2::timestamptz IS NULL OR demo_seen_at<=$2::timestamptz) FOR UPDATE`,
        [orgId, seenBefore?.toISOString() ?? null],
      )
    ).rows[0];
    if (!org) {
      await client.query("ROLLBACK");
      return false;
    }
    await removeOrgTree(client, {
      orgId,
      confirm: org.name,
      commit: true,
      allowLicensed: true,
    });
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** The caller's own per-visitor demos, from before the shared school, of one
 * kind or both. Real places and shared schools never match. */
export async function removeDemos(
  pool: Pool,
  accountId: string,
  kind?: DemoKind,
): Promise<number> {
  const { rows } = await pool.query(
    `SELECT id FROM amp_orgs WHERE demo AND created_by=$1 AND ($2::text IS NULL OR demo_kind=$2) ORDER BY id`,
    [accountId, kind ?? null],
  );
  let removed = 0;
  for (const row of rows) if (await removeDemoOrg(pool, row.id)) removed++;
  return removed;
}

/** SQL: a shared demo school's org (`shared.ts`), as opposed to a demo made
 * for one visitor before there was one. */
export const SHARED_DEMO_ORG = `created_by LIKE 'amp-demo:%'`;

/** Retention. Every demo made for one visitor goes, with all its data: the
 * shared school replaced them, so none is opened again. A visitor of the
 * shared school who hasn't been back for `idleDemoDays` is no longer one.
 * Each removal is its own transaction; a busy one waits for the next run.
 * Shared schools themselves go each night (`retireSchools`). */
export async function purgeIdleDemos(
  pool: Pool,
  at = new Date(),
): Promise<{ expiredDemoPlaces: number; expiredDemoVisitors: number }> {
  const cutoff = new Date(at.getTime() - RETENTION.idleDemoDays * 86_400_000);
  const { rows } = await pool.query(
    `SELECT id FROM amp_orgs WHERE demo AND NOT ${SHARED_DEMO_ORG}
     ORDER BY demo_seen_at,id LIMIT 500`,
  );
  let expiredDemoPlaces = 0;
  for (const row of rows)
    try {
      if (await removeDemoOrg(pool, row.id)) expiredDemoPlaces++;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "55P03" && code !== "40P01") throw error;
      console.error(JSON.stringify({ retentionUnitSkipped: code }));
    }
  const expiredDemoVisitors = Number(
    (
      await pool.query(
        `WITH gone AS (
           DELETE FROM amp_demo_visitors WHERE seen_at<=$1::timestamptz RETURNING person_id
         ), ended AS (
           UPDATE amp_people p SET deleted_at=now() FROM gone
           WHERE p.id=gone.person_id AND p.demo_visitor AND p.deleted_at IS NULL
         )
         SELECT count(*)::int AS n FROM gone`,
        [cutoff.toISOString()],
      )
    ).rows[0].n,
  );
  return { expiredDemoPlaces, expiredDemoVisitors };
}

/** A demo was opened: it stays another `idleDemoDays`. At most hourly. */
export async function touchDemo(pool: Pool, orgId: string) {
  await pool.query(
    "UPDATE amp_orgs SET demo_seen_at=now() WHERE id=$1 AND demo AND demo_seen_at<now()-interval '1 hour'",
    [orgId],
  );
}
