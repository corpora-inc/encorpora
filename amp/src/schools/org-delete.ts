import type { PoolClient } from "pg";
import { SchoolError } from "./contracts.js";

/** A license with one of these references is a free pilot, not a contract. */
export const FREE_LICENSE_REFERENCES = ["pilot", "evaluation", "demo"];

/** Removes a root org with its whole tree, inside the caller's transaction:
 * the operator's `delete-org` command and removing a demo place
 * (`schools/demo`) share it. Clever connections are locked before other school
 * writes, followed by licenses, account locks, and person/learner rows.
 * Every delete is bounded by the ids of
 * the tree, and rows of the tree's people that sit in another tree stop it
 * before anything is deleted. School events can only be deleted inside the
 * transaction's `amp.retention_purge='school-org'`. */
export async function removeOrgTree(
  client: PoolClient,
  input: {
    orgId: string;
    /** The org's current name, exactly. */
    confirm: string;
    commit: boolean;
    allowLicensed: boolean;
  },
) {
  const rows = async (sql: string, params: unknown[] = []) =>
    (await client.query(sql, params)).rows;
  const ids = async (sql: string, params: unknown[]) =>
    (await rows(sql, params)).map((row) => row.id as string);
  const number = async (sql: string, params: unknown[]) =>
    Number((await rows(sql, params))[0].n);

  const org = (
    await rows("SELECT id,name,parent_id,demo FROM amp_orgs WHERE id=$1", [
      input.orgId,
    ])
  )[0];
  if (!org) throw new SchoolError(404, "org_not_found");
  if (org.name !== input.confirm)
    throw new SchoolError(409, "confirm_mismatch");
  if (org.parent_id) throw new SchoolError(409, "org_has_parent");

  const orgs = await ids(
    "SELECT id FROM amp_orgs WHERE path[1]=$1 ORDER BY id",
    [org.id],
  );
  // Imports acquire the connection lock before any learning-account locks.
  // Join that order before taking licenses/accounts, so an import never waits
  // on a purge that is itself waiting to delete the import's connection.
  const connections = await ids(
    "SELECT id FROM amp_clever_connections WHERE tenant_id=ANY($1::uuid[]) ORDER BY id",
    [orgs],
  );
  for (const id of connections)
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `clever-sync:${id}`,
    ]);
  const licenses = await rows(
    `SELECT id,reference,(status='active' AND starts_at<=now() AND ends_at>now()) AS active
     FROM amp_school_licenses WHERE org_id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
    [orgs],
  );
  if (
    !input.allowLicensed &&
    licenses.some(
      (license) =>
        license.active &&
        !FREE_LICENSE_REFERENCES.includes(
          (license.reference ?? "").trim().toLowerCase(),
        ),
    )
  )
    throw new SchoolError(409, "org_licensed");
  const licenseIds: string[] = licenses.map((license) => license.id);

  const people = await ids(
    "SELECT id FROM amp_people WHERE tenant_id=ANY($1::uuid[]) ORDER BY id",
    [orgs],
  );
  const accounts = people.map((id) => `school:${id}`);
  for (const account of accounts)
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      account,
    ]);
  await client.query(
    "SELECT 1 FROM amp_people WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
    [people],
  );
  const sessions = await ids(
    "SELECT id FROM amp_academic_sessions WHERE org_id=ANY($1::uuid[])",
    [orgs],
  );
  const classes = await ids(
    "SELECT id FROM amp_classes WHERE org_id=ANY($1::uuid[])",
    [orgs],
  );
  // Only a school account's learner is deleted. A family child or an adult
  // learner linked as a member belongs to its own account and is detached.
  const owned = await ids(
    "SELECT id FROM amp_learners WHERE account_id=ANY($1::text[]) ORDER BY id FOR UPDATE",
    [accounts],
  );
  if (
    await number(
      "SELECT count(*) AS n FROM amp_commerce_orders WHERE learner_id=ANY($1::text[])",
      [owned],
    )
  )
    throw new SchoolError(409, "learner_has_orders");
  const detached = await number(
    `SELECT count(*) AS n FROM amp_people
     WHERE id=ANY($1::uuid[]) AND learner_id IS NOT NULL AND NOT learner_id=ANY($2::text[])`,
    [people, owned],
  );

  // A row of these people in another tree is another tenant's: stop.
  const strays = await number(
    `SELECT
       (SELECT count(*) FROM amp_org_roles WHERE person_id=ANY($1::uuid[]) AND NOT org_id=ANY($2::uuid[])) +
       (SELECT count(*) FROM amp_enrollments WHERE person_id=ANY($1::uuid[]) AND NOT class_id=ANY($3::uuid[])) +
       (SELECT count(*) FROM amp_seats WHERE person_id=ANY($1::uuid[]) AND NOT license_id=ANY($4::uuid[])) +
       (SELECT count(*) FROM amp_term_grades WHERE (person_id=ANY($1::uuid[]) OR final_by=ANY($1::uuid[])) AND NOT class_id=ANY($3::uuid[])) +
       (SELECT count(*) FROM amp_school_events WHERE actor_person_id=ANY($1::uuid[]) AND NOT org_id=ANY($2::uuid[])) +
       (SELECT count(*) FROM amp_data_agreements WHERE signer_person_id=ANY($1::uuid[]) AND NOT org_id=ANY($2::uuid[])) AS n`,
    [people, orgs, classes, licenseIds],
  );
  if (strays > 0) throw new SchoolError(409, "org_shared_rows");

  const counts: Record<string, number> = {};
  /** Counts, deletes and checks the two agree. */
  const purge = async (
    name: string,
    table: string,
    where: string,
    params: unknown[],
  ) => {
    const expected = await number(
      `SELECT count(*) AS n FROM ${table} WHERE ${where}`,
      params,
    );
    const { rowCount } = await client.query(
      `DELETE FROM ${table} WHERE ${where}`,
      params,
    );
    if (rowCount !== expected) throw new SchoolError(500, "delete_mismatch");
    counts[name] = expected;
  };

  // A seat's grant on a learner who stays ends with the seat.
  await client.query(
    `UPDATE amp_grants SET status='revoked' WHERE status='active' AND id IN
     (SELECT grant_id FROM amp_seats WHERE license_id=ANY($1::uuid[]) AND grant_id IS NOT NULL)`,
    [licenseIds],
  );
  // Approval links of the tree's family classes, then the family rows.
  await purge(
    "classAuthorizations",
    "amp_class_authorizations",
    "class_id=ANY($1::uuid[])",
    [classes],
  );
  await purge("classPilots", "amp_class_pilots", "class_id=ANY($1::uuid[])", [
    classes,
  ]);
  await purge("schoolStarts", "amp_school_starts", "org_id=ANY($1::uuid[])", [
    orgs,
  ]);
  await purge(
    "purchaseRequests",
    "amp_school_purchase_requests",
    "org_id=ANY($1::uuid[])",
    [orgs],
  );
  // Teacher eligibility and non-contact extension history survive deleting a
  // place; recreating the school must not grant another introductory pilot.
  const families = await ids(
    "SELECT account_id AS id FROM amp_families WHERE org_id=ANY($1::uuid[])",
    [orgs],
  );
  await purge(
    "familyApprovals",
    "amp_family_approvals",
    "family_account_id=ANY($1::text[]) OR class_id=ANY($2::uuid[]) OR person_id=ANY($3::uuid[])",
    [families, classes, people],
  );
  await purge("families", "amp_families", "org_id=ANY($1::uuid[])", [orgs]);
  await purge(
    "studentSessions",
    "amp_student_sessions",
    "person_id=ANY($1::uuid[])",
    [people],
  );
  await purge(
    "credentials",
    "amp_person_credentials",
    "person_id=ANY($1::uuid[])",
    [people],
  );
  await purge(
    "termGrades",
    "amp_term_grades",
    "class_id=ANY($1::uuid[]) OR person_id=ANY($2::uuid[])",
    [classes, people],
  );
  await purge(
    "enrollments",
    "amp_enrollments",
    "class_id=ANY($1::uuid[]) OR person_id=ANY($2::uuid[])",
    [classes, people],
  );
  await purge(
    "seats",
    "amp_seats",
    "license_id=ANY($1::uuid[]) OR person_id=ANY($2::uuid[])",
    [licenseIds, people],
  );
  await purge(
    "roles",
    "amp_org_roles",
    "org_id=ANY($1::uuid[]) OR person_id=ANY($2::uuid[])",
    [orgs, people],
  );
  await purge(
    "externalRefs",
    "amp_external_refs",
    "tenant_id=ANY($1::uuid[])",
    [orgs],
  );
  await purge(
    "dataAgreements",
    "amp_data_agreements",
    "org_id=ANY($1::uuid[])",
    [orgs],
  );
  await purge(
    "scopeSettings",
    "amp_scope_settings",
    `(scope_kind='org' AND scope_id::text=ANY($1::text[])) OR (scope_kind='class' AND scope_id::text=ANY($2::text[])) OR (scope_kind='person' AND scope_id::text=ANY($3::text[]))`,
    [orgs, classes, people],
  );
  // The one place school events are deleted; the setting ends with the transaction.
  await client.query("SET LOCAL amp.retention_purge='school-org'");
  await purge("events", "amp_school_events", "org_id=ANY($1::uuid[])", [orgs]);
  await client.query("RESET amp.retention_purge");
  await purge("people", "amp_people", "id=ANY($1::uuid[])", [people]);
  // A demo's reports of problems are made-up practice: they go with it, where
  // a real learner's stay, unlinked, for the content's sake.
  if (org.demo)
    await purge(
      "problemFlags",
      "amp_problem_flags",
      "learner_id=ANY($1::text[])",
      [owned],
    );
  await purge("learners", "amp_learners", "id=ANY($1::text[])", [owned]);
  await purge("licenses", "amp_school_licenses", "id=ANY($1::uuid[])", [
    licenseIds,
  ]);
  await purge("classes", "amp_classes", "id=ANY($1::uuid[])", [classes]);
  await purge(
    "academicSessions",
    "amp_academic_sessions",
    "id=ANY($1::uuid[])",
    [sessions],
  );
  await purge("orgs", "amp_orgs", "id=ANY($1::uuid[])", [orgs]);
  counts.learnersDetached = detached;

  const remaining = {
    orgs: await number(
      "SELECT count(*) AS n FROM amp_orgs WHERE id=ANY($1::uuid[])",
      [orgs],
    ),
    people: await number(
      "SELECT count(*) AS n FROM amp_people WHERE id=ANY($1::uuid[])",
      [people],
    ),
    learners: await number(
      "SELECT count(*) AS n FROM amp_learners WHERE id=ANY($1::text[])",
      [owned],
    ),
    events: await number(
      "SELECT count(*) AS n FROM amp_school_events WHERE org_id=ANY($1::uuid[])",
      [orgs],
    ),
  };
  if (Object.values(remaining).some(Boolean))
    throw new SchoolError(500, "delete_incomplete");
  return {
    commit: input.commit,
    orgs: orgs.length,
    counts,
    remaining: { orgs: remaining.orgs, people: remaining.people },
  };
}
