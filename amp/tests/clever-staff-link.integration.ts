import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import {
  registerCleverConnection,
  cleverSource,
} from "../src/schools/clever/connection.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import { attachProvedCleverStaffIn } from "../src/schools/clever/staff-link.js";
import { type Snapshot } from "../src/schools/clever/model.js";
import { SchoolError } from "../src/schools/contracts.js";
const id = () => randomBytes(12).toString("hex");

test(
  "proved Clever staff aliases keep one canonical person",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `clever_staff_${randomUUID().replaceAll("-", "")}`,
      admin = new Pool({ connectionString: url, max: 1 }),
      scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 4 }),
      repo = new SchoolRepository(db);
    try {
      // Bootstrap TTL is installed with connection operations. This fixture also
      // verifies a standalone helper checkout before that migration is integrated.
      await db.query(
        "ALTER TABLE amp_clever_memberships ADD COLUMN IF NOT EXISTS bootstrap_valid_until timestamptz",
      );
      async function fixture() {
        const districtId = id(),
          schoolId = id(),
          a = id(),
          b = id(),
          sectionId = id(),
          accountId = `amp|${randomUUID()}`;
        const district = await repo.createOrg(
          { kind: "district", name: "Fixture district", timezone: "UTC" },
          { version: "fixture", signerName: "Fixture", signerTitle: "Admin" },
        );
        const connection = await registerCleverConnection(db, {
          environment: "sandbox",
          districtId,
          tenantId: district.id,
        });
        const snapshot: Snapshot = {
          district: { id: districtId, name: "Fixture" },
          schools: [
            { id: schoolId, district: districtId, name: "Fixture School" },
          ],
          users: [
            {
              id: a,
              district: districtId,
              name: { first: "Staff A" },
              roles: { teacher: { school: schoolId } },
            },
            {
              id: b,
              district: districtId,
              name: { first: "Staff B" },
              roles: { teacher: { school: schoolId } },
            },
          ],
          sections: [
            {
              id: sectionId,
              district: districtId,
              school: schoolId,
              name: "Fixture Class",
              students: [],
              teachers: [a, b],
            },
          ],
          courses: [],
          terms: [],
        };
        const sync = (source = snapshot) =>
          syncCleverConnection(db, connection.id, {
            districtToken: async () => "fixture",
            snapshot: async () => source,
            latestEvent: async () => null,
            events: async () => [],
          });
        const prove = async (
          userId: string,
          account = accountId,
          roles = ["teacher"],
        ) => {
          await db.query(
            "INSERT INTO amp_provider_principals(account_id) VALUES($1) ON CONFLICT DO NOTHING",
            [account],
          );
          await db.query(
            `INSERT INTO amp_provider_identities(id,account_id,provider,environment,district_id,subject,claims)
          VALUES($1,$2,'clever','sandbox',$3,$4,$5) ON CONFLICT(provider,environment,district_id,subject) DO UPDATE SET claims=excluded.claims`,
            [
              randomUUID(),
              account,
              districtId,
              userId,
              {
                environment: "sandbox",
                districtId,
                userId,
                roles,
                schools: [schoolId],
              },
            ],
          );
        };
        const attach = (userId: string, account = accountId) =>
          repo.transaction((client) =>
            attachProvedCleverStaffIn(client, {
              connectionId: connection.id,
              accountId: account,
              userId,
            }),
          );
        const person = async (userId: string) =>
          (
            await db.query(
              "SELECT local_id FROM amp_clever_bindings WHERE connection_id=$1 AND kind='user' AND clever_id=$2",
              [connection.id, userId],
            )
          ).rows[0]?.local_id as string | undefined;
        return {
          district,
          connection,
          districtId,
          schoolId,
          a,
          b,
          sectionId,
          accountId,
          snapshot,
          sync,
          prove,
          attach,
          person,
        };
      }
      const refusal = (error: unknown) =>
        error instanceof SchoolError &&
        error.statusCode === 409 &&
        error.code === "clever_account_link_required";
      await t.test(
        "unbound subjects reuse the existing canonical staff person and synchronize without duplicates",
        async () => {
          const f = await fixture(),
            staff = await repo.addStaff({
              orgId: f.district.id,
              role: "teacher",
              givenName: "Canonical",
              accountId: f.accountId,
            });
          await f.prove(f.a);
          await f.prove(f.b);
          const subjects = [f.a, f.b];
          const concurrent = await Promise.all(subjects.map(f.attach));
          assert.ok(
            concurrent.every(
              (r) =>
                (r.disposition === "reused" && r.personId === staff.personId) ||
                (r.disposition === "deferred" && r.personId === null),
            ),
          );
          // A competing canonical-account attachment yields immediately. The
          // next session read retries it after the first transaction commits.
          const results = [];
          for (const [index, result] of concurrent.entries())
            results.push(
              result.disposition === "deferred"
                ? await f.attach(subjects[index]!)
                : result,
            );
          assert.ok(
            results.every(
              (r) =>
                r.personId === staff.personId && r.disposition === "reused",
            ),
          );
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_external_refs WHERE tenant_id=$1 AND source=$2 AND kind='person'",
                [f.district.id, cleverSource(f.connection.id)],
              )
            ).rows[0].n,
            2,
          );
          await f.sync();
          assert.equal(await f.person(f.a), staff.personId);
          assert.equal(await f.person(f.b), staff.personId);
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_people WHERE tenant_id=$1",
                [f.district.id],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "an already rostered second staff subject consolidates memberships, source records and finite bootstrap expiry",
        async () => {
          const f = await fixture();
          await f.sync();
          const a = (await f.person(f.a))!,
            b = (await f.person(f.b))!;
          const before = (
            await db.query(
              "SELECT id FROM amp_enrollments WHERE person_id=$1",
              [b],
            )
          ).rows.map((r) => r.id);
          await db.query(
            "UPDATE amp_clever_memberships SET bootstrap_valid_until=now()+interval '15 minutes' WHERE connection_id=$1 AND kind='org_role'",
            [f.connection.id],
          );
          await f.prove(f.a);
          assert.equal((await f.attach(f.a)).disposition, "attached");
          await f.prove(f.b);
          const merged = await f.attach(f.b);
          assert.deepEqual(merged, { personId: a, disposition: "merged" });
          assert.equal(await f.person(f.b), a);
          const person = (
            await db.query(
              "SELECT account_id,deleted_at FROM amp_people WHERE id=$1",
              [b],
            )
          ).rows[0];
          assert.equal(person.account_id, null);
          assert.ok(person.deleted_at);
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_enrollments WHERE person_id=$1 AND end_on IS NULL",
                [a],
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_enrollments WHERE id=ANY($1::uuid[])",
                [before],
              )
            ).rows[0].n,
            before.length,
          );
          assert.ok(
            (
              await db.query(
                "SELECT bootstrap_valid_until FROM amp_clever_memberships WHERE connection_id=$1 AND kind='org_role'",
                [f.connection.id],
              )
            ).rows.every((r) => r.bootstrap_valid_until instanceof Date),
          );
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_clever_memberships WHERE connection_id=$1 AND source_key LIKE $2",
                [f.connection.id, `%:${b}:%`],
              )
            ).rows[0].n,
            0,
          );
          assert.equal(
            (
              await db.query(
                "SELECT record->'roles' AS roles FROM amp_clever_bindings WHERE connection_id=$1 AND clever_id=$2",
                [f.connection.id, f.b],
              )
            ).rows[0].roles.teacher.school,
            f.schoolId,
          );
          const onlyB = structuredClone(f.snapshot);
          onlyB.users = onlyB.users.filter((u) => u.id === f.b);
          onlyB.sections[0]!.teachers = [f.b];
          await f.sync(onlyB);
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_enrollments WHERE person_id=$1 AND role='teacher' AND end_on IS NULL",
                [a],
              )
            ).rows[0].n,
            1,
          );
          const none = structuredClone(onlyB);
          none.users = [];
          none.sections[0]!.teachers = [];
          await f.sync(none);
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_enrollments WHERE person_id=$1 AND role='teacher' AND end_on IS NULL",
                [a],
              )
            ).rows[0].n,
            0,
          );
        },
      );
      await t.test(
        "independent manual staff authority survives an overlapping source-owned role",
        async () => {
          const f = await fixture();
          await f.sync();
          const a = (await f.person(f.a))!,
            b = (await f.person(f.b))!;
          await db.query(
            `UPDATE amp_clever_memberships SET owned=false WHERE connection_id=$1 AND local_id IN
        (SELECT id FROM amp_org_roles WHERE person_id=$2 UNION ALL SELECT id FROM amp_enrollments WHERE person_id=$2)`,
            [f.connection.id, b],
          );
          await f.prove(f.a);
          await f.attach(f.a);
          await f.prove(f.b);
          await f.attach(f.b);
          const none = structuredClone(f.snapshot);
          none.users = [];
          none.sections[0]!.teachers = [];
          await f.sync(none);
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_enrollments WHERE person_id=$1 AND end_on IS NULL",
                [a],
              )
            ).rows[0].n,
            1,
          );
        },
      );
      await t.test(
        "staged aliases claimed by another account and incompatible staff settings require review",
        async () => {
          const f = await fixture();
          await f.sync();
          const a = (await f.person(f.a))!,
            b = (await f.person(f.b))!;
          await f.prove(f.a);
          await f.attach(f.a);
          await f.prove(f.b);
          const stagedAlias = id();
          await f.prove(stagedAlias, `amp|${randomUUID()}`);
          await db.query(
            "INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id) VALUES($1,$2,'person',$3,$4)",
            [f.district.id, cleverSource(f.connection.id), stagedAlias, b],
          );
          await assert.rejects(f.attach(f.b), refusal);
          await db.query(
            "DELETE FROM amp_external_refs WHERE tenant_id=$1 AND sourced_id=$2",
            [f.district.id, stagedAlias],
          );
          await db.query(
            `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values") VALUES('person',$1,'{"fixture":1}'),('person',$2,'{"fixture":2}')`,
            [a, b],
          );
          await assert.rejects(f.attach(f.b), refusal);
          assert.equal(await f.person(f.b), b);
          assert.equal(
            (
              await db.query("SELECT deleted_at FROM amp_people WHERE id=$1", [
                b,
              ])
            ).rows[0].deleted_at,
            null,
          );
        },
      );
      await t.test(
        "missing proof, another canonical account and student records refuse before any constraint error",
        async () => {
          const f = await fixture();
          await f.sync();
          await assert.rejects(f.attach(f.a), refusal);
          await f.prove(f.a);
          await f.attach(f.a);
          const other = `amp|${randomUUID()}`;
          await f.prove(f.b, other);
          await f.attach(f.b, other);
          await assert.rejects(f.attach(f.b), refusal);
          const c = id();
          await f.prove(c);
          const student = await repo.provisionStudent(f.district.id, {
            givenName: "Fixture student",
          });
          await db.query(
            "INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id) VALUES($1,$2,'person',$3,$4)",
            [f.district.id, cleverSource(f.connection.id), c, student.personId],
          );
          await assert.rejects(f.attach(c), refusal);
          assert.equal(
            (
              await db.query("SELECT learner_id FROM amp_people WHERE id=$1", [
                student.personId,
              ])
            ).rows[0].learner_id,
            student.learnerId,
          );
        },
      );
      await t.test(
        "a fresh first subject is explicitly unbound, and deleted or former-student staff cannot be reused",
        async () => {
          const f = await fixture();
          await f.prove(f.a);
          assert.deepEqual(await f.attach(f.a), {
            personId: null,
            disposition: "unbound",
          });
          const staff = await repo.addStaff({
            orgId: f.district.id,
            role: "teacher",
            givenName: "Canonical",
            accountId: f.accountId,
          });
          await db.query(
            "INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on,end_on) VALUES($1,$2,$3,'student','2020-01-01','2021-01-01')",
            [randomUUID(), staff.personId, f.district.id],
          );
          await assert.rejects(f.attach(f.a), refusal);
          await db.query(
            "DELETE FROM amp_org_roles WHERE person_id=$1 AND role='student'",
            [staff.personId],
          );
          await db.query("UPDATE amp_people SET deleted_at=now() WHERE id=$1", [
            staff.personId,
          ]);
          await assert.rejects(f.attach(f.a), refusal);
        },
      );
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
