import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import {
  SchoolRepository,
  birthYearForGrade,
} from "../src/schools/repository.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import { schoolAccountId } from "../src/schools/principal.js";
import type { Snapshot } from "../src/schools/clever/model.js";

const sourceId = (kind: number, index: number) =>
  `${kind.toString(16)}${index.toString(16).padStart(23, "0")}`;

test(
  "batched Clever roster keeps privacy, learning and source authority across chunk boundaries",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `clever_batch_${randomUUID().replaceAll("-", "")}`,
      admin = new Pool({ connectionString: url, max: 1 }),
      scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new Pool({ connectionString: scoped.href, max: 6 });
    try {
      await migrate(scoped.href);
      const repo = new SchoolRepository(db),
        district = await repo.createOrg(
          { kind: "district", name: "Fixture district", timezone: "UTC" },
          {
            version: "fixture",
            signerName: "Fixture administrator",
            signerTitle: "Administrator",
          },
        );
      const districtId = sourceId(1, 1),
        schoolId = sourceId(2, 1),
        teacher = sourceId(4, 1),
        techLead = sourceId(5, 1),
        portal = sourceId(5, 2),
        plainStaff = sourceId(5, 3),
        administrator = sourceId(5, 4);
      const studentCount = 2201,
        students = Array.from({ length: studentCount }, (_, i) =>
          sourceId(3, i + 1),
        );
      const source: Snapshot = {
        district: { id: districtId, name: "Fixture district" },
        schools: [
          { id: schoolId, district: districtId, name: "Fixture school" },
        ],
        users: students.map((id, i) => ({
          id,
          district: districtId,
          name: { first: `Student ${i + 1}` },
          roles: { student: { school: schoolId, grade: "4" } },
        })),
        sections: [0, 1].map((i) => ({
          id: sourceId(6, i + 1),
          district: districtId,
          school: schoolId,
          name: `Class ${i + 1}`,
          teachers: [teacher],
          students: students.filter((_, j) => j % 2 === i),
        })),
        courses: [],
        terms: [],
      };
      source.users.push(
        {
          id: teacher,
          district: districtId,
          name: { first: "Teacher" },
          roles: {
            teacher: { school: schoolId },
            staff: { school: schoolId, roles: ["PortalOnly"] },
          },
        },
        {
          id: techLead,
          district: districtId,
          name: { first: "Tech lead" },
          roles: { staff: { school: schoolId, roles: ["SchoolTechLead"] } },
        },
        {
          id: portal,
          district: districtId,
          name: { first: "Portal staff" },
          roles: { staff: { school: schoolId, roles: ["PortalOnly"] } },
        },
        {
          id: plainStaff,
          district: districtId,
          name: { first: "Staff" },
          roles: { staff: { school: schoolId } },
        },
        {
          id: administrator,
          district: districtId,
          name: { first: "Administrator" },
          roles: {
            district_admin: {},
            staff: { school: schoolId, roles: ["PortalOnly"] },
          },
        },
      );
      const connection = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId,
        tenantId: district.id,
      });
      const client = {
        districtToken: async () => "fixture",
        snapshot: async () => source,
        latestEvent: async () => null,
        events: async () => [],
      };
      let failedSqlCode: string | undefined;
      const sync = async (
        onQuery?: (sql: string, args: unknown[]) => void | Promise<void>,
      ) => {
        const sqlClient = await db.connect(),
          original = sqlClient.query;
        let count = 0;
        failedSqlCode = undefined;
        sqlClient.query = ((...args: unknown[]) => {
          count++;
          return Promise.resolve(onQuery?.(String(args[0]), args)).then(() =>
            Reflect.apply(original, sqlClient, args).catch((error: unknown) => {
              failedSqlCode = (error as { code?: string }).code;
              throw error;
            }),
          );
        }) as PoolClient["query"];
        try {
          await syncCleverConnection(db, connection.id, client, {
            mode: "full",
            db: sqlClient,
          });
          return count;
        } finally {
          sqlClient.query = original;
          sqlClient.release();
        }
      };
      const person = async (id: string) =>
        (
          await db.query(
            `SELECT p.*,p.xmin::text AS person_version,l.name AS learner_name,l.birth_year,l.name_pending,l.xmin::text AS learner_version
      FROM amp_clever_bindings b JOIN amp_people p ON p.id=b.local_id LEFT JOIN amp_learners l ON l.id=p.learner_id
      WHERE b.connection_id=$1 AND b.kind='user' AND b.clever_id=$2`,
            [connection.id, id],
          )
        ).rows[0];
      const liveRoles = async (id: string) =>
        (
          await db.query(
            `SELECT r.role FROM amp_clever_bindings b JOIN amp_org_roles r ON r.person_id=b.local_id
      WHERE b.connection_id=$1 AND b.kind='user' AND b.clever_id=$2 AND r.end_on IS NULL ORDER BY r.role`,
            [connection.id, id],
          )
        ).rows.map((r) => r.role);

      await t.test(
        "first and repeated imports use bounded query counts and avoid rewriting unchanged learning rows",
        async () => {
          const first = await sync();
          assert.ok(
            first < 150,
            `First import used ${first} SQL calls for ${studentCount} students`,
          );
          const before = await person(students[0]);
          const repeat = await sync();
          assert.ok(
            repeat < 150,
            `Repeat import used ${repeat} SQL calls for ${studentCount} students`,
          );
          assert.deepEqual(
            await person(students[0]),
            before,
            "unchanged person and learner rows retain their row versions",
          );
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
                [district.id],
              )
            ).rows[0].n,
            studentCount,
          );
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_enrollments WHERE role='student' AND end_on IS NULL",
              )
            ).rows[0].n,
            studentCount,
          );
          t.diagnostic(
            `2201-student first/repeat SQL calls: ${first}/${repeat}`,
          );
        },
      );

      await t.test(
        "only SchoolTechLead grants viewer; demotion ends source authority without changing teacher/admin co-roles",
        async () => {
          assert.deepEqual(await liveRoles(techLead), ["viewer"]);
          assert.deepEqual(await liveRoles(portal), []);
          assert.deepEqual(await liveRoles(plainStaff), []);
          assert.deepEqual(await liveRoles(teacher), ["teacher"]);
          assert.deepEqual(await liveRoles(administrator), ["admin"]);
          source.users.find((u) => u.id === techLead)!.roles.staff!.roles = [
            "PortalOnly",
          ];
          await sync();
          assert.deepEqual(await liveRoles(techLead), []);
          assert.deepEqual(await liveRoles(teacher), ["teacher"]);
          assert.deepEqual(await liveRoles(administrator), ["admin"]);
        },
      );

      await t.test(
        "roster names and grades propagate while display names and prior learning evidence are preserved",
        async () => {
          const first = await person(students[0]),
            experienced = await person(students[1]);
          await db.query(
            "UPDATE amp_people SET display_name='Classroom nickname' WHERE id=$1",
            [experienced.id],
          );
          await db.query(
            "INSERT INTO amp_instances(id,learner_id,content) VALUES('batch-instance',$1,'{}')",
            [experienced.learner_id],
          );
          await db.query(
            "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome) VALUES('batch-attempt',$1,'batch-instance','batch-request',$2)",
            [
              experienced.learner_id,
              {
                skillId: "fixture",
                correct: true,
                createdAt: new Date().toISOString(),
              },
            ],
          );
          for (const id of students.slice(0, 2)) {
            const user = source.users.find((u) => u.id === id)!;
            user.name.first = "Updated";
            user.roles.student!.grade = "7";
          }
          await sync();
          const updated = await person(students[0]),
            preserved = await person(students[1]);
          assert.equal(updated.learner_id, first.learner_id);
          assert.equal(updated.learner_name, "Updated");
          assert.equal(updated.birth_year, birthYearForGrade(7));
          assert.equal(preserved.learner_id, experienced.learner_id);
          assert.equal(preserved.learner_name, "Classroom nickname");
          assert.equal(preserved.birth_year, experienced.birth_year);
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
                [experienced.learner_id],
              )
            ).rows[0].n,
            1,
          );
        },
      );

      await t.test(
        "pending names transition only with active naming consent and denied imports roll back",
        async () => {
          const pending = await person(students[2]);
          const makePending = async () => {
            await db.query(
              "UPDATE amp_people SET given_name='Student 1',family_name=NULL,display_name=NULL,email=NULL,identifier=NULL WHERE id=$1",
              [pending.id],
            );
            await db.query(
              "UPDATE amp_learners SET name='Student 1',identity_scope=$2,label_number=1,name_pending=true WHERE id=$1",
              [pending.learner_id, schoolAccountId(pending.id)],
            );
          };
          await makePending();
          await sync();
          assert.equal((await person(students[2])).name_pending, false);
          assert.equal((await person(students[2])).learner_name, "Student 3");
          await makePending();
          const school = (
            await db.query(
              "SELECT local_id FROM amp_clever_bindings WHERE connection_id=$1 AND kind='school' AND clever_id=$2",
              [connection.id, schoolId],
            )
          ).rows[0].local_id;
          const agreement = await repo.transaction((client) =>
            repo.acceptAgreement(client, school, {
              version: "fixture",
              signerName: "Fixture",
              signerTitle: "Administrator",
            }),
          );
          await db.query(
            "UPDATE amp_data_agreements SET ended_at=now() WHERE id=$1",
            [agreement],
          );
          const before = await person(students[2]);
          await assert.rejects(sync(), /clever_sync_failed/);
          assert.deepEqual(await person(students[2]), before);
          await db.query(
            "UPDATE amp_data_agreements SET ended_at=NULL WHERE id=$1",
            [agreement],
          );
          await sync();
          assert.equal((await person(students[2])).name_pending, false);
        },
      );

      await t.test(
        "an unchanged import proceeds during active practice; changed learning fields respect its row lock",
        async () => {
          const current = await person(students[4]),
            practice = await db.connect();
          const shortLock = (sql: string, args: unknown[]) => {
            if (sql.startsWith("SET LOCAL lock_timeout"))
              args[0] = "SET LOCAL lock_timeout='100ms'";
          };
          await practice.query("BEGIN");
          try {
            await practice.query(
              "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",
              [schoolAccountId(current.id)],
            );
            await practice.query(
              "SELECT id FROM amp_learners WHERE id=$1 FOR UPDATE",
              [current.learner_id],
            );
            await sync(shortLock);
            source.users.find((u) => u.id === students[4])!.name.first =
              "Changed during practice";
            await assert.rejects(sync(shortLock), /clever_sync_failed/);
            assert.equal(
              failedSqlCode,
              "55P03",
              "changed learning data waits for the learner row lock",
            );
            assert.equal(
              (await person(students[4])).given_name,
              current.given_name,
            );
            await practice.query("COMMIT");
            await sync();
            assert.equal(
              (await person(students[4])).learner_name,
              "Changed during practice",
            );
          } finally {
            await practice.query("ROLLBACK");
            practice.release();
          }
        },
      );
      await t.test(
        "privacy deletion holds the account lock before the import can lock or rewrite its person",
        async () => {
          const victim = (
            await db.query(
              "SELECT p.id,p.learner_id,b.clever_id FROM amp_people p JOIN amp_clever_bindings b ON b.local_id=p.id AND b.kind='user' AND b.connection_id=$2 WHERE p.tenant_id=$1 AND p.learner_id IS NOT NULL ORDER BY p.id LIMIT 1",
              [district.id, connection.id],
            )
          ).rows[0];
          const account = schoolAccountId(victim.id),
            privacy = await db.connect();
          source.users.find((u) => u.id === victim.clever_id)!.name.first =
            "Must never be restored";
          let signal!: () => void;
          const waiting = new Promise<void>((resolve) => {
            signal = resolve;
          });
          await privacy.query("BEGIN");
          await privacy.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
            [account],
          );
          const importing = sync((sql, args) => {
            if (
              sql.includes("pg_advisory_xact_lock_shared") &&
              JSON.stringify(args[1]).includes(account)
            )
              signal();
          });
          const refused = assert.rejects(
            importing,
            /clever_deleted_person_requires_review/,
          );
          try {
            await waiting;
            await privacy.query(
              "UPDATE amp_people SET deleted_at=now(),given_name='Removed' WHERE id=$1",
              [victim.id],
            );
            await privacy.query("COMMIT");
            await refused;
            assert.equal(
              (
                await db.query(
                  "SELECT given_name FROM amp_people WHERE id=$1",
                  [victim.id],
                )
              ).rows[0].given_name,
              "Removed",
            );
          } finally {
            await privacy.query("ROLLBACK");
            privacy.release();
          }
          source.users = source.users.filter((u) => u.id !== victim.clever_id);
          for (const section of source.sections)
            section.students = section.students.filter(
              (id) => id !== victim.clever_id,
            );
        },
      );
      await t.test(
        "an unchanged source checkpoint never restores a concurrent privacy tombstone payload",
        async () => {
          await sync();
          const victim = (
            await db.query(
              "SELECT p.id,b.clever_id FROM amp_people p JOIN amp_clever_bindings b ON b.local_id=p.id AND b.kind='user' AND b.connection_id=$2 WHERE p.tenant_id=$1 AND p.learner_id IS NOT NULL AND p.deleted_at IS NULL ORDER BY p.id LIMIT 1",
              [district.id, connection.id],
            )
          ).rows[0];
          let removed = false;
          await sync(async (sql, args) => {
            if (
              !removed &&
              sql.includes(
                "UPDATE amp_clever_bindings b SET last_seen_run_id",
              ) &&
              JSON.stringify(args[1]).includes(victim.clever_id)
            ) {
              const privacy = await db.connect();
              try {
                await privacy.query("BEGIN");
                await privacy.query(
                  "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
                  [schoolAccountId(victim.id)],
                );
                await privacy.query(
                  "UPDATE amp_people SET deleted_at=now(),given_name='Removed' WHERE id=$1",
                  [victim.id],
                );
                await privacy.query("COMMIT");
                removed = true;
              } finally {
                await privacy.query("ROLLBACK");
                privacy.release();
              }
            }
          });
          assert.equal(removed, true);
          const binding = (
            await db.query(
              "SELECT record,metadata,archived_at FROM amp_clever_bindings WHERE connection_id=$1 AND kind='user' AND clever_id=$2",
              [connection.id, victim.clever_id],
            )
          ).rows[0];
          assert.deepEqual(binding.record.name, {});
          assert.deepEqual(binding.metadata, { roles: [] });
          assert.ok(binding.archived_at);
        },
      );
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
