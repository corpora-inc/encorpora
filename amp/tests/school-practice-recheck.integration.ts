import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { activateClassPilot, startSchoolClass } from "../src/schools/pilots.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/*
 * CP-3 r4 H1: a class's `recheckAt` is the EARLIEST moment anything that
 * decides its practice, or the reader's access to it, can change: a
 * pilot's end, its grace, an extension; a license; a seat's grant; any of
 * its students' enrollments (here or in a class whose pilot covers them)
 * or student roles, at midnight in their school's own time zone; and the
 * reader's own role. Each boundary is set alone as the earliest, and the
 * server's answer must name it exactly.
 */
test(
  "a class's recheck moment is the earliest boundary that can change it",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `recheck_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer ")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const teacher = "fixture-recheck-teacher";
    const start = (className: string, names: string[], orgId?: string) =>
      startSchoolClass(schools, teacher, {
        requestId: randomUUID(),
        schoolName: "Birchwood Elementary",
        ...(orgId ? { orgId } : {}),
        className,
        timezone: "UTC",
        signerName: "Rosa Lindqvist",
        signerTitle: "Teacher",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
        names,
      });
    const { orgId, classId } = await start("Grade 4 Math", [
      "Ana Brook",
      "Ben Cole",
    ]);
    await activateClassPilot(schools, teacher, classId);
    const year = async (account = teacher, klass = classId) => {
      const read = await app.inject({
        method: "GET",
        url: `/api/v1/school/classes/${klass}/year`,
        headers: { authorization: `Bearer ${account}` },
      });
      assert.equal(read.statusCode, 200, read.body);
      return read.json() as {
        practice: string;
        recheckAt: string | null;
        serverNow: string;
      };
    };
    const day = 864e5;
    const at = (ms: number) => new Date(ms).toISOString();
    const now = Date.now();
    // The pilot runs on: its grace ends in 20 days, the only boundary.
    const graceEnd = new Date(Math.floor((now + 20 * day) / 1000) * 1000);
    await db.query(
      "UPDATE amp_teacher_pilots SET started_at=now()-interval '10 days',ends_at=now()-interval '1 day',grace_ends_at=$1",
      [graceEnd],
    );
    // Enrollments and roles began in the past, with no end.
    await db.query(
      "UPDATE amp_enrollments SET begin_on=current_date-30 WHERE class_id=$1",
      [classId],
    );
    await db.query(
      "UPDATE amp_org_roles SET begin_on=current_date-30 WHERE org_id=$1",
      [orgId],
    );
    let read = await year();
    assert.equal(read.practice, "open");
    assert.equal(read.recheckAt, at(graceEnd.getTime()), "the grace end");
    assert.ok(Date.parse(read.serverNow) <= Date.now() + 1000);

    // An extension's own end is a boundary too, here the earliest.
    const pilotId = (
      await db.query("SELECT id FROM amp_teacher_pilots LIMIT 1")
    ).rows[0].id as string;
    const extension = new Date(Math.floor((now + 10 * day) / 1000) * 1000);
    await db.query(
      "INSERT INTO amp_pilot_extensions(id,pilot_id,until_at,reason,operator_reference) VALUES(gen_random_uuid(),$1,$2,'fixture','fixture')",
      [pilotId, extension],
    );
    read = await year();
    assert.equal(read.recheckAt, at(extension.getTime()), "the extension");

    const ana = (
      await db.query(
        "SELECT id FROM amp_people WHERE given_name='Ana' AND family_name='Brook'",
      )
    ).rows[0].id as string;
    // Ana's enrollment ends sooner, at midnight in the school's time zone.
    for (const zone of ["UTC", "America/New_York", "Pacific/Kiritimati"]) {
      await db.query("UPDATE amp_orgs SET timezone=$2 WHERE id=$1", [
        orgId,
        zone,
      ]);
      await db.query(
        "UPDATE amp_enrollments SET end_on=((now() AT TIME ZONE $3)::date+5) WHERE class_id=$1 AND person_id=$2",
        [classId, ana, zone],
      );
      const expected = (
        await db.query(
          "SELECT (((now() AT TIME ZONE $1)::date+5)::timestamp AT TIME ZONE $1) AS t",
          [zone],
        )
      ).rows[0].t as Date;
      read = await year();
      assert.equal(
        read.recheckAt,
        at(expected.getTime()),
        `Ana's enrollment end, at midnight in ${zone}`,
      );
    }
    await db.query("UPDATE amp_orgs SET timezone='UTC' WHERE id=$1", [orgId]);
    // Her student role ends sooner still.
    await db.query(
      "UPDATE amp_org_roles SET end_on=current_date+3 WHERE person_id=$1 AND role='student'",
      [ana],
    );
    read = await year();
    assert.equal(
      read.recheckAt,
      at(
        (
          await db.query(
            "SELECT ((now() AT TIME ZONE 'UTC')::date+3)::timestamp AT TIME ZONE 'UTC' AS t",
          )
        ).rows[0].t.getTime(),
      ),
      "Ana's student role end",
    );
    // A license that ends sooner than all of that.
    const licenseEnd = new Date(Math.floor((now + 2 * day) / 1000) * 1000);
    await schools.issueLicense({
      orgId,
      seats: 5,
      endsAt: licenseEnd.toISOString(),
    });
    read = await year();
    assert.equal(read.recheckAt, at(licenseEnd.getTime()), "the license end");
    // A seat's grant for Ben ending in a day.
    const ben = (
      await db.query(
        "SELECT learner_id FROM amp_people WHERE given_name='Ben' AND family_name='Cole'",
      )
    ).rows[0].learner_id as string;
    const grantEnd = new Date(Math.floor((now + day) / 1000) * 1000);
    await db.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,starts_at,ends_at,status)
       VALUES($1,$2,'stripe','fixture',now()-interval '1 day',$3,'active')`,
      [`fixture-grant-${randomUUID()}`, ben, grantEnd],
    );
    read = await year();
    assert.equal(read.recheckAt, at(grantEnd.getTime()), "Ben's grant end");
    // Ana is also in another class (its pilot can cover her), and that
    // enrollment ends at the next midnight.
    const other = await start("Math support", [], orgId);
    await db.query(
      `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on,end_on)
       VALUES(gen_random_uuid(),$1,$2,'student',current_date-1,current_date+1)`,
      [other.classId, ana],
    );
    read = await year();
    assert.equal(
      read.recheckAt,
      at(
        (
          await db.query(
            "SELECT ((now() AT TIME ZONE 'UTC')::date+1)::timestamp AT TIME ZONE 'UTC' AS t",
          )
        ).rows[0].t.getTime(),
      ),
      "her other class's enrollment end",
    );
    // A viewer whose own role ends at the next midnight: earlier for them
    // alone, once nothing of the class's ends that soon.
    const viewer = "fixture-recheck-viewer";
    await schools.addStaff({
      orgId,
      role: "viewer",
      givenName: "Theo",
      accountId: viewer,
    });
    await db.query(
      `UPDATE amp_org_roles SET begin_on=current_date-1,end_on=current_date+1
       WHERE role='viewer' AND person_id=(SELECT id FROM amp_people WHERE account_id=$1)`,
      [viewer],
    );
    await db.query(
      `UPDATE amp_enrollments SET end_on=current_date+2 WHERE class_id=$1 AND person_id=$2`,
      [other.classId, ana],
    );
    const viewerRead = await year(viewer);
    const teacherRead = await year();
    assert.ok(
      Date.parse(viewerRead.recheckAt!) < Date.parse(teacherRead.recheckAt!),
      "the reader's own role end is theirs alone",
    );
  },
);
