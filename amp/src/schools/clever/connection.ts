import { SchoolError } from "../contracts.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { cleverId, CleverSyncError } from "./model.js";

export const connectionInput = z.object({
  environment: z.enum(["sandbox", "production"]),
  districtId: cleverId,
  tenantId: z.uuid(),
  eventsEnabled: z.boolean().optional(),
});
export async function requireAgreement(
  db: Pick<PoolClient, "query">,
  tenantId: string,
) {
  const result = await db.query(
    `SELECT o.id,o.path,o.timezone FROM amp_orgs o
    JOIN LATERAL (SELECT ended_at FROM amp_data_agreements WHERE org_id=o.id
      ORDER BY accepted_at DESC,id DESC LIMIT 1) a ON a.ended_at IS NULL
    WHERE o.id=$1 AND o.kind='district' AND o.parent_id IS NULL AND NOT o.demo`,
    [tenantId],
  );
  if (!result.rowCount)
    throw new CleverSyncError("clever_institution_agreement_required");
  return result.rows[0] as { id: string; path: string[]; timezone: string };
}

/** Caller establishes institutional authority (e.g. a verified district-admin
 * OAuth flow). This helper never grants authority from a name or email match. */
export async function registerCleverConnectionIn(
  db: PoolClient,
  raw: z.input<typeof connectionInput>,
) {
  const input = connectionInput.parse(raw);
  await db.query("SET LOCAL lock_timeout='5s'");
  const existing = (
    await db.query(
      "SELECT id FROM amp_clever_connections WHERE environment=$1 AND district_id=$2",
      [input.environment, input.districtId],
    )
  ).rows[0];
  if (existing) {
    const acquired = (
      await db.query(
        "SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS ok",
        [`clever-sync:${existing.id}`],
      )
    ).rows[0].ok;
    if (!acquired) throw new SchoolError(409, "clever_sync_already_running", 1);
  }
  await requireAgreement(db, input.tenantId);
  const result = await db.query(
    `INSERT INTO amp_clever_connections(id,environment,district_id,tenant_id,events_enabled)
    VALUES($1,$2,$3,$4,COALESCE($5,false))
    ON CONFLICT(environment,district_id) DO UPDATE SET status='active',disconnected_at=NULL,
      events_enabled=COALESCE($5,amp_clever_connections.events_enabled)
    WHERE amp_clever_connections.tenant_id=EXCLUDED.tenant_id RETURNING id`,
    [
      randomUUID(),
      input.environment,
      input.districtId,
      input.tenantId,
      input.eventsEnabled ?? null,
    ],
  );
  if (!result.rowCount)
    throw new CleverSyncError("clever_district_already_bound");
  return { id: result.rows[0].id as string };
}

/** Transaction wrapper for callers that already have an institution. Use the
 * In variant to create the organization, agreement and connection atomically. */
export async function registerCleverConnection(
  pool: Pool,
  raw: z.input<typeof connectionInput>,
) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await registerCleverConnectionIn(db, raw);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

export const cleverSource = (connectionId: string) => `clever:${connectionId}`;

/** Explicitly reviewed migration match, authorized by the caller's institution
 * admin. This never searches by email/name and cannot replace an established
 * identity. It must run before the first import of this Clever user. */
export async function linkCleverPerson(
  pool: Pool,
  raw: {
    connectionId: string;
    userId: string;
    personId: string;
  },
) {
  const input = z
    .object({ connectionId: z.uuid(), userId: cleverId, personId: z.uuid() })
    .parse(raw);
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL lock_timeout='5s'");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `clever-sync:${input.connectionId}`,
    ]);
    const connection = (
      await db.query(
        "SELECT tenant_id FROM amp_clever_connections WHERE id=$1 AND status='active' FOR UPDATE",
        [input.connectionId],
      )
    ).rows[0];
    if (!connection) throw new CleverSyncError("clever_connection_inactive");
    await requireAgreement(db, connection.tenant_id);
    const person = (
      await db.query(
        `SELECT p.id,l.account_id AS learner_owner FROM amp_people p
      LEFT JOIN amp_learners l ON l.id=p.learner_id
      WHERE p.id=$1 AND p.tenant_id=$2 AND p.deleted_at IS NULL FOR UPDATE OF p`,
        [input.personId, connection.tenant_id],
      )
    ).rows[0];
    if (
      !person ||
      (person.learner_owner && person.learner_owner !== `school:${person.id}`)
    )
      throw new CleverSyncError("clever_match_requires_review");
    const existing = (
      await db.query(
        `SELECT local_id,clever_id FROM amp_clever_bindings WHERE connection_id=$1
      AND kind='user' AND (clever_id=$2 OR local_id=$3)`,
        [input.connectionId, input.userId, input.personId],
      )
    ).rows;
    if (
      existing.some(
        (row) =>
          (row.local_id !== null && row.local_id !== input.personId) ||
          row.clever_id !== input.userId,
      )
    )
      throw new CleverSyncError("clever_identity_already_bound");
    const result = await db.query(
      `INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id)
      SELECT $1,$2,'person',$3,$4 WHERE NOT EXISTS(SELECT 1 FROM amp_external_refs
        WHERE tenant_id=$1 AND source=$2 AND kind='person' AND local_id=$4 AND sourced_id<>$3)
      ON CONFLICT(tenant_id,source,kind,sourced_id) DO UPDATE SET local_id=EXCLUDED.local_id
        WHERE amp_external_refs.local_id=EXCLUDED.local_id RETURNING local_id`,
      [
        connection.tenant_id,
        cleverSource(input.connectionId),
        input.userId,
        input.personId,
      ],
    );
    if (!result.rowCount)
      throw new CleverSyncError("clever_identity_already_bound");
    await db.query(
      "UPDATE amp_clever_bindings SET local_id=$3 WHERE connection_id=$1 AND kind='user' AND clever_id=$2 AND local_id IS NULL",
      [input.connectionId, input.userId, input.personId],
    );
    await db.query("COMMIT");
    return { personId: input.personId };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
