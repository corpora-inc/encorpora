import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { recordEvent } from "./events.js";
import { GRACE_DAYS, PILOT_DAYS } from "./pilots.js";

/** The one lifetime pilot of a Clever district: whoever connects it, however
 * often, and whatever AMP org holds it now. */
export const cleverDistrictPilotKey = (
  environment: "sandbox" | "production",
  districtId: string,
) =>
  createHash("sha256")
    .update(`amp-pilot-clever-district-v1:${environment}:${districtId}`)
    .digest("hex");

/** Starts `orgId`'s pilot, or finds the one it has (founder ruling
 * 2026-11-20): 30 days and the usual grace from the first call, covering
 * every class on the org's path below it, including classes made later
 * (`amp_school_pilot_until`). Idempotent: a second call, a reconnect, or a
 * new org for the same identity never restarts or extends it. The caller is
 * in a transaction. Returns the pilot's id. */
export async function startInstitutionPilot(
  db: PoolClient,
  orgId: string,
  key: string,
): Promise<string> {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `pilot-identity:${key}`,
  ]);
  const linked = (
    await db.query("SELECT pilot_id FROM amp_org_pilots WHERE org_id=$1", [
      orgId,
    ])
  ).rows[0]?.pilot_id as string | undefined;
  if (linked) return linked;
  let pilot = (
    await db.query(
      "SELECT pilot_id FROM amp_pilot_eligibility WHERE identity_digest=$1",
      [key],
    )
  ).rows[0]?.pilot_id as string | undefined;
  if (!pilot) {
    pilot = randomUUID();
    await db.query(
      `INSERT INTO amp_teacher_pilots(id,account_id,started_at,ends_at,grace_ends_at)
       VALUES($1::uuid,'institution-pilot:'||$1::text,now(),now()+make_interval(days=>$2::int),now()+make_interval(days=>$3::int))`,
      [pilot, PILOT_DAYS, PILOT_DAYS + GRACE_DAYS],
    );
    await db.query(
      "INSERT INTO amp_pilot_eligibility(identity_digest,pilot_id,confirmed) VALUES($1,$2,true)",
      [key, pilot],
    );
  }
  await db.query("INSERT INTO amp_org_pilots(org_id,pilot_id) VALUES($1,$2)", [
    orgId,
    pilot,
  ]);
  await recordEvent(db, {
    orgId,
    action: "pilot.institution-started",
    targetKind: "org",
    targetId: orgId,
    detail: { after: { pilotId: pilot } },
  });
  return pilot;
}

/** A district connected before its pilot started by itself gets it now,
 * dated from now: on its next roster sync and on its people's next Clever
 * sign-in. Only an active connection; idempotent. */
export async function ensureCleverDistrictPilot(
  /** A pool, or a client outside any transaction (the sync's own). */
  source: Pool | PoolClient,
  connection:
    | { connectionId: string }
    | { environment: "sandbox" | "production"; districtId: string },
): Promise<string | null> {
  const own = !("release" in source);
  const db = own ? await (source as Pool).connect() : (source as PoolClient);
  try {
    await db.query("BEGIN");
    const row = (
      await db.query(
        `SELECT c.tenant_id,c.environment,c.district_id,
           EXISTS(SELECT 1 FROM amp_org_pilots op WHERE op.org_id=c.tenant_id) AS started
         FROM amp_clever_connections c WHERE c.status='active'
           AND (c.id::text=$1 OR (c.environment=$2 AND c.district_id=$3))`,
        "connectionId" in connection
          ? [connection.connectionId, null, null]
          : [null, connection.environment, connection.districtId],
      )
    ).rows[0];
    const pilot = !row
      ? null
      : row.started
        ? null
        : await startInstitutionPilot(
            db,
            row.tenant_id,
            cleverDistrictPilotKey(row.environment, row.district_id),
          );
    await db.query("COMMIT");
    return pilot;
  } catch (error) {
    await db.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    if (own) db.release();
  }
}

/** The institution pilot covering this org (one on its path), while it or
 * its grace runs. What the overview's seats and the license show in place of
 * "no license" while it does. */
export async function institutionPilotOn(
  db: Pick<PoolClient, "query">,
  path: readonly string[],
): Promise<{ endsAt: string; graceEndsAt: string } | null> {
  const row = (
    await db.query(
      `SELECT * FROM (SELECT t.ends_at,greatest(t.grace_ends_at,
         (SELECT max(x.until_at) FROM amp_pilot_extensions x WHERE x.pilot_id=t.id)) AS grace_ends_at
       FROM amp_org_pilots op JOIN amp_teacher_pilots t ON t.id=op.pilot_id
       WHERE op.org_id=ANY($1::uuid[]) AND t.started_at<=now()) p
       WHERE p.grace_ends_at>now() ORDER BY p.grace_ends_at DESC LIMIT 1`,
      [path],
    )
  ).rows[0];
  return row
    ? {
        endsAt: row.ends_at.toISOString(),
        graceEndsAt: row.grace_ends_at.toISOString(),
      }
    : null;
}
