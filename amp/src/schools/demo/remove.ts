import type { Pool } from "pg";
import { RETENTION } from "../../privacy/retention-periods.js";
import { removeOrgTree } from "../org-delete.js";
import type { DemoKind } from "./build.js";

/** Removes one demo org with everything in it, in one transaction. */
async function removeDemoOrg(pool: Pool, orgId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='60s'");
    const org = (
      await client.query(
        "SELECT name FROM amp_orgs WHERE id=$1 AND demo FOR UPDATE",
        [orgId],
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

/** The caller's own demos, of one kind or both. Real places never match. */
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

/** Retention: a demo nobody has opened for `idleDemoDays` goes, with all its
 * data. Each one is its own transaction; a busy one waits for the next run. */
export async function purgeIdleDemos(
  pool: Pool,
  at = new Date(),
): Promise<{ expiredDemoPlaces: number }> {
  const { rows } = await pool.query(
    `SELECT id FROM amp_orgs WHERE demo AND demo_seen_at<=$1::timestamptz-make_interval(days=>$2)
     ORDER BY demo_seen_at,id LIMIT 500`,
    [at.toISOString(), RETENTION.idleDemoDays],
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
  return { expiredDemoPlaces };
}

/** A demo was opened: it stays another `idleDemoDays`. At most hourly. */
export async function touchDemo(pool: Pool, orgId: string) {
  await pool.query(
    "UPDATE amp_orgs SET demo_seen_at=now() WHERE id=$1 AND demo AND demo_seen_at<now()-interval '1 hour'",
    [orgId],
  );
}
