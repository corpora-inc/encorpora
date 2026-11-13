import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { activeToday } from "./principal.js";
import { recordEvent } from "./events.js";
import { cleverId, CleverSyncError } from "./clever/model.js";
import { cleverSource, requireAgreement } from "./clever/connection.js";
import { syncSsoCredentials } from "./sso-credentials.js";

type Database = Pick<PoolClient, "query">;
const destinations = z.object({ schoolId: z.uuid(), districtId: z.uuid() });
const decisions = z.object({
  staffMerges: z
    .array(z.object({ sourcePersonId: z.uuid(), targetPersonId: z.uuid() }))
    .max(1000)
    .default([]),
  cleverSchool: z
    .object({ connectionId: z.uuid(), schoolId: cleverId })
    .optional(),
});
type Decisions = z.input<typeof decisions>;
type Grant = {
  id: string;
  source_account_id: string;
  school_id: string;
  district_id: string;
  expires_at: Date;
  consumed_at: Date | null;
  revoked_at: Date | null;
};
export type AdoptionConflict = {
  code:
    | "account_already_in_district"
    | "source_identifier_conflict"
    | "external_membership"
    | "source_connection";
  sourcePersonId?: string;
  targetPersonId?: string;
  source?: string;
  kind?: string;
  sourcedId?: string;
};
export type AdoptionPlan = {
  schoolId: string;
  districtId: string;
  people: number;
  learners: number;
  classes: number;
  conflicts: AdoptionConflict[];
};

const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
async function transaction<T>(
  pool: Pool,
  work: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL lock_timeout='5s'");
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
async function isAdmin(db: Database, accountId: string, orgId: string) {
  return !!(
    await db.query(
      `SELECT 1 FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id
    JOIN amp_orgs scope ON scope.id=r.org_id JOIN amp_orgs target ON r.org_id=ANY(target.path)
    WHERE p.account_id=$1 AND p.deleted_at IS NULL AND r.role='admin'
      AND target.id=$2 AND ${activeToday("r", "scope")} LIMIT 1`,
      [accountId, orgId],
    )
  ).rowCount;
}
/** A teacher owns the school only when every live class was started by that
 * account and that account is still actively enrolled as its teacher. */
async function isSourceOwner(
  db: Database,
  accountId: string,
  schoolId: string,
) {
  if (await isAdmin(db, accountId, schoolId)) return true;
  const table = (
    await db.query("SELECT to_regclass('amp_school_starts') AS name")
  ).rows[0].name;
  if (!table) return false;
  return (
    (
      await db.query(
        `SELECT EXISTS(SELECT 1 FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
      WHERE o.path[1]=$2 AND c.archived_at IS NULL) AND NOT EXISTS(
    SELECT 1 FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
    WHERE o.path[1]=$2 AND c.archived_at IS NULL AND (
      NOT EXISTS(SELECT 1 FROM amp_school_starts s WHERE s.account_id=$1 AND s.org_id=$2 AND s.class_id=c.id)
      OR NOT EXISTS(SELECT 1 FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
        WHERE e.class_id=c.id AND e.role='teacher' AND p.account_id=$1 AND p.deleted_at IS NULL
          AND ${activeToday("e", "o")}
          AND EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs scope ON scope.id=r.org_id
            WHERE r.person_id=p.id AND r.org_id=ANY(o.path) AND r.role IN ('teacher','admin')
              AND ${activeToday("r", "scope")}))
    )) AS owner`,
        [accountId, schoolId],
      )
    ).rows[0].owner === true
  );
}
async function institutions(
  db: Database,
  schoolId: string,
  districtId: string,
) {
  const school = (
    await db.query(
      "SELECT id FROM amp_orgs WHERE id=$1 AND kind='school' AND parent_id IS NULL AND NOT demo",
      [schoolId],
    )
  ).rows[0];
  if (!school || schoolId === districtId)
    throw new CleverSyncError("adoption_needs_standalone_school");
  await requireAgreement(db, districtId);
  if (
    (
      await db.query(
        "SELECT 1 FROM amp_orgs WHERE path[1]=$1 AND (demo OR kind<>'school')",
        [schoolId],
      )
    ).rowCount
  )
    throw new CleverSyncError("adoption_unsupported_tree");
}

export async function issueSchoolAdoption(
  pool: Pool,
  sourceAccountId: string,
  raw: z.input<typeof destinations>,
  now = new Date(),
) {
  const input = destinations.parse(raw);
  return transaction(pool, async (db) => {
    await institutions(db, input.schoolId, input.districtId);
    if (!(await isSourceOwner(db, sourceAccountId, input.schoolId)))
      throw new CleverSyncError("adoption_source_authority_required");
    const id = randomUUID();
    const token = `adopt_${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(now.getTime() + 7 * 86_400_000);
    await db.query(
      `INSERT INTO amp_school_adoptions(id,token_hash,source_account_id,school_id,district_id,created_at,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        tokenHash(token),
        sourceAccountId,
        input.schoolId,
        input.districtId,
        now,
        expiresAt,
      ],
    );
    await recordEvent(db, {
      orgId: input.schoolId,
      action: "school.adoption-authorized",
      targetKind: "org",
      targetId: input.districtId,
      detail: { after: { requestId: id, expiresAt: expiresAt.toISOString() } },
    });
    return { id, token, expiresAt: expiresAt.toISOString() };
  });
}

