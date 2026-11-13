import test from "node:test";
import Fastify from "fastify";
import { registerSchoolAdoptionRoutes } from "../src/schools/adoption-routes.js";
import { ApiError } from "../src/server/repository.js";
import {
  adoptionOptions,
  adoptionReview,
} from "../src/schools/adoption-contracts.js";
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
  schoolAdoptionAuthority,
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
        "HTTP adoption requires both accounts, body-only proof and same-origin cookie writes",
        async () => {
          const f = await fixture(),
            app = Fastify();
          await registerSchoolAdoptionRoutes(app, {
            pool: db!,
            origin: "https://amp.example.test",
            authenticate: async (request) => {
              const value =
                request.headers.authorization?.replace(/^Bearer /, "") ??
                request.headers.cookie?.replace(/^account=/, "");
              if (!value) throw new ApiError(401, "sign_in_required");
              return value;
            },
          });
          try {
            const post = (
              path: string,
              account: string,
              body: unknown,
              headers: Record<string, string> = {},
            ) =>
              app.inject({
                method: "POST",
                url: `/api/v1/school/adoptions/${path}`,
                headers: { authorization: `Bearer ${account}`, ...headers },
                payload: body as object,
              });
            const options = await post("options", sourceAccount, {
              districtId: f.district.id,
            });
            assert.equal(options.statusCode, 200, options.body);
            const view = adoptionOptions.parse(options.json());
            assert.ok(view.schools.some((s) => s.id === f.school.id));
            assert.equal(view.district?.id, f.district.id);
            assert.equal(
              (
                await post("issue", targetAccount, {
                  schoolId: f.school.id,
                  districtId: f.district.id,
                  confirmed: true,
                })
              ).statusCode,
              403,
            );
            const created = await post("issue", sourceAccount, {
              schoolId: f.school.id,
              districtId: f.district.id,
              confirmed: true,
            });
            assert.equal(created.statusCode, 200, created.body);
            const token = created.json().token;
            assert.equal(created.headers["cache-control"], "no-store");
            assert.equal(
              (await post("review", sourceAccount, { token })).statusCode,
              403,
            );
            assert.equal(
              (await post("review", `st_${"x".repeat(43)}`, { token }))
                .statusCode,
              401,
            );
            const review = await post("review", targetAccount, { token });
            assert.equal(review.statusCode, 200, review.body);
            const reviewed = adoptionReview.parse(review.json());
            assert.equal(reviewed.schoolName, "School");
            assert.equal(reviewed.learners, 1);
            assert.equal(reviewed.sourcePeople.length, 2);
            assert.equal(reviewed.sourceClasses[0]?.id, f.klass.id);
            for (const origin of [undefined, "https://other.example.test"]) {
              const blocked = await app.inject({
                method: "POST",
                url: "/api/v1/school/adoptions/accept",
                headers: {
                  cookie: `account=${targetAccount}`,
                  ...(origin ? { origin } : {}),
                },
                payload: { token, confirmed: true },
              });
              assert.equal(blocked.statusCode, 403);
              assert.equal(blocked.json().error, "request_origin_invalid");
            }
            const accepted = await app.inject({
              method: "POST",
              url: "/api/v1/school/adoptions/accept",
              headers: {
                cookie: `account=${targetAccount}`,
                origin: "https://amp.example.test",
              },
              payload: { token, confirmed: true },
            });
            assert.equal(accepted.statusCode, 200, accepted.body);
            assert.equal(accepted.json().schoolId, f.school.id);
            assert.equal(
              (await post("accept", targetAccount, { token, confirmed: true }))
                .statusCode,
              409,
            );
          } finally {
            await app.close();
          }
        },
      );

      await t.test(
        "staged Clever administrators must retain current provider authority before reading or accepting a school",
        async () => {
          const f = await fixture(),
            districtId = "100000000000000000000077",
            userId = "300000000000000000000077";
          const connection = await registerCleverConnection(db!, {
            environment: "sandbox",
            districtId,
            tenantId: f.district.id,
          });
          const runId = randomUUID(),
            role = (
              await db!.query(
                "SELECT id FROM amp_org_roles WHERE person_id=$1 AND role='admin'",
                [f.leader.personId],
              )
            ).rows[0];
          await db!.query(
            "INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status,finished_at) VALUES($1,$2,'full','succeeded',now())",
            [runId, connection.id],
          );
          await db!.query(
            "INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,local_id,record,last_seen_run_id) VALUES($1,'user',$2,$3,$4,$5)",
            [
              connection.id,
              userId,
              f.leader.personId,
              {
                id: userId,
                district: districtId,
                name: { first: "Leader" },
                roles: { district_admin: {} },
              },
              runId,
            ],
          );
          await db!.query(
            "INSERT INTO amp_clever_memberships(connection_id,kind,source_key,local_id,owned,last_seen_run_id) VALUES($1,'org_role','fixture-admin',$2,true,$3)",
            [connection.id, role.id, runId],
          );
          const grant = await issueSchoolAdoption(db!, sourceAccount, {
            schoolId: f.school.id,
            districtId: f.district.id,
          });
          let snapshot: Snapshot = {
            district: { id: districtId, name: "District" },
            schools: [],
            users: [
              {
                id: userId,
                district: districtId,
                name: { first: "Former admin" },
                roles: { teacher: {} },
              },
            ],
            sections: [],
            courses: [],
            terms: [],
          };
          const app = Fastify();
          await registerSchoolAdoptionRoutes(app, {
            pool: db!,
            authenticate: async () => targetAccount,
            cleverSnapshot: async () => snapshot,
          });
          try {
            for (const path of ["review", "clever-preview", "accept"]) {
              const result = await app.inject({
                method: "POST",
                url: `/api/v1/school/adoptions/${path}`,
                payload: {
                  token: grant.token,
                  connectionId: connection.id,
                  confirmed: true,
                },
              });
              assert.equal(result.statusCode, 403, result.body);
              assert.equal(
                result.json().error,
                "adoption_current_authority_required",
              );
              assert.equal("sourcePeople" in result.json(), false);
            }
            assert.equal(
              (
                await db!.query("SELECT parent_id FROM amp_orgs WHERE id=$1", [
                  f.school.id,
                ])
              ).rows[0].parent_id,
              null,
            );
            await assert.rejects(
              acceptSchoolAdoption(db!, targetAccount, grant.token),
              /current_authority_required/,
            );
            snapshot = {
              ...snapshot,
              users: [
                {
                  id: userId,
                  district: districtId,
                  name: { first: "Leader" },
                  roles: { district_admin: {} },
                },
              ],
            };
            const proof = await schoolAdoptionAuthority(
              db!,
              targetAccount,
              { token: grant.token },
              async () => snapshot,
            );
            const review = await app.inject({
              method: "POST",
              url: "/api/v1/school/adoptions/review",
              payload: { token: grant.token },
            });
            assert.equal(review.statusCode, 200, review.body);
            assert.equal(proof.authoritySnapshots?.length, 1);
            const accepted = await app.inject({
              method: "POST",
              url: "/api/v1/school/adoptions/accept",
              payload: { token: grant.token, confirmed: true },
            });
            assert.equal(accepted.statusCode, 200, accepted.body);
          } finally {
            await app.close();
          }
        },
      );
      await t.test(
        "independent district admin grants do not depend on Clever authority",
        async () => {
          const f = await fixture();
          const grant = await issueSchoolAdoption(db!, sourceAccount, {
            schoolId: f.school.id,
            districtId: f.district.id,
          });
          const proof = await schoolAdoptionAuthority(
            db!,
            targetAccount,
            { token: grant.token },
            async () => {
              throw new Error("must not fetch");
            },
          );
          assert.deepEqual(proof, {});
          await acceptSchoolAdoption(
            db!,
            targetAccount,
            grant.token,
            {},
            proof,
          );
        },
      );

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
          const studentId = "300000000000000000000098",
            teacherId = "300000000000000000000099",
            sectionId = "400000000000000000000098";
          const snapshot: Snapshot = {
            district: { id: districtId, name: "District" },
            schools: [{ id: schoolId, district: districtId, name: "School" }],
            users: [
              {
                id: studentId,
                district: districtId,
                name: { first: "Student" },
                roles: { student: { school: schoolId, grade: "4" } },
              },
              {
                id: teacherId,
                district: districtId,
                name: { first: "Teacher" },
                roles: { teacher: { school: schoolId } },
              },
            ],
            sections: [
              {
                id: sectionId,
                district: districtId,
                school: schoolId,
                name: "Existing Class",
                students: [studentId],
                teachers: [teacherId],
              },
            ],
            courses: [],
            terms: [],
          };
          const decisions = {
            cleverSchool: { connectionId: connection.id, schoolId },
            cleverPeople: [
              { personId: f.teacher.personId, userId: teacherId },
              { personId: f.learner.personId, userId: studentId },
            ],
            cleverSections: [{ classId: f.klass.id, sectionId }],
          };
          await assert.rejects(
            acceptSchoolAdoption(db!, targetAccount, grant.token, decisions),
            /review_required/,
          );
          await assert.rejects(
            acceptSchoolAdoption(
              db!,
              targetAccount,
              grant.token,
              { ...decisions, cleverPeople: [] },
              { snapshot },
            ),
            /incomplete_match/,
          );
          await assert.rejects(
            acceptSchoolAdoption(
              db!,
              targetAccount,
              grant.token,
              {
                ...decisions,
                cleverPeople: [
                  { personId: f.teacher.personId, userId: studentId },
                  { personId: f.learner.personId, userId: teacherId },
                ],
              },
              { snapshot },
            ),
            /role_mismatch/,
          );
          const badRoster = structuredClone(snapshot);
          badRoster.sections[0]!.students = [];
          await assert.rejects(
            acceptSchoolAdoption(db!, targetAccount, grant.token, decisions, {
              snapshot: badRoster,
            }),
            /roster_mismatch/,
          );
          await acceptSchoolAdoption(
            db!,
            targetAccount,
            grant.token,
            decisions,
            { snapshot },
          );
          const ref = (
            await db!.query(
              "SELECT local_id FROM amp_external_refs WHERE tenant_id=$1 AND source=$2 AND kind='org'",
              [f.district.id, cleverSource(connection.id)],
            )
          ).rows[0];
          assert.equal(ref.local_id, f.school.id);
          await syncCleverConnection(db!, connection.id, {
            districtToken: async () => "not-persisted",
            latestEvent: async () => null,
            events: async () => [],
            snapshot: async () => snapshot,
          });
          assert.equal(
            (
              await db!.query(
                "SELECT local_id FROM amp_clever_bindings WHERE connection_id=$1 AND kind='section'",
                [connection.id],
              )
            ).rows[0].local_id,
            f.klass.id,
          );
          assert.equal(
            (
              await db!.query(
                "SELECT local_id FROM amp_clever_bindings WHERE connection_id=$1 AND kind='user' AND clever_id=$2",
                [connection.id, studentId],
              )
            ).rows[0].local_id,
            f.learner.personId,
          );
          assert.equal(
            (
              await db!.query("SELECT learner_id FROM amp_people WHERE id=$1", [
                f.learner.personId,
              ])
            ).rows[0].learner_id,
            f.learner.learnerId,
          );
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
                [f.district.id],
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_clever_memberships WHERE connection_id=$1 AND owned=false",
                [connection.id],
              )
            ).rows[0].n,
            0,
          );
          const removed = structuredClone(snapshot);
          removed.users = removed.users.filter((u) => u.id !== studentId);
          removed.sections[0]!.students = [];
          await syncCleverConnection(db!, connection.id, {
            districtToken: async () => "not-persisted",
            latestEvent: async () => null,
            events: async () => [],
            snapshot: async () => removed,
          });
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_enrollments WHERE person_id=$1 AND end_on IS NULL",
                [f.learner.personId],
              )
            ).rows[0].n,
            0,
          );
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
