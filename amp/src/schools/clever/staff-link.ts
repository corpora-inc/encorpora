import type { PoolClient } from "pg";
import { z } from "zod";
import { SchoolError } from "../contracts.js";
import { recordEvent } from "../events.js";
import { cleverSource } from "./connection.js";

const inputSchema = z.object({
  connectionId: z.uuid(),
  accountId: z.string().startsWith("amp|"),
  userId: z.string().regex(/^[a-f0-9]{24}$/),
});
const refused = () => new SchoolError(409, "clever_account_link_required");
type Person = {
  id: string;
  tenant_id: string;
  account_id: string | null;
  learner_id: string | null;
  deleted_at: Date | null;
};
type Membership = {
  connection_id: string;
  kind: string;
  source_key: string;
  local_id: string;
  owned: boolean;
  last_seen_run_id: string;
  deadline: string | null;
};

/** Call inside the successful OAuth/link or freshly provider-verified bootstrap
 * transaction, AFTER its identity row belongs to the proved canonical account.
 * This never guesses by email/name and never consolidates a learner. Account
 * lock precedes the connection lock; the roster worker never calls this helper.
 */
export async function attachProvedCleverStaffIn(
  db: PoolClient,
  raw: z.input<typeof inputSchema>,
): Promise<{
  personId: string | null;
  disposition: "unbound" | "attached" | "reused" | "merged";
}> {
  const input = inputSchema.parse(raw);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    input.accountId,
  ]);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `clever-sync:${input.connectionId}`,
  ]);
  const connection = (
    await db.query(
      `SELECT c.tenant_id,c.environment,c.district_id,i.claims FROM amp_clever_connections c
    JOIN amp_provider_identities i ON i.provider='clever' AND i.environment=c.environment AND i.district_id=c.district_id
      AND i.subject=$2 AND i.account_id=$3 WHERE c.id=$1 AND c.status='active'`,
      [input.connectionId, input.userId, input.accountId],
    )
  ).rows[0];
  const roles = connection?.claims?.roles;
  if (
    !connection ||
    !Array.isArray(roles) ||
    roles.includes("student") ||
    roles.includes("contact") ||
    !roles.some((role) => ["teacher", "staff", "district_admin"].includes(role))
  )
    throw refused();
  if (
    (
      await db.query(
        "SELECT 1 FROM amp_account_deletions WHERE account_id=$1",
        [input.accountId],
      )
    ).rowCount
  )
    throw refused();
  const refs = (
    await db.query(
      `SELECT local_id FROM amp_clever_bindings WHERE connection_id=$1 AND kind='user' AND clever_id=$2
    UNION SELECT local_id FROM amp_external_refs WHERE tenant_id=$3 AND source=$4 AND kind='person' AND sourced_id=$2`,
      [
        input.connectionId,
        input.userId,
        connection.tenant_id,
        cleverSource(input.connectionId),
      ],
    )
  ).rows;
  const ids = [
    ...new Set(refs.map((row) => row.local_id).filter(Boolean)),
  ] as string[];
  if (ids.length > 1) throw refused();
  const canonical = (
    await db.query(
      "SELECT id FROM amp_people WHERE tenant_id=$1 AND account_id=$2",
      [connection.tenant_id, input.accountId],
    )
  ).rows[0]?.id as string | undefined;
  const people = (
    await db.query<Person>(
      "SELECT id,tenant_id,account_id,learner_id,deleted_at FROM amp_people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
      [[...ids, ...(canonical ? [canonical] : [])]],
    )
  ).rows;
  const source = people.find((p) => p.id === ids[0]),
    target = people.find((p) => p.id === canonical);
  if (ids.length && !source) throw refused();
  for (const person of people) {
    if (
      person.tenant_id !== connection.tenant_id ||
      person.deleted_at ||
      person.learner_id ||
      (person.account_id && person.account_id !== input.accountId)
    )
      throw refused();
    if (
      (
        await db.query(
          `SELECT 1 FROM amp_org_roles WHERE person_id=$1 AND role='student'
      UNION ALL SELECT 1 FROM amp_enrollments WHERE person_id=$1 AND role='student'
      UNION ALL SELECT 1 FROM amp_term_grades WHERE person_id=$1
      UNION ALL SELECT 1 FROM amp_seats WHERE person_id=$1
      UNION ALL SELECT 1 FROM amp_student_sessions WHERE person_id=$1
      UNION ALL SELECT 1 FROM amp_families WHERE second_parent=$1 LIMIT 1`,
          [person.id],
        )
      ).rowCount
    )
      throw refused();
    // Every provider alias of either record must already belong to this same
    // canonical account or be unclaimed. A second established account stays separate.
    if (
      (
        await db.query(
          `SELECT 1 FROM amp_clever_bindings b JOIN amp_clever_connections c ON c.id=b.connection_id
      LEFT JOIN amp_provider_identities i ON i.provider='clever' AND i.environment=c.environment AND i.district_id=c.district_id AND i.subject=b.clever_id
      WHERE b.kind='user' AND b.local_id=$1 AND (c.id<>$2 OR i.account_id IS NOT NULL AND i.account_id<>$3
        OR i.claims->'roles' ?| ARRAY['student','contact']
        OR b.record->'roles'->'student' IS NOT NULL AND b.record->'roles'->'student'<>'null'::jsonb
        OR b.record->'roles'->'contact' IS NOT NULL AND b.record->'roles'->'contact'<>'null'::jsonb)
      UNION ALL SELECT 1 FROM amp_external_refs x
      LEFT JOIN amp_provider_identities i ON x.source=$5 AND i.provider='clever'
        AND i.environment=$6 AND i.district_id=$7 AND i.subject=x.sourced_id
      WHERE x.kind='person' AND x.local_id=$1 AND (x.tenant_id<>$4
        OR x.source LIKE 'clever:%' AND x.source<>$5
        OR i.account_id IS NOT NULL AND i.account_id<>$3 OR i.claims->'roles' ?| ARRAY['student','contact']) LIMIT 1`,
          [
            person.id,
            input.connectionId,
            input.accountId,
            connection.tenant_id,
            cleverSource(input.connectionId),
            connection.environment,
            connection.district_id,
          ],
        )
      ).rowCount
    )
      throw refused();
  }
  const personId = target?.id ?? source?.id;
  if (!personId) return { personId: null, disposition: "unbound" };
  if (source && target && source.id !== target.id)
    await consolidateStaff(
      db,
      input.connectionId,
      connection.tenant_id,
      source.id,
      target.id,
    );
  await db.query("UPDATE amp_people SET account_id=$2 WHERE id=$1", [
    personId,
    input.accountId,
  ]);
  await db.query(
    `INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id) VALUES($1,$2,'person',$3,$4)
    ON CONFLICT(tenant_id,source,kind,sourced_id) DO UPDATE SET local_id=excluded.local_id`,
    [
      connection.tenant_id,
      cleverSource(input.connectionId),
      input.userId,
      personId,
    ],
  );
  await recordEvent(db, {
    orgId: connection.tenant_id,
    actorPersonId: personId,
    action: "staff.clever-identity-linked",
    targetKind: "person",
    targetId: personId,
    detail: {
      after: {
        connectionId: input.connectionId,
        ...(source && source.id !== personId
          ? { mergedPersonId: source.id }
          : {}),
      },
    },
  });
  return {
    personId,
    disposition:
      source && target && source.id !== target.id
        ? "merged"
        : source && !target
          ? "attached"
          : "reused",
  };
}