async function grantFor(
  db: Database,
  accountId: string,
  token: string,
  lock = false,
  now = new Date(),
): Promise<Grant> {
  if (!/^adopt_[A-Za-z0-9_-]{43}$/.test(token))
    throw new CleverSyncError("adoption_not_found");
  const grant = (
    await db.query(
      `SELECT * FROM amp_school_adoptions WHERE token_hash=$1${lock ? " FOR UPDATE" : ""}`,
      [tokenHash(token)],
    )
  ).rows[0] as Grant | undefined;
  if (!grant || grant.revoked_at || grant.expires_at <= now)
    throw new CleverSyncError("adoption_expired_or_revoked");
  if (grant.consumed_at) throw new CleverSyncError("adoption_already_used");
  if (!(await isAdmin(db, accountId, grant.district_id)))
    throw new CleverSyncError("adoption_destination_authority_required");
  await institutions(db, grant.school_id, grant.district_id);
  if (!(await isSourceOwner(db, grant.source_account_id, grant.school_id)))
    throw new CleverSyncError("adoption_source_authority_changed");
  return grant;
}

async function adoptionPlan(
  db: Database,
  schoolId: string,
  districtId: string,
): Promise<AdoptionPlan> {
  const conflicts: AdoptionConflict[] = [];
  const duplicateAccounts = (
    await db.query(
      `SELECT a.id AS source_id,b.id AS target_id FROM amp_people a
    JOIN amp_people b ON b.account_id=a.account_id AND b.tenant_id=$2
    WHERE a.tenant_id=$1 AND a.account_id IS NOT NULL ORDER BY a.id,b.id`,
      [schoolId, districtId],
    )
  ).rows;
  for (const row of duplicateAccounts)
    conflicts.push({
      code: "account_already_in_district",
      sourcePersonId: row.source_id,
      targetPersonId: row.target_id,
    });
  const duplicateRefs = (
    await db.query(
      `SELECT a.source,a.kind,a.sourced_id FROM amp_external_refs a
    JOIN amp_external_refs b ON b.tenant_id=$2 AND b.source=a.source AND b.kind=a.kind AND b.sourced_id=a.sourced_id
    WHERE a.tenant_id=$1 AND a.local_id<>b.local_id ORDER BY a.source,a.kind,a.sourced_id`,
      [schoolId, districtId],
    )
  ).rows;
  for (const row of duplicateRefs)
    conflicts.push({
      code: "source_identifier_conflict",
      source: row.source,
      kind: row.kind,
      sourcedId: row.sourced_id,
    });
  const strays = (
    await db.query(
      `SELECT EXISTS(
    SELECT 1 FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id JOIN amp_orgs o ON o.id=r.org_id WHERE p.tenant_id=$1 AND o.path[1]<>$1
    UNION ALL SELECT 1 FROM amp_people p JOIN amp_enrollments e ON e.person_id=p.id JOIN amp_classes c ON c.id=e.class_id
      JOIN amp_orgs o ON o.id=c.org_id WHERE p.tenant_id=$1 AND o.path[1]<>$1
    UNION ALL SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id JOIN amp_people p ON p.id=r.person_id WHERE o.path[1]=$1 AND p.tenant_id<>$1
    UNION ALL SELECT 1 FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id JOIN amp_people p ON p.id=e.person_id
      WHERE o.path[1]=$1 AND p.tenant_id<>$1) AS stray`,
      [schoolId],
    )
  ).rows[0].stray;
  if (strays) conflicts.push({ code: "external_membership" });
  if (
    (
      await db.query(
        "SELECT 1 FROM amp_clever_connections WHERE tenant_id=$1",
        [schoolId],
      )
    ).rowCount
  )
    conflicts.push({ code: "source_connection" });
  const counts = (
    await db.query(
      `SELECT
    (SELECT count(*)::int FROM amp_people WHERE tenant_id=$1) AS people,
    (SELECT count(*)::int FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL) AS learners,
    (SELECT count(*)::int FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id WHERE o.path[1]=$1) AS classes`,
      [schoolId],
    )
  ).rows[0];
  return { schoolId, districtId, ...counts, conflicts };
}

