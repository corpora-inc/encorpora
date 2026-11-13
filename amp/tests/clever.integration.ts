import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import {
  linkCleverPerson,
  registerCleverConnection,
} from "../src/schools/clever/connection.js";
import { removeOrgTree } from "../src/schools/org-delete.js";
import { resolveCleverPerson } from "../src/schools/clever/identity.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import {
  CleverHttpError,
  type CleverEvent,
} from "../src/schools/clever/client.js";
import { CleverSyncError, type Snapshot } from "../src/schools/clever/model.js";

const D = "100000000000000000000001",
  S = "200000000000000000000001",
  S2 = "200000000000000000000002";
const U = "300000000000000000000001",
  T = "300000000000000000000002",
  T2 = "300000000000000000000003";
const C = "400000000000000000000001",
  C2 = "400000000000000000000002",
  TERM = "600000000000000000000001",
  COURSE = "700000000000000000000001";
const E1 = "500000000000000000000001",
  E2 = "500000000000000000000002";
const fixture = (): Snapshot => ({
  district: {
    id: D,
    name: "Fixture District",
    connection_type: "anyschool",
    launch_date: "2026-11-01",
  },
  schools: [
    { id: S, district: D, name: "School A" },
    { id: S2, district: D, name: "School B" },
  ],
  users: [
    {
      id: U,
      district: D,
      name: { first: "Student", last: "Fixture" },
      email: null,
      roles: { student: { school: S, schools: [S, S2], grade: "4" } },
    },
    {
      id: T,
      district: D,
      name: { first: "Teacher" },
      email: "unverified@example.test",
      roles: { teacher: { school: S, schools: [S] }, staff: { schools: [S2] } },
    },
    {
      id: T2,
      district: D,
      name: { first: "No Classes" },
      roles: { teacher: { school: S } },
    },
  ],
  sections: [
    {
      id: C,
      district: D,
      school: S,
      name: "Math A",
      students: [U],
      teachers: [T, T2],
      teacher: T,
      term_id: TERM,
      course: COURSE,
    },
    {
      id: C2,
      district: D,
      school: S2,
      name: "Math B",
      students: [U],
      teachers: [T],
    },
  ],
  courses: [{ id: COURSE, district: D, name: "Mathematics", number: "M4" }],
  terms: [
    {
      id: TERM,
      district: D,
      name: "Fall",
      start_date: "2026-08-01",
      end_date: "2026-12-31",
    },
  ],
});

