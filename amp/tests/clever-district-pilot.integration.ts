import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { resolveCleverPerson } from "../src/schools/clever/identity.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import type { Snapshot } from "../src/schools/clever/model.js";
import { removeOrgTree } from "../src/schools/org-delete.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import {
  classPracticeGate,
  schoolPilotAccess,
} from "../src/schools/pilot-access.js";
import {
  activateClassPilot,
  classPilotState,
  startSchoolClass,
  startTeacherPilots,
} from "../src/schools/pilots.js";
import { ensureCleverDistrictPilot } from "../src/schools/institution-pilot.js";
import { studentMe } from "../src/schools/student-me.js";
import { readOverview } from "../src/schools/org-reads.js";
import { licenseView } from "../src/schools/roster.js";

/** Clever ids for district `n`: 24 hex digits, distinct per district. */
const id = (kind: number, n: number, i = 1) =>
  `${kind}${String(n).padStart(3, "0")}${String(i).padStart(20, "0")}`;
const roster = (n: number, extraSection = false): Snapshot => {
  const D = id(1, n),
    S = id(2, n),
    T = id(3, n, 1),
    U = id(3, n, 2),
    U2 = id(3, n, 3);
  return {
    district: { id: D, name: `District ${n}` },
    schools: [{ id: S, district: D, name: `School ${n}` }],
    users: [
      {
        id: T,
        district: D,
        name: { first: "Teacher" },
        roles: { teacher: { school: S, schools: [S] } },
      },
      {
        id: U,
        district: D,
        name: { first: "Student", last: "One" },
        roles: { student: { school: S, schools: [S], grade: "4" } },
      },
      ...(extraSection
        ? [
            {
              id: U2,
              district: D,
              name: { first: "Student", last: "Two" },
              roles: { student: { school: S, schools: [S], grade: "4" } },
            },
          ]
        : []),
    ],
    sections: [
      {
        id: id(4, n, 1),
        district: D,
        school: S,
        name: "Math 4",
        students: [U],
        teachers: [T],
        teacher: T,
      },
      // A section Clever shares after the district connected.
      ...(extraSection
        ? [
            {
              id: id(4, n, 2),
              district: D,
              school: S,
              name: "Math 4 Enrichment",
              students: [U2],
              teachers: [T],
              teacher: T,
            },
          ]
        : []),
    ],
    courses: [],
    terms: [],
  };
};
const client = (snapshot: () => Snapshot) => ({
  districtToken: async () => "not-persisted",
  latestEvent: async () => null,
  snapshot: async () => snapshot(),
  events: async () => [],
});
const DAY = 86_400_000;

