import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { activeToday } from "./principal.js";
import { recordEvent } from "./events.js";
import {
  validateSnapshot,
  type Snapshot,
  type User,
  userSchema,
  CleverSyncError,
} from "./clever/model.js";
import {
  adoptionDestination as destinations,
  adoptionDecisions as decisions,
} from "./adoption-contracts.js";
import { cleverSource, requireAgreement } from "./clever/connection.js";
import { syncSsoCredentials } from "./sso-credentials.js";

type Database = Pick<PoolClient, "query">;
type Decisions = z.input<typeof decisions>;
type Authority = {
  authoritySnapshots?: Pick<Snapshot, "district" | "users">[];
};
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
/** Solo-school adoption requires the creator to own every class and all active
 * staff roles, and to teach every student. Other schools require an admin. */
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
        `SELECT EXISTS(SELECT 1 FROM amp_orgs o JOIN amp_school_starts s ON s.org_id=o.id
        WHERE o.id=$2 AND o.solo AND s.account_id=$1 AND s.created_school)
      AND NOT EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_people p ON p.id=r.person_id
        JOIN amp_orgs o ON o.id=r.org_id WHERE o.path[1]=$2 AND r.role<>'student'
          AND p.account_id IS DISTINCT FROM $1 AND p.deleted_at IS NULL AND ${activeToday("r", "o")})
      AND NOT EXISTS(SELECT 1 FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
        JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
        WHERE o.path[1]=$2 AND e.role<>'student' AND p.account_id IS DISTINCT FROM $1
          AND p.deleted_at IS NULL AND ${activeToday("e", "o")})
      AND NOT EXISTS(SELECT 1 FROM amp_people p WHERE p.tenant_id=$2 AND p.deleted_at IS NULL
        AND (p.learner_id IS NOT NULL OR EXISTS(SELECT 1 FROM amp_org_roles r WHERE r.person_id=p.id AND r.role='student'))
        AND NOT EXISTS(SELECT 1 FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
          JOIN amp_orgs o ON o.id=c.org_id JOIN amp_school_starts s ON s.class_id=c.id AND s.account_id=$1
          WHERE e.person_id=p.id AND e.role='student' AND c.archived_at IS NULL AND ${activeToday("e", "o")}))
      AND NOT EXISTS(SELECT 1 FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
        WHERE o.path[1]=$2 AND NOT EXISTS(SELECT 1 FROM amp_school_starts s WHERE s.class_id=c.id AND s.account_id=$1))
      AND EXISTS(SELECT 1 FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
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
  authority: Authority = {},
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
  await requireCurrentAdoptionAdmin(
    db,
    accountId,
    grant.district_id,
    authority.authoritySnapshots ?? [],
  );
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
  authority: Authority = {},
): Promise<AdoptionPlan> {
  const grant = await grantFor(
    db,
    accountId,
    token,
    false,
    new Date(),
    authority,
  );
  return adoptionPlan(db, grant.school_id, grant.district_id);
}

export async function schoolAdoptionOptions(
  db: Database,
  accountId: string,
  districtId?: string,
) {
  const candidates = (
    await db.query(
      `SELECT DISTINCT o.id,o.name FROM amp_orgs o
    JOIN amp_people p ON p.tenant_id=o.id WHERE p.account_id=$1 AND p.deleted_at IS NULL
    AND o.parent_id IS NULL AND o.kind='school' AND NOT o.demo ORDER BY o.name,o.id`,
      [accountId],
    )
  ).rows;
  const schools = [];
  for (const school of candidates)
    if (await isSourceOwner(db, accountId, school.id)) {
      const classes = (
        await db.query(
          `SELECT count(*)::int AS n FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
      WHERE o.path[1]=$1 AND c.archived_at IS NULL`,
          [school.id],
        )
      ).rows[0].n;
      schools.push({ ...school, classes });
    }
  let district = null;
  if (districtId) {
    z.uuid().parse(districtId);
    await requireAgreement(db, districtId);
    district = (
      await db.query("SELECT id,name FROM amp_orgs WHERE id=$1", [districtId])
    ).rows[0];
  }
  const grants = (
    await db.query(
      `SELECT a.id,s.name AS "schoolName",d.name AS "districtName",a.expires_at AS "expiresAt",
    CASE WHEN a.consumed_at IS NOT NULL THEN 'used' WHEN a.revoked_at IS NOT NULL THEN 'revoked'
      WHEN a.expires_at<=now() THEN 'expired' ELSE 'open' END AS status
    FROM amp_school_adoptions a JOIN amp_orgs s ON s.id=a.school_id JOIN amp_orgs d ON d.id=a.district_id
    WHERE a.source_account_id=$1 ORDER BY a.created_at DESC LIMIT 100`,
      [accountId],
    )
  ).rows.map((r) => ({ ...r, expiresAt: r.expiresAt.toISOString() }));
  const districts = (
    await db.query(
      `SELECT DISTINCT o.id,o.name FROM amp_orgs o
    JOIN amp_org_roles r ON r.org_id=o.id AND r.role='admin' JOIN amp_people p ON p.id=r.person_id
    JOIN LATERAL (SELECT ended_at FROM amp_data_agreements a WHERE a.org_id=o.id ORDER BY accepted_at DESC,id DESC LIMIT 1) a ON a.ended_at IS NULL
    WHERE p.account_id=$1 AND p.deleted_at IS NULL AND o.kind='district' AND o.parent_id IS NULL AND NOT o.demo
      AND ${activeToday("r", "o")} ORDER BY o.name,o.id`,
      [accountId],
    )
  ).rows;
  return { schools, districts, district, grants };
}

export async function schoolAdoptionDistrict(
  db: Database,
  accountId: string,
  districtId: string,
  authority: Authority = {},
) {
  z.uuid().parse(districtId);
  await requireCurrentAdoptionAdmin(
    db,
    accountId,
    districtId,
    authority.authoritySnapshots ?? [],
  );
  await requireAgreement(db, districtId);
  return {
    district: (
      await db.query("SELECT id,name FROM amp_orgs WHERE id=$1", [districtId])
    ).rows[0],
  };
}

export async function reviewSchoolAdoption(
  db: Database,
  accountId: string,
  token: string,
  authority: Authority = {},
) {
  const grant = await grantFor(
    db,
    accountId,
    token,
    false,
    new Date(),
    authority,
  );
  const plan = await adoptionPlan(db, grant.school_id, grant.district_id);
  const places = (
    await db.query("SELECT id,name FROM amp_orgs WHERE id=ANY($1::uuid[])", [
      [grant.school_id, grant.district_id],
    ])
  ).rows;
  const staffConflicts = plan.conflicts.filter(
    (c) => c.code === "account_already_in_district",
  );
  const staffIds = [
    ...new Set(
      staffConflicts.flatMap((c) => [c.sourcePersonId!, c.targetPersonId!]),
    ),
  ];
  const staff = staffIds.length
    ? (
        await db.query(
          `SELECT p.id,COALESCE(p.display_name,concat_ws(' ',p.given_name,p.family_name)) AS name,
      p.learner_id IS NULL AND p.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM amp_org_roles WHERE person_id=p.id AND role='student')
      AND NOT EXISTS(SELECT 1 FROM amp_enrollments WHERE person_id=p.id AND role='student') AS allowed
      FROM amp_people p WHERE id=ANY($1::uuid[])`,
          [staffIds],
        )
      ).rows
    : [];
  const staffById = new Map(staff.map((p) => [p.id, p]));
  const staffMatches = staffConflicts.map((conflict) => {
    const source = staffById.get(conflict.sourcePersonId!);
    const target = staffById.get(conflict.targetPersonId!);
    return {
      sourcePersonId: conflict.sourcePersonId!,
      targetPersonId: conflict.targetPersonId!,
      sourceName: source?.name ?? "Staff member",
      targetName: target?.name ?? "Staff member",
      allowed: !!(source?.allowed && target?.allowed),
    };
  });
  const cleverConnections = (
    await db.query(
      `SELECT c.id,c.environment,o.name AS "districtName" FROM amp_clever_connections c
    JOIN amp_orgs o ON o.id=c.tenant_id WHERE c.tenant_id=$1 AND c.status='active' ORDER BY c.environment`,
      [grant.district_id],
    )
  ).rows;
  const source = await sourceRoster(db, grant.school_id);
  return {
    ...plan,
    sourcePeople: source.people,
    sourceClasses: source.classes,
    conflicts: plan.conflicts.map(
      ({ code, sourcePersonId, targetPersonId }) => ({
        code,
        sourcePersonId,
        targetPersonId,
      }),
    ),
    schoolName: places.find((p) => p.id === grant.school_id).name,
    districtName: places.find((p) => p.id === grant.district_id).name,
    expiresAt: grant.expires_at.toISOString(),
    staffMatches,
    cleverConnections,
  };
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
  trusted: { snapshot?: Snapshot } & Authority = {},
) {
  const input = decisions.parse(raw);
  const grant = await grantFor(db, accountId, token, true, new Date(), trusted);
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
  await grantFor(db, accountId, token, false, new Date(), trusted);
  const before = await adoptionPlan(db, schoolId, districtId);
  if (input.cleverSchool)
    await validateCleverMatches(
      db,
      schoolId,
      districtId,
      input,
      trusted.snapshot,
    );
  else if (input.cleverPeople.length || input.cleverSections.length)
    throw new CleverSyncError("adoption_clever_school_required");
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
    if (binding?.local_id && binding.local_id !== schoolId)
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
    await db.query(
      "UPDATE amp_clever_bindings SET local_id=$3 WHERE connection_id=$1 AND kind='school' AND clever_id=$2 AND local_id IS NULL",
      [connection.id, input.cleverSchool.schoolId, schoolId],
    );
  }
  if (input.cleverSchool) {
    const source = cleverSource(input.cleverSchool.connectionId);
    for (const match of input.cleverPeople) {
      const personId =
        input.staffMerges.find((m) => m.sourcePersonId === match.personId)
          ?.targetPersonId ?? match.personId;
      await db.query(
        `INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id)
        VALUES($1,$2,'person',$3,$4) ON CONFLICT DO NOTHING`,
        [districtId, source, match.userId, personId],
      );
      await db.query(
        "UPDATE amp_clever_bindings SET local_id=$3 WHERE connection_id=$1 AND kind='user' AND clever_id=$2 AND local_id IS NULL",
        [input.cleverSchool.connectionId, match.userId, personId],
      );
    }
    for (const match of input.cleverSections) {
      await db.query(
        `INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id)
      VALUES($1,$2,'class',$3,$4) ON CONFLICT DO NOTHING`,
        [districtId, source, match.sectionId, match.classId],
      );
      await db.query(
        "UPDATE amp_clever_bindings SET local_id=$3 WHERE connection_id=$1 AND kind='section' AND clever_id=$2 AND local_id IS NULL",
        [input.cleverSchool.connectionId, match.sectionId, match.classId],
      );
    }
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
  trusted: { snapshot?: Snapshot } & Authority = {},
) =>
  transaction(pool, (db) =>
    acceptSchoolAdoptionIn(db, accountId, token, input, trusted),
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

const distinctNames = (values: string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));
const displayedGrade = (grade: number | null) =>
  grade === 0 ? "Kindergarten" : grade == null ? null : String(grade);

async function sourceRoster(db: Database, schoolId: string) {
  const people = (
    await db.query(
      `SELECT p.id,COALESCE(p.display_name,concat_ws(' ',p.given_name,p.family_name)) AS name,
    p.grade_level, p.learner_id IS NOT NULL AS student FROM amp_people p WHERE p.tenant_id=$1 AND p.deleted_at IS NULL
    AND EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
      WHERE r.person_id=p.id AND ${activeToday("r", "o")}) ORDER BY p.learner_id IS NOT NULL,p.given_name,p.id`,
      [schoolId],
    )
  ).rows as {
    id: string;
    name: string;
    student: boolean;
    grade_level: number | null;
  }[];
  const classes = (
    await db.query(
      `SELECT c.id,c.name,c.org_id,course.name AS "courseName" FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
    LEFT JOIN amp_courses course ON course.id=c.course_id
    WHERE o.path[1]=$1 AND c.archived_at IS NULL ORDER BY c.name,c.id`,
      [schoolId],
    )
  ).rows as {
    id: string;
    name: string;
    org_id: string;
    courseName: string | null;
  }[];
  // One school-scoped membership read supplies context for every choice. Avoid
  // one query per person/class when reviewing a large school.
  const memberships = (
    await db.query(
      `SELECT e.person_id,e.class_id,e.role FROM amp_enrollments e
      JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
      WHERE o.path[1]=$1 AND c.archived_at IS NULL AND ${activeToday("e", "o")}`,
      [schoolId],
    )
  ).rows as { person_id: string; class_id: string; role: string }[];
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const classesById = new Map(classes.map((c) => [c.id, c]));
  const classMembers = new Map<string, typeof memberships>();
  const personClasses = new Map<string, string[]>();
  for (const member of memberships) {
    const members = classMembers.get(member.class_id) ?? [];
    members.push(member);
    classMembers.set(member.class_id, members);
    const ids = personClasses.get(member.person_id) ?? [];
    ids.push(member.class_id);
    personClasses.set(member.person_id, ids);
  }
  const classTeachers = new Map(
    classes.map((c) => [
      c.id,
      distinctNames(
        (classMembers.get(c.id) ?? [])
          .filter((m) => m.role === "teacher")
          .flatMap((m) => peopleById.get(m.person_id)?.name ?? []),
      ),
    ]),
  );
  return {
    people: people.map(({ grade_level, ...p }) => ({
      ...p,
      grade: displayedGrade(grade_level),
      classNames: distinctNames(
        (personClasses.get(p.id) ?? []).flatMap(
          (id) => classesById.get(id)?.name ?? [],
        ),
      ),
      teacherNames: distinctNames(
        (personClasses.get(p.id) ?? []).flatMap(
          (id) => classTeachers.get(id) ?? [],
        ),
      ),
    })),
    classes: classes.map((c) => {
      const grades = new Set(
        (classMembers.get(c.id) ?? [])
          .filter((m) => m.role === "student")
          .map((m) => peopleById.get(m.person_id)?.grade_level ?? null),
      );
      return {
        ...c,
        teacherNames: classTeachers.get(c.id) ?? [],
        grade: grades.size === 1 ? displayedGrade([...grades][0]!) : null,
      };
    }),
  };
}
export async function schoolAdoptionCleverSource(
  db: Database,
  accountId: string,
  token: string,
  connectionId: string,
  authority: Authority = {},
) {
  const grant = await grantFor(
    db,
    accountId,
    token,
    false,
    new Date(),
    authority,
  );
  const connection = (
    await db.query(
      `SELECT id,district_id,environment,last_sync_at FROM amp_clever_connections
    WHERE id=$1 AND tenant_id=$2 AND status='active'`,
      [connectionId, grant.district_id],
    )
  ).rows[0];
  if (!connection)
    throw new CleverSyncError("adoption_clever_connection_mismatch");
  if (connection.last_sync_at)
    throw new CleverSyncError("adoption_clever_already_imported");
  return connection as {
    id: string;
    district_id: string;
    environment: "sandbox" | "production";
    last_sync_at: null;
  };
}
export function schoolAdoptionCleverPreview(
  snapshot: Snapshot,
  schoolId?: string,
) {
  const schools = snapshot.schools.map(({ id, name }) => ({ id, name }));
  if (!schoolId) return { schools, users: [], sections: [] };
  if (!schools.some((s) => s.id === schoolId))
    throw new CleverSyncError("adoption_clever_school_mismatch");
  const sections = snapshot.sections.filter((s) => s.school === schoolId);
  const usersById = new Map(snapshot.users.map((u) => [u.id, u]));
  const coursesById = new Map(snapshot.courses.map((c) => [c.id, c]));
  const nameOf = (u: User) =>
    [u.name.first, u.name.last].filter(Boolean).join(" ") || "Unnamed user";
  const userSections = new Map<string, typeof sections>();
  const sectionTeachers = new Map<string, string[]>();
  for (const section of sections) {
    const teacherIds = [
      ...new Set([
        ...(section.teachers ?? []),
        ...(section.teacher ? [section.teacher] : []),
      ]),
    ];
    sectionTeachers.set(
      section.id,
      distinctNames(
        teacherIds.flatMap((id) => {
          const teacher = usersById.get(id);
          return teacher ? [nameOf(teacher)] : [];
        }),
      ),
    );
    for (const id of new Set([...section.students, ...teacherIds])) {
      const memberSections = userSections.get(id) ?? [];
      memberSections.push(section);
      userSections.set(id, memberSections);
    }
  }
  const users = snapshot.users.filter(
    (u) =>
      Object.values(u.roles).some(
        (r) =>
          r &&
          (("school" in r && r.school === schoolId) ||
            ("schools" in r && r.schools?.includes(schoolId))),
      ) ||
      u.roles.district_admin ||
      userSections.has(u.id),
  );
  return {
    schools,
    users: users.map((u) => ({
      id: u.id,
      name: nameOf(u),
      student: !!u.roles.student,
      grade: u.roles.student?.grade ?? null,
      classNames: distinctNames(
        (userSections.get(u.id) ?? []).map((s) => s.name),
      ),
      teacherNames: distinctNames(
        (userSections.get(u.id) ?? []).flatMap(
          (s) => sectionTeachers.get(s.id) ?? [],
        ),
      ),
    })),
    sections: sections.map((s) => ({
      id: s.id,
      name: s.name,
      grade: s.grade ?? null,
      teacherNames: sectionTeachers.get(s.id) ?? [],
      courseName: s.course ? (coursesById.get(s.course)?.name ?? null) : null,
    })),
  };
}
async function validateCleverMatches(
  db: PoolClient,
  schoolId: string,
  districtId: string,
  input: z.output<typeof decisions>,
  raw?: Snapshot,
) {
  if (!raw) throw new CleverSyncError("adoption_clever_review_required");
  const school = input.cleverSchool!;
  const connection = (
    await db.query(
      `SELECT district_id,last_sync_at FROM amp_clever_connections
    WHERE id=$1 AND tenant_id=$2 AND status='active' FOR UPDATE`,
      [school.connectionId, districtId],
    )
  ).rows[0];
  if (!connection)
    throw new CleverSyncError("adoption_clever_connection_mismatch");
  if (connection.last_sync_at)
    throw new CleverSyncError("adoption_clever_already_imported");
  const snapshot = validateSnapshot(raw, connection.district_id),
    preview = schoolAdoptionCleverPreview(snapshot, school.schoolId),
    source = await sourceRoster(db, schoolId);
  if (source.classes.some((c) => c.org_id !== schoolId))
    throw new CleverSyncError("adoption_clever_nested_school_review");
  const people = new Map(input.cleverPeople.map((p) => [p.personId, p.userId])),
    sections = new Map(
      input.cleverSections.map((c) => [c.classId, c.sectionId]),
    );
  if (
    people.size !== input.cleverPeople.length ||
    new Set(people.values()).size !== people.size ||
    sections.size !== input.cleverSections.length ||
    new Set(sections.values()).size !== sections.size
  )
    throw new CleverSyncError("adoption_clever_duplicate_match");
  if (
    people.size !== source.people.length ||
    source.people.some((p) => !people.has(p.id)) ||
    sections.size !== source.classes.length ||
    source.classes.some((c) => !sections.has(c.id))
  )
    throw new CleverSyncError("adoption_clever_incomplete_match");
  for (const person of source.people) {
    const user = preview.users.find((u) => u.id === people.get(person.id));
    if (!user || user.student !== person.student)
      throw new CleverSyncError("adoption_clever_role_mismatch");
    const owner = (
      await db.query(
        `SELECT l.account_id FROM amp_people p JOIN amp_learners l ON l.id=p.learner_id WHERE p.id=$1`,
        [person.id],
      )
    ).rows[0];
    if (owner && owner.account_id !== `school:${person.id}`)
      throw new CleverSyncError("adoption_learner_merge_forbidden");
  }
  for (const klass of source.classes) {
    const section = snapshot.sections.find(
      (s) => s.id === sections.get(klass.id) && s.school === school.schoolId,
    );
    if (!section) throw new CleverSyncError("adoption_clever_class_mismatch");
    const members = (
      await db.query(
        `SELECT e.person_id,e.role FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
      JOIN amp_orgs o ON o.id=c.org_id WHERE e.class_id=$1 AND e.role IN ('student','teacher') AND ${activeToday("e", "o")}`,
        [klass.id],
      )
    ).rows;
    for (const member of members) {
      const id = people.get(member.person_id),
        remote =
          member.role === "student"
            ? section.students
            : [
                ...(section.teachers ?? []),
                ...(section.teacher ? [section.teacher] : []),
              ];
      if (!id || !remote.includes(id))
        throw new CleverSyncError("adoption_clever_roster_mismatch");
    }
  }
  const refs = [
    { kind: "org", id: school.schoolId, local: schoolId },
    ...input.cleverPeople.map((p) => ({
      kind: "person",
      id: p.userId,
      local:
        input.staffMerges.find((m) => m.sourcePersonId === p.personId)
          ?.targetPersonId ?? p.personId,
    })),
    ...input.cleverSections.map((c) => ({
      kind: "class",
      id: c.sectionId,
      local: c.classId,
    })),
  ];
  for (const ref of refs) {
    const existing = await db.query(
      `SELECT 1 FROM amp_external_refs WHERE tenant_id=ANY($1::uuid[]) AND source=$2 AND kind=$3
      AND (sourced_id=$4 OR local_id=$5) AND (sourced_id<>$4 OR local_id<>$5)
      UNION ALL SELECT 1 FROM amp_clever_bindings WHERE connection_id=$6 AND kind=$7
      AND (clever_id=$4 OR local_id=$5) AND (clever_id<>$4 OR local_id<>$5) LIMIT 1`,
      [
        [schoolId, districtId],
        cleverSource(school.connectionId),
        ref.kind,
        ref.id,
        ref.local,
        school.connectionId,
        { org: "school", person: "user", class: "section" }[ref.kind],
      ],
    );
    if (existing.rowCount)
      throw new CleverSyncError("adoption_clever_identity_already_bound");
  }
}

type AdminRole = {
  role_id: string;
  manual: boolean;
  connection_id: string | null;
  district_id: string | null;
  clever_id: string | null;
  active: boolean;
};
async function adoptionAdminRoles(
  db: Database,
  accountId: string,
  districtId: string,
): Promise<AdminRole[]> {
  return (
    await db.query(
      `SELECT r.id AS role_id,NOT EXISTS(SELECT 1 FROM amp_clever_memberships own
    WHERE own.kind='org_role' AND own.local_id=r.id AND own.owned) AS manual,
    c.id AS connection_id,c.district_id,b.clever_id,c.status='active' AND b.archived_at IS NULL AS active
    FROM amp_people p JOIN amp_org_roles r ON r.person_id=p.id AND r.role='admin'
    JOIN amp_orgs o ON o.id=r.org_id JOIN amp_orgs target ON r.org_id=ANY(target.path)
    LEFT JOIN amp_clever_memberships m ON m.kind='org_role' AND m.local_id=r.id AND m.owned
    LEFT JOIN amp_clever_connections c ON c.id=m.connection_id
    LEFT JOIN amp_clever_bindings b ON b.connection_id=c.id AND b.kind='user' AND b.local_id=p.id
    WHERE p.account_id=$1 AND p.deleted_at IS NULL AND target.id=$2 AND ${activeToday("r", "o")}`,
      [accountId, districtId],
    )
  ).rows;
}
async function requireCurrentAdoptionAdmin(
  db: Database,
  accountId: string,
  districtId: string,
  snapshots: Pick<Snapshot, "district" | "users">[],
) {
  const roles = await adoptionAdminRoles(db, accountId, districtId);
  if (roles.some((r) => r.manual)) return;
  if (!roles.length)
    throw new CleverSyncError("adoption_destination_authority_required");
  const proved = roles.filter(
    (r) =>
      r.active &&
      snapshots.some(
        (s) =>
          s.district.id === r.district_id &&
          s.users.some((u) => u.id === r.clever_id && !!u.roles.district_admin),
      ),
  );
  // A successful provider read can revoke temporary authority immediately.
  // Missing transport evidence never extends or revokes another identity.
  const revoked = roles.filter(
    (r) =>
      snapshots.some((s) => s.district.id === r.district_id) &&
      !proved.some((p) => p.role_id === r.role_id),
  );
  if (revoked.length)
    await db.query(
      `UPDATE amp_clever_memberships SET bootstrap_valid_until=now()
      WHERE kind='org_role' AND owned AND local_id=ANY($1::uuid[]) AND bootstrap_valid_until IS NOT NULL`,
      [revoked.map((r) => r.role_id)],
    );
  if (proved.length) {
    await db.query(
      `UPDATE amp_clever_memberships SET bootstrap_valid_until=now()+interval '15 minutes'
      WHERE kind='org_role' AND owned AND local_id=ANY($1::uuid[]) AND bootstrap_valid_until IS NOT NULL`,
      [proved.map((r) => r.role_id)],
    );
    return;
  }
  throw new CleverSyncError("adoption_current_authority_required");
}
/** Source-owned staged administrator roles must be re-proved by Clever before
 * they expose the approving school's records. Independent admin grants stand. */
export async function schoolAdoptionAuthority(
  db: Database,
  accountId: string,
  input: { token?: string; districtId?: string },
  fetchUser?: (connectionId: string, userId: string) => Promise<User>,
): Promise<Authority> {
  let districtId = input.districtId;
  if (input.token) {
    if (!/^adopt_[A-Za-z0-9_-]{43}$/.test(input.token))
      throw new CleverSyncError("adoption_not_found");
    const grant = (
      await db.query(
        "SELECT district_id,consumed_at FROM amp_school_adoptions WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now()",
        [tokenHash(input.token)],
      )
    ).rows[0];
    if (!grant) throw new CleverSyncError("adoption_expired_or_revoked");
    if (grant.consumed_at) throw new CleverSyncError("adoption_already_used");
    districtId = grant.district_id;
  }
  if (!districtId) throw new CleverSyncError("adoption_not_found");
  const roles = await adoptionAdminRoles(db, accountId, districtId);
  if (roles.some((r) => r.manual)) return {};
  if (!roles.length)
    throw new CleverSyncError("adoption_destination_authority_required");
  if (!fetchUser)
    throw new CleverSyncError("adoption_current_authority_required");
  const snapshots: Pick<Snapshot, "district" | "users">[] = [];
  for (const role of roles.filter(
    (r) => r.active && r.connection_id && r.clever_id,
  )) {
    const user = userSchema.parse(
      await fetchUser(role.connection_id!, role.clever_id!),
    );
    if (user.id !== role.clever_id || user.district !== role.district_id)
      throw new CleverSyncError("adoption_current_authority_required");
    snapshots.push({
      district: { id: role.district_id!, name: "" },
      users: [user],
    });
  }
  await requireCurrentAdoptionAdmin(db, accountId, districtId, snapshots);
  return { authoritySnapshots: snapshots };
}