test(
  "Clever roster transactional lifecycle",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `clever_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    let db: Pool | undefined;
    try {
      await migrate(scoped.href);
      db = new Pool({ connectionString: scoped.href, max: 3 });
      const repo = new SchoolRepository(db);
      const org = await repo.createOrg({
        kind: "district",
        name: "Fixture",
        timezone: "America/New_York",
      });
      await assert.rejects(
        registerCleverConnection(db, {
          environment: "sandbox",
          districtId: D,
          tenantId: org.id,
        }),
        /agreement_required/,
      );
      await repo.recordDataAgreement(org.id, {
        version: "fixture",
        signerName: "Fixture Admin",
        signerTitle: "District Administrator",
      });
      const connection = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: D,
        tenantId: org.id,
        eventsEnabled: true,
      });
      const knownPerson = randomUUID(),
        knownLearner = randomUUID();
      await db.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES($1,$2,'Existing Student')",
        [knownLearner, `school:${knownPerson}`],
      );
      await db.query(
        `INSERT INTO amp_people(id,tenant_id,given_name,handle,learner_id,timezone)
      VALUES($1,$2,'Existing','Fixture123',$3,'America/New_York')`,
        [knownPerson, org.id, knownLearner],
      );
      await linkCleverPerson(db, {
        connectionId: connection.id,
        userId: U,
        personId: knownPerson,
      });
      let source = fixture(),
        events: CleverEvent[] = [],
        failing = false,
        tokenMissing = false;
      const client = {
        districtToken: async () => {
          if (tokenMissing)
            throw new CleverSyncError("district_not_authorized");
          return "not-persisted";
        },
        latestEvent: async () => E1,
        snapshot: async () => {
          if (failing) throw new CleverHttpError(503);
          return source;
        },
        events: async () => events,
      };
      const sync = (mode: "full" | "events" = "full") =>
        syncCleverConnection(db!, connection.id, client, { mode });
      const person = () =>
        resolveCleverPerson(db!, {
          environment: "sandbox",
          districtId: D,
          userId: U,
        });
      const mapping = async (kind: string, id: string) =>
        (
          await db!.query(
            "SELECT * FROM amp_clever_bindings WHERE connection_id=$1 AND kind=$2 AND clever_id=$3",
            [connection.id, kind, id],
          )
        ).rows[0];
      let initialPerson: NonNullable<Awaited<ReturnType<typeof person>>>;
      let classId: string;

      await t.test(
        "imports district tree, multi-school/multi-role users and optional course/term",
        async () => {
          const result = await sync();
          assert.equal(result.counts.users, 3);
          assert.equal(result.cursor, E1);
          initialPerson = (await person())!;
          assert.equal(initialPerson.personId, knownPerson);
          assert.equal(initialPerson.learnerId, knownLearner);
          assert.ok(initialPerson.learnerId);
          assert.equal(initialPerson.accountId, null);
          const teacher = await resolveCleverPerson(db!, {
            environment: "sandbox",
            districtId: D,
            userId: T,
          });
          assert.deepEqual(teacher!.roles, ["teacher", "staff"]);
          assert.equal(teacher!.accountId, null); // Unverified email never auto-links.
          assert.equal(
            await resolveCleverPerson(db!, {
              environment: "production",
              districtId: D,
              userId: U,
            }),
            null,
          );
          const schools = (
            await db!.query("SELECT * FROM amp_orgs WHERE parent_id=$1", [
              org.id,
            ])
          ).rows;
          assert.equal(schools.length, 2);
          assert.ok(schools.every((s) => s.path[0] === org.id));
          assert.equal(
            (
              await db!.query(
                "SELECT * FROM amp_enrollments WHERE person_id=$1 AND role='student' AND end_on IS NULL",
                [initialPerson.personId],
              )
            ).rowCount,
            2,
          );
          classId = (await mapping("section", C)).local_id;
          assert.equal(
            (await mapping("section", C)).metadata.syntheticCalendar,
            false,
          );
          assert.equal(
            (await mapping("section", C2)).metadata.syntheticCalendar,
            true,
          );
          const noClasses = await resolveCleverPerson(db!, {
            environment: "sandbox",
            districtId: D,
            userId: T2,
          });
          assert.ok(noClasses);
          await db!.query(
            "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,'{}')",
            ["fixture-evidence", initialPerson.learnerId],
          );
          await db!.query(
            "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome) VALUES('fixture-attempt',$1,'fixture-evidence','request',$2)",
            [
              initialPerson.learnerId,
              JSON.stringify({
                createdAt: new Date().toISOString(),
                skillId: "fixture-skill",
                correct: true,
              }),
            ],
          );
        },
      );

      await t.test(
        "repeat sync updates names by stable identity and preserves learner evidence",
        async () => {
          source.users[0].name.first = "Renamed";
          source.users[0].email = "changed@example.test";
          await sync();
          assert.equal((await person())!.personId, initialPerson.personId);
          assert.equal((await person())!.learnerId, initialPerson.learnerId);
          assert.equal(
            (await db!.query("SELECT count(*)::int AS n FROM amp_people"))
              .rows[0].n,
            3,
          );
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
                [initialPerson.learnerId],
              )
            ).rows[0].n,
            1,
          );
          assert.equal(
            (
              await db!.query("SELECT given_name FROM amp_people WHERE id=$1", [
                initialPerson.personId,
              ])
            ).rows[0].given_name,
            "Renamed",
          );
        },
      );

      await t.test(
        "partial failures and cross-district records leave roster/checkpoint untouched",
        async () => {
          failing = true;
          await assert.rejects(sync(), /clever_http_503/);
          failing = false;
          source.schools[0].district = "100000000000000000000002";
          await assert.rejects(sync(), /district_mismatch/);
          source.schools[0].district = D;
          assert.ok(await person());
          assert.equal(
            (
              await db!.query(
                "SELECT event_cursor FROM amp_clever_connections WHERE id=$1",
                [connection.id],
              )
            ).rows[0].event_cursor,
            E1,
          );
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_enrollments WHERE person_id=$1 AND end_on IS NULL",
                [initialPerson.personId],
              )
            ).rows[0].n,
            2,
          );
        },
      );

      await t.test(
        "Events reconcile enrollment removals and atomically advance cursor",
        async () => {
          source.sections[0].students = [];
          events = [
            {
              id: E2,
              type: "sections.updated",
              created: new Date().toISOString(),
              data: { object: source.sections[0] },
            },
          ];
          const result = await sync("events");
          assert.equal(result.cursor, E2);
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_enrollments WHERE person_id=$1 AND end_on IS NULL",
                [initialPerson.personId],
              )
            ).rows[0].n,
            1,
          );
          await sync("events"); // A repeated event does not duplicate memberships.
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_enrollments WHERE person_id=$1 AND end_on IS NULL",
                [initialPerson.personId],
              )
            ).rows[0].n,
            1,
          );
        },
      );

      await t.test(
        "expired cursors and an Events retention gap perform a complete resync",
        async () => {
          const repaired = await syncCleverConnection(
            db!,
            connection.id,
            {
              ...client,
              events: async () => {
                throw new CleverHttpError(404);
              },
            },
            { mode: "events" },
          );
          assert.equal(repaired.mode, "full");
          await db!.query(
            "UPDATE amp_clever_connections SET last_sync_at=now()-interval '28 days' WHERE id=$1",
            [connection.id],
          );
          const stale = await syncCleverConnection(
            db!,
            connection.id,
            {
              ...client,
              events: async () => {
                throw new Error("must not request an expired cursor");
              },
            },
            { mode: "events" },
          );
          assert.equal(stale.mode, "full");
        },
      );

      await t.test(
        "optional deleted courses/terms do not archive active sections",
        async () => {
          source.courses = [];
          source.terms = [];
          await sync();
          assert.ok((await mapping("course", COURSE)).archived_at);
          assert.ok((await mapping("term", TERM)).archived_at);
          const klass = (
            await db!.query("SELECT * FROM amp_classes WHERE id=$1", [classId])
          ).rows[0];
          assert.equal(klass.archived_at, null);
          assert.equal(klass.course_id, null);
          assert.equal(
            (await mapping("section", C)).metadata.syntheticCalendar,
            true,
          );
        },
      );

      await t.test(
        "unsharing archives source bindings/access and restoration keeps same learner",
        async () => {
          source.users = source.users.filter((user) => user.id !== U);
          source.sections = [];
          await sync();
          assert.equal(await person(), null);
          assert.ok((await mapping("user", U)).archived_at);
          assert.equal(
            (
              await db!.query("SELECT deleted_at FROM amp_people WHERE id=$1", [
                initialPerson.personId,
              ])
            ).rows[0].deleted_at,
            null,
          );
          assert.ok(
            (
              await db!.query(
                "SELECT archived_at FROM amp_classes WHERE id=$1",
                [classId],
              )
            ).rows[0].archived_at,
          );
          source = fixture();
          await sync();
          assert.equal((await person())!.learnerId, initialPerson.learnerId);
          assert.equal((await mapping("section", C)).local_id, classId);
          assert.equal(
            (
              await db!.query(
                "SELECT archived_at FROM amp_classes WHERE id=$1",
                [classId],
              )
            ).rows[0].archived_at,
            null,
          );
          assert.equal(
            (await db!.query("SELECT count(*)::int AS n FROM amp_attempts"))
              .rows[0].n,
            1,
          );
        },
      );

      await t.test(
        "revocation ends source memberships, preserving independent manual access",
        async () => {
          const teacher = await resolveCleverPerson(db!, {
            environment: "sandbox",
            districtId: D,
            userId: T,
          });
          const manualId = randomUUID();
          await db!.query(
            "INSERT INTO amp_org_roles(id,org_id,person_id,role,begin_on) VALUES($1,$2,$3,'viewer',current_date)",
            [manualId, org.id, teacher!.personId],
          );
          tokenMissing = true;
          await assert.rejects(sync(), /district_not_authorized/);
          assert.equal(await person(), null);
          assert.equal(
            (
              await db!.query("SELECT end_on FROM amp_org_roles WHERE id=$1", [
                manualId,
              ])
            ).rows[0].end_on,
            null,
          );
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_enrollments WHERE end_on IS NULL",
              )
            ).rows[0].n,
            0,
          );
          assert.equal(
            (await db!.query("SELECT count(*)::int AS n FROM amp_attempts"))
              .rows[0].n,
            1,
          );
          tokenMissing = false;
          await registerCleverConnection(db!, {
            environment: "sandbox",
            districtId: D,
            tenantId: org.id,
            eventsEnabled: true,
          });
          await sync();
          assert.equal((await person())!.learnerId, initialPerson.learnerId);
        },
      );

      await t.test(
        "concurrent workers cannot overwrite a newer snapshot",
        async () => {
          let release!: () => void;
          let entered!: () => void;
          const enteredPromise = new Promise<void>((r) => (entered = r));
          const blocked = new Promise<void>((r) => (release = r));
          const first = syncCleverConnection(
            db!,
            connection.id,
            {
              ...client,
              snapshot: async () => {
                entered();
                await blocked;
                return source;
              },
            },
            { mode: "full" },
          );
          await enteredPromise;
          await assert.rejects(sync(), /clever_sync_already_running/);
          release();
          await first;
        },
      );

      await t.test(
        "an established identity cannot be rebound or claimed twice",
        async () => {
          const teacher = (await mapping("user", T)).local_id;
          await assert.rejects(
            linkCleverPerson(db!, {
              connectionId: connection.id,
              userId: U,
              personId: teacher,
            }),
            /identity_already_bound/,
          );
          await assert.rejects(
            linkCleverPerson(db!, {
              connectionId: connection.id,
              userId: T,
              personId: knownPerson,
            }),
            /identity_already_bound/,
          );
          await assert.rejects(
            linkCleverPerson(db!, {
              connectionId: connection.id,
              userId: "300000000000000000000099",
              personId: knownPerson,
            }),
            /identity_already_bound/,
          );
        },
      );

      await t.test(
        "privacy deletion scrubs source identity and never resurrects the learner",
        async () => {
          await db!.query("DELETE FROM amp_learners WHERE id=$1", [
            knownLearner,
          ]);
          const binding = await mapping("user", U);
          assert.deepEqual(binding.record.name, {});
          assert.equal(binding.record.email, undefined);
          assert.deepEqual(binding.metadata.roles, []);
          assert.ok(binding.archived_at);
          source.schools[0].name = "Must Roll Back";
          await assert.rejects(sync(), /deleted_person_requires_review/);
          assert.equal(
            (
              await db!.query("SELECT name FROM amp_orgs WHERE id=$1", [
                (await mapping("school", S)).local_id,
              ])
            ).rows[0].name,
            "School A",
          );
          assert.equal(await person(), null);
          assert.equal(
            (
              await db!.query(
                "SELECT count(*)::int AS n FROM amp_learners WHERE id=$1",
                [knownLearner],
              )
            ).rows[0].n,
            0,
          );
        },
      );

      await t.test(
        "explicit institution purge cascades provider records and courses",
        async () => {
          await repo.transaction((client) =>
            removeOrgTree(client, {
              orgId: org.id,
              confirm: "Fixture",
              commit: true,
              allowLicensed: false,
            }),
          );
          for (const table of [
            "amp_clever_connections",
            "amp_clever_bindings",
            "amp_clever_sync_runs",
            "amp_clever_memberships",
            "amp_courses",
          ])
            assert.equal(
              (await db!.query(`SELECT count(*)::int AS n FROM ${table}`))
                .rows[0].n,
              0,
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