export async function previewSchoolAdoption(
  db: Database,
  accountId: string,
  token: string,
): Promise<AdoptionPlan> {
  const grant = await grantFor(db, accountId, token);
  return adoptionPlan(db, grant.school_id, grant.district_id);
}

/** The only permitted duplicate-person resolution is an explicit match between
 * two staff records on the same canonical account, neither holding a learner.
 * Historical actor references retain the source tombstone. */
async function mergeStaff(
  db: PoolClient,
  schoolId: string,
  districtId: string,
  source: string,
  target: string,
) {
  const rows = (
    await db.query(
      `SELECT id,tenant_id,account_id,learner_id,deleted_at FROM amp_people
    WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [[source, target]],
    )
  ).rows;
  const from = rows.find((p) => p.id === source),
    to = rows.find((p) => p.id === target);
  if (
    !from ||
    !to ||
    source === target ||
    from.tenant_id !== schoolId ||
    to.tenant_id !== districtId ||
    !from.account_id ||
    from.account_id !== to.account_id ||
    from.learner_id ||
    to.learner_id ||
    from.deleted_at ||
    to.deleted_at
  )
    throw new CleverSyncError("adoption_staff_match_invalid");
  if (
    (
      await db.query(
        `SELECT 1 FROM amp_org_roles WHERE person_id=ANY($1::uuid[]) AND role='student'
    UNION ALL SELECT 1 FROM amp_enrollments WHERE person_id=ANY($1::uuid[]) AND role='student' LIMIT 1`,
        [[source, target]],
      )
    ).rowCount
  )
    throw new CleverSyncError("adoption_learner_merge_forbidden");
  await db.query("UPDATE amp_org_roles SET person_id=$2 WHERE person_id=$1", [
    source,
    target,
  ]);
  await db.query("UPDATE amp_enrollments SET person_id=$2 WHERE person_id=$1", [
    source,
    target,
  ]);
  await db.query(
    "UPDATE amp_external_refs SET local_id=$2 WHERE tenant_id=$3 AND kind='person' AND local_id=$1",
    [source, target, schoolId],
  );
  await db.query(
    "UPDATE amp_person_credentials SET revoked_at=COALESCE(revoked_at,now()) WHERE person_id=$1",
    [source],
  );
  await db.query(
    "UPDATE amp_student_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE person_id=$1",
    [source],
  );
  await db.query(
    `UPDATE amp_people SET account_id=NULL,deleted_at=now(),given_name='Removed',family_name=NULL,
    display_name=NULL,email=NULL WHERE id=$1`,
    [source],
  );
}

export async function acceptSchoolAdoptionIn(
  db: PoolClient,
  accountId: string,
  token: string,
  raw: Decisions = {},
) {
  const input = decisions.parse(raw);
  const grant = await grantFor(db, accountId, token, true);
  const { school_id: schoolId, district_id: districtId } = grant;
  if (input.cleverSchool) {
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `clever-sync:${input.cleverSchool.connectionId}`,
    ]);
  }
  for (const orgId of [schoolId, districtId].sort())
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `school-adoption:${orgId}`,
    ]);
  await db.query(
    "SELECT id FROM amp_orgs WHERE path[1]=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
    [[schoolId, districtId]],
  );
  // Keep current ownership and administrator evidence stable through commit.
  // Org locks also block concurrent insertion of new classes and memberships.
  await db.query(
    "SELECT id FROM amp_people WHERE tenant_id=ANY($1::uuid[]) AND account_id=ANY($2::text[]) ORDER BY id FOR SHARE",
    [
      [schoolId, districtId],
      [grant.source_account_id, accountId],
    ],
  );
  await db.query(
    `SELECT r.id FROM amp_org_roles r JOIN amp_people p ON p.id=r.person_id
    WHERE p.tenant_id=ANY($1::uuid[]) AND p.account_id=ANY($2::text[]) ORDER BY r.id FOR SHARE OF r`,
    [
      [schoolId, districtId],
      [grant.source_account_id, accountId],
    ],
  );
  await db.query(
    `SELECT c.id FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
    WHERE o.path[1]=$1 ORDER BY c.id FOR SHARE OF c`,
    [schoolId],
  );
  await db.query(
    `SELECT e.id FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
    JOIN amp_orgs o ON o.id=c.org_id WHERE o.path[1]=$1 ORDER BY e.id FOR SHARE OF e`,
    [schoolId],
  );
  if (
    (await db.query("SELECT to_regclass('amp_school_starts') AS name")).rows[0]
      .name
  )
    await db.query(
      "SELECT class_id FROM amp_school_starts WHERE org_id=$1 FOR SHARE",
      [schoolId],
    );
  await db.query(
    "SELECT id FROM amp_data_agreements WHERE org_id=$1 FOR SHARE",
    [districtId],
  );
  // Re-read after waiting for locks. The bearer token does not replace either
  // party's current institutional authority.
  await grantFor(db, accountId, token);
  const before = await adoptionPlan(db, schoolId, districtId);
  if (
    before.conflicts.some(
      (c) =>
        c.code !== "account_already_in_district" &&
        c.code !== "source_identifier_conflict",
    )
  )
    throw new CleverSyncError("adoption_conflicts_require_review");
  const seen = new Set<string>();
  for (const match of input.staffMerges) {
    if (seen.has(match.sourcePersonId) || seen.has(match.targetPersonId))
      throw new CleverSyncError("adoption_duplicate_match");
    seen.add(match.sourcePersonId);
    seen.add(match.targetPersonId);
    await mergeStaff(
      db,
      schoolId,
      districtId,
      match.sourcePersonId,
      match.targetPersonId,
    );
  }
  const unresolved = await adoptionPlan(db, schoolId, districtId);
  // Staff merged into a destination person now correctly has memberships in
  // both roots until the path moves. All other cross-root relationships were
  // rejected before any merge.
  if (unresolved.conflicts.some((c) => c.code !== "external_membership"))
    throw new CleverSyncError("adoption_conflicts_require_review");
  if (input.cleverSchool) {
    const connection = (
      await db.query(
        "SELECT id FROM amp_clever_connections WHERE id=$1 AND tenant_id=$2 AND status='active'",
        [input.cleverSchool.connectionId, districtId],
      )
    ).rows[0];
    if (!connection)
      throw new CleverSyncError("adoption_clever_connection_mismatch");
    const binding = (
      await db.query(
        "SELECT local_id FROM amp_clever_bindings WHERE connection_id=$1 AND kind='school' AND clever_id=$2",
        [connection.id, input.cleverSchool.schoolId],
      )
    ).rows[0];
    if (binding && binding.local_id !== schoolId)
      throw new CleverSyncError("adoption_clever_school_already_bound");
    const source = cleverSource(connection.id);
    const ref = (
      await db.query(
        "SELECT local_id,sourced_id FROM amp_external_refs WHERE tenant_id=$1 AND source=$2 AND kind='org' AND (sourced_id=$3 OR local_id=$4)",
        [districtId, source, input.cleverSchool.schoolId, schoolId],
      )
    ).rows;
    if (
      ref.some(
        (r) =>
          r.local_id !== schoolId ||
          r.sourced_id !== input.cleverSchool!.schoolId,
      )
    )
      throw new CleverSyncError("adoption_clever_school_already_bound");
    await db.query(
      `INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id)
      VALUES($1,$2,'org',$3,$4) ON CONFLICT DO NOTHING`,
      [districtId, source, input.cleverSchool.schoolId, schoolId],
    );
  }
  await db.query(
    `UPDATE amp_orgs SET path=ARRAY[$2::uuid]||path,
    parent_id=CASE WHEN id=$1 THEN $2::uuid ELSE parent_id END WHERE path[1]=$1`,
    [schoolId, districtId],
  );
  await db.query("UPDATE amp_people SET tenant_id=$2 WHERE tenant_id=$1", [
    schoolId,
    districtId,
  ]);
  // Exact duplicate references to the same reviewed local record are redundant.
  await db.query(
    `DELETE FROM amp_external_refs a USING amp_external_refs b WHERE a.tenant_id=$1 AND b.tenant_id=$2
    AND a.source=b.source AND a.kind=b.kind AND a.sourced_id=b.sourced_id AND a.local_id=b.local_id`,
    [schoolId, districtId],
  );
  await db.query(
    "UPDATE amp_external_refs SET tenant_id=$2 WHERE tenant_id=$1",
    [schoolId, districtId],
  );
  await syncSsoCredentials(db, districtId);
  await db.query(
    "UPDATE amp_school_adoptions SET consumed_at=now(),accepted_by_account_id=$2 WHERE id=$1",
    [grant.id, accountId],
  );
  for (const orgId of [schoolId, districtId])
    await recordEvent(db, {
      orgId,
      action: "school.adopted",
      targetKind: "org",
      targetId: schoolId,
      detail: {
        before: { tenantId: schoolId },
        after: {
          tenantId: districtId,
          requestId: grant.id,
          staffMerges: input.staffMerges,
        },
      },
    });
  return {
    schoolId,
    districtId,
    people: before.people,
    learners: before.learners,
    classes: before.classes,
  };
}

export const acceptSchoolAdoption = (
  pool: Pool,
  accountId: string,
  token: string,
  input: Decisions = {},
) =>
  transaction(pool, (db) =>
    acceptSchoolAdoptionIn(db, accountId, token, input),
  );

export async function revokeSchoolAdoption(
  pool: Pool,
  accountId: string,
  id: string,
) {
  z.uuid().parse(id);
  return transaction(pool, async (db) => {
    const grant = (
      await db.query(
        "SELECT * FROM amp_school_adoptions WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0] as Grant | undefined;
    if (
      !grant ||
      (grant.source_account_id !== accountId &&
        !(await isAdmin(db, accountId, grant.school_id)))
    )
      throw new CleverSyncError("adoption_source_authority_required");
    if (grant.consumed_at) throw new CleverSyncError("adoption_already_used");
    await db.query(
      "UPDATE amp_school_adoptions SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1",
      [id],
    );
    return { revoked: true };
  });
}
