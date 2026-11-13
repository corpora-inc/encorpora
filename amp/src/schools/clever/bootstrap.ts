import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { generateHandle } from "../repository.js";
import { CleverSyncError, type User } from "./model.js";
import { cleverSource } from "./connection.js";

/** A current district-admin profile verified by the provider authorizes staging
 * an import. Its role is source-owned, so later sharing/role revocation ends it. */
export async function bootstrapCleverAdmin(
  db: PoolClient,
  connectionId: string,
  tenantId: string,
  accountId: string,
  user: User,
) {
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    accountId,
  ]);
  const found = (
    await db.query(
      `SELECT p.id,p.account_id,p.deleted_at FROM amp_clever_bindings b JOIN amp_people p ON p.id=b.local_id
    WHERE b.connection_id=$1 AND b.kind='user' AND b.clever_id=$2`,
      [connectionId, user.id],
    )
  ).rows[0];
  if (
    found?.deleted_at ||
    (found?.account_id && found.account_id !== accountId)
  )
    throw new CleverSyncError("clever_account_link_required");
  const personId = found?.id ?? randomUUID();
  if (!found)
    await db.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,family_name,handle,account_id,timezone)
    SELECT $1,$2,$3,$4,$5,$6,timezone FROM amp_orgs WHERE id=$2`,
      [
        personId,
        tenantId,
        user.name.first?.slice(0, 100) || "Administrator",
        user.name.last?.slice(0, 100) || null,
        generateHandle(),
        accountId,
      ],
    );
  else
    await db.query("UPDATE amp_people SET account_id=$2 WHERE id=$1", [
      personId,
      accountId,
    ]);
  const runId = randomUUID();
  await db.query(
    `INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status,finished_at,counts)
    VALUES($1,$2,'full','succeeded',now(),'{"bootstrap":1}')`,
    [runId, connectionId],
  );
  await db.query(
    `INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,local_id,record,metadata,last_seen_run_id)
    VALUES($1,'user',$2,$3,$4,'{"roles":["district_admin"]}',$5)
    ON CONFLICT(connection_id,kind,clever_id) DO UPDATE SET archived_at=NULL,record=excluded.record,metadata=excluded.metadata,last_seen_run_id=excluded.last_seen_run_id`,
    [connectionId, user.id, personId, JSON.stringify(user), runId],
  );
  await db.query(
    `INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id)
    VALUES($1,$2,'person',$3,$4) ON CONFLICT DO NOTHING`,
    [tenantId, cleverSource(connectionId), user.id, personId],
  );
  let role = (
    await db.query(
      "SELECT id FROM amp_org_roles WHERE person_id=$1 AND org_id=$2 AND role='admin' AND end_on IS NULL",
      [personId, tenantId],
    )
  ).rows[0];
  const created = !role;
  if (!role)
    role = (
      await db.query(
        `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on)
    SELECT $1,$2,$3,'admin',(now() AT TIME ZONE timezone)::date FROM amp_orgs WHERE id=$3 RETURNING id`,
        [randomUUID(), personId, tenantId],
      )
    ).rows[0];
  await db.query(
    `INSERT INTO amp_clever_memberships(connection_id,kind,source_key,local_id,owned,last_seen_run_id,bootstrap_valid_until)
    VALUES($1,'org_role',$2,$3,$4,$5,CASE WHEN $4 THEN now()+interval '15 minutes' END) ON CONFLICT(connection_id,kind,source_key)
    DO UPDATE SET local_id=excluded.local_id,owned=amp_clever_memberships.owned OR excluded.owned,last_seen_run_id=excluded.last_seen_run_id,bootstrap_valid_until=CASE WHEN amp_clever_memberships.owned OR excluded.owned THEN now()+interval '15 minutes' END`,
    [connectionId, `${tenantId}:${personId}:admin`, role.id, created, runId],
  );
}
