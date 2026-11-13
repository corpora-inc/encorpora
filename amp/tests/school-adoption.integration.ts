import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import {
  acceptSchoolAdoption,
  issueSchoolAdoption,
  previewSchoolAdoption,
  revokeSchoolAdoption,
} from "../src/schools/adoption.js";
import {
  cleverSource,
  registerCleverConnection,
} from "../src/schools/clever/connection.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import type { Snapshot } from "../src/schools/clever/model.js";
import { loadActor, can } from "../src/schools/authz.js";

test(
  "standalone school adoption requires both parties and preserves learning identities",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `adoption_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    let db: Pool | undefined;
    try {
      await migrate(scoped.href);
      db = new Pool({ connectionString: scoped.href, max: 3 });
      // This table is supplied by school self-service (0119). The fixture keeps
      // this independently reviewable adoption migration testable before merge.
      await db.query(`CREATE TABLE IF NOT EXISTS amp_school_starts (
      account_id text NOT NULL,request_id uuid NOT NULL,org_id uuid NOT NULL REFERENCES amp_orgs(id),
      class_id uuid NOT NULL REFERENCES amp_classes(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(account_id,request_id))`);
      const repo = new SchoolRepository(db);
      const agreement = {
        version: "fixture",
        signerName: "Fixture",
        signerTitle: "Administrator",
      };
      const sourceAccount = `amp|${randomUUID()}`,
        targetAccount = `amp|${randomUUID()}`;
      async function fixture(sameAccount = false) {
        const school = await repo.createOrg(
          { kind: "school", name: "School", timezone: "America/New_York" },
          agreement,
        );
        const district = await repo.createOrg(
          { kind: "district", name: "District", timezone: "America/Chicago" },
          agreement,
        );
        const klass = await repo.createClass(school.id, {
          name: "Existing Class",
        });
        const teacher = await repo.addStaff({
          orgId: school.id,
          role: "teacher",
          givenName: "Teacher",
          accountId: sourceAccount,
          classId: klass.id,
        });
        const account = sameAccount ? sourceAccount : targetAccount;
        const leader = await repo.addStaff({
          orgId: district.id,
          role: "admin",
          givenName: "Leader",
          accountId: account,
        });
        await db!.query(
          "INSERT INTO amp_school_starts(account_id,request_id,org_id,class_id) VALUES($1,$2,$3,$4)",
          [sourceAccount, randomUUID(), school.id, klass.id],
        );
        const learner = await repo.provisionStudent(school.id, {
          givenName: "Student",
          classId: klass.id,
          gradeLevel: 4,
        });
        return { school, district, klass, teacher, leader, learner, account };
      }

      await t.test(
        "teacher-owner authorizes exact district; its administrator accepts without recreating learners",
        async () => {
          const f = await fixture();
          await db!.query(
            "INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id) VALUES($1,'csv','person','student-1',$2)",
            [f.school.id, f.learner.personId],
          );
          await db!.query(
            "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,'{}')",
            ["adoption-evidence", f.learner.learnerId],
          );
          await db!.query(
            "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome) VALUES('adoption-attempt',$1,'adoption-evidence','adoption-request',$2)",
            [
              f.learner.learnerId,
              {
                createdAt: new Date().toISOString(),
                skillId: "fixture",
                correct: true,
              },
            ],
          );
          const issued = await issueSchoolAdoption(db!, sourceAccount, {
            schoolId: f.school.id,
            districtId: f.district.id,
          });
          const stored = (
            await db!.query("SELECT * FROM amp_school_adoptions WHERE id=$1", [
              issued.id,
            ])
          ).rows[0];
          assert.notEqual(stored.token_hash, issued.token);
          assert.equal(stored.token, undefined);
          await assert.rejects(
            acceptSchoolAdoption(db!, sourceAccount, issued.token),
            /destination_authority_required/,
          );
          const plan = await previewSchoolAdoption(
            db!,
            targetAccount,
            issued.token,
          );
          assert.equal(plan.learners, 1);
          assert.deepEqual(plan.conflicts, []);
          const accepted = await acceptSchoolAdoption(
            db!,
            targetAccount,
            issued.token,
          );
          assert.equal(accepted.schoolId, f.school.id);
          assert.deepEqual(
            (
              await db!.query("SELECT path FROM amp_orgs WHERE id=$1", [
                f.school.id,
              ])
            ).rows[0].path,
            [f.district.id, f.school.id],
          );
          const person = (
            await db!.query(
              "SELECT tenant_id,learner_id FROM amp_people WHERE id=$1",
              [f.learner.personId],
            )
          ).rows[0];
          assert.equal(person.tenant_id, f.district.id);
          assert.equal(person.learner_id, f.learner.learnerId);
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
                [f.learner.learnerId],
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await db!.query(
                "SELECT local_id FROM amp_external_refs WHERE tenant_id=$1 AND sourced_id='student-1'",
                [f.district.id],
              )
            ).rows[0].local_id,
            f.learner.personId,
          );
          assert.ok(
            can(await loadActor(db!, targetAccount), "students.read", {
              kind: "org",
              orgId: f.school.id,
              path: [f.district.id, f.school.id],
            }),
          );
          assert.equal(
            (
              await db!.query("SELECT timezone FROM amp_orgs WHERE id=$1", [
                f.school.id,
              ])
            ).rows[0].timezone,
            "America/New_York",
          );
          await assert.rejects(
            acceptSchoolAdoption(db!, targetAccount, issued.token),
            /already_used/,
          );
        },
      );

      await t.test(
        "sharing only some classes does not authorize an entire school's adoption",
        async () => {
          const f = await fixture();
          const grant = await issueSchoolAdoption(db!, sourceAccount, {
            schoolId: f.school.id,
            districtId: f.district.id,
          });
          await repo.createClass(f.school.id, {
            name: "Another Teacher's Class",
          });
          await assert.rejects(
            issueSchoolAdoption(db!, sourceAccount, {
              schoolId: f.school.id,
              districtId: f.district.id,
            }),
            /source_authority_required/,
          );
          await assert.rejects(
            acceptSchoolAdoption(db!, targetAccount, grant.token),
            /source_authority_changed/,
          );
          assert.equal(
            (
              await db!.query("SELECT parent_id FROM amp_orgs WHERE id=$1", [
                f.school.id,
              ])
            ).rows[0].parent_id,
            null,
          );
        },
      );

      await t.test(
        "ended teacher authority cannot approve adoption despite a live class enrollment",
        async () => {
          const f = await fixture();
          const grant = await issueSchoolAdoption(db!, sourceAccount, {
            schoolId: f.school.id,
            districtId: f.district.id,
          });
          await db!.query(
            "UPDATE amp_org_roles SET begin_on='1999-01-01',end_on='2000-01-01' WHERE person_id=$1",
            [f.teacher.personId],
          );
          await assert.rejects(
            acceptSchoolAdoption(db!, targetAccount, grant.token),
            /source_authority_changed/,
          );
          await assert.rejects(
            issueSchoolAdoption(db!, sourceAccount, {
              schoolId: f.school.id,
              districtId: f.district.id,
            }),
            /source_authority_required/,
          );
        },
      );

      await t.test(
        "stale roster writes cannot retain the adopted school as a tenant root",
        async () => {
          const f = await fixture();
          const grant = await issueSchoolAdoption(db!, sourceAccount, {
            schoolId: f.school.id,
            districtId: f.district.id,
          });
          await acceptSchoolAdoption(db!, targetAccount, grant.token);
          await assert.rejects(
            db!.query(
              "INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id) VALUES($1,'csv','person','stale',$2)",
              [f.school.id, f.learner.personId],
            ),
            /tenant must be a root organization/,
          );
          await assert.rejects(
            db!.query("UPDATE amp_people SET tenant_id=$1 WHERE id=$2", [
              f.school.id,
              f.learner.personId,
            ]),
            /tenant must be a root organization/,
          );
          assert.equal(
            (
              await db!.query("SELECT tenant_id FROM amp_people WHERE id=$1", [
                f.learner.personId,
              ])
            ).rows[0].tenant_id,
            f.district.id,
          );
        },
      );

      await t.test(
        "expired, revoked and wrong-destination handoffs cannot move data",
        async () => {
          const f = await fixture();
          const expired = await issueSchoolAdoption(
            db!,
            sourceAccount,
            { schoolId: f.school.id, districtId: f.district.id },
            new Date(Date.now() - 8 * 86_400_000),
          );
          await assert.rejects(
            acceptSchoolAdoption(db!, targetAccount, expired.token),
            /expired_or_revoked/,
          );
          const grant = await issueSchoolAdoption(db!, sourceAccount, {
            schoolId: f.school.id,
            districtId: f.district.id,
          });
          await assert.rejects(
            previewSchoolAdoption(db!, `amp|${randomUUID()}`, grant.token),
            /destination_authority_required/,
          );
          await revokeSchoolAdoption(db!, sourceAccount, grant.id);
          await assert.rejects(
            acceptSchoolAdoption(db!, targetAccount, grant.token),
            /expired_or_revoked/,
          );
        },
      );

      await t.test(
        "duplicate staff accounts require an explicit same-principal match",
        async () => {
          const f = await fixture(true);
          const grant = await issueSchoolAdoption(db!, sourceAccount, {
            schoolId: f.school.id,
            districtId: f.district.id,
          });
          const plan = await previewSchoolAdoption(
            db!,
            sourceAccount,
            grant.token,
          );
          assert.deepEqual(plan.conflicts, [
            {
              code: "account_already_in_district",
              sourcePersonId: f.teacher.personId,
              targetPersonId: f.leader.personId,
            },
          ]);
          await assert.rejects(
            acceptSchoolAdoption(db!, sourceAccount, grant.token),
            /conflicts_require_review/,
          );
          await assert.rejects(
            acceptSchoolAdoption(db!, sourceAccount, grant.token, {
              staffMerges: [
                {
                  sourcePersonId: f.learner.personId,
                  targetPersonId: f.leader.personId,
                },
              ],
            }),
            /staff_match_invalid/,
          );
          await acceptSchoolAdoption(db!, sourceAccount, grant.token, {
            staffMerges: [
              {
                sourcePersonId: f.teacher.personId,
                targetPersonId: f.leader.personId,
              },
            ],
          });
          const old = (
            await db!.query(
              "SELECT deleted_at,account_id FROM amp_people WHERE id=$1",
              [f.teacher.personId],
            )
          ).rows[0];
          assert.ok(old.deleted_at);
          assert.equal(old.account_id, null);
          assert.equal(
            (
              await db!.query(
                "SELECT person_id FROM amp_enrollments WHERE class_id=$1 AND role='teacher' AND end_on IS NULL",
                [f.klass.id],
              )
            ).rows[0].person_id,
            f.leader.personId,
          );
          assert.equal(
            (
              await db!.query("SELECT learner_id FROM amp_people WHERE id=$1", [
                f.learner.personId,
              ])
            ).rows[0].learner_id,
            f.learner.learnerId,
          );
        },
      );

      await t.test(
        "colliding source IDs require review and roll back every partial decision",
        async () => {
          const f = await fixture(true);
          const other = await repo.provisionStudent(f.district.id, {
            givenName: "Unrelated",
            gradeLevel: 4,
          });
          await db!.query(
            `INSERT INTO amp_external_refs(tenant_id,source,kind,sourced_id,local_id)
        VALUES($1,'oneroster','person','same-source-key',$2),($3,'oneroster','person','same-source-key',$4)`,
            [f.school.id, f.learner.personId, f.district.id, other.personId],
          );
          const grant = await issueSchoolAdoption(db!, sourceAccount, {
            schoolId: f.school.id,
            districtId: f.district.id,
          });
          await assert.rejects(
            acceptSchoolAdoption(db!, sourceAccount, grant.token, {
              staffMerges: [
                {
                  sourcePersonId: f.teacher.personId,
                  targetPersonId: f.leader.personId,
                },
              ],
            }),
            /conflicts_require_review/,
          );
          assert.equal(
            (
              await db!.query("SELECT account_id FROM amp_people WHERE id=$1", [
                f.teacher.personId,
              ])
            ).rows[0].account_id,
            sourceAccount,
          );
          assert.equal(
            (
              await db!.query(
                "SELECT consumed_at FROM amp_school_adoptions WHERE id=$1",
                [grant.id],
              )
            ).rows[0].consumed_at,
            null,
          );
          assert.equal(
            (
              await db!.query("SELECT parent_id FROM amp_orgs WHERE id=$1", [
                f.school.id,
              ])
            ).rows[0].parent_id,
            null,
          );
        },
      );

      await t.test(
        "reviewed Clever school binding makes the first sync reuse the adopted school",
        async () => {
          const f = await fixture();
          const districtId = "100000000000000000000098",
            schoolId = "200000000000000000000098";
          const connection = await registerCleverConnection(db!, {
            environment: "sandbox",
            districtId,
            tenantId: f.district.id,
          });
          const grant = await issueSchoolAdoption(db!, sourceAccount, {
            schoolId: f.school.id,
            districtId: f.district.id,
          });
          await acceptSchoolAdoption(db!, targetAccount, grant.token, {
            cleverSchool: { connectionId: connection.id, schoolId },
          });
          const ref = (
            await db!.query(
              "SELECT local_id FROM amp_external_refs WHERE tenant_id=$1 AND source=$2 AND kind='org'",
              [f.district.id, cleverSource(connection.id)],
            )
          ).rows[0];
          assert.equal(ref.local_id, f.school.id);
          const snapshot: Snapshot = {
            district: { id: districtId, name: "District" },
            schools: [{ id: schoolId, district: districtId, name: "School" }],
            users: [],
            sections: [],
            courses: [],
            terms: [],
          };
          await syncCleverConnection(db!, connection.id, {
            districtToken: async () => "not-persisted",
            latestEvent: async () => null,
            events: async () => [],
            snapshot: async () => snapshot,
          });
          assert.equal(
            (
              await db!.query(
                "SELECT local_id FROM amp_clever_bindings WHERE connection_id=$1 AND kind='school'",
                [connection.id],
              )
            ).rows[0].local_id,
            f.school.id,
          );
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_orgs WHERE parent_id=$1",
                [f.district.id],
              )
            ).rows[0].n,
            1,
          );
        },
      );
    } finally {
      await db?.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
