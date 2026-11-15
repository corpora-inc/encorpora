import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import {
  classPilotState,
  startSchool,
  startSchoolClass,
  startTeacherPilots,
  GRACE_DAYS,
  PILOT_DAYS,
} from "../src/schools/pilots.js";
import { classPracticeGate } from "../src/schools/pilot-access.js";

/** Founder ruling 2026-11-15: a teacher signs up, makes a class and runs a
 * free 30-day pilot (then 14 days of grace) with no operator, contract,
 * confirmed mailbox or Start button in the way. */
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
const DAY = 86_400_000;
const classInput = () => ({
  requestId: randomUUID(),
  schoolName: "Fixture School",
  className: "Math",
  timezone: "UTC",
  signerName: "Fixture Teacher",
  agreementVersion: AGREEMENT_VERSION,
  authorized: true as const,
});
async function fixture(
  run: (db: Pool, repo: SchoolRepository) => Promise<void>,
) {
  const url = new URL(process.env.AMP_TEST_DATABASE_URL!);
  assertTestDatabaseTarget(url.href);
  const admin = new Pool({ connectionString: url.href });
  const schema = `zero_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  url.searchParams.set("options", `-c search_path=${schema}`);
  await migrate(url.href);
  const db = new Pool({ connectionString: url.href });
  try {
    await run(db, new SchoolRepository(db));
  } finally {
    await db.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}
async function mailbox(db: Pool, email: string, verified: boolean) {
  const id = randomUUID();
  await db.query(
    'INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,$4,now(),now())',
    [id, "Fixture", email, verified],
  );
  return `amp|${id}`;
}

test(
  "a teacher with an unconfirmed mailbox and no title starts a class, and its pilot runs at once",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const teacher = await mailbox(db, "new.teacher@school.example", false);
      const created = await startSchoolClass(repo, teacher, classInput());
      const pilot = await classPilotState(db, created.classId, teacher);
      assert.equal(pilot.status, "active");
      assert.equal(
        Date.parse(pilot.endsAt!) - Date.parse(pilot.startedAt!),
        PILOT_DAYS * DAY,
      );
      assert.equal(
        Date.parse(pilot.graceEndsAt!) - Date.parse(pilot.endsAt!),
        GRACE_DAYS * DAY,
      );
      assert.equal(GRACE_DAYS, 14);
      assert.equal(
        (
          await db.query(
            "SELECT signer_name,signer_title FROM amp_class_authorizations WHERE class_id=$1",
            [created.classId],
          )
        ).rows[0].signer_title,
        null,
      );
      // No students yet: the class waits for them, it hasn't "ended".
      assert.equal(await classPracticeGate(db, created.classId), "waiting");
      await repo.provisionStudent(created.orgId, {
        givenName: "Ada",
        classId: created.classId,
      });
      assert.equal(await classPracticeGate(db, created.classId), null);
      // A second class shares the same dates.
      const second = await startSchoolClass(repo, teacher, {
        ...classInput(),
        orgId: created.orgId,
        className: "Science",
      });
      assert.equal(
        (await classPilotState(db, second.classId)).endsAt,
        pilot.endsAt,
      );
      assert.equal(
        (await db.query("SELECT count(*)::int n FROM amp_teacher_pilots"))
          .rows[0].n,
        1,
      );
      // Grace, then the paywall.
      await db.query(
        "UPDATE amp_teacher_pilots SET started_at=now()-interval '35 days',ends_at=now()-interval '5 days',grace_ends_at=now()+interval '9 days'",
      );
      assert.equal(
        (await classPilotState(db, created.classId)).status,
        "grace",
      );
      assert.equal(await classPracticeGate(db, created.classId), null);
      await db.query(
        "UPDATE amp_teacher_pilots SET started_at=now()-interval '45 days',ends_at=now()-interval '15 days',grace_ends_at=now()-interval '1 day'",
      );
      assert.equal(
        (await classPilotState(db, created.classId)).status,
        "expired",
      );
      assert.equal(await classPracticeGate(db, created.classId), "ended");
    }),
);

test(
  "an unconfirmed mailbox can't restart a pilot, nor bind its confirmed owner to someone else's dates",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const first = await mailbox(db, "F.ixture+one@gmail.com", false);
      const a = await startSchoolClass(repo, first, classInput());
      await db.query(
        "UPDATE amp_teacher_pilots SET started_at=now()-interval '50 days',ends_at=now()-interval '20 days',grace_ends_at=now()-interval '6 days'",
      );
      // The same mailbox under a new, unconfirmed account: the old dates.
      const again = await mailbox(db, "fixture+two@googlemail.com", false);
      const b = await startSchoolClass(repo, again, classInput());
      assert.equal((await classPilotState(db, b.classId)).status, "expired");
      // Its confirmed owner was never bound by those claims: a pilot of
      // their own.
      const owner = await mailbox(db, "fixture@gmail.com", true);
      const c = await startSchoolClass(repo, owner, classInput());
      assert.equal((await classPilotState(db, c.classId)).status, "active");
      assert.notEqual(
        (await classPilotState(db, c.classId)).startedAt,
        (await classPilotState(db, a.classId)).startedAt,
      );
      // And from then on the mailbox's claim is the owner's: a later
      // unconfirmed alias shares the owner's dates.
      const later = await mailbox(db, "fix.ture+three@gmail.com", false);
      const d = await startSchoolClass(repo, later, classInput());
      assert.equal(
        (await classPilotState(db, d.classId)).startedAt,
        (await classPilotState(db, c.classId)).startedAt,
      );
    }),
);

test(
  "a school leader starts a school, makes a class, and its pilot starts with it",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const leader = await mailbox(db, "head@school.example", false);
      const request = {
        requestId: randomUUID(),
        schoolName: "Fixture Academy",
        timezone: "UTC",
        signerName: "Fixture Head",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
      };
      const [school, retried] = await Promise.all([
        startSchool(repo, leader, request),
        startSchool(repo, leader, request),
      ]);
      assert.deepEqual(retried, school);
      assert.equal(
        (await db.query("SELECT count(*)::int n FROM amp_orgs")).rows[0].n,
        1,
      );
      const agreement = (
        await db.query(
          "SELECT signer_name,signer_title,signer_account_id FROM amp_data_agreements WHERE org_id=$1",
          [school.orgId],
        )
      ).rows[0];
      assert.equal(agreement.signer_title, null);
      assert.equal(agreement.signer_account_id, leader);
      const app = Fastify();
      await registerSchoolRoutes(app, {
        pool: db,
        authenticate: async () => leader,
        services: {
          secret: "fixture-school-token-secret-long-enough",
          origin: "https://amp.example",
          mail: async () => {},
        },
      });
      try {
        const response = await app.inject({
          method: "POST",
          url: `/api/v1/school/orgs/${school.orgId}/classes`,
          payload: { name: "Grade 4" },
        });
        assert.equal(response.statusCode, 201);
        const klass = response.json().class as { id: string };
        assert.equal((await classPilotState(db, klass.id)).status, "active");
        // The school's agreement covers its students.
        await repo.provisionStudent(school.orgId, {
          givenName: "Bea",
          classId: klass.id,
        });
        assert.equal(await classPracticeGate(db, klass.id), null);
        // A negotiated license needs no pilot.
        await repo.issueLicense({
          orgId: school.orgId,
          seats: 10,
          endsAt: new Date(Date.now() + 365 * DAY).toISOString(),
          reference: "Fixture license",
        });
        const licensed = await app.inject({
          method: "POST",
          url: `/api/v1/school/orgs/${school.orgId}/classes`,
          payload: { name: "Licensed" },
        });
        assert.equal(licensed.statusCode, 201);
        assert.equal(
          (
            await db.query("SELECT 1 FROM amp_class_pilots WHERE class_id=$1", [
              licensed.json().class.id,
            ])
          ).rowCount,
          0,
        );
      } finally {
        await app.close();
      }
    }),
);

test(
  "a teacher's classes made without them (a roster sync) start their pilot when they sign in",
  enabled,
  () =>
    fixture(async (db, repo) => {
      const leader = await mailbox(db, "district@school.example", true);
      const school = await startSchool(repo, leader, {
        requestId: randomUUID(),
        schoolName: "Synced School",
        timezone: "UTC",
        signerName: "Fixture Admin",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
      });
      const synced = await repo.createClass(school.orgId, {
        name: "Section 1",
        gradingKind: "year",
      });
      const teacher = "fixture-synced-teacher";
      await repo.addStaff({
        orgId: school.orgId,
        givenName: "Synced",
        accountId: teacher,
        role: "teacher",
        classId: synced.id,
      });
      assert.equal((await classPilotState(db, synced.id)).status, "ready");
      assert.deepEqual(await startTeacherPilots(repo, teacher), {
        started: 1,
      });
      assert.equal((await classPilotState(db, synced.id)).status, "active");
      assert.equal(
        (
          await db.query(
            "SELECT t.account_id FROM amp_class_pilots cp JOIN amp_teacher_pilots t ON t.id=cp.pilot_id WHERE cp.class_id=$1",
            [synced.id],
          )
        ).rows[0].account_id,
        teacher,
      );
      // Again: nothing new.
      assert.deepEqual(await startTeacherPilots(repo, teacher), {
        started: 0,
      });
    }),
);