test(
  "a Clever district's connection starts one pilot that covers every class it shares",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `district_pilot_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    let db: Pool | undefined;
    try {
      await migrate(scoped.href);
      db = new Pool({ connectionString: scoped.href, max: 3 });
      const repo = new SchoolRepository(db);
      const district = async (name: string) => {
        const org = await repo.createOrg({
          kind: "district",
          name,
          timezone: "America/New_York",
        });
        await repo.recordDataAgreement(org.id, {
          version: AGREEMENT_VERSION,
          signerName: "Fixture Admin",
        });
        return org.id as string;
      };
      const count = async (sql: string, params: unknown[] = []) =>
        (await db!.query(sql, params)).rows[0].n as number;
      const pilotOf = async (orgId: string) =>
        (
          await db!.query(
            `SELECT t.id,t.started_at,t.ends_at,t.grace_ends_at FROM amp_org_pilots op
             JOIN amp_teacher_pilots t ON t.id=op.pilot_id WHERE op.org_id=$1`,
            [orgId],
          )
        ).rows[0] as
          | { id: string; started_at: Date; ends_at: Date; grace_ends_at: Date }
          | undefined;
      const student = async (n: number, i: number) => {
        const person = await resolveCleverPerson(db!, {
          environment: "sandbox",
          districtId: id(1, n),
          userId: id(3, n, i),
        });
        assert.ok(person?.learnerId, "the sync made the student's learner");
        return person as { personId: string; learnerId: string };
      };
      const classOf = async (n: number, i: number) =>
        (
          await db!.query(
            `SELECT local_id FROM amp_clever_bindings WHERE kind='section' AND clever_id=$1`,
            [id(4, n, i)],
          )
        ).rows[0].local_id as string;

      // District 1 connects the way a district admin does today.
      const orgId = await district("District 1");
      let source = roster(1);
      const connection = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: id(1, 1),
        tenantId: orgId,
      });
      const sync = () =>
        syncCleverConnection(
          db!,
          connection.id,
          client(() => source),
          {
            mode: "full",
          },
        );
      const started = (await pilotOf(orgId))!;

      await t.test(
        "connecting starts the pilot: 30 days, then the usual grace",
        () => {
          assert.ok(started, "the district has its pilot");
          assert.ok(
            Math.abs(started.started_at.getTime() - Date.now()) < 60_000,
          );
          assert.equal(
            started.ends_at.getTime() - started.started_at.getTime(),
            30 * DAY,
          );
          assert.equal(
            started.grace_ends_at.getTime() - started.started_at.getTime(),
            44 * DAY,
          );
        },
      );

      await t.test(
        "a freshly synced student practices with no teacher doing anything",
        async () => {
          await sync();
          const { personId, learnerId } = await student(1, 2);
          const classId = await classOf(1, 1);
          assert.equal(await classPracticeGate(db!, classId), null);
          assert.equal((await schoolPilotAccess(db!, learnerId)).active, true);
          const signedIn = await repo.issueStudentSession({
            personId,
            mode: "shared",
          });
          const me = await studentMe(db!, signedIn.token, true);
          assert.equal(me.signedIn && me.school?.practice, undefined);
          // The teacher's class screen reads the district's dates.
          const state = await classPilotState(db!, classId);
          assert.equal(state.status, "active");
          assert.equal(state.endsAt, started.ends_at.toISOString());
          // No teacher pilot was made or needed.
          assert.equal(
            await count("SELECT count(*)::int AS n FROM amp_class_pilots"),
            0,
          );
        },
      );

      await t.test(
        "the admin overview and the license show the pilot, not a missing license",
        async () => {
          const overview = await readOverview(db!, orgId, null, true);
          assert.deepEqual(overview.seats.pilot, {
            endsAt: started.ends_at.toISOString(),
            graceEndsAt: started.grace_ends_at.toISOString(),
          });
          assert.equal(overview.seats.waiting, 0);
          const ids = overview.attention.map((item) => item.id);
          assert.ok(!ids.includes("no-license"), ids.join());
          assert.ok(!ids.includes("seats"), ids.join());
          const license = await licenseView(repo, orgId);
          assert.equal(license.waiting, 0);
          assert.equal(license.pilot?.endsAt, started.ends_at.toISOString());
        },
      );

      await t.test("reconnecting never restarts or extends it", async () => {
        // Ten days in, the district connects again.
        await db!.query(
          `UPDATE amp_teacher_pilots SET started_at=started_at-interval '10 days',
             ends_at=ends_at-interval '10 days',grace_ends_at=grace_ends_at-interval '10 days' WHERE id=$1`,
          [started.id],
        );
        const before = (await pilotOf(orgId))!;
        await registerCleverConnection(db!, {
          environment: "sandbox",
          districtId: id(1, 1),
          tenantId: orgId,
        });
        assert.deepEqual(await pilotOf(orgId), before);
        assert.equal(
          await ensureCleverDistrictPilot(db!, { connectionId: connection.id }),
          null,
        );
        assert.deepEqual(await pilotOf(orgId), before);
        assert.equal(
          await count("SELECT count(*)::int AS n FROM amp_teacher_pilots"),
          1,
        );
      });

      await t.test(
        "a section shared in a later sync is covered at once",
        async () => {
          source = roster(1, true);
          await sync();
          const late = await classOf(1, 2);
          const { learnerId } = await student(1, 3);
          assert.equal(await classPracticeGate(db!, late), null);
          assert.equal((await schoolPilotAccess(db!, learnerId)).active, true);
          assert.equal((await classPilotState(db!, late)).status, "active");
        },
      );

      await t.test(
        "a teacher's own class in the district runs on the district's pilot, never their own",
        async () => {
          const teacher = "fixture-clever-teacher";
          const { personId } = (await resolveCleverPerson(db!, {
            environment: "sandbox",
            districtId: id(1, 1),
            userId: id(3, 1, 1),
          }))!;
          await db!.query("UPDATE amp_people SET account_id=$2 WHERE id=$1", [
            personId,
            teacher,
          ]);
          assert.deepEqual(await startTeacherPilots(repo, teacher), {
            started: 0,
          });
          const school = (
            await db!.query(
              "SELECT id FROM amp_orgs WHERE parent_id=$1 AND kind='school'",
              [orgId],
            )
          ).rows[0].id as string;
          const manual = await startSchoolClass(repo, teacher, {
            requestId: randomUUID(),
            orgId: school,
            schoolName: "School 1",
            className: "Math club",
            timezone: "America/New_York",
            signerName: "Teacher Example",
            agreementVersion: AGREEMENT_VERSION,
            authorized: true,
            names: ["Manual Student"],
            gradeLevel: 4,
          });
          assert.equal(await classPracticeGate(db!, manual.classId), null);
          const pupil = (
            await db!.query(
              `SELECT p.learner_id FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
               WHERE e.class_id=$1 AND e.role='student'`,
              [manual.classId],
            )
          ).rows[0].learner_id as string;
          assert.equal((await schoolPilotAccess(db!, pupil)).active, true);
          const state = await activateClassPilot(repo, teacher, manual.classId);
          assert.equal(state.status, "active");
          assert.equal(
            state.endsAt,
            (await pilotOf(orgId))!.ends_at.toISOString(),
          );
          assert.equal(
            await count("SELECT count(*)::int AS n FROM amp_teacher_pilots"),
            1,
          );
        },
      );

      await t.test(
        "after the pilot and its grace, the existing paywall applies",
        async () => {
          const classId = await classOf(1, 1);
          const { personId } = await student(1, 2);
          const signedIn = await repo.issueStudentSession({
            personId,
            mode: "shared",
          });
          // In grace: still practicing, the class says so.
          await db!.query(
            `UPDATE amp_teacher_pilots SET started_at=now()-interval '35 days',
               ends_at=now()-interval '5 days',grace_ends_at=now()+interval '9 days' WHERE id=$1`,
            [started.id],
          );
          assert.equal((await classPilotState(db!, classId)).status, "grace");
          assert.equal(await classPracticeGate(db!, classId), null);
          // Over: practice ends, and no teacher can start a fresh trial.
          await db!.query(
            `UPDATE amp_teacher_pilots SET started_at=now()-interval '50 days',
               ends_at=now()-interval '20 days',grace_ends_at=now()-interval '6 days' WHERE id=$1`,
            [started.id],
          );
          assert.equal((await classPilotState(db!, classId)).status, "expired");
          assert.equal(await classPracticeGate(db!, classId), "ended");
          const me = await studentMe(db!, signedIn.token, true);
          assert.equal(me.signedIn && me.school?.practice, "ended");
          const again = await activateClassPilot(
            repo,
            "fixture-clever-teacher",
            classId,
          );
          assert.equal(again.status, "expired");
          assert.equal(
            await count("SELECT count(*)::int AS n FROM amp_teacher_pilots"),
            1,
          );
          // The overview is back to asking for a license and seats.
          const overview = await readOverview(db!, orgId, null, true);
          assert.equal(overview.seats.pilot, null);
          const ids = overview.attention.map((item) => item.id);
          assert.ok(ids.includes("no-license"), ids.join());
          assert.ok(ids.includes("seats"), ids.join());
          assert.equal((await licenseView(repo, orgId)).pilot, null);
        },
      );

      await t.test(
        "deleting the district and connecting it again finds the same, spent pilot",
        async () => {
          await repo.transaction((tx) =>
            removeOrgTree(tx, {
              orgId,
              confirm: "District 1",
              commit: true,
              allowLicensed: false,
            }),
          );
          const again = await district("District 1");
          await registerCleverConnection(db!, {
            environment: "sandbox",
            districtId: id(1, 1),
            tenantId: again,
          });
          assert.equal((await pilotOf(again))?.id, started.id);
          assert.equal(
            await count("SELECT count(*)::int AS n FROM amp_teacher_pilots"),
            1,
          );
        },
      );

      await t.test(
        "a district connected before pilots started by themselves gets one on its next sync, dated then",
        async () => {
          const before = await district("District 2");
          // The connection as earlier code made it: no pilot.
          const earlier = randomUUID();
          await db!.query(
            "INSERT INTO amp_clever_connections(id,environment,district_id,tenant_id) VALUES($1,'sandbox',$2,$3)",
            [earlier, id(1, 2), before],
          );
          assert.equal(await pilotOf(before), undefined);
          await syncCleverConnection(
            db!,
            earlier,
            client(() => roster(2)),
            {
              mode: "full",
            },
          );
          const pilot = (await pilotOf(before))!;
          assert.ok(Math.abs(pilot.started_at.getTime() - Date.now()) < 60_000);
          const { learnerId } = await student(2, 2);
          assert.equal((await schoolPilotAccess(db!, learnerId)).active, true);
          // A second sync changes nothing.
          await syncCleverConnection(
            db!,
            earlier,
            client(() => roster(2)),
            {
              mode: "full",
            },
          );
          assert.deepEqual(await pilotOf(before), pilot);
        },
      );

      await t.test("…or on its people's next Clever sign-in", async () => {
        const before = await district("District 3");
        await db!.query(
          "INSERT INTO amp_clever_connections(id,environment,district_id,tenant_id) VALUES($1,'sandbox',$2,$3)",
          [randomUUID(), id(1, 3), before],
        );
        const signIn = {
          environment: "sandbox" as const,
          districtId: id(1, 3),
        };
        const pilot = await ensureCleverDistrictPilot(db!, signIn);
        assert.equal((await pilotOf(before))?.id, pilot);
        assert.equal(await ensureCleverDistrictPilot(db!, signIn), null);
        // A district that never connected starts nothing.
        assert.equal(
          await ensureCleverDistrictPilot(db!, {
            environment: "sandbox",
            districtId: id(1, 9),
          }),
          null,
        );
      });
    } finally {
      await db?.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