async function consolidateStaff(
  db: PoolClient,
  connectionId: string,
  tenantId: string,
  source: string,
  target: string,
) {
  const settings = (
    await db.query(
      `SELECT scope_id,"values",locked FROM amp_scope_settings WHERE scope_kind='person' AND scope_id=ANY($1::uuid[]) ORDER BY scope_id FOR UPDATE`,
      [[source, target]],
    )
  ).rows;
  const sourceSettings = settings.find((s) => s.scope_id === source),
    targetSettings = settings.find((s) => s.scope_id === target);
  if (
    sourceSettings &&
    targetSettings &&
    (JSON.stringify(sourceSettings.values) !==
      JSON.stringify(targetSettings.values) ||
      JSON.stringify(sourceSettings.locked) !==
        JSON.stringify(targetSettings.locked))
  )
    throw refused();
  const hasDeadline =
    (
      await db.query(`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema()
    AND table_name='amp_clever_memberships' AND column_name='bootstrap_valid_until') AS present`)
    ).rows[0].present === true;
  for (const [table, scope, kind] of [
    ["amp_org_roles", "org_id", "org_role"],
    ["amp_enrollments", "class_id", "enrollment"],
  ] as const) {
    const rows = (
      await db.query<{
        id: string;
        person_id: string;
        scope_id: string;
        role: string;
        begin_on: Date;
        end_on: Date | null;
      }>(
        `SELECT id,person_id,${scope} AS scope_id,role,begin_on,end_on FROM ${table} WHERE person_id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
        [[source, target]],
      )
    ).rows;
    const mappings = (
      await db.query<Membership>(
        `SELECT m.*,to_jsonb(m)->>'bootstrap_valid_until' AS deadline FROM amp_clever_memberships m WHERE kind=$1 AND local_id=ANY($2::uuid[])`,
        [kind, rows.map((r) => r.id)],
      )
    ).rows;
    if (mappings.some((m) => m.connection_id !== connectionId)) throw refused();
    for (const row of rows.filter((r) => r.person_id === source)) {
      const duplicate =
        row.end_on === null
          ? rows.find(
              (r) =>
                r.person_id === target &&
                r.end_on === null &&
                r.scope_id === row.scope_id &&
                r.role === row.role,
            )
          : undefined;
      const to = duplicate ?? row;
      const relevant = mappings.filter(
        (m) => m.local_id === row.id || m.local_id === to.id,
      );
      const ownership = (id: string) =>
        mappings.some((m) => m.local_id === id && m.owned) &&
        !mappings.some((m) => m.local_id === id && !m.owned);
      const owned = duplicate
        ? ownership(row.id) && ownership(to.id)
        : ownership(row.id);
      // A collision closes only the redundant episode. Both historical row IDs
      // remain, while the canonical person's active episode is the one source tracks.
      if (duplicate)
        await db.query(
          `UPDATE ${table} SET person_id=$2,end_on=GREATEST(begin_on,(now() AT TIME ZONE (SELECT timezone FROM amp_orgs WHERE id=$3))::date) WHERE id=$1`,
          [row.id, target, tenantId],
        );
      else
        await db.query(`UPDATE ${table} SET person_id=$2 WHERE id=$1`, [
          row.id,
          target,
        ]);
      if (kind === "enrollment" && duplicate)
        await db.query(
          "UPDATE amp_external_refs SET local_id=$2 WHERE tenant_id=$3 AND kind='enrollment' AND local_id=$1",
          [row.id, to.id, tenantId],
        );
      // Independent manual authority survives the union. Source-owned bootstrap
      // authority retains its finite expiry instead of becoming an unlimited role.
      const deadline = relevant.some((m) => m.deadline === null)
        ? null
        : (relevant
            .map((m) => m.deadline!)
            .sort()
            .at(-1) ?? null);
      const sourceKey = `${row.scope_id}:${target}:${row.role}`;
      for (const m of mappings.filter((m) => m.local_id === row.id)) {
        // A closed historical episode cannot replace a live canonical source
        // relation. Its row survives as history, without a second source key.
        if (
          row.end_on &&
          rows.some(
            (r) =>
              r.person_id === target &&
              r.scope_id === row.scope_id &&
              r.role === row.role &&
              r.end_on === null,
          )
        ) {
          await db.query(
            "DELETE FROM amp_clever_memberships WHERE connection_id=$1 AND kind=$2 AND source_key=$3",
            [connectionId, kind, m.source_key],
          );
          continue;
        }
        if (m.source_key !== sourceKey)
          await db.query(
            "DELETE FROM amp_clever_memberships WHERE connection_id=$1 AND kind=$2 AND source_key=$3",
            [connectionId, kind, m.source_key],
          );
        await db.query(
          `INSERT INTO amp_clever_memberships(connection_id,kind,source_key,local_id,owned,last_seen_run_id${hasDeadline ? ",bootstrap_valid_until" : ""})
          VALUES($1,$2,$3,$4,$5,$6${hasDeadline ? ",$7" : ""}) ON CONFLICT(connection_id,kind,source_key)
          DO UPDATE SET local_id=excluded.local_id,owned=excluded.owned${hasDeadline ? ",bootstrap_valid_until=excluded.bootstrap_valid_until" : ""}`,
          [
            connectionId,
            kind,
            sourceKey,
            to.id,
            owned,
            m.last_seen_run_id,
            ...(hasDeadline ? [deadline] : []),
          ],
        );
      }
      if (duplicate)
        await db.query(
          `UPDATE amp_clever_memberships SET owned=$2${hasDeadline ? ",bootstrap_valid_until=$3" : ""} WHERE local_id=$1 AND kind='${kind}'`,
          [to.id, owned, ...(hasDeadline ? [deadline] : [])],
        );
    }
  }
  await db.query(
    "UPDATE amp_external_refs SET local_id=$2 WHERE tenant_id=$3 AND kind='person' AND local_id=$1",
    [source, target, tenantId],
  );
  await db.query(
    "UPDATE amp_clever_bindings SET local_id=$2 WHERE connection_id=$3 AND kind='user' AND local_id=$1",
    [source, target, connectionId],
  );
  await db.query(
    "UPDATE amp_person_credentials SET revoked_at=COALESCE(revoked_at,now()) WHERE person_id=$1",
    [source],
  );
  if (sourceSettings) {
    if (targetSettings)
      await db.query(
        "DELETE FROM amp_scope_settings WHERE scope_kind='person' AND scope_id=$1",
        [source],
      );
    else
      await db.query(
        "UPDATE amp_scope_settings SET scope_id=$2 WHERE scope_kind='person' AND scope_id=$1",
        [source, target],
      );
  }
  // Historical actors, authorizations and pilot activation keep this tombstone.
  // Move bindings first so the privacy trigger cannot scrub the surviving user.
  await db.query(
    "UPDATE amp_people SET account_id=NULL,deleted_at=now(),given_name='Removed',family_name=NULL,display_name=NULL,email=NULL WHERE id=$1",
    [source],
  );
}
